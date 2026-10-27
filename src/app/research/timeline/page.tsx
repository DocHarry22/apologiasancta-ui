import { ReportIssue } from "@/components/content/ReportIssue";
import { ResearchLayout } from "@/components/research/ResearchLayout";
import KnowledgeSelector from "@/components/research/KnowledgeSelector";
import styles from "@/components/research/ResearchUI.module.css";
import SaveKnowledgeJourneyButton from "@/components/research/SaveKnowledgeJourneyButton";
import { StatusBadge } from "@/components/ui/Primitives";
import { GraphLink } from "@/components/research/GraphLink";
import { getResearchGraphUrl } from "@/lib/publicEnv";
import { fetchKnowledgeEngine } from "@/lib/server/knowledgeEngine";
import type { TimelineResponse as TimelinePayload } from "@/lib/knowledge/researchContract";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Timeline | Apologia Sancta Research",
  description: "Explore explicitly dated published events from the canonical Apologia Knowledge Engine.",
};

const CANONICAL_ID = /^[a-z][a-z0-9_-]*:[a-z0-9][a-z0-9._:-]*$/;
const SIMPLE = /^[a-z0-9_-]+$/;

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
      payload = await fetchKnowledgeEngine("/knowledge/timeline", params);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "Timeline is temporarily unavailable.";
    }
  }
  const entries = payload?.entries ?? [];
  const journeyNodeIds = [...new Set(entries.map((entry) => entry.node.id).filter((id) => CANONICAL_ID.test(id)))];
  const journeyRoot = CANONICAL_ID.test(nodeId) ? nodeId : journeyNodeIds[0] || "";
  const journeyTitle = domain
    ? `${domain[0]?.toUpperCase() || ""}${domain.slice(1)} timeline`
    : entries.length ? `Timeline: ${entries[0]?.node.title || "published events"}` : "Published timeline";

  return (
    <ResearchLayout current="timeline" eyebrow="Research · timeline" title="Trace the story." accent="See the connections." description="Follow the faith through published events and their recorded dates. Choose an area of study or a saved topic to begin.">

        <p className="mt-4 text-sm text-(--text-muted)">Undated records are excluded rather than assigned invented chronology.</p>
        <form method="get" className={styles.compareForm} aria-label="Timeline filters">
          <label className="text-sm font-semibold md:col-span-2">Area of study<input name="domain" defaultValue={domain} placeholder="e.g. christology" className="form-control mt-2 w-full" /></label>
          <label className="text-sm font-semibold">From year<input name="from" inputMode="numeric" defaultValue={from} placeholder="-100" className="mt-2 w-full rounded-lg border border-(--border) bg-(--surface-elevated) px-3 py-2 text-sm" /></label>
          <label className="text-sm font-semibold">To year<input name="to" inputMode="numeric" defaultValue={to} placeholder="2026" className="mt-2 w-full rounded-lg border border-(--border) bg-(--surface-elevated) px-3 py-2 text-sm" /></label>
          <details className="md:col-span-2" open={Boolean(nodeId || topicId)}><summary className="min-h-11 cursor-pointer text-sm font-semibold text-(--gold-hover)">More filters</summary><div className="mt-3 grid gap-4"><KnowledgeSelector label="Claim (optional)" name="nodeId" initialId={CANONICAL_ID.test(nodeId) ? nodeId : ""} required={false} /><label className="text-sm font-semibold">Topic reference<input name="topicId" defaultValue={topicId} placeholder="topic:..." className="form-control mt-2 w-full" /></label></div></details>
          <div className="md:col-span-2"><button className="btn-primary w-full" type="submit">Build timeline</button></div>
        </form>

        {!requested ? (
          <div className="surface-card mt-6 p-6"><StatusBadge>Choose an area to begin</StatusBadge><p className="mt-3 text-sm leading-6 text-(--text-muted)">Choose an area of study or a published topic. Only events with recorded dates appear in the timeline.</p></div>
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
                      <h2 className="editorial-heading mt-3 text-2xl font-semibold">{entry.node.title}</h2><ReportIssue app="research" contentType="claim" contentId={entry.node.id} title={entry.node.title} snapshot={entry.node} />
                      {entry.node.proposition ? <p className="mt-2 text-sm font-medium leading-6">{entry.node.proposition}</p> : null}
                      {entry.node.summary ? <p className="mt-2 text-sm leading-6 text-(--text-muted)">{entry.node.summary}</p> : null}
                      <div className="mt-4 flex flex-wrap gap-2"><code className="rounded bg-(--surface-elevated) px-2 py-1 text-xs">{entry.node.id}</code>{graphHref ? <GraphLink className="btn-quiet px-3 py-1.5" href={graphHref}>Open in Galaxy</GraphLink> : null}</div>
                    </article>
                  </li>
                );
              })}
            </ol>
          </section>
        )}
    </ResearchLayout>
  );
}
