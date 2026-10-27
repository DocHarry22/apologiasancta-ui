import Link from "next/link";
import { ResearchLayout } from "@/components/research/ResearchLayout";
import { listPacks } from "@/lib/server/agent/repository";
export const dynamic = "force-dynamic";
export const metadata = { title: "AI study library | Apologia Sancta" };
export default async function AgentLibraryPage() {
  let entries: Awaited<ReturnType<typeof listPacks>> = []; let unavailable = false;
  try { entries = await listPacks(); } catch { unavailable = true; }
  return <ResearchLayout current="agent" eyebrow="Research · AI studies" title="A new way to study." accent="Room to explore." description="Explore AI-generated study aids with lessons, objections, responses, quizzes, and evidence.">
    <p className="surface-card p-5 text-sm text-(--text-muted)">These AI-generated study aids pass automated checks; they have not received human or ecclesiastical approval.</p>
    {unavailable ? <p role="status" className="mt-6">The study library is temporarily unavailable.</p> : !entries.length ? <p className="mt-6">The agent has not published any lessons yet.</p> :
      <div className="mt-6 grid gap-4 sm:grid-cols-2">{entries.map(entry => <Link key={entry.id} href={`/research/agent/${entry.id}`} className="surface-card p-5 hover:border-(--gold)"><h2 className="editorial-heading text-2xl font-semibold">{entry.topic}</h2><p className="mt-2 text-sm text-(--text-secondary)">Lesson · Practice quiz · Evidence drawer</p></Link>)}</div>}
  </ResearchLayout>;
}
