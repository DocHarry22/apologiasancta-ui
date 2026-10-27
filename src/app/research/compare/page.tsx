import { ReportIssue } from "@/components/content/ReportIssue";
import { ResearchLayout } from "@/components/research/ResearchLayout";
import SaveKnowledgeJourneyButton from "@/components/research/SaveKnowledgeJourneyButton";
import { StatusBadge } from "@/components/ui/Primitives";
import { getResearchGraphUrl } from "@/lib/publicEnv";
import { fetchKnowledgeEngine } from "@/lib/server/knowledgeEngine";
import type { ResearchNode as NodeView, CompareResponse as ComparePayload } from "@/lib/knowledge/researchContract";
import CompareClaimsForm from "@/components/research/CompareClaimsForm";
import ResearchDiscovery from "@/components/research/ResearchDiscovery";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Compare | Apologia Sancta Research",
  description: "Compare two published canonical propositions using stored relationships, assessments, shared neighbors, and bounded connecting paths.",
};

const CANONICAL_ID = /^[a-z][a-z0-9_-]*:[a-z0-9][a-z0-9._:-]*$/;
const SIMPLE = /^[a-z0-9_-]+$/;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function graphLink(nodeId: string): string | null {
  const base = getResearchGraphUrl();
  if (!base) return null;
  const url = new URL("/graph", base);
  url.searchParams.set("focus", nodeId);
  return url.toString();
}

function NodeCard({ node, label }: { node: NodeView; label: string }) {
  const href = graphLink(node.id);
  return (
    <article className="surface-card p-5">
      <div className="flex flex-wrap gap-2"><StatusBadge tone="info">{label}</StatusBadge><StatusBadge>{node.kind}</StatusBadge></div>
      <h2 className="editorial-heading mt-3 text-2xl font-semibold">{node.title}</h2><ReportIssue app="research" contentType="claim" contentId={node.id} title={node.title} snapshot={node} />
      {node.proposition ? <p className="mt-2 text-sm font-medium leading-6">{node.proposition}</p> : null}
      {node.summary ? <p className="mt-2 text-sm leading-6 text-(--text-muted)">{node.summary}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2"><code className="rounded bg-(--surface-elevated) px-2 py-1 text-xs">{node.id}</code>{href ? <a className="btn-quiet px-3 py-1.5" href={href} target="_blank" rel="noopener noreferrer">Open in Galaxy ↗</a> : null}</div>
    </article>
  );
}

export default async function ResearchComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const left = first(raw.left).trim();
  const right = first(raw.right).trim();
  const lens = first(raw.lens).trim().toLowerCase() || "catholic";
  const validLeft = CANONICAL_ID.test(left);
  const validRight = CANONICAL_ID.test(right);
  const validLens = SIMPLE.test(lens) && lens.length <= 80;

  let payload: ComparePayload | null = null;
  let error = "";
  if (validLeft && validRight && left !== right) {
    const params = new URLSearchParams({ left, right });
    if (validLens) params.set("lens", lens);
    try {
      payload = await fetchKnowledgeEngine("/knowledge/compare/advanced", params);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "Comparison is temporarily unavailable.";
    }
  }

  const direct = payload?.directEdges ?? [];
  const shared = payload?.sharedNeighbors ?? [];
  const semantic = payload?.semanticRelationships ?? [];
  const assessments = payload?.assessments ?? [];
  const comparisonJourneyIds = payload
    ? [...new Set([payload.left.id, ...(payload.connectingPath || []), payload.right.id].filter((id) => CANONICAL_ID.test(id)))]
    : [];

  return (
    <ResearchLayout current="compare" eyebrow="Research · compare" title="Two claims." accent="A clearer view." description="Look at two published claims side by side. Follow their connections, sources, and recorded perspectives.">

        <p className="mt-4 text-sm text-(--text-muted)">Only stored published relationships and approved assessments appear here.</p>
        <CompareClaimsForm key={`${left}:${right}:${lens}`} left={validLeft ? left : ""} right={validRight ? right : ""} leftTitle={payload?.left.title} rightTitle={payload?.right.title} lens={lens} />

        {(!left && !right) ? (
          <div className="surface-card mt-6 p-6"><StatusBadge>Choose two claims</StatusBadge><p className="mt-3 text-sm leading-6 text-(--text-muted)">Search by title or phrase, or open a suggested comparison below.</p></div>
        ) : left === right ? (
          <div className="surface-card mt-6 p-6"><StatusBadge tone="warning">Choose different claims</StatusBadge><p className="mt-3 text-sm text-(--text-muted)">Select a second claim to compare.</p></div>
        ) : (!validLeft || !validRight) ? (
          <div className="surface-card mt-6 p-6"><StatusBadge>Complete your comparison</StatusBadge><p className="mt-3 text-sm leading-6 text-(--text-muted)">Choose a published claim in each search field above.</p></div>
        ) : error ? (
          <div className="surface-card mt-6 p-6"><StatusBadge tone="danger">Comparison unavailable</StatusBadge><p className="mt-3 text-sm leading-6 text-(--text-muted)">{error}</p></div>
        ) : payload ? (
          <>
            <div className="mt-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div><StatusBadge tone="success">Published comparison</StatusBadge><p className="mt-2 text-sm text-(--text-muted)">Save the actual bounded canonical path; unrelated graph neighbors are not silently added.</p></div>
              <SaveKnowledgeJourneyButton title={`Compare: ${payload.left.title} ↔ ${payload.right.title}`} rootNodeId={payload.left.id} nodeIds={comparisonJourneyIds} lens={validLens ? lens : "catholic"} metadata={{ mode: "compare", left: payload.left.id, right: payload.right.id }} />
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-2"><NodeCard node={payload.left} label="Left" /><NodeCard node={payload.right} label="Right" /></div>

            <section className="mt-7 grid gap-5 xl:grid-cols-2" aria-label="Stored comparison relationships">
              <article className="surface-card p-5"><div className="flex items-center justify-between gap-3"><h2 className="editorial-heading text-2xl font-semibold">Direct relationships</h2><StatusBadge>{direct.length}</StatusBadge></div>{direct.length ? <ul className="mt-4 space-y-3">{direct.map((edge) => <li key={edge.id} className="rounded-lg border border-(--border) bg-(--surface-elevated) p-3 text-sm"><strong>{edge.relationshipType}</strong><div className="mt-1 break-all font-mono text-xs text-(--text-muted)">{edge.fromNodeId} → {edge.toNodeId}</div></li>)}</ul> : <p className="mt-3 text-sm text-(--text-muted)">No direct published edge connects these nodes.</p>}</article>
              <article className="surface-card p-5"><div className="flex items-center justify-between gap-3"><h2 className="editorial-heading text-2xl font-semibold">Shared context</h2><StatusBadge>{shared.length}</StatusBadge></div>{shared.length ? <ul className="mt-4 space-y-3">{shared.map((node) => <li key={node.id} className="rounded-lg border border-(--border) bg-(--surface-elevated) p-3"><strong>{node.title}</strong><ReportIssue app="research" contentType="claim" contentId={node.id} title={node.title} snapshot={node} /><div className="mt-1 break-all font-mono text-xs text-(--text-muted)">{node.id}</div></li>)}</ul> : <p className="mt-3 text-sm text-(--text-muted)">No bounded shared-neighbor set was found.</p>}</article>
            </section>

            <section className="mt-7 grid gap-5 xl:grid-cols-2" aria-label="Assessments and semantic relationships">
              <article className="surface-card p-5"><div className="flex items-center justify-between gap-3"><h2 className="editorial-heading text-2xl font-semibold">Approved assessments</h2><StatusBadge tone="info">{lens}</StatusBadge></div>{assessments.length ? <ul className="mt-4 space-y-3">{assessments.map((assessment) => <li key={assessment.id} className="rounded-lg border border-(--border) bg-(--surface-elevated) p-3 text-sm"><strong>{assessment.position}</strong><div className="mt-1 text-xs text-(--text-muted)">{assessment.lens} · {assessment.nodeId}</div></li>)}</ul> : <p className="mt-3 text-sm text-(--text-muted)">No approved assessment matched this lens.</p>}</article>
              <article className="surface-card p-5"><div className="flex items-center justify-between gap-3"><h2 className="editorial-heading text-2xl font-semibold">Semantic / historical links</h2><StatusBadge>{semantic.length}</StatusBadge></div>{semantic.length ? <ul className="mt-4 space-y-3">{semantic.map((edge) => <li key={edge.id} className="rounded-lg border border-(--border) bg-(--surface-elevated) p-3 text-sm"><strong>{edge.relationshipType}</strong><div className="mt-1 break-all font-mono text-xs text-(--text-muted)">{edge.fromNodeId} → {edge.toNodeId}</div></li>)}</ul> : <p className="mt-3 text-sm text-(--text-muted)">No stored definitional, interpretive, or historical relationship was returned.</p>}</article>
            </section>

            <article className="surface-card mt-7 p-5"><div className="flex flex-wrap items-center gap-2"><h2 className="editorial-heading mr-auto text-2xl font-semibold">Bounded connecting path</h2><StatusBadge tone="success">Stored relationships only</StatusBadge><StatusBadge>Maximum four hops</StatusBadge></div>{payload.connectingPath?.length ? <ol className="mt-4 flex flex-wrap items-center gap-2">{payload.connectingPath.map((id, index) => <li key={`${id}:${index}`} className="flex items-center gap-2"><code className="rounded bg-(--surface-elevated) px-2 py-1 text-xs">{id}</code>{index < (payload.connectingPath?.length || 0) - 1 ? <span aria-hidden="true">→</span> : null}</li>)}</ol> : <p className="mt-3 text-sm text-(--text-muted)">No connecting path was found inside the bounded published traversal.</p>}</article>
          </>
        ) : null}
        <ResearchDiscovery anchor={validLeft ? left : ""} lens={validLens ? lens : "catholic"} />
    </ResearchLayout>
  );
}
