import { AppShell } from "@/components/shell/AppShell";
import { ResearchModeNav } from "@/components/research/ResearchModeNav";
import SaveKnowledgeJourneyButton from "@/components/research/SaveKnowledgeJourneyButton";
import { StatusBadge } from "@/components/ui/Primitives";
import { getResearchGraphUrl } from "@/lib/publicEnv";
import { fetchKnowledgeEngine } from "@/lib/server/knowledgeEngine";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Timeline | Apologia Sancta Research",
  description: "Explore explicitly dated published events from the canonical Apologia Knowledge Engine.",
};

const CANONICAL_ID = /^[a-z][a-z0-9_-]*:[a-z0-9][a-z0-9._:-]*$/;
const SIMPLE = /^[a-z0-9_-]+$/;

type TimelineEntry = {
  year: number;
  date?: string;
  node: {
    id: string;
    kind: string;
    title: string;
    proposition?: string;
    summary?: string;
  };
  provenanceIds?: string[];
};

type TimelinePayload = {
  entries?: TimelineEntry[];
  meta?: {
    bounded?: boolean;
    undatedRecordsExcluded?: boolean;
  };
};

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function graphUrlFor(nodeId: string): string | null {
  const base = getResearchGraphUrl();
  if (!base) return null;
  const url = new URL("/graph", base);
  url.searchParams.set("focus", nodeId);
  return url.toString();
}

export default async function ResearchTimelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const nodeId = first(raw.nodeId).trim();
  const topicId = first(raw.topicId).trim();
  const domain = first(raw.domain).trim().toLowerCase();
  const from = first(raw.from).trim();
  const to = first(raw.to).trim();

  const params = new URLSearchParams();
  if (CANONICAL_ID.test(nodeId)) params.set("nodeId", nodeId);
  if (CANONICAL_ID.test(topicId)) params.set("topicId", topicId);
  if (domain && SIMPLE.test(domain) && domain.length <= 80) params.set("domain", domain);
  if (/^-?\d{1,6}$/.test(from)) params.set("from", from);
  if (/^-?\d{1,6}$/.test(to)) params.set("to", to);
  params.set("limit", "150");

  const requested = params.has("nodeId") || params.has("topicId") || params.has("domain");
  let payload: TimelinePayload | null = null;
  let error = "";
  if (requested) {
    try {
      payload = await fetchKnowledgeEngine("/knowledge/timeline", params) as TimelinePayload;
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "Timeline is temporarily unavailable.";
    }
  }
  const entries = Array.isArray(payload?.entries) ? payload.entries : [];
  const journeyNodeIds = [...new Set(entries.map((entry) => entry.node.id).filter((id) => CANONICAL_ID.test(id)))];
  const journeyRoot = CANONICAL_ID.test(nodeId) ? nodeId : journeyNodeIds[0] || "";
  const journeyTitle = domain
    ? `${domain[0]?.toUpperCase() || ""}${domain.slice(1)} timeline`
    : entries.length ? `Timeline: ${entries[0]?.node.title || "published events"}` : "Published timeline";

  return (
    <AppShell>
      <div className="page-container py-8 sm:py-11">
        <div className="flex flex-col gap-5 border-b border-(--border) pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow">Research · chronology</p>
            <h1 className="editorial-heading mt-2 text-4xl font-semibold sm:text-5xl">Timeline</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-(--text-muted)">
              Follow explicitly dated, published canonical events. Undated records are excluded rather than assigned invented chronology.
            </p>
          </div>
          <ResearchModeNav current="timeline" />
        </div>

        <form method="get" className="surface-card mt-7 grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-5" aria-label="Timeline filters">
          <label className="text-sm font-semibold">Canonical node ID<input name="nodeId" defaultValue={nodeId} placeholder="node:..." className="mt-2 w-full rounded-lg border border-(--border) bg-(--surface-elevated) px-3 py-2 font-mono text-sm" /></label>
          <label className="text-sm font-semibold">Topic ID<input name="topicId" defaultValue={topicId} placeholder="topic:..." className="mt-2 w-full rounded-lg border border-(--border) bg-(--surface-elevated) px-3 py-2 font-mono text-sm" /></label>
          <label className="text-sm font-semibold">Domain<input name="domain" defaultValue={domain} placeholder="christology" className="mt-2 w-full rounded-lg border border-(--border) bg-(--surface-elevated) px-3 py-2 text-sm" /></label>
          <label className="text-sm font-semibold">From year<input name="from" inputMode="numeric" defaultValue={from} placeholder="-100" className="mt-2 w-full rounded-lg border border-(--border) bg-(--surface-elevated) px-3 py-2 text-sm" /></label>
          <label className="text-sm font-semibold">To year<input name="to" inputMode="numeric" defaultValue={to} placeholder="2026" className="mt-2 w-full rounded-lg border border-(--border) bg-(--surface-elevated) px-3 py-2 text-sm" /></label>
          <div className="md:col-span-2 xl:col-span-5"><button className="btn-primary" type="submit">Build timeline</button></div>
        </form>

        {!requested ? (
          <div className="surface-card mt-6 p-6"><StatusBadge>Choose a published scope</StatusBadge><p className="mt-3 text-sm leading-6 text-(--text-muted)">Enter a canonical node, topic, or domain. The server returns only published event nodes with explicit stored chronology.</p></div>
        ) : error ? (
          <div className="surface-card mt-6 p-6"><StatusBadge tone="danger">Timeline unavailable</StatusBadge><p className="mt-3 text-sm leading-6 text-(--text-muted)">{error}</p></div>
        ) : entries.length === 0 ? (
          <div className="surface-card mt-6 p-6"><StatusBadge>No dated published events</StatusBadge><p className="mt-3 text-sm leading-6 text-(--text-muted)">No explicitly dated published event nodes matched this scope. The timeline does not manufacture dates for undated material.</p></div>
        ) : (
          <section className="mt-7" aria-label="Published timeline entries">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2"><StatusBadge tone="success">{entries.length} published events</StatusBadge><StatusBadge>Undated records excluded</StatusBadge></div>
              {journeyRoot ? <SaveKnowledgeJourneyButton title={journeyTitle} rootNodeId={journeyRoot} nodeIds={journeyNodeIds} metadata={{ mode: "timeline", topicId: CANONICAL_ID.test(topicId) ? topicId : undefined, domain: domain || undefined, from: from || undefined, to: to || undefined }} /> : null}
            </div>
            <ol className="relative ml-3 border-l border-(--border) pl-7">
              {entries.map((entry) => {
                const graphHref = graphUrlFor(entry.node.id);
                return (
                  <li key={`${entry.node.id}:${entry.date || entry.year}`} className="relative mb-6 last:mb-0">
                    <span className="absolute -left-[2.15rem] top-2 h-3 w-3 rounded-full border-2 border-(--gold) bg-(--surface-elevated)" aria-hidden="true" />
                    <article className="surface-card p-5">
                      <div className="flex flex-wrap items-center gap-2"><StatusBadge tone="info">{entry.date || entry.year}</StatusBadge><StatusBadge>{entry.node.kind}</StatusBadge>{entry.provenanceIds?.length ? <StatusBadge tone="success">{entry.provenanceIds.length} provenance refs</StatusBadge> : null}</div>
                      <h2 className="editorial-heading mt-3 text-2xl font-semibold">{entry.node.title}</h2>
                      {entry.node.proposition ? <p className="mt-2 text-sm font-medium leading-6">{entry.node.proposition}</p> : null}
                      {entry.node.summary ? <p className="mt-2 text-sm leading-6 text-(--text-muted)">{entry.node.summary}</p> : null}
                      <div className="mt-4 flex flex-wrap gap-2"><code className="rounded bg-(--surface-elevated) px-2 py-1 text-xs">{entry.node.id}</code>{graphHref ? <a className="btn-quiet px-3 py-1.5" href={graphHref} target="_blank" rel="noopener noreferrer">Open in Galaxy ↗</a> : null}</div>
                    </article>
                  </li>
                );
              })}
            </ol>
          </section>
        )}
      </div>
    </AppShell>
  );
}
