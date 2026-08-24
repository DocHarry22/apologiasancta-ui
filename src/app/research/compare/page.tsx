import { AppShell } from "@/components/shell/AppShell";
import { ResearchModeNav } from "@/components/research/ResearchModeNav";
import { StatusBadge } from "@/components/ui/Primitives";
import { getResearchGraphUrl } from "@/lib/publicEnv";
import { fetchKnowledgeEngine } from "@/lib/server/knowledgeEngine";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Compare | Apologia Sancta Research",
  description: "Compare two published canonical propositions using stored relationships, assessments, shared neighbors, and bounded connecting paths.",
};

const CANONICAL_ID = /^[a-z][a-z0-9_-]*:[a-z0-9][a-z0-9._:-]*$/;
const SIMPLE = /^[a-z0-9_-]+$/;

type NodeView = { id: string; kind: string; title: string; proposition?: string; summary?: string };
type EdgeView = { id: string; fromNodeId: string; toNodeId: string; relationshipType: string };
type Assessment = { id: string; nodeId: string; lens: string; position: string; rationaleIds?: unknown[]; sourceIds?: unknown[] };
type ComparePayload = {
  left: NodeView;
  right: NodeView;
  directEdges?: EdgeView[];
  sharedNeighbors?: NodeView[];
  semanticRelationships?: EdgeView[];
  assessments?: Assessment[];
  connectingPath?: string[] | null;
  meta?: { storedRelationshipsOnly?: boolean; bounded?: boolean };
};

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
      <h2 className="editorial-heading mt-3 text-2xl font-semibold">{node.title}</h2>
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
  if (validLeft && validRight) {
    const params = new URLSearchParams({ left, right });
    if (validLens) params.set("lens", lens);
    try {
      payload = await fetchKnowledgeEngine("/knowledge/compare/advanced", params) as ComparePayload;
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "Comparison is temporarily unavailable.";
    }
  }

  const direct = payload?.directEdges || [];
  const shared = payload?.sharedNeighbors || [];
  const semantic = payload?.semanticRelationships || [];
  const assessments = payload?.assessments || [];

  return (
    <AppShell>
      <div className="page-container py-8 sm:py-11">
        <div className="flex flex-col gap-5 border-b border-(--border) pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow">Research · comparison</p>
            <h1 className="editorial-heading mt-2 text-4xl font-semibold sm:text-5xl">Compare canonical claims</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-(--text-muted)">Compare two published nodes without manufacturing agreement or contradiction. Only stored published relationships, approved assessments, shared neighbors, and a bounded connecting path are shown.</p>
          </div>
          <ResearchModeNav current="compare" />
        </div>

        <form method="get" className="surface-card mt-7 grid gap-4 p-5 lg:grid-cols-[1fr_1fr_0.6fr_auto] lg:items-end" aria-label="Canonical comparison form">
          <label className="text-sm font-semibold">Left canonical ID<input name="left" defaultValue={left} placeholder="node:..." className="mt-2 w-full rounded-lg border border-(--border) bg-(--surface-elevated) px-3 py-2 font-mono text-sm" /></label>
          <label className="text-sm font-semibold">Right canonical ID<input name="right" defaultValue={right} placeholder="node:..." className="mt-2 w-full rounded-lg border border-(--border) bg-(--surface-elevated) px-3 py-2 font-mono text-sm" /></label>
          <label className="text-sm font-semibold">Lens<input name="lens" defaultValue={lens} placeholder="catholic" className="mt-2 w-full rounded-lg border border-(--border) bg-(--surface-elevated) px-3 py-2 text-sm" /></label>
          <button type="submit" className="btn-primary h-fit">Compare</button>
        </form>

        {(!left && !right) ? (
          <div className="surface-card mt-6 p-6"><StatusBadge>Select two published nodes</StatusBadge><p className="mt-3 text-sm leading-6 text-(--text-muted)">Use canonical IDs from Research, Learn evidence links, or the Galaxy. The comparison endpoint refuses unpublished nodes.</p></div>
        ) : (!validLeft || !validRight) ? (
          <div className="surface-card mt-6 p-6"><StatusBadge tone="warning">Canonical IDs required</StatusBadge><p className="mt-3 text-sm leading-6 text-(--text-muted)">Both values must be canonical IDs such as <code>node:christology-example</code>.</p></div>
        ) : error ? (
          <div className="surface-card mt-6 p-6"><StatusBadge tone="danger">Comparison unavailable</StatusBadge><p className="mt-3 text-sm leading-6 text-(--text-muted)">{error}</p></div>
        ) : payload ? (
          <>
            <div className="mt-7 grid gap-5 lg:grid-cols-2"><NodeCard node={payload.left} label="Left" /><NodeCard node={payload.right} label="Right" /></div>

            <section className="mt-7 grid gap-5 xl:grid-cols-2" aria-label="Stored comparison relationships">
              <article className="surface-card p-5"><div className="flex items-center justify-between gap-3"><h2 className="editorial-heading text-2xl font-semibold">Direct relationships</h2><StatusBadge>{direct.length}</StatusBadge></div>{direct.length ? <ul className="mt-4 space-y-3">{direct.map((edge) => <li key={edge.id} className="rounded-lg border border-(--border) bg-(--surface-elevated) p-3 text-sm"><strong>{edge.relationshipType}</strong><div className="mt-1 break-all font-mono text-xs text-(--text-muted)">{edge.fromNodeId} → {edge.toNodeId}</div></li>)}</ul> : <p className="mt-3 text-sm text-(--text-muted)">No direct published edge connects these nodes.</p>}</article>
              <article className="surface-card p-5"><div className="flex items-center justify-between gap-3"><h2 className="editorial-heading text-2xl font-semibold">Shared context</h2><StatusBadge>{shared.length}</StatusBadge></div>{shared.length ? <ul className="mt-4 space-y-3">{shared.map((node) => <li key={node.id} className="rounded-lg border border-(--border) bg-(--surface-elevated) p-3"><strong>{node.title}</strong><div className="mt-1 break-all font-mono text-xs text-(--text-muted)">{node.id}</div></li>)}</ul> : <p className="mt-3 text-sm text-(--text-muted)">No bounded shared-neighbor set was found.</p>}</article>
            </section>

            <section className="mt-7 grid gap-5 xl:grid-cols-2" aria-label="Assessments and semantic relationships">
              <article className="surface-card p-5"><div className="flex items-center justify-between gap-3"><h2 className="editorial-heading text-2xl font-semibold">Approved assessments</h2><StatusBadge tone="info">{lens}</StatusBadge></div>{assessments.length ? <ul className="mt-4 space-y-3">{assessments.map((assessment) => <li key={assessment.id} className="rounded-lg border border-(--border) bg-(--surface-elevated) p-3 text-sm"><strong>{assessment.position}</strong><div className="mt-1 text-xs text-(--text-muted)">{assessment.lens} · {assessment.nodeId}</div></li>)}</ul> : <p className="mt-3 text-sm text-(--text-muted)">No approved assessment matched this lens.</p>}</article>
              <article className="surface-card p-5"><div className="flex items-center justify-between gap-3"><h2 className="editorial-heading text-2xl font-semibold">Semantic / historical links</h2><StatusBadge>{semantic.length}</StatusBadge></div>{semantic.length ? <ul className="mt-4 space-y-3">{semantic.map((edge) => <li key={edge.id} className="rounded-lg border border-(--border) bg-(--surface-elevated) p-3 text-sm"><strong>{edge.relationshipType}</strong><div className="mt-1 break-all font-mono text-xs text-(--text-muted)">{edge.fromNodeId} → {edge.toNodeId}</div></li>)}</ul> : <p className="mt-3 text-sm text-(--text-muted)">No stored definitional, interpretive, or historical relationship was returned.</p>}</article>
            </section>

            <article className="surface-card mt-7 p-5"><div className="flex flex-wrap items-center gap-2"><h2 className="editorial-heading mr-auto text-2xl font-semibold">Bounded connecting path</h2><StatusBadge tone="success">Stored relationships only</StatusBadge><StatusBadge>Maximum four hops</StatusBadge></div>{payload.connectingPath?.length ? <ol className="mt-4 flex flex-wrap items-center gap-2">{payload.connectingPath.map((id, index) => <li key={`${id}:${index}`} className="flex items-center gap-2"><code className="rounded bg-(--surface-elevated) px-2 py-1 text-xs">{id}</code>{index < (payload.connectingPath?.length || 0) - 1 ? <span aria-hidden="true">→</span> : null}</li>)}</ol> : <p className="mt-3 text-sm text-(--text-muted)">No connecting path was found inside the bounded published traversal.</p>}</article>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
