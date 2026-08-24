import { AppShell } from "@/components/shell/AppShell";
import { SectionHeading, StatusBadge } from "@/components/ui/Primitives";
import { getResearchGraphUrl } from "@/lib/publicEnv";
import { fetchKnowledgeEngine } from "@/lib/server/knowledgeEngine";

export const metadata = {
  title: "Research Catholic Claims and Sources | Apologia Sancta",
  description: "Explore published Apologia Knowledge Engine topics, evidence and argument relationships in Apologia Graph.",
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

const values = [
  { icon: "◎", title: "Trace canonical claims", copy: "Follow one published proposition through objections, responses, evidence, definitions and related doctrines." },
  { icon: "⇄", title: "Compare perspectives", copy: "Inspect Catholic and other recorded assessments without replacing the proposition or primary evidence." },
  { icon: "✓", title: "Inspect provenance", copy: "See why a relationship exists, who asserts it, which evidence supports it and what review state it carries." },
  { icon: "◇", title: "Build reusable paths", copy: "Move from a research question into guided, evidence-first, study and debate journeys over the same canonical knowledge." },
];

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

function ExternalGraphLink({ href, children, className = "btn-primary" }: { href: string; children: React.ReactNode; className?: string }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children} <span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span></a>;
}

export default async function ResearchPage() {
  const graphUrl = getResearchGraphUrl();
  const [graphStatus, knowledge] = await Promise.all([getGraphStatus(graphUrl), getKnowledgeTopics()]);

  return (
    <AppShell>
      <div className="page-container py-8 sm:py-11">
        <section className="grid gap-8 border-b border-(--border) pb-9 lg:grid-cols-[0.9fr_1.1fr] lg:items-center" aria-labelledby="research-heading">
          <div>
            <p className="eyebrow">Apologia Knowledge Engine</p>
            <h1 id="research-heading" className="editorial-heading mt-2 max-w-3xl text-4xl font-semibold leading-[1.03] sm:text-5xl">See how the truths of the Faith connect.<br />Every question has an argument universe.</h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-(--text-muted)">Research, evidence, learning and debate now share one canonical model. Follow a published proposition into its sources, objections, responses and recorded perspectives, then open the same context in the 3D Galaxy.</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {graphUrl ? <ExternalGraphLink href={graphFocusUrl(graphUrl)}>Open Apologia Graph</ExternalGraphLink> : <span className="btn-primary cursor-not-allowed opacity-60">Graph URL unavailable</span>}
              <StatusBadge tone={knowledge.available ? "success" : "neutral"}>{knowledge.available ? "Knowledge Engine connected" : "Knowledge Engine unavailable"}</StatusBadge>
              <StatusBadge tone={graphStatus === "available" ? "success" : "neutral"}>{graphStatus === "available" ? "Galaxy available" : "Galaxy status unknown"}</StatusBadge>
            </div>
          </div>

          <div className="surface-card-elevated relative min-h-[22rem] overflow-hidden p-5" role="img" aria-label="Conceptual map of a canonical theological research constellation">
            <span className="absolute left-4 top-4 z-10 rounded-full border border-(--border) bg-(--surface-elevated) px-3 py-1 text-xs font-bold text-(--text-muted)">{knowledge.available ? "Canonical research model" : "Offline concept preview"}</span>
            <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)", backgroundSize: "24px 24px" }} aria-hidden="true" />
            <svg className="absolute inset-0 h-full w-full text-(--gold) opacity-55" viewBox="0 0 600 360" fill="none" aria-hidden="true"><path d="M300 180 130 75m170 105L480 78M300 180 105 270m195-90 190 98m-190-98 5-125" stroke="currentColor" strokeWidth="1.5" /></svg>
            <div className="absolute left-1/2 top-1/2 grid h-28 w-28 -translate-x-1/2 -translate-y-1/2 place-content-center rounded-full border-2 border-(--gold) bg-(--navy) text-center text-white shadow-xl"><span className="text-2xl text-(--gold)" aria-hidden="true">△</span><strong className="mt-1 font-[family-name:var(--font-editorial)]">Question</strong></div>
            {[{ label: "Claim", pos: "left-[6%] top-[11%]" }, { label: "Objection", pos: "right-[4%] top-[12%]" }, { label: "Evidence", pos: "bottom-[10%] left-[4%]" }, { label: "Response", pos: "bottom-[8%] right-[5%]" }, { label: "Doctrine", pos: "left-1/2 top-[2%] -translate-x-1/2" }].map((node) => <span key={node.label} className={`absolute ${node.pos} rounded-full border border-(--border) bg-(--surface-elevated) px-3 py-2 text-xs font-bold shadow-sm`}>{node.label}</span>)}
          </div>
        </section>

        <section className="mt-8" aria-labelledby="research-value-heading">
          <SectionHeading eyebrow="A disciplined research workflow" title="From assertion to accountable evidence" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{values.map((value) => <article key={value.title} className="surface-card p-5"><span className="grid h-11 w-11 place-items-center rounded-full border border-(--border) text-xl text-(--gold-hover)" aria-hidden="true">{value.icon}</span><h2 className="editorial-heading mt-4 text-xl font-semibold">{value.title}</h2><p className="mt-2 text-sm leading-6 text-(--text-muted)">{value.copy}</p></article>)}</div>
        </section>

        <section className="mt-9" aria-labelledby="guided-research-heading">
          <SectionHeading eyebrow={knowledge.available ? "Published Knowledge Engine topics" : "Research prompts"} title={knowledge.available ? "Enter a reviewed argument constellation" : "Start with an apologetics question"} />
          {knowledge.available && knowledge.topics.length === 0 ? <div className="surface-card p-6"><StatusBadge>Editorial migration in progress</StatusBadge><p className="mt-3 text-sm leading-6 text-(--text-muted)">The Knowledge Engine is connected, but no reviewed topic journey has been published yet. Draft imports remain intentionally hidden until source and doctrinal review are complete.</p></div> : null}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {(knowledge.topics.length ? knowledge.topics : fallbackPrompts).map((entry, index) => {
              const topic = entry as KnowledgeTopic & { focus?: string; difficulty?: string };
              const live = "rootNodeId" in topic && Boolean(topic.rootNodeId);
              return <article key={topic.id || topic.title} className="surface-card grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 p-5 sm:grid-cols-[auto_minmax(0,1fr)_auto]"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-(--gold) font-[family-name:var(--font-editorial)] text-xl text-(--gold-hover)" aria-hidden="true">{index + 1}</span><div className="min-w-0"><h2 className="editorial-heading text-xl font-semibold">{topic.title}</h2><p className="mt-1 text-sm leading-5 text-(--text-muted)">{live ? topic.summary || "Published canonical topic journey." : "A suggested research starting point while the reviewed canonical topic catalogue is being populated."}</p><div className="mt-2 flex flex-wrap gap-2">{live ? <><StatusBadge tone="success">Published</StatusBadge><StatusBadge tone="info">Canonical</StatusBadge></> : <><StatusBadge tone="info">{topic.focus || "Apologetics"}</StatusBadge><StatusBadge>{topic.difficulty || "Research"}</StatusBadge></>}</div></div>{graphUrl ? <ExternalGraphLink href={graphFocusUrl(graphUrl, live ? topic.rootNodeId : undefined)} className="btn-quiet col-span-2 w-full px-3 sm:col-span-1 sm:w-auto">{live ? "Explore constellation" : "Browse catalogue"}</ExternalGraphLink> : null}</article>;
            })}
          </div>
        </section>

        <section id="standards" className="surface-card mt-9 scroll-mt-28 p-6 sm:p-8" aria-labelledby="standards-heading">
          <div className="grid gap-6 lg:grid-cols-[0.65fr_1.35fr] lg:items-start"><div><p className="eyebrow">Research standards</p><h2 id="standards-heading" className="editorial-heading mt-2 text-3xl font-semibold">Know what kind of statement you are reading.</h2><p className="mt-3 text-sm leading-6 text-(--text-muted)">Canonical propositions, source identity, exact citations, interpretations and editorial inferences remain distinct. Perspective does not rewrite evidence.</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[
            ["Claim", "The atomic proposition being examined."], ["Evidence", "Textual, historical, linguistic or doctrinal support."], ["Assessment", "How a recorded tradition or scholarly lens evaluates the proposition."], ["Objection", "A serious challenge stated in its own terms."], ["Response", "A focused answer linked to the actual objection."], ["Provenance", "Who asserts a relationship, from what evidence and under which reviewed revision."],
          ].map(([title, copy]) => <div key={title} className="rounded-lg border border-(--border) bg-(--surface-elevated) p-4"><h3 className="font-bold text-(--gold-hover)">{title}</h3><p className="mt-1 text-sm leading-5 text-(--text-muted)">{copy}</p></div>)}</div></div>
        </section>
      </div>
    </AppShell>
  );
}
