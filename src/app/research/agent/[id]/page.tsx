import Link from "next/link";
import { notFound } from "next/navigation";
import AgentLesson from "@/components/agent/AgentLesson";
import { getPack } from "@/lib/server/agent/repository";
import { ResearchFrame, ResearchLayout } from "@/components/research/ResearchLayout";
import { ResearchModeNav } from "@/components/research/ResearchModeNav";
import styles from "@/components/research/ResearchUI.module.css";
export const dynamic = "force-dynamic";
export default async function AgentLessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let entry;
  try { entry = await getPack(id); } catch { return <ResearchLayout current="agent" title="Study temporarily unavailable" description="Please try again shortly."><Link className="btn-secondary" href="/research/agent">Back to study library</Link></ResearchLayout>; }
  if (!entry) notFound();
  return <ResearchFrame><ResearchModeNav current="agent" /><Link className="btn-quiet" href="/research/agent">← Study library</Link><div className={styles.lesson}><AgentLesson entry={entry} /></div></ResearchFrame>;
}
