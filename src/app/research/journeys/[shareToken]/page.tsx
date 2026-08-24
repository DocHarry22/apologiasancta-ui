import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { StatusBadge } from "@/components/ui/Primitives";
import { getResearchGraphUrl } from "@/lib/publicEnv";
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
  const galaxy = galaxyHref(journey.rootNodeId);

  return (
    <AppShell>
      <div className="page-container py-8 sm:py-11">
        <header className="max-w-4xl border-b border-(--border) pb-7">
          <p className="eyebrow">Shared canonical research journey</p>
          <h1 className="editorial-heading mt-2 text-4xl font-semibold sm:text-5xl">{journey.title}</h1>
          <div className="mt-4 flex flex-wrap gap-2"><StatusBadge tone="success">Shared by opaque link</StatusBadge><StatusBadge tone="info">{journey.lens}</StatusBadge><StatusBadge>{journey.nodeIds.length} canonical nodes</StatusBadge></div>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-(--text-muted)">This share view stores navigation identifiers only. The underlying claims, evidence, assessments, and relationships remain governed by the live Knowledge Engine and are not copied into the share record.</p>
          <div className="mt-5 flex flex-wrap gap-2">{galaxy ? <a className="btn-primary" href={galaxy} target="_blank" rel="noopener noreferrer">Open root in Galaxy ↗</a> : null}<a className="btn-secondary" href="/research">Research home</a></div>
        </header>

        <section className="mt-7" aria-labelledby="shared-path-heading">
          <h2 id="shared-path-heading" className="editorial-heading text-2xl font-semibold">Canonical path</h2>
          <ol className="mt-4 space-y-3">
            {journey.nodeIds.map((nodeId, index) => {
              const href = galaxyHref(nodeId);
              return <li key={`${nodeId}:${index}`} className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><span className="text-xs font-bold text-(--text-muted)">Step {index + 1}</span><code className="mt-1 block break-all text-sm text-(--gold-hover)">{nodeId}</code></div>{href ? <a className="btn-quiet shrink-0 px-3 py-2 text-sm" href={href} target="_blank" rel="noopener noreferrer">Inspect in Galaxy ↗</a> : null}</li>;
            })}
          </ol>
        </section>
      </div>
    </AppShell>
  );
}
