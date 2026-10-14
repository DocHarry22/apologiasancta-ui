import Link from "next/link";
import { ResearchModeNav } from "@/components/research/ResearchModeNav";
import { listPacks } from "@/lib/server/agent/repository";
export const dynamic = "force-dynamic";
export const metadata = { title: "AI study library | Apologia Sancta" };
export default async function AgentLibraryPage() {
  let entries: Awaited<ReturnType<typeof listPacks>> = []; let unavailable = false;
  try { entries = await listPacks(); } catch { unavailable = true; }
  return <main className="mx-auto max-w-5xl px-4 py-8 text-foreground"><ResearchModeNav current="agent" />
    <h1 className="mt-6 text-3xl font-bold">AI study library</h1><p className="mt-3 max-w-3xl leading-7">Explore Catholic lessons, objections, responses, quizzes and claim-level evidence. These AI-generated study aids pass automated checks; they have not received human or ecclesiastical approval.</p>
    {unavailable ? <p role="status" className="mt-6">The study library is temporarily unavailable.</p> : !entries.length ? <p className="mt-6">The agent has not published any lessons yet.</p> :
      <div className="mt-6 grid gap-4 sm:grid-cols-2">{entries.map(entry => <Link key={entry.id} href={`/research/agent/${entry.id}`} className="rounded-xl border border-(--border) bg-(--card) p-5 hover:border-(--accent)"><h2 className="text-lg font-semibold">{entry.topic}</h2><p className="mt-2 text-sm text-(--text-secondary)">Lesson · Practice quiz · Evidence drawer</p></Link>)}</div>}
  </main>;
}
