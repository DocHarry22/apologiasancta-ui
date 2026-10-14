import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { claimJob, fail, finish, dashboard, getPack, listPacks } from "./repository";
import { closeLearningPoolForTests, learningQuery } from "@/lib/server/learning/database";
import { fixture, sources } from "@/lib/agent/testFixtures";
const url = process.env.AGENT_ACCEPTANCE_DATABASE_URL;
const suite = url ? describe : describe.skip;
suite("agent PostgreSQL acceptance", () => {
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (!["localhost", "127.0.0.1"].includes(parsed.hostname) || !/test|acceptance/.test(parsed.pathname) || !["postgres:", "postgresql:"].includes(parsed.protocol)) throw new Error("Agent acceptance requires a disposable local PostgreSQL test database");
    vi.stubEnv("LEARNING_DATABASE_URL", url!); vi.stubEnv("LEARNING_DB_SSL_MODE", "disable");
    await learningQuery(await readFile("scripts/sql/content-agent.sql", "utf8"));
  });
  beforeEach(async () => { await learningQuery("truncate apologia_agent.packs,apologia_agent.runs,apologia_agent.jobs"); });
  afterAll(async () => { await closeLearningPoolForTests(); vi.unstubAllEnvs(); });
  it("seeds ordered jobs, reserves only one active worker and enforces the daily cap", async () => {
    const first = await claimJob(1); expect(first?.topic).toBe("Revelation, Scripture and Sacred Tradition");
    expect(await claimJob(1)).toBeNull(); await fail(first!, {error:"fixture failure"}, []); expect(await claimJob(1)).toBeNull();
  });
  it("publishes atomically and returns only published packs", async () => {
    const job = (await claimJob(6))!;
    const id = await finish(job, fixture(), sources, {passed:true,issues:[],model:"fixture",reviewedAt:new Date().toISOString()}, {}, []);
    expect((await getPack(id))?.pack.quiz).toHaveLength(3); expect(await listPacks()).toHaveLength(1);
    const pack = await getPack(id); expect(pack?.sources[0]).not.toHaveProperty("text"); expect((await dashboard()).runs[0].status).toBe("completed");
  });
  it("rejects expired-worker publication and recovers the topic automatically", async () => {
    const first = (await claimJob(6))!; await learningQuery("update apologia_agent.jobs set lease_until=now()-interval '1 minute' where id=$1", [first.id]);
    const second = (await claimJob(6))!; expect(second.id).toBe(first.id); expect(second.leaseToken).not.toBe(first.leaseToken);
    await expect(finish(first,fixture(),sources,{passed:true,issues:[],model:"fixture",reviewedAt:"now"},{},[])).rejects.toThrow(/lease/);
    expect(await listPacks()).toHaveLength(0);
  });
  it("blocks repeatedly failed topics and continues to the next foundation", async () => {
    const first = (await claimJob(6))!; await learningQuery("update apologia_agent.jobs set attempts=3 where id=$1", [first.id]); await fail(first,{},[]);
    expect((await learningQuery("select status from apologia_agent.jobs where id=$1", [first.id])).rows[0].status).toBe("blocked");
    expect((await claimJob(6))?.topic).toBe("Faith and reason");
  });
  it("keeps provider-outage failures retryable without consuming content attempts", async () => {
    const job = (await claimJob(6))!; await fail(job,{error:"provider outage"},[],true);
    const row = (await learningQuery("select status,attempts from apologia_agent.jobs where id=$1",[job.id])).rows[0];
    expect(row.status).toBe("queued"); expect(row.attempts).toBe(0);
  });
  it("protects all private agent tables with RLS and revokes public schema access", async () => {
    expect((await learningQuery("select count(*)::int as count from pg_tables where schemaname='apologia_agent' and rowsecurity")).rows[0].count).toBe(3);
    expect((await learningQuery("select has_schema_privilege('public','apologia_agent','usage') as allowed")).rows[0].allowed).toBe(false);
  });
});
