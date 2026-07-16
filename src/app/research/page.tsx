import { AppShell } from "@/components/shell/AppShell";
import { SectionHeading, StatusBadge } from "@/components/ui/Primitives";
import { getResearchGraphUrl } from "@/lib/publicEnv";

export const metadata = {
  title: "Research Catholic Claims and Sources | Apologia Sancta",
  description: "Open the separate Apologia Graph research catalogue for Catholic topics and source references.",
};

export const revalidate = 60;

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

const values = [
  { icon: "◎", title: "Browse research records", copy: "Explore the Graph's current seed catalogue of theological topics and references." },
  { icon: "⇄", title: "See relationships", copy: "Use the workspace to inspect the connections its current records actually expose." },
  { icon: "✓", title: "Inspect references", copy: "Open supplied citations and evaluate them in their original context." },
  { icon: "◇", title: "Plan an argument", copy: "Use the catalogue as a starting point; complete claim-level workflows are still in development." },
];

const paths = [
  { title: "Is Jesus truly God?", focus: "Christology", difficulty: "Foundation" },
  { title: "Where is the Trinity in Scripture?", focus: "Scripture & doctrine", difficulty: "Intermediate" },
  { title: "Did the early Church believe in the Eucharist?", focus: "Fathers & sacraments", difficulty: "Intermediate" },
  { title: "What authority did Christ give Peter?", focus: "Scripture & Church history", difficulty: "Advanced" },
];

function ExternalGraphLink({ href, children, className = "btn-primary" }: { href: string; children: React.ReactNode; className?: string }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children} <span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span></a>;
}

export default async function ResearchPage() {
  const graphUrl = getResearchGraphUrl();
  const graphStatus = await getGraphStatus(graphUrl);
  return (
    <AppShell>
      <div className="page-container py-8 sm:py-11">
        <section className="grid gap-8 border-b border-(--border) pb-9 lg:grid-cols-[0.9fr_1.1fr] lg:items-center" aria-labelledby="research-heading">
          <div>
            <p className="eyebrow">Apologia Graph</p>
            <h1 id="research-heading" className="editorial-heading mt-2 max-w-3xl text-4xl font-semibold leading-[1.03] sm:text-5xl">See how the truths<br />of the Faith connect.</h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-(--text-muted)">Apologia Graph is a separate research workspace with a small seed catalogue of theological records and references. Complete claim-level verification paths and stable deep links are still in development.</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {graphUrl ? <ExternalGraphLink href={graphUrl}>Open Apologia Graph</ExternalGraphLink> : <span className="btn-primary cursor-not-allowed opacity-60">Graph URL unavailable</span>}
              <StatusBadge tone={graphStatus === "available" ? "success" : "neutral"}>{graphStatus === "available" ? "Graph available" : "Status unavailable"}</StatusBadge>
              <span className="text-sm text-(--text-muted)">Opens a separate application.</span>
            </div>
          </div>

          <div className="surface-card-elevated relative min-h-[22rem] overflow-hidden p-5" role="img" aria-label="Conceptual preview of a planned Trinity research relationship model">
            <span className="absolute left-4 top-4 z-10 rounded-full border border-(--border) bg-(--surface-elevated) px-3 py-1 text-xs font-bold text-(--text-muted)">Concept preview, not live Graph data</span>
            <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)", backgroundSize: "24px 24px" }} aria-hidden="true" />
            <svg className="absolute inset-0 h-full w-full text-(--gold) opacity-55" viewBox="0 0 600 360" fill="none" aria-hidden="true"><path d="M300 180 130 75m170 105L480 78M300 180 105 270m195-90 190 98m-190-98 5-125" stroke="currentColor" strokeWidth="1.5" /></svg>
            <div className="absolute left-1/2 top-1/2 grid h-28 w-28 -translate-x-1/2 -translate-y-1/2 place-content-center rounded-full border-2 border-(--gold) bg-(--navy) text-center text-white shadow-xl"><span className="text-2xl text-(--gold)" aria-hidden="true">△</span><strong className="mt-1 font-[family-name:var(--font-editorial)]">The Trinity</strong></div>
            {[{ label: "Scripture", pos: "left-[6%] top-[11%]" }, { label: "Council of Nicaea", pos: "right-[4%] top-[12%]" }, { label: "Church Fathers", pos: "bottom-[10%] left-[4%]" }, { label: "Catechism", pos: "bottom-[8%] right-[5%]" }, { label: "Christology", pos: "left-1/2 top-[2%] -translate-x-1/2" }].map((node) => <span key={node.label} className={`absolute ${node.pos} rounded-full border border-(--border) bg-(--surface-elevated) px-3 py-2 text-xs font-bold shadow-sm`}>{node.label}</span>)}
          </div>
        </section>

        <section className="mt-8" aria-labelledby="research-value-heading">
          <SectionHeading eyebrow="A disciplined research workflow" title="From assertion to accountable evidence" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{values.map((value) => <article key={value.title} className="surface-card p-5"><span className="grid h-11 w-11 place-items-center rounded-full border border-(--border) text-xl text-(--gold-hover)" aria-hidden="true">{value.icon}</span><h2 className="editorial-heading mt-4 text-xl font-semibold">{value.title}</h2><p className="mt-2 text-sm leading-6 text-(--text-muted)">{value.copy}</p></article>)}</div>
        </section>

        <section className="mt-9" aria-labelledby="guided-research-heading">
          <SectionHeading eyebrow="Research prompts" title="Start with a real apologetics question" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{paths.map((path, index) => <article key={path.title} className="surface-card grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 p-5 sm:grid-cols-[auto_minmax(0,1fr)_auto]"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-(--gold) font-[family-name:var(--font-editorial)] text-xl text-(--gold-hover)" aria-hidden="true">{index + 1}</span><div className="min-w-0"><h2 className="editorial-heading text-xl font-semibold">{path.title}</h2><div className="mt-2 flex flex-wrap gap-2"><StatusBadge tone="info">{path.focus}</StatusBadge><StatusBadge>{path.difficulty}</StatusBadge><span className="text-xs text-(--text-muted)">No stable path-specific totals or deep link are published yet.</span></div></div>{graphUrl ? <ExternalGraphLink href={graphUrl} className="btn-quiet col-span-2 w-full px-3 sm:col-span-1 sm:w-auto">Browse catalogue</ExternalGraphLink> : null}</article>)}</div>
        </section>

        <section id="standards" className="surface-card mt-9 scroll-mt-28 p-6 sm:p-8" aria-labelledby="standards-heading">
          <div className="grid gap-6 lg:grid-cols-[0.65fr_1.35fr] lg:items-start"><div><p className="eyebrow">Research standards</p><h2 id="standards-heading" className="editorial-heading mt-2 text-3xl font-semibold">Know what kind of statement you are reading.</h2><p className="mt-3 text-sm leading-6 text-(--text-muted)">These are the editorial distinctions Apologia Sancta expects as the catalogue matures; their presence is not implied for every current Graph record.</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[
            ["Claim", "The proposition being defended."], ["Evidence", "Textual, historical, or doctrinal support."], ["Interpretation", "The reasoning that connects evidence to a claim."], ["Objection", "A serious challenge stated charitably."], ["Response", "A focused answer to the actual objection."], ["Provenance", "Where the source came from and how it can be checked."],
          ].map(([title, copy]) => <div key={title} className="rounded-lg border border-(--border) bg-(--surface-elevated) p-4"><h3 className="font-bold text-(--gold-hover)">{title}</h3><p className="mt-1 text-sm leading-5 text-(--text-muted)">{copy}</p></div>)}</div></div>
        </section>
      </div>
    </AppShell>
  );
}
