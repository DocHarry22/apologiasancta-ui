import Link from "next/link";
import ResearchDiscovery from "@/components/research/ResearchDiscovery";
import { ResearchLayout } from "@/components/research/ResearchLayout";
import KnowledgeSelector from "@/components/research/KnowledgeSelector";
import { AppIcon } from "@/components/native/AppIcon";
import { StudyArtwork } from "@/components/native/StudyUI";
import study from "@/components/native/StudyUI.module.css";
import styles from "@/components/research/ResearchUI.module.css";
import { GraphLink } from "@/components/research/GraphLink";
import { getResearchGraphUrl } from "@/lib/publicEnv";
import { fetchKnowledgeEngine } from "@/lib/server/knowledgeEngine";

export const metadata = {
  title: "Research Catholic Claims and Sources | Apologia Sancta",
  description: "Explore published Apologia Knowledge Engine topics, chronology, comparisons, debate routes, evidence, and argument relationships.",
};

export const revalidate = 60;

type KnowledgeTopic = {
  id: string;
  title: string;
  rootNodeId: string;
  summary?: string;
  featuredNodeIds?: string[];
  publishedRevisionId?: string;
};

async function getGraphStatus(graphUrl: string | null): Promise<"available" | "unknown"> {
  if (!graphUrl) return "unknown";
  try {
    const base = new URL(graphUrl);
    if (base.protocol !== "https:") return "unknown";
    const response = await fetch(new URL("/api/health", base), {
      signal: AbortSignal.timeout(2500),
      next: { revalidate: 60 },
    });
    if (!response.ok) return "unknown";
    const payload = await response.json() as { ok?: unknown; service?: unknown };
    return payload.ok === true && payload.service === "apologia-graph-api" ? "available" : "unknown";
  } catch {
    return "unknown";
  }
}

async function getKnowledgeTopics(): Promise<{ available: boolean; topics: KnowledgeTopic[] }> {
  try {
    const payload = await fetchKnowledgeEngine("/knowledge/topics", new URLSearchParams({ limit: "24" })) as { topics?: unknown };
    if (!Array.isArray(payload?.topics)) return { available: true, topics: [] };
    const topics = payload.topics.filter((value): value is KnowledgeTopic => {
      if (!value || typeof value !== "object") return false;
      const item = value as Record<string, unknown>;
      return typeof item.id === "string" && typeof item.title === "string" && typeof item.rootNodeId === "string";
    });
    return { available: true, topics };
  } catch {
    return { available: false, topics: [] };
  }
}

const fallbackPrompts = [
  { title: "Is Jesus truly God?", focus: "Christology", difficulty: "Foundation" },
  { title: "Where is the Trinity in Scripture?", focus: "Scripture & doctrine", difficulty: "Intermediate" },
  { title: "Did the early Church believe in the Eucharist?", focus: "Fathers & sacraments", difficulty: "Intermediate" },
  { title: "What authority did Christ give Peter?", focus: "Scripture & Church history", difficulty: "Advanced" },
];

function graphFocusUrl(graphUrl: string, nodeId?: string): string {
  const url = new URL("/graph", graphUrl);
  if (nodeId) url.searchParams.set("focus", nodeId);
  return url.toString();
}

export default async function ResearchPage() {
  const graphUrl = getResearchGraphUrl();
  const [graphStatus, knowledge] = await Promise.all([getGraphStatus(graphUrl), getKnowledgeTopics()]);

  return (
    <ResearchLayout current="constellations" eyebrow="Faith seeking understanding" title="Follow your questions." accent="Find understanding." description="Explore the claims, sources, and conversations that help you understand the faith more deeply." search={<form action="/research/compare" method="get" className={styles.searchCard} aria-label="Search research"><KnowledgeSelector label="Find a claim" name="left" /><button type="submit">Explore claim <AppIcon name="arrow" width={17} height={17} /></button></form>}>
      <section className={styles.section} aria-labelledby="guided-research-heading">
        <div className={styles.sectionHeader}><div><h2 id="guided-research-heading">Start with a question</h2><p>Follow a reviewed topic into its claims, connections, and sources.</p></div></div>
        {knowledge.topics.length ? <div className={styles.cards}>{knowledge.topics.map((topic, index) => <article key={topic.id} className={styles.topic}><StudyArtwork icon="book" tone={index} /><div><h3>{topic.title}</h3><p>{topic.summary || "Explore this published topic and the evidence behind it."}</p><div className={styles.topicLinks}><Link href={`/research/compare?left=${encodeURIComponent(topic.rootNodeId)}`}>Explore claim <AppIcon name="arrow" width={14} height={14} /></Link><Link href={`/research/timeline?topicId=${encodeURIComponent(topic.id)}`}>Timeline</Link>{graphUrl ? <GraphLink href={graphFocusUrl(graphUrl, topic.rootNodeId)}>Open in Graph <AppIcon name="arrow" width={14} height={14} /></GraphLink> : null}</div></div></article>)}</div> : <div className={study.empty}><AppIcon name="research" /><h3>{knowledge.available ? "More paths are being prepared." : "Research is taking a moment."}</h3><p>{knowledge.available ? "Reviewed topic journeys will appear here when published. You can search for a claim above." : "Topics are temporarily unavailable. You can still open the research tools or try again shortly."}</p></div>}
      </section>
      <ResearchDiscovery showJourneys={false} />
      {graphUrl ? <section className={styles.graph}><AppIcon name="research" width={27} height={27} /><h2>See how it all connects.</h2><p>Explore the same claims and sources in an interactive graph. Follow a connection and see where it leads.</p><Link href="/research/graph">Explore the 3D Galaxy <AppIcon name="arrow" width={17} height={17} /></Link><small>{graphStatus === "available" ? "Live Graph website · Available inside the app" : "Uses the live Graph website · An internet connection is needed"}</small></section> : null}
      <details id="standards" className={styles.standards}><summary>How to read the research</summary><p>Sources, claims, interpretations, and editorial assessments have different roles. These labels help you follow the evidence.</p><dl>{[["Claim", "The proposition being examined."], ["Evidence", "Textual, historical, linguistic, or doctrinal support."], ["Assessment", "How a tradition or scholarly perspective evaluates a claim."], ["Objection", "A serious challenge stated in its own terms."], ["Response", "An answer linked to a particular objection."], ["Provenance", "Who asserts a connection and which reviewed sources support it."]].map(([label, copy]) => <div key={label}><dt>{label}</dt><dd>{copy}</dd></div>)}</dl></details>
      {!knowledge.topics.length ? <details className={styles.standards}><summary>Questions to think about</summary><p>Suggested starting questions to explore as reviewed research becomes available.</p><dl>{fallbackPrompts.map((prompt) => <div key={prompt.title}><dt>{prompt.title}</dt><dd>{prompt.focus} · {prompt.difficulty}</dd></div>)}</dl></details> : null}
    </ResearchLayout>
  );
}
