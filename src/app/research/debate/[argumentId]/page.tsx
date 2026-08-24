import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { ResearchModeNav } from "@/components/research/ResearchModeNav";
import SaveKnowledgeJourneyButton from "@/components/research/SaveKnowledgeJourneyButton";
import { StatusBadge } from "@/components/ui/Primitives";
import { getResearchGraphUrl } from "@/lib/publicEnv";
import { fetchKnowledgeEngine, KnowledgeEngineError } from "@/lib/server/knowledgeEngine";

export const dynamic = "force-dynamic";

const CANONICAL_ID = /^[a-z][a-z0-9_-]*:[a-z0-9][a-z0-9._:-]*$/;

type NodeView = { id: string; kind: string; title: string; proposition?: string; summary?: string };
type DebatePayload = {
  argument: {
    id: string;
    title: string;
    argumentType: string;
    conclusionNodeId: string;
    publishedRevisionId: string;
  };
  steps?: Array<{
    objection: NodeView;
    candidateResponses: Array<{
      edge: { id: string; relationshipType: string; fromNodeId: string; toNodeId: string };
      node: NodeView;
    }>;
  }>;
  canonicalNodeIds?: string[];
  scoringDisclosure?: string;
  meta?: { bounded?: boolean; unpublishedBranchesExcluded?: boolean };
};

function graphHref(nodeId: string): string | null {
  const base = getResearchGraphUrl();
  if (!base) return null;
  const url = new URL("/graph", base);
  url.searchParams.set("focus", nodeId);
  return url.toString();
}

export default async function DebateArgumentPage({ params }: { params: Promise<{ argumentId: string }> }) {
  const { argumentId: encoded } = await params;
  let argumentId = "";
  try {
    argumentId = decodeURIComponent(encoded);
  } catch {
    notFound();
  }
  if (!CANONICAL_ID.test(argumentId)) notFound();

  let payload: DebatePayload;
  try {
    payload = await fetchKnowledgeEngine(`/knowledge/debate/${encodeURIComponent(argumentId)}`) as DebatePayload;
  } catch (error) {
    if (error instanceof KnowledgeEngineError && error.status === 404) notFound();
    throw error;
  }

  const steps = Array.isArray(payload.steps) ? payload.steps : [];
  const journeyNodeIds = [...new Set([
    payload.argument.conclusionNodeId,
    ...(payload.canonicalNodeIds || []),
    ...steps.flatMap((step) => [step.objection.id, ...step.candidateResponses.map((candidate) => candidate.node.id)]),
  ].filter((id) => CANONICAL_ID.test(id)))].slice(0, 120);
  const journeyRoot = CANONICAL_ID.test(payload.argument.conclusionNodeId)
    ? payload.argument.conclusionNodeId
    : journeyNodeIds[0] || "";

  return (
    <AppShell>
      <div className="page-container py-8 sm:py-11">
        <div className="flex flex-col gap-5 border-b border-(--border) pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow">Research · debate traversal</p>
            <h1 className="editorial-heading mt-2 text-4xl font-semibold sm:text-5xl">{payload.argument.title}</h1>
            <div className="mt-3 flex flex-wrap gap-2"><StatusBadge tone="success">Published argument</StatusBadge><StatusBadge tone="info">{payload.argument.argumentType}</StatusBadge><StatusBadge>{steps.length} objection steps</StatusBadge></div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-(--text-muted)">{payload.scoringDisclosure || "This experience reports route completeness, not theological truth."}</p>
          </div>
          <ResearchModeNav current="debate" />
        </div>

        <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2"><Link href="/research/debate" className="btn-quiet px-3 py-2">Choose another argument</Link><code className="rounded bg-(--surface-elevated) px-3 py-2 text-xs">{payload.argument.id}</code></div>
          {journeyRoot ? <SaveKnowledgeJourneyButton title={`Debate: ${payload.argument.title}`} rootNodeId={journeyRoot} nodeIds={journeyNodeIds} metadata={{ mode: "debate", argumentId: payload.argument.id, argumentType: payload.argument.argumentType }} /> : null}
        </div>

        {steps.length === 0 ? (
          <div className="surface-card mt-7 p-6"><StatusBadge>No published objection branch</StatusBadge><p className="mt-3 text-sm leading-6 text-(--text-muted)">This published argument currently has no authored objection-role members with published response routes.</p></div>
        ) : (
          <ol className="mt-7 space-y-6" aria-label="Published debate steps">
            {steps.map((step, index) => {
              const objectionGraph = graphHref(step.objection.id);
              return (
                <li key={step.objection.id} className="surface-card overflow-hidden">
                  <div className="border-b border-(--border) bg-(--surface-elevated) p-5">
                    <div className="flex flex-wrap items-center gap-2"><StatusBadge tone="warning">Objection {index + 1}</StatusBadge><StatusBadge>{step.objection.kind}</StatusBadge></div>
                    <h2 className="editorial-heading mt-3 text-2xl font-semibold">{step.objection.title}</h2>
                    {step.objection.proposition ? <p className="mt-2 text-sm font-medium leading-6">{step.objection.proposition}</p> : null}
                    {step.objection.summary ? <p className="mt-2 text-sm leading-6 text-(--text-muted)">{step.objection.summary}</p> : null}
                    <div className="mt-3 flex flex-wrap gap-2"><code className="rounded bg-(--surface) px-2 py-1 text-xs">{step.objection.id}</code>{objectionGraph ? <a className="btn-quiet px-3 py-1.5" href={objectionGraph} target="_blank" rel="noopener noreferrer">Inspect objection in Galaxy ↗</a> : null}</div>
                  </div>

                  <div className="p-5">
                    <div className="flex items-center justify-between gap-3"><h3 className="editorial-heading text-xl font-semibold">Published candidate responses</h3><StatusBadge tone={step.candidateResponses.length ? "success" : "danger"}>{step.candidateResponses.length}</StatusBadge></div>
                    {step.candidateResponses.length ? (
                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        {step.candidateResponses.map(({ edge, node }) => {
                          const responseGraph = graphHref(node.id);
                          return (
                            <article key={`${edge.id}:${node.id}`} className="rounded-xl border border-(--border) bg-(--surface-elevated) p-4">
                              <div className="flex flex-wrap gap-2"><StatusBadge tone="success">{edge.relationshipType}</StatusBadge><StatusBadge>{node.kind}</StatusBadge></div>
                              <h4 className="editorial-heading mt-3 text-xl font-semibold">{node.title}</h4>
                              {node.proposition ? <p className="mt-2 text-sm font-medium leading-6">{node.proposition}</p> : null}
                              {node.summary ? <p className="mt-2 text-sm leading-6 text-(--text-muted)">{node.summary}</p> : null}
                              <div className="mt-3 flex flex-wrap gap-2"><code className="rounded bg-(--surface) px-2 py-1 text-xs">{node.id}</code>{responseGraph ? <a className="btn-quiet px-3 py-1.5" href={responseGraph} target="_blank" rel="noopener noreferrer">Inspect evidence path ↗</a> : null}</div>
                            </article>
                          );
                        })}
                      </div>
                    ) : <p className="mt-3 text-sm leading-6 text-(--text-muted)">No published <code>responds_to</code> route currently answers this objection. This is an editorial coverage gap, not a hidden answer.</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <aside className="surface-card mt-7 p-5" aria-label="Debate safety disclosure"><div className="flex flex-wrap gap-2"><StatusBadge tone="success">Published branches only</StatusBadge><StatusBadge>Bounded traversal</StatusBadge><StatusBadge>No truth score</StatusBadge></div><p className="mt-3 text-sm leading-6 text-(--text-muted)">Unpublished response branches are excluded server-side. Missing responses remain visible as coverage gaps so reviewers can improve the knowledge base without leaking draft material.</p></aside>
      </div>
    </AppShell>
  );
}
