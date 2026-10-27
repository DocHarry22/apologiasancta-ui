import { notFound } from "next/navigation";
import { ResearchLayout } from "@/components/research/ResearchLayout";
import { StatusBadge } from "@/components/ui/Primitives";
import { GraphLink } from "@/components/research/GraphLink";
import { getResearchGraphUrl } from "@/lib/publicEnv";
import { graphJourneyHref, isGraphJourney } from "@/lib/graphJourneys";
import { getSharedKnowledgeJourney } from "@/lib/server/learning/knowledgeLearnerRepository";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Shared Research Journey | Apologia Sancta",
  description: "Open a shared canonical Apologia Sancta research journey.",
  robots: { index: false, follow: false },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SharedJourney = {
  id: string;
  title: string;
  rootNodeId: string;
  nodeIds: string[];
  lens: string;
  visibility: "unlisted" | "public";
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

function galaxyHref(nodeId: string) {
  const base = getResearchGraphUrl();
  if (!base) return null;
  try {
    const url = new URL("/graph", base);
    url.searchParams.set("focus", nodeId);
    return url.toString();
  } catch {
    return null;
  }
}

export default async function SharedJourneyPage({ params }: { params: Promise<{ shareToken: string }> }) {
  const { shareToken } = await params;
  if (!UUID.test(shareToken)) notFound();
  const raw = await getSharedKnowledgeJourney(shareToken);
  if (!raw) notFound();
  const journey = raw as unknown as SharedJourney;
  const galaxy = graphJourneyHref(getResearchGraphUrl(), journey);

  return (
    <ResearchLayout current="saved" eyebrow="A shared research journey" title={journey.title} description="Follow this path through its claims and sources. The research links open the current published content.">
          <p className="mt-4 text-sm text-(--text-muted)">Shared paths contain navigation identifiers only. Your private account data stays private.</p>
          <div className="mt-4 flex flex-wrap gap-2"><StatusBadge tone="success">Shared journey</StatusBadge><StatusBadge tone="info">{journey.lens}</StatusBadge><StatusBadge>{journey.nodeIds.length} steps</StatusBadge></div>
          <div className="mt-5 flex flex-wrap gap-2">{galaxy ? <GraphLink className="btn-primary" href={galaxy}>{isGraphJourney(journey) ? "Reopen in Graph" : "Open root in Galaxy"}</GraphLink> : null}<a className="btn-secondary" href="/research">Research home</a></div>

        <section className="mt-7" aria-labelledby="shared-path-heading">
          <h2 id="shared-path-heading" className="editorial-heading text-2xl font-semibold">Canonical path</h2>
          <ol className="mt-4 space-y-3">
            {journey.nodeIds.map((nodeId, index) => {
              const href = galaxyHref(nodeId);
              return <li key={`${nodeId}:${index}`} className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><span className="text-xs font-bold text-(--text-muted)">Step {index + 1}</span><code className="mt-1 block break-all text-sm text-(--gold-hover)">{nodeId}</code></div>{href ? <GraphLink className="btn-quiet shrink-0 px-3 py-2 text-sm" href={href}>Inspect in Galaxy</GraphLink> : null}</li>;
            })}
          </ol>
        </section>
    </ResearchLayout>
  );
}
