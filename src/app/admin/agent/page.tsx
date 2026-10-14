import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { readSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { hasAnyPermission } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/server/currentUser";
import { isSessionFreshForUser } from "@/lib/server/sessionFreshness";
import { dashboard } from "@/lib/server/agent/repository";
import { agentConfiguration } from "@/lib/server/agent/runner";
export const dynamic = "force-dynamic";
export const metadata = { title: "Autonomous research agent | Apologia Sancta" };
export default async function AgentAdminPage() {
  const session = await readSessionCookie((await cookies()).get(SESSION_COOKIE_NAME)?.value);
  if (!session) redirect("/admin/login?next=/admin/agent");
  const user = await getCurrentUser(session.userId);
  if (!isSessionFreshForUser(session, user)) redirect("/admin/login?next=/admin/agent");
  if (user.accountType !== "staff" || !hasAnyPermission(user.role, ["learning:manage", "learning:audit"])) redirect("/admin");
  const config = agentConfiguration();
  let data: Awaited<ReturnType<typeof dashboard>> | null = null;
  try { data = await dashboard(); } catch { /* Render configuration help without exposing database errors. */ }
  const last = data?.runs[0];
  const heartbeat = last?.started_at ? new Date(String(last.started_at)) : null;
  const stale = config.enabled && config.configured && (!heartbeat || new Date(String(data?.today.server_time)).getTime() - heartbeat.getTime() > 26 * 3600_000);
  return <main className="mx-auto max-w-6xl p-6 text-foreground"><h1 className="text-3xl font-bold">Autonomous Catholic research agent</h1>
    <p className="mt-3 leading-7">Source → lesson → quiz → evidence checks → independent automated audit → AI study library. Routine work runs without approval prompts.</p>
    <div className="mt-6 grid gap-4 sm:grid-cols-3">
      <article className="rounded-xl border border-(--border) bg-(--card) p-4"><h2 className="font-semibold">Configuration</h2><p className="mt-2">{!config.enabled ? "Disabled" : config.configured && data ? "Ready for scheduled runs" : "Setup incomplete"}</p><p className="mt-2 text-sm">{config.dailyLimit} runs/day maximum · {config.model} · {config.provider === "codex" ? "Private Codex worker" : "OpenAI API"}</p></article>
      <article className="rounded-xl border border-(--border) bg-(--card) p-4"><h2 className="font-semibold">Last activity</h2><p className="mt-2">{heartbeat ? heartbeat.toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" }) : "No runs recorded"}</p><p className="mt-2 text-sm">{stale ? "No recent heartbeat: check the scheduler." : last ? String(last.status) : "Awaiting first run"}</p></article>
      <article className="rounded-xl border border-(--border) bg-(--card) p-4"><h2 className="font-semibold">Topic queue</h2>{data?.jobs.map(j => <p key={String(j.status)} className="mt-2">{String(j.status)}: {String(j.count)}</p>)}</article>
    </div>
    {config.provider === "codex" && <p className="mt-5 text-sm">Subscription mode: processing runs on a private machine signed in to Codex with ChatGPT. This website reads its reports; configuration readiness does not establish that the worker is authenticated or running.</p>}
    {!!config.missing.length && <p role="status" className="mt-5 rounded-xl border border-(--border) p-4">Deployment settings missing: {config.missing.join(", ")}. No credentials are displayed here.</p>}
    {!data && <p role="status" className="mt-5">Agent database unavailable. Install the private agent schema and verify the learning database connection.</p>}
    {data && <p className="mt-5 text-sm">Today: {String(data.today.runs)} runs · {String(data.today.completed)} published · {String(data.today.failed)} failed. Full activity is stored persistently; the latest 50 runs appear below.</p>}
    <section className="mt-8"><h2 className="text-2xl font-bold">Activity reports</h2><p className="mt-2 text-sm">Every run reports its topic, completed actions, source metadata, warnings, checks, failures, and model usage. Times below use South Africa time.</p>
      {!data?.runs.length && <p className="mt-4">No reports yet.</p>}
      {data?.runs.map(run => { const report = run.report as Record<string, unknown>; return <details key={String(run.id)} className="mt-4 rounded-xl border border-(--border) bg-(--card) p-4"><summary className="cursor-pointer font-semibold">{String(report.topic || "Recovered run")} · {String(run.status)} · {String(run.stage)}</summary>
        <p className="mt-3 text-sm">{new Date(String(run.started_at)).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })}</p>
        {Array.isArray(report.actions) && <ul className="mt-3 list-disc space-y-2 pl-5">{report.actions.map((a,i) => <li key={i}>{String(a)}</li>)}</ul>}
        {report.error ? <p className="mt-4 font-semibold">{String(report.error)}</p> : null}
        {report.nextAction ? <p className="mt-2">{String(report.nextAction)}</p> : null}
        {report.packId ? <Link href={`/research/agent/${String(report.packId)}`} className="mt-3 inline-block text-(--accent) underline">Open lesson and quiz</Link> : null}
        <details className="mt-4"><summary>Sources, warnings and usage</summary><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-(--border) p-3 text-xs">{JSON.stringify({ sources: report.sources, warnings: report.warnings, reviewIssues: report.reviewIssues, usage: run.usage }, null, 2)}</pre></details>
      </details>; })}
    </section><Link href="/research/agent" className="mt-6 inline-block text-(--accent) underline">Browse published AI studies →</Link>
  </main>;
}
