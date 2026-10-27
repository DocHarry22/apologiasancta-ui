"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppIcon } from "@/components/native/AppIcon";
import { StudyArtwork, StudySearch } from "@/components/native/StudyUI";
import styles from "@/components/native/StudyUI.module.css";
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
const PAGE_SIZE = 10;

function ResourceIcon({ resource }: { resource: LibraryResource }) {
  return <StudyArtwork icon={resource.category === "Doctrine" ? "cross" : resource.category === "Church History" ? "library" : resource.category === "Apologetics" ? "research" : "book"} tone={resource.category === "Scripture" ? 1 : resource.category === "Church History" ? 2 : 0} />;
}

function BookmarkButton({ resource, saved, toggle }: { resource: LibraryResource; saved: boolean; toggle: () => void }) {
  return (
    <button type="button" onClick={toggle} aria-pressed={saved} aria-label={`${saved ? "Remove" : "Save"} ${resource.title}`} className={styles.bookmark}>
      <AppIcon name="bookmark" width={17} height={17} />
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
    try { setSaved(parseLibraryBookmarks(localStorage.getItem(LIBRARY_BOOKMARKS_KEY))); } catch { /* Device storage is optional. */ }
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
  const currentPage = Math.min(page, pages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const advancedCount = Number(format !== "All") + Number(difficulty !== "All") + Number(era !== "All") + Number(sort !== "recommended");
  const hasFilters = Boolean(query || category !== "All" || advancedCount || savedOnly);
  const reset = () => { setQuery(""); setCategory("All"); setFormat("All"); setDifficulty("All"); setEra("All"); setSort("recommended"); setSavedOnly(false); };
  const changePage = (next: number) => { setPage(next); document.getElementById("browse-library")?.scrollIntoView({ behavior: "smooth", block: "start" }); };

  const toggleSaved = (id: string) => {
    setSaved((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      try { localStorage.setItem(LIBRARY_BOOKMARKS_KEY, JSON.stringify(next)); } catch { /* in-memory bookmarks remain usable */ }
      return next;
    });
  };

  return <div className={styles.screen}>
    <header className={styles.intro}><p className={styles.eyebrow}>The knowledge library</p><h1 id="library-heading" className={styles.title}>Follow your <em>curiosity.</em></h1><p>Questions worth asking. Sources worth reading. Find a deeper understanding of your faith.</p><div className={styles.stats}><span><strong>{items.length}</strong> topics to explore</span><span><strong>{saved.length}</strong> saved on this device</span></div></header>
    <div className={styles.browseTabs} role="group" aria-label="Library collection"><button type="button" aria-pressed={!savedOnly} onClick={() => setSavedOnly(false)}>Discover</button><button type="button" aria-pressed={savedOnly} onClick={() => setSavedOnly(true)}><AppIcon name="bookmark" width={15} height={15} /> Saved <small>{saved.length}</small></button></div>
    <StudySearch id="library-search" label="Search the library" value={query} onChange={setQuery} placeholder="Scripture, sacraments, questions…" />
    <div className={styles.chipRow} role="group" aria-label="Library category filter">{categories.map((item) => <button key={item} type="button" aria-pressed={category === item} className={styles.chip} onClick={() => setCategory(item)}>{item === "All" ? "All topics" : item}</button>)}</div>
    <details className={styles.filters}><summary><AppIcon name="filter" width={16} height={16} /> Refine your search{advancedCount ? " · " + advancedCount + " active" : ""}</summary>
      <div className={styles.filterGrid}>
        <label>Content type<select value={format} onChange={(event) => setFormat(event.target.value)}><option>All</option><option>Question collection</option><option>Lesson</option></select></label>
        <label>Difficulty<select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option>All</option>{[1, 2, 3, 4, 5].map((level) => <option key={level} value={level}>Level {level}</option>)}</select></label>
        <label>Era focus<select value={era} onChange={(event) => setEra(event.target.value)}>{eras.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Sort by<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="recommended">Recommended</option><option value="title">Title A–Z</option><option value="questions">Most questions</option><option value="sources">Most references</option></select></label>
      </div>
    </details>
    <section id="browse-library" className="scroll-mt-24" aria-labelledby="browse-library-heading">
      <div className={styles.resultsToolbar}><div><h2 id="browse-library-heading">{savedOnly ? "Your saved collections" : query ? "What we found" : "Explore the collections"}</h2><p aria-live="polite">{filtered.length} matching {filtered.length === 1 ? "resource" : "resources"}{hasFilters ? <> · <button className="underline underline-offset-2" type="button" onClick={reset}>Clear filters</button></> : null}</p></div>
        <div className={styles.viewToggle} role="group" aria-label="Library view"><button type="button" aria-label="Grid view" aria-pressed={view === "grid"} onClick={() => setView("grid")}><AppIcon name="grid" width={18} height={18} /></button><button type="button" aria-label="List view" aria-pressed={view === "list"} onClick={() => setView("list")}><AppIcon name="list" width={19} height={19} /></button></div>
      </div>
      {pageItems.length ? <div className={view === "grid" ? styles.resourceGrid : styles.libraryList}>
        {pageItems.map((item) => <article key={item.format + "-" + item.id} className={styles.resource}>
          <BookmarkButton resource={item} saved={saved.includes(item.id)} toggle={() => toggleSaved(item.id)} />
          <Link href={item.href} className={styles.resourceMain}>
            <ResourceIcon resource={item} />
            <div className={styles.resourceCopy}><p className={styles.cardEyebrow}>{item.category}</p><h3 className={styles.cardTitle}>{item.title}</h3><p className={styles.description}>{item.description}</p><div className={styles.meta}><span>{item.format === "Lesson" ? "Lesson" : item.questionCount + (item.questionCount === 1 ? " question" : " questions")}</span><span>{item.sourceCount === null ? "References not supplied" : item.sourceCount + (item.sourceCount === 1 ? " cited reference" : " cited references")}</span></div></div>
          </Link>
        </article>)}
      </div> : <div className={styles.empty}><AppIcon name={savedOnly ? "bookmark" : "search"} /><h3>{savedOnly && !saved.length ? "Keep a little inspiration close." : "No resources match."}</h3><p>{savedOnly && !saved.length ? "Tap the bookmark on a collection to save it here, on this device." : "Try another word or broaden your filters."}</p><button type="button" className="btn-secondary" onClick={reset}>{savedOnly && !saved.length ? "Discover collections" : "Clear filters"}</button></div>}
      {pages > 1 ? <nav className={styles.pagination} aria-label="Library pages"><button type="button" className="btn-quiet" disabled={currentPage === 1} onClick={() => changePage(Math.max(1, currentPage - 1))}>Previous</button><span>Page {currentPage} of {pages}</span><button type="button" className="btn-quiet" disabled={currentPage === pages} onClick={() => changePage(Math.min(pages, currentPage + 1))}>Next</button></nav> : null}
    </section>
    <aside className={styles.notice}><AppIcon name="book" width={22} height={22} /><div><strong>Prefer a guided path?</strong>Build your understanding with structured lessons.<br /><Link className={styles.textLink} href="/learn">Explore Learn <AppIcon name="arrow" width={15} height={15} /></Link></div></aside>
    <p className={styles.sourceNote}>The bundled catalogue contains {questionTotal.toLocaleString()} questions and {sourceTotal.toLocaleString()} cited references. {engineState === "live" ? "Topic counts updated from the live catalogue." : engineState === "checking" ? "Checking for updated topic counts…" : "Showing bundled topic counts while live updates are unavailable."}</p>
  </div>;
}
