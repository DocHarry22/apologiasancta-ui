import Link from "next/link";
import { notFound } from "next/navigation";
import AgentLesson from "@/components/agent/AgentLesson";
import { getPack } from "@/lib/server/agent/repository";
export const dynamic = "force-dynamic";
export default async function AgentLessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let entry;
  try { entry = await getPack(id); } catch { return <main className="p-8"><h1 className="text-xl font-bold">Study temporarily unavailable</h1><Link className="underline" href="/research/agent">Back to study library</Link></main>; }
  if (!entry) notFound();
  return <main><div className="mx-auto max-w-3xl px-4 pt-6"><Link className="text-(--accent) underline" href="/research/agent">← Study library</Link></div><AgentLesson entry={entry} /></main>;
}
