"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EmptyState, ProgressBar, SectionHeading, StatusBadge } from "@/components/ui/Primitives";
import { LIBRARY_BOOKMARKS_KEY, parseLibraryBookmarks } from "@/lib/libraryBookmarks";
import { getEngineUrl } from "@/lib/publicEnv";

export type LibraryResource = {
  id: string;
  title: string;
  description: string;
  href: string;
  format: "Question collection" | "Lesson";
  category: string;
  era: string;
  tags: string[];
  difficulty: number | null;
  questionCount: number;
  sourceCount: number | null;
  durationMinutes: number;
  featured?: boolean;
};

type EngineTopic = { id: string; title: string; questionCount: number };
const PAGE_SIZE = 9;

function ResourceIcon({ resource }: { resource: LibraryResource }) {
  const glyph = resource.format === "Lesson" ? "☩" : resource.category === "Scripture" ? "▥" : resource.category === "Church History" ? "⌂" : "✦";
  return <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-(--border) bg-(--surface-elevated) font-[family-name:var(--font-editorial)] text-2xl text-(--gold-hover)" aria-hidden="true">{glyph}</span>;
}

function BookmarkButton({ resource, saved, toggle }: { resource: LibraryResource; saved: boolean; toggle: () => void }) {
  return (
    <button type="button" onClick={toggle} aria-pressed={saved} aria-label={`${saved ? "Remove" : "Save"} ${resource.title}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-(--border) text-lg text-(--text-muted) hover:border-(--gold) hover:text-(--gold-hover)">
      <span aria-hidden="true">{saved ? "♥" : "♡"}</span>
    </button>
  );
}

export function EngineTopicsList({ resources, questionTotal, sourceTotal }: { resources: LibraryResource[]; questionTotal: number; sourceTotal: number }) {
  const [items, setItems] = useState(resources);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [format, setFormat] = useState("All");
  const [difficulty, setDifficulty] = useState("All");
  const [era, setEra] = useState("All");
  const [sort, setSort] = useState("recommended");
  const [savedOnly, setSavedOnly] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [saved, setSaved] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [engineState, setEngineState] = useState<"checking" | "live" | "fallback">("checking");

  useEffect(() => {
    setSaved(parseLibraryBookmarks(localStorage.getItem(LIBRARY_BOOKMARKS_KEY)));
    const initialQuery = new URL(window.location.href).searchParams.get("q");
    if (initialQuery) setQuery(initialQuery);
  }, []);

  useEffect(() => {
    const engine = getEngineUrl();
    if (!engine) { setEngineState("fallback"); return; }
    const controller = new AbortController();
    fetch(`${engine}/topics`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("topic service unavailable");
        const payload = await response.json() as { topics?: EngineTopic[] };
        const live = payload.topics ?? [];
        setItems((current) => {
          const byId = new Map(current.map((item) => [item.id, item]));
          for (const topic of live) {
            const bundled = byId.get(topic.id);
            byId.set(topic.id, bundled ? { ...bundled, title: topic.title || bundled.title, questionCount: topic.questionCount } : {
              id: topic.id, title: topic.title, description: "A live Engine question collection.", href: `/library/${topic.id}`, format: "Question collection", category: "Doctrine", era: "General", tags: [], difficulty: null, questionCount: topic.questionCount, sourceCount: null, durationMinutes: Math.max(5, Math.ceil(topic.questionCount * 0.75)),
            });
          }
          return [...byId.values()];
        });
        setEngineState("live");
      })
      .catch((error) => { if ((error as Error).name !== "AbortError") setEngineState("fallback"); });
    return () => controller.abort();
  }, []);

  const categories = useMemo(() => ["All", ...new Set(items.map((item) => item.category))], [items]);
  const eras = useMemo(() => ["All", ...new Set(items.map((item) => item.era))], [items]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const next = items.filter((item) => {
      const searchable = `${item.title} ${item.description} ${item.tags.join(" ")}`.toLowerCase();
      return (!normalized || searchable.includes(normalized))
        && (category === "All" || item.category === category)
        && (format === "All" || item.format === format)
        && (difficulty === "All" || item.difficulty === Number(difficulty))
        && (era === "All" || item.era === era)
        && (!savedOnly || saved.includes(item.id));
    });
    return next.sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "questions") return b.questionCount - a.questionCount;
      if (sort === "sources") return (b.sourceCount ?? -1) - (a.sourceCount ?? -1);
      return Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || b.questionCount - a.questionCount;
    });
  }, [items, query, category, format, difficulty, era, savedOnly, saved, sort]);

  useEffect(() => { setPage(1); }, [query, category, format, difficulty, era, savedOnly, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const featured = items.filter((item) => item.featured).slice(0, 3);
  const continueItem = items.find((item) => saved.includes(item.id)) ?? items[0];

  const toggleSaved = (id: string) => {
    setSaved((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      try { localStorage.setItem(LIBRARY_BOOKMARKS_KEY, JSON.stringify(next)); } catch { /* in-memory bookmarks remain usable */ }
      return next;
    });
  };

  return (
    <>
      <section className="relative grid gap-7 border-b border-(--border) pb-7 lg:grid-cols-[1fr_0.7fr] lg:items-center" aria-labelledby="library-heading">
        <div>
          <p className="eyebrow">Catholic knowledge library</p>
          <h1 id="library-heading" className="editorial-heading mt-2 max-w-2xl text-4xl font-semibold leading-[1.02] sm:text-5xl">Explore the treasury<br />of the Faith.</h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-(--text-muted)">Search Scripture, doctrine, Church history, apologetics, councils, and sourced Catholic explanations.</p>
          <label htmlFor="library-search" className="sr-only">Search the library</label>
          <div className="mt-5 flex max-w-2xl gap-2">
            <input id="library-search" type="search" className="form-control min-h-12" placeholder="Search topics, questions, Scripture, councils…" value={query} onChange={(event) => setQuery(event.target.value)} />
            <button type="button" className="btn-primary min-h-12" onClick={() => document.getElementById("browse-library")?.scrollIntoView({ behavior: "smooth" })}>Search</button>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-(--text-muted)"><strong className="text-(--text)">{resources.filter((item) => item.format === "Question collection").length}</strong> topics <span aria-hidden="true">·</span><strong className="text-(--text)">{questionTotal.toLocaleString()}</strong> questions <span aria-hidden="true">·</span><strong className="text-(--text)">{sourceTotal.toLocaleString()}</strong> cited references <span className="text-xs">in the bundled catalogue</span></div>
        </div>
        <div className="hidden justify-center lg:flex" aria-hidden="true"><div className="relative grid h-52 w-80 place-items-center rounded-[50%] border border-(--border) bg-(--surface)"><span className="text-8xl text-(--gold)">▥</span><span className="absolute top-2 text-4xl text-(--gold)">☩</span></div></div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">
          <section className="surface-card p-3 sm:p-4" aria-label="Library filters">
            <div className="flex gap-1 overflow-x-auto border-b border-(--border) pb-2" role="group" aria-label="Library category filter">
              {categories.map((item) => <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)} className={`min-h-11 shrink-0 rounded-md px-3 text-sm font-semibold ${category === item ? "bg-(--gold) text-(--button-primary-text)" : "text-(--text-muted) hover:bg-(--surface-elevated) hover:text-(--text)"}`}>{item}</button>)}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs font-bold text-(--text-muted)">Content type<select className="form-control mt-1" value={format} onChange={(event) => setFormat(event.target.value)}><option>All</option><option>Question collection</option><option>Lesson</option></select></label>
              <label className="text-xs font-bold text-(--text-muted)">Difficulty<select className="form-control mt-1" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option>All</option>{[1,2,3,4,5].map((level) => <option key={level} value={level}>Level {level}</option>)}</select></label>
              <label className="text-xs font-bold text-(--text-muted)">Era focus<select className="form-control mt-1" value={era} onChange={(event) => setEra(event.target.value)}>{eras.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="text-xs font-bold text-(--text-muted)">Sort<select className="form-control mt-1" value={sort} onChange={(event) => setSort(event.target.value)}><option value="recommended">Recommended</option><option value="title">Title</option><option value="questions">Most questions</option><option value="sources">Most references</option></select></label>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-(--text-muted)"><input type="checkbox" checked={savedOnly} onChange={(event) => setSavedOnly(event.target.checked)} className="h-5 w-5 accent-(--gold)" /> Saved only</label>
              <div className="flex gap-1" role="group" aria-label="Library view"><button type="button" aria-pressed={view === "grid"} className={`btn-quiet min-h-11 px-3 ${view === "grid" ? "border-(--gold) text-(--gold-hover)" : ""}`} onClick={() => setView("grid")}>Grid</button><button type="button" aria-pressed={view === "list"} className={`btn-quiet min-h-11 px-3 ${view === "list" ? "border-(--gold) text-(--gold-hover)" : ""}`} onClick={() => setView("list")}>List</button></div>
            </div>
          </section>

          {featured.length ? <section className="mt-7" aria-labelledby="featured-collections-heading"><SectionHeading eyebrow="Featured collections" title="Begin with a trusted path" /><div className="grid gap-4 md:grid-cols-3">{featured.map((item) => <Link key={item.id} href={item.href} className="surface-card p-4 hover:border-(--gold)"><div className="flex items-start gap-3"><ResourceIcon resource={item} /><div><h3 className="editorial-heading text-lg font-semibold">{item.title}</h3><p className="mt-1 text-xs text-(--text-muted)">{item.questionCount ? `${item.questionCount} questions` : "1 lesson"} · {item.sourceCount === null ? "reference count unavailable" : `${item.sourceCount} references`}</p></div></div><p className="mt-3 line-clamp-3 text-sm leading-6 text-(--text-muted)">{item.description}</p><div className="mt-4"><ProgressBar value={0} label={`${item.title} completion not yet tracked`} /></div><p className="mt-3 text-sm font-bold text-(--gold-hover)">Open collection →</p></Link>)}</div></section> : null}

          <section id="browse-library" className="mt-7 scroll-mt-28" aria-labelledby="browse-library-heading">
            <SectionHeading eyebrow="Browse the library" title={`${filtered.length} matching resources`} action={<StatusBadge tone={engineState === "live" ? "success" : engineState === "fallback" ? "warning" : "neutral"}>{engineState === "live" ? "Engine topic counts" : engineState === "fallback" ? "Bundled catalogue" : "Checking Engine"}</StatusBadge>} />
            {pageItems.length ? (
              <div className={view === "grid" ? "grid gap-3 lg:grid-cols-2" : "space-y-3"}>
                {pageItems.map((item) => (
                  <article key={`${item.format}-${item.id}`} className={`surface-card flex gap-3 p-4 ${view === "list" ? "sm:items-center" : "items-start"}`}>
                    <ResourceIcon resource={item} />
                    <div className="min-w-0 flex-1"><p className="text-xs text-(--text-muted)">{item.category}</p><h3 className="editorial-heading mt-0.5 text-lg font-semibold"><Link href={item.href} className="hover:text-(--gold-hover)">{item.title}</Link></h3><p className="mt-1 line-clamp-2 text-sm leading-5 text-(--text-muted)">{item.description}</p><div className="mt-3 flex flex-wrap gap-2 text-[0.72rem] text-(--text-muted)"><span className="rounded-full border border-(--border) px-2 py-1">{item.format}</span>{item.difficulty ? <span className="rounded-full border border-(--border) px-2 py-1">Level {item.difficulty}</span> : null}<span className="px-1 py-1">{item.durationMinutes} min est.</span><span className="px-1 py-1">{item.sourceCount === null ? "refs not supplied" : `${item.sourceCount} refs`}</span></div></div>
                    <BookmarkButton resource={item} saved={saved.includes(item.id)} toggle={() => toggleSaved(item.id)} />
                  </article>
                ))}
              </div>
            ) : <EmptyState title="No resources match" description="Try a broader search, reset a filter, or turn off Saved only." action={<button type="button" className="btn-secondary" onClick={() => { setQuery(""); setCategory("All"); setFormat("All"); setDifficulty("All"); setEra("All"); setSavedOnly(false); }}>Clear filters</button>} />}
            {pages > 1 ? <nav className="mt-5 flex items-center justify-between gap-3" aria-label="Library pages"><button type="button" className="btn-quiet" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button><span className="text-sm text-(--text-muted)">Page {page} of {pages}</span><button type="button" className="btn-quiet" disabled={page === pages} onClick={() => setPage((value) => Math.min(pages, value + 1))}>Next</button></nav> : null}
          </section>
        </div>

        <aside className="space-y-4" aria-label="Library tools">
          {continueItem ? <section className="surface-card p-5"><p className="eyebrow">Continue exploring</p><div className="mt-3 flex items-center gap-3"><ResourceIcon resource={continueItem} /><h2 className="editorial-heading text-lg font-semibold">{continueItem.title}</h2></div><p className="mt-3 text-sm text-(--text-muted)">{saved.includes(continueItem.id) ? "Saved on this device." : "A recommended starting point from the catalogue."}</p><Link href={continueItem.href} className="btn-primary mt-4 w-full">Open resource</Link></section> : null}
          <section className="surface-card p-5"><p className="eyebrow">Your saved items</p><p className="editorial-heading mt-2 text-3xl font-semibold">{saved.length}</p><p className="mt-1 text-sm text-(--text-muted)">Saved on this device.</p><button type="button" className="mt-3 text-sm font-bold text-(--gold-hover) hover:underline" onClick={() => setSavedOnly(true)}>View saved items →</button></section>
          <section className="surface-card p-5"><p className="eyebrow">Popular this week</p><p className="mt-2 text-sm leading-6 text-(--text-muted)">Popularity analytics are not available from the Engine yet. Resources are currently sorted by editorial priority and catalogue depth.</p></section>
          <section className="surface-card p-5"><p className="eyebrow">Source standards</p><p className="mt-2 text-sm leading-6 text-(--text-muted)">Published questions require an explanation and cited references. Content still requires accountable human theological review.</p><Link href="/research#standards" className="mt-3 inline-block text-sm font-bold text-(--gold-hover) hover:underline">How sources are handled →</Link></section>
        </aside>
      </div>
    </>
  );
}
