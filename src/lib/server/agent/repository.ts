import { randomUUID } from "node:crypto";
import { learningQuery, withLearningTransaction } from "@/lib/server/learning/database";
import { sourceMetadata, type Pack, type Source, type PublishedPack } from "@/lib/agent/contracts";
export const CURRICULUM = [
  ["creed", "Revelation, Scripture and Sacred Tradition"], ["creed", "Faith and reason"],
  ["creed", "The Trinity"], ["creed", "The Incarnation"], ["creed", "The Resurrection of Jesus"],
  ["creed", "The Church and apostolic succession"], ["creed", "Mary and the communion of saints"],
  ["sacraments", "Baptism"], ["sacraments", "Confirmation"], ["sacraments", "The Eucharist"],
  ["sacraments", "Reconciliation"], ["sacraments", "Anointing of the sick"], ["sacraments", "Holy Orders"], ["sacraments", "Marriage"],
  ["moral_life", "Human dignity and conscience"], ["moral_life", "Grace, justification and good works"], ["moral_life", "The Ten Commandments"],
  ["prayer", "Christian prayer"], ["prayer", "The Lord's Prayer"], ["prayer", "Prayer and intercession of saints"],
] as const;
export async function claimJob(dailyLimit: number) {
  return withLearningTransaction(async client => {
    // Transaction lock serialises daily reservations across workers, including crashes.
    await client.query("select pg_advisory_xact_lock(761482391)");
    for (const [priority, [pillar, topic]] of CURRICULUM.entries()) await client.query(
      "insert into apologia_agent.jobs(topic,pillar,priority) values($1,$2,$3) on conflict(topic) do nothing", [topic, pillar, priority]);
    const active = await client.query("select id from apologia_agent.jobs where status='running' and lease_until>now() limit 1");
    if (active.rowCount) return null;
    await client.query(`update apologia_agent.runs set status='failed',finished_at=now(),report=report || '{"error":"Worker lease expired; automatic recovery"}'::jsonb
      where status='running' and job_id in (select id from apologia_agent.jobs where status='running' and lease_until<=now())`);
    await client.query("update apologia_agent.jobs set status=case when attempts>=3 then 'blocked' else 'queued' end,lease_token=null,lease_until=null where status='running' and lease_until<=now()");
    // Refresh an existing topic after 30 days, rather than multiplying duplicates forever.
    await client.query(`update apologia_agent.jobs j set status='queued',attempts=0,priority=500
      where status='completed' and exists(select 1 from apologia_agent.packs p where p.job_id=j.id and p.created_at<now()-interval '30 days')`);
    const count = await client.query<{ count: number }>("select count(*)::int as count from apologia_agent.runs where started_at >= (date_trunc('day',now() at time zone 'Africa/Johannesburg') at time zone 'Africa/Johannesburg')");
    if (count.rows[0].count >= dailyLimit) return null;
    const leaseToken = randomUUID();
    const job = await client.query<{ id: string; topic: string; pillar: string }>(`update apologia_agent.jobs set status='running',attempts=attempts+1,lease_until=now()+interval '15 minutes',lease_token=$1
      where id=(select id from apologia_agent.jobs where status='queued' and available_at<=now() order by priority,created_at for update skip locked limit 1) returning id,topic,pillar`, [leaseToken]);
    if (!job.rows[0]) return null;
    const run = await client.query<{ id: string }>("insert into apologia_agent.runs(job_id) values($1) returning id", [job.rows[0].id]);
    return { ...job.rows[0], leaseToken, runId: run.rows[0].id };
  });
}
export async function stage(runId: string, name: string, report: Record<string, unknown>, usage: unknown[]) {
  await learningQuery("update apologia_agent.runs set stage=$2,report=$3::jsonb,usage=$4::jsonb where id=$1 and status='running'", [runId, name, JSON.stringify(report), JSON.stringify(usage)]);
}
export async function finish(job: NonNullable<Awaited<ReturnType<typeof claimJob>>>, pack: Pack, sources: Source[], review: PublishedPack["review"], report: Record<string, unknown>, usage: unknown[]) {
  return withLearningTransaction(async client => {
    const owner = await client.query("select id from apologia_agent.jobs where id=$1 and lease_token=$2 and status='running' and lease_until>now() for update", [job.id, job.leaseToken]);
    if (!owner.rowCount) throw new Error("Agent job lease lost");
    const metadata = sources.map(sourceMetadata);
    const result = await client.query<{ id: string }>(`insert into apologia_agent.packs(job_id,topic,pack,sources,review,published) values($1,$2,$3::jsonb,$4::jsonb,$5::jsonb,true)
      on conflict(job_id) do update set pack=excluded.pack,sources=excluded.sources,review=excluded.review,published=true,created_at=now() returning id`,
      [job.id, job.topic, JSON.stringify(pack), JSON.stringify(metadata), JSON.stringify(review)]);
    // Fresh topics go behind the foundational curriculum. Case-insensitive deduplication.
    for (const topic of pack.nextTopics) await client.query(`insert into apologia_agent.jobs(topic,pillar,priority)
      select $1,$2,100 where not exists(select 1 from apologia_agent.jobs where lower(topic)=lower($1)) and (select count(*) from apologia_agent.jobs where status='queued')<200 on conflict(topic) do nothing`, [topic, job.pillar]);
    await client.query("update apologia_agent.jobs set status='completed',lease_until=null,lease_token=null where id=$1", [job.id]);
    await client.query("update apologia_agent.runs set status='completed',stage='published',finished_at=now(),report=$2::jsonb,usage=$3::jsonb where id=$1", [job.runId, JSON.stringify({ ...report, packId: result.rows[0].id }), JSON.stringify(usage)]);
    return result.rows[0].id;
  });
}
export async function fail(job: NonNullable<Awaited<ReturnType<typeof claimJob>>>, report: Record<string, unknown>, usage: unknown[], infrastructure = false) {
  await withLearningTransaction(async client => {
    const owner = await client.query("select id from apologia_agent.jobs where id=$1 and lease_token=$2 and status='running' for update", [job.id, job.leaseToken]);
    if (!owner.rowCount) return;
    await client.query("update apologia_agent.jobs set status=case when $2 then 'queued' when attempts>=3 then 'blocked' else 'queued' end,attempts=case when $2 then greatest(attempts-1,0) else attempts end,available_at=now()+interval '2 hours',lease_until=null,lease_token=null where id=$1", [job.id, infrastructure]);
    await client.query("update apologia_agent.runs set status='failed',finished_at=now(),report=$2::jsonb,usage=$3::jsonb where id=$1", [job.runId, JSON.stringify(report), JSON.stringify(usage)]);
  });
}
export async function dashboard() {
  const [jobs, runs, packs] = await Promise.all([
    learningQuery("select status,count(*)::int as count from apologia_agent.jobs group by status"),
    learningQuery("select id,job_id,started_at,finished_at,status,stage,report,usage from apologia_agent.runs order by started_at desc limit 50"),
    learningQuery("select id,topic,created_at from apologia_agent.packs where published order by created_at desc limit 50"),
  ]);
  const activity = await learningQuery("select now() as server_time, count(*)::int as runs, count(*) filter(where status='completed')::int as completed, count(*) filter(where status='failed')::int as failed from apologia_agent.runs where started_at >= (date_trunc('day',now() at time zone 'Africa/Johannesburg') at time zone 'Africa/Johannesburg')");
  return { jobs: jobs.rows, runs: runs.rows, packs: packs.rows, today: activity.rows[0] };
}
export async function listPacks(): Promise<{ id: string; topic: string; created_at: string }[]> {
  return (await learningQuery<{ id: string; topic: string; created_at: string }>("select id,topic,created_at from apologia_agent.packs where published order by created_at desc limit 100")).rows;
}
export async function getPack(id: string): Promise<PublishedPack | null> {
  if (!/^[a-f0-9-]{36}$/i.test(id)) return null;
  return (await learningQuery<PublishedPack>("select id,topic,created_at,pack,sources,review from apologia_agent.packs where id=$1 and published", [id])).rows[0] || null;
}
