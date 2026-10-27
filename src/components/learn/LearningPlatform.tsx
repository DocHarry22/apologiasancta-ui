"use client";

import { ReportIssue } from "@/components/content/ReportIssue";
import { ScreenSurface, ScreenIntro } from "@/components/native/ScreenSurface";
import surface from "@/components/native/ScreenSurface.module.css";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProgressBar } from "@/components/ui/Primitives";
import { AppIcon } from "@/components/native/AppIcon";
import { StudyArtwork, StudySearch } from "@/components/native/StudyUI";
import styles from "@/components/native/StudyUI.module.css";

type ApiEnvelope<T> = { data: T; meta?: Record<string, unknown> };
type CatalogueItem = {
  id: string;
  slug: string;
  title: string;
  shortDescription?: string;
  description?: string;
  coverImageUrl?: string;
  displayOrder?: number;
  estimatedMinutes?: number;
  difficulty?: string;
  visibility?: "public" | "locked" | "hidden" | "coming_soon";
  subjects?: CatalogueItem[];
  groups?: CatalogueItem[];
  lessons?: CatalogueItem[];
  unlocked?: boolean;
  isInitiallyUnlocked?: boolean;
  completed?: boolean;
  completionPercent?: number;
};

type LessonBlock = {
  id?: string;
  type: string;
  heading?: string;
  text?: string;
  body?: string;
  reference?: string;
  citation?: string;
  quote?: string;
  attribution?: string;
  url?: string;
  alt?: string;
  caption?: string;
  claim?: string;
  response?: string;
  items?: Array<{ title?: string; body?: string }>;
  headers?: string[];
  rows?: string[][];
};

type LessonDetail = CatalogueItem & {
  subtitle?: string;
  objectives?: Array<{ id?: string; text?: string; objective?: string; description?: string } | string>;
  sections?: Array<{ id: string; title?: string; heading?: string; blockKind?: string; blocks?: LessonBlock[]; content?: LessonBlock[] | LessonBlock }>;
  sources?: Array<{ id?: string; title?: string; label?: string; reference?: string; url?: string; kind?: string }>;
  previousLesson?: Pick<CatalogueItem, "slug" | "title"> | null;
  nextLesson?: Pick<CatalogueItem, "slug" | "title"> | null;
  navigation?: { previous?: Pick<CatalogueItem, "slug" | "title"> | null; next?: Pick<CatalogueItem, "slug" | "title"> | null };
};

type LessonBookmark = {
  id: string;
  lessonId: string;
  sectionId?: string | null;
};

type MasteryQuestion = { id?: string; questionId?: string; questionType?: string; prompt: string; options: Array<{ id?: string; optionId?: string; label?: string; content?: string }> };
type MasteryAttempt = { id?: string; attemptId?: string; questions: MasteryQuestion[]; expiresAt?: string };

function asEnvelope<T>(value: unknown): ApiEnvelope<T> {
  if (value && typeof value === "object" && "data" in value) return value as ApiEnvelope<T>;
  return { data: value as T };
}

async function api<T>(url: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body && typeof body.error === "string"
      ? body.error
      : body?.error && typeof body.error.message === "string"
        ? body.error.message
        : `Request failed (${response.status})`;
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return asEnvelope<T>(body);
}

async function csrfHeaders(unauthorizedMessage = "Sign in to save official progress."): Promise<Record<string, string>> {
  const response = await fetch("/api/auth/csrf", { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error(response.status === 401 ? unauthorizedMessage : "Security token unavailable.");
  const body = await response.json() as { csrfToken?: string };
  if (!body.csrfToken) throw new Error("Security token unavailable.");
  return { "content-type": "application/json", "x-csrf-token": body.csrfToken };
}

function useLearningResource<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setData((await api<T>(url)).data); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Learning content is unavailable."); }
    finally { setLoading(false); }
  }, [url]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, error, loading, reload };
}

function LoadingCards() {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Loading learning content">{[0, 1, 2].map((item) => <div key={item} className="surface-card min-h-48 animate-pulse p-6"><div className="h-3 w-24 rounded bg-(--border)" /><div className="mt-5 h-7 w-3/4 rounded bg-(--border)" /><div className="mt-4 h-4 w-full rounded bg-(--border)" /><div className="mt-2 h-4 w-4/5 rounded bg-(--border)" /></div>)}</div>;
}

function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return <div className={styles.empty} role="alert"><AppIcon name="book" /><h2>We couldn’t load your lessons.</h2><p>{message}</p><button type="button" className="btn-secondary" onClick={retry}>Try again</button></div>;
}

function itemHref(item: CatalogueItem, kind: "programme" | "subject" | "group" | "lesson") {
  if (kind === "programme") return `/learn/programmes/${item.slug}`;
  if (kind === "subject") return `/learn/subjects/${item.slug}`;
  if (kind === "group") return `/learn/groups/${item.slug}`;
  return `/learn/${item.slug}`;
}

function masteryQuestionId(question: MasteryQuestion): string { return question.id ?? question.questionId ?? ""; }
function masteryOptionId(option: MasteryQuestion["options"][number]): string { return option.id ?? option.optionId ?? ""; }

function CatalogueCard({ item, kind, index = 0 }: { item: CatalogueItem; kind: "programme" | "subject" | "group" | "lesson"; index?: number }) {
  const locked = (item.visibility === "locked" && item.unlocked !== true && item.isInitiallyUnlocked !== true) || item.unlocked === false;
  const comingSoon = item.visibility === "coming_soon";
  if (item.visibility === "hidden") return null;
  const content = <>
    <StudyArtwork icon={locked ? "lock" : item.completed ? "check" : "book"} tone={index} />
    <div className={styles.cardBody}>
      <p className={styles.cardEyebrow}>{kind}</p>
      <h3 className={styles.cardTitle}>{item.title}</h3>
      <p className={styles.description}>{item.shortDescription || item.description || "Discover the next step in your formation."}</p>
      <div className={styles.meta}>{item.difficulty ? <span>{item.difficulty}</span> : null}{item.estimatedMinutes ? <span>{item.estimatedMinutes} min</span> : null}{item.subjects?.length ? <span>{item.subjects.length} subjects</span> : null}{item.lessons?.length ? <span>{item.lessons.length} lessons</span> : null}</div>
      {typeof item.completionPercent === "number" ? <div className="mt-3"><ProgressBar value={item.completionPercent} label={`${item.title} completion`} /></div> : null}
      <span className={styles.cardArrow}>{comingSoon ? "Coming soon" : locked ? "Complete the prerequisites to unlock" : item.completed ? "Review" : kind === "lesson" ? "Read lesson" : "Explore"}<AppIcon name={locked ? "lock" : comingSoon ? "book" : "arrow"} width={15} height={15} /></span>
    </div>
  </>;
  return locked || comingSoon ? <div className={styles.learningCard} aria-disabled="true">{content}</div> : <Link className={styles.learningCard} href={itemHref(item, kind)}>{content}</Link>;
}

export function LearningCatalogue() {
  const { data, error, loading, reload } = useLearningResource<CatalogueItem[]>("/api/v1/learning/programmes");
  const [query, setQuery] = useState("");
  const [availability, setAvailability] = useState("All programmes");
  const programmes = (data ?? []).filter((item) => item.visibility !== "hidden");
  const filtered = programmes.filter((item) => {
    const locked = (item.visibility === "locked" && item.unlocked !== true && item.isInitiallyUnlocked !== true) || item.unlocked === false;
    return `${item.title} ${item.shortDescription ?? ""} ${item.description ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())
      && (availability === "All programmes" || (availability === "Coming soon" ? item.visibility === "coming_soon" : !locked && item.visibility !== "coming_soon"));
  });
  return <div className={styles.screen}>
    <header className={styles.intro}><p className={styles.eyebrow}>Your formation</p><h1 className={styles.title}>Know your faith.<br /><em>Grow with purpose.</em></h1><p>A little understanding today. A stronger foundation for tomorrow.</p></header>
    <section className={styles.compactFeature} aria-labelledby="formation-path-title"><div><h2 id="formation-path-title">Faith, one step at a time.</h2><p>Choose a path. Make it part of your day.</p></div><a href="#learning-programmes" aria-label="Find your learning path"><AppIcon name="arrow" width={20} height={20} /></a></section>
    <StudySearch id="programme-search" label="Search programmes" value={query} onChange={setQuery} placeholder="What would you like to learn?" />
    <div className={styles.chipRow} role="group" aria-label="Programme availability">{["All programmes", "Available", "Coming soon"].map((label) => <button className={styles.chip} type="button" key={label} aria-pressed={availability === label} onClick={() => setAvailability(label)}>{label}</button>)}</div>
    <section id="learning-programmes" className="scroll-mt-24" aria-labelledby="programmes-heading">
      <div className={styles.sectionHeading}><div><h2 id="programmes-heading">Your next chapter</h2><p aria-live="polite">{loading ? "Finding your learning paths…" : `${filtered.length} ${filtered.length === 1 ? "programme" : "programmes"} to explore`}</p></div><Link href="/learn/search" className={styles.textLink}>Find a lesson <AppIcon name="arrow" width={15} height={15} /></Link></div>
      {loading ? <LoadingCards /> : error ? <ErrorState message={error} retry={reload} /> : filtered.length ? <div className={styles.catalogue}>{filtered.map((item, index) => <CatalogueCard key={item.id} item={item} kind="programme" index={index} />)}</div> : <div className={styles.empty}><AppIcon name="book" /><h3>{programmes.length ? "A different path, perhaps?" : "Your next chapter is on its way."}</h3><p>{programmes.length ? "Try another search or choose a different availability filter." : "New programmes will appear here when they’re ready. You can explore the library in the meantime."}</p>{programmes.length ? <button className="btn-secondary" onClick={() => { setQuery(""); setAvailability("All programmes"); }}>Clear filters</button> : <Link className="btn-secondary" href="/library">Explore the library</Link>}</div>}
    </section>
    <aside className={styles.notice}><AppIcon name="bookmark" width={21} height={21} /><div><strong>Make it part of your day.</strong>Return to a lesson whenever you need. Sign in to keep your lesson progress and bookmarks together.</div></aside>
  </div>;
}

export function LearningHierarchyPage({ kind, slug }: { kind: "programme" | "subject" | "group"; slug: string }) {
  const plural = kind === "programme" ? "programmes" : kind === "subject" ? "subjects" : "groups";
  const { data, error, loading, reload } = useLearningResource<CatalogueItem>(`/api/v1/learning/${plural}/${encodeURIComponent(slug)}`);
  const [unlockedGroupIds, setUnlockedGroupIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (kind !== "subject") return;
    const controller = new AbortController();
    fetch("/api/v1/learning/unlocks", { cache: "no-store", signal: controller.signal })
      .then(async (response) => response.ok ? response.json() as Promise<{ data?: Array<{ groupId?: string }> }> : null)
      .then((payload) => setUnlockedGroupIds(new Set((payload?.data ?? []).flatMap((item) => item.groupId ? [item.groupId] : []))))
      .catch((cause) => { if ((cause as Error).name !== "AbortError") setUnlockedGroupIds(new Set()); });
    return () => controller.abort();
  }, [kind]);
  const children = data ? ((kind === "programme" ? data.subjects : kind === "subject" ? data.groups : data.lessons) ?? []).filter((item) => item.visibility !== "hidden").map((item) => kind === "subject" && unlockedGroupIds.has(item.id) ? { ...item, unlocked: true } : item) : [];
  const childKind = kind === "programme" ? "subject" : kind === "subject" ? "group" : "lesson";
  return <div className={styles.screen}>
    <Link className={styles.breadcrumb} href="/learn"><AppIcon name="chevron" width={15} height={15} /> All programmes</Link>
    {loading ? <LoadingCards /> : error ? <ErrorState message={error} retry={reload} /> : data ? <>
      <header className={styles.intro}><p className={styles.eyebrow}>{kind}</p><h1 className={styles.title}>{data.title}</h1><p>{data.shortDescription || data.description}</p><div className={styles.meta}>{data.difficulty ? <span>{data.difficulty}</span> : null}{data.estimatedMinutes ? <span>{data.estimatedMinutes} minutes</span> : null}<span>{children.length} {kind === "group" ? "lessons" : kind === "subject" ? "learning groups" : "subjects"}</span></div></header>
      <section><div className={styles.sectionHeading}><h2>{kind === "group" ? "One lesson at a time" : kind === "subject" ? "Choose your next step" : "Explore the subjects"}</h2></div>{children.length ? <div className={styles.catalogue}>{children.map((item, index) => <CatalogueCard key={item.id} item={item} kind={childKind} index={index} />)}</div> : <div className={styles.empty}><AppIcon name="book" /><h2>More to discover, soon.</h2><p>New content will appear here when it is published.</p></div>}</section>
      {kind === "group" && data.id ? <section className={styles.compactFeature}><div><h2>Put your learning into practice.</h2><p>Ready to move forward? Check your understanding with a mastery assessment.</p></div><Link href={`/learn/groups/${data.slug}/mastery`} aria-label="Start mastery assessment"><AppIcon name="arrow" width={21} height={21} /></Link></section> : null}
    </> : null}
  </div>;
}

function renderBlock(block: LessonBlock, index: number) {
  const key = block.id || `${block.type}-${index}`;
  if (["paragraph", "rich_text", "text"].includes(block.type)) return <p key={key} className="text-base leading-8 text-(--text-muted)">{block.text || block.body}</p>;
  if (block.type === "heading") return <h3 key={key} className="editorial-heading pt-3 text-2xl font-semibold">{block.heading || block.text}</h3>;
  if (["scripture_reference", "catechism_reference", "reference"].includes(block.type)) return <aside key={key} className="rounded-r-lg border-l-4 border-(--gold) bg-[color-mix(in_srgb,var(--gold)_9%,transparent)] px-5 py-4"><strong>{block.reference || block.citation}</strong>{block.text || block.body ? <p className="mt-2 leading-7 text-(--text-muted)">{block.text || block.body}</p> : null}</aside>;
  if (["quote", "quotation"].includes(block.type)) return <blockquote key={key} className="border-l-4 border-(--blue) pl-5 text-lg italic leading-8"><p>{block.quote || block.text}</p>{block.attribution ? <footer className="mt-2 text-sm not-italic text-(--text-muted)">— {block.attribution}</footer> : null}</blockquote>;
  if (block.type === "table" && block.rows) return <div key={key} className="overflow-x-auto"><table className="w-full border-collapse text-left text-sm"><thead>{block.headers ? <tr>{block.headers.map((cell) => <th className="border border-(--border) p-3" key={cell}>{cell}</th>)}</tr> : null}</thead><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td className="border border-(--border) p-3" key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>;
  if (block.type === "image" && block.url) return <figure key={key}>
    {/* eslint-disable-next-line @next/next/no-img-element -- CMS-managed lesson assets may use approved external storage. */}
    <img className="w-full rounded-xl border border-(--border)" src={block.url} alt={block.alt || "Lesson illustration"} />
    {block.caption ? <figcaption className="mt-2 text-sm text-(--text-muted)">{block.caption}</figcaption> : null}
  </figure>;
  if (["audio", "video"].includes(block.type) && block.url) return <div key={key} className="surface-card p-4">{block.type === "audio" ? <audio className="w-full" controls preload="metadata" src={block.url} /> : <video className="w-full rounded-lg" controls preload="metadata" src={block.url} />}{block.caption ? <p className="mt-2 text-sm text-(--text-muted)">{block.caption}</p> : null}</div>;
  if (["expandable", "explanation"].includes(block.type)) return <details key={key} className="surface-card p-4"><summary className="cursor-pointer font-bold">{block.heading || "Read the explanation"}</summary><p className="mt-3 leading-7 text-(--text-muted)">{block.body || block.text}</p></details>;
  if (["comparison", "distinction"].includes(block.type) && block.items) return <div key={key} className="grid gap-3 md:grid-cols-2">{block.items.map((item, itemIndex) => <div key={itemIndex} className="surface-card p-4"><strong>{item.title}</strong><p className="mt-2 text-sm leading-6 text-(--text-muted)">{item.body}</p></div>)}</div>;
  if (["objection_response", "objection"].includes(block.type)) return <aside key={key} className="surface-card border-(--gold) p-5"><p className="eyebrow">Objection</p><p className="mt-2 font-bold">{block.claim || block.heading}</p><p className="eyebrow mt-5">Response</p><p className="mt-2 leading-7 text-(--text-muted)">{block.response || block.body}</p></aside>;
  return <p key={key} className="text-base leading-8 text-(--text-muted)">{block.text || block.body || ""}</p>;
}

function sectionBlocks(section: NonNullable<LessonDetail["sections"]>[number]): LessonBlock[] {
  if (Array.isArray(section.blocks)) return section.blocks;
  if (Array.isArray(section.content)) return section.content;
  if (section.content && typeof section.content === "object") {
    const block = section.content as LessonBlock;
    return [{ ...block, type: block.type || section.blockKind || "rich_text" }];
  }
  return [];
}

export function LessonBookmarkControl({ lessonId, lessonTitle }: { lessonId: string; lessonTitle: string }) {
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkId, setBookmarkId] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "idle" | "saving" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const loadBookmark = async () => {
      setState("loading");
      setMessage("");
      setBookmarked(false);
      setBookmarkId(null);
      try {
        let offset = 0;
        while (!controller.signal.aborted) {
          const response = await api<LessonBookmark[]>(`/api/v1/learning/bookmarks?limit=100&offset=${offset}`, { signal: controller.signal });
          const match = response.data.find((bookmark) => bookmark.lessonId === lessonId && !bookmark.sectionId);
          if (match) {
            setBookmarked(true);
            setBookmarkId(match.id);
            break;
          }
          if (response.meta?.hasMore !== true) break;
          offset += 100;
        }
        if (!controller.signal.aborted) setState("idle");
      } catch (cause) {
        if ((cause as Error).name === "AbortError") return;
        const status = (cause as Error & { status?: number }).status;
        setState(status === 401 ? "idle" : "error");
        if (status !== 401) setMessage("Bookmark status could not be loaded. You can still try saving this lesson.");
      }
    };
    void loadBookmark();
    return () => controller.abort();
  }, [lessonId]);

  const toggleBookmark = async () => {
    const removing = bookmarked;
    if (removing && !bookmarkId) {
      setState("error");
      setMessage("This bookmark could not be removed safely. Refresh the lesson and try again.");
      return;
    }
    setState("saving");
    setMessage("");
    try {
      const headers = await csrfHeaders("Sign in to save lesson bookmarks.");
      if (removing) {
        await api<{ deleted: boolean }>(`/api/v1/learning/bookmarks?id=${encodeURIComponent(bookmarkId!)}`, { method: "DELETE", headers });
        setBookmarked(false);
        setBookmarkId(null);
        setMessage("Bookmark removed.");
      } else {
        const response = await api<LessonBookmark>("/api/v1/learning/bookmarks", {
          method: "POST",
          headers,
          body: JSON.stringify({ lessonId, sectionId: null, label: lessonTitle.slice(0, 160), note: null }),
        });
        setBookmarked(true);
        setBookmarkId(response.data.id);
        setMessage("Lesson bookmarked to your account.");
      }
      setState("idle");
    } catch (cause) {
      setState("error");
      setMessage(cause instanceof Error ? cause.message : "The bookmark could not be updated.");
    }
  };

  const busy = state === "loading" || state === "saving";
  const buttonLabel = state === "loading"
    ? "Checking bookmark…"
    : state === "saving"
      ? bookmarked ? "Removing…" : "Saving…"
      : bookmarked ? "Remove bookmark" : "Bookmark lesson";

  return <section className="surface-card p-5">
    <p className="eyebrow">Save for later</p>
    <h2 className="editorial-heading mt-2 text-xl font-semibold">Lesson bookmark</h2>
    <p className="mt-2 text-sm leading-6 text-(--text-muted)">Bookmarks are account-linked and available on your signed-in devices.</p>
    <button type="button" className="btn-secondary mt-4 w-full" aria-pressed={bookmarked} disabled={busy} onClick={() => void toggleBookmark()}>{buttonLabel}</button>
    {message ? <p className={`mt-3 text-sm ${state === "error" ? "text-(--danger)" : "text-(--success)"}`} role={state === "error" ? "alert" : "status"}>{message}</p> : null}
  </section>;
}

export function DatabaseLesson({ slug }: { slug: string }) {
  const { data: lesson, error, loading, reload } = useLearningResource<LessonDetail>(`/api/v1/learning/lessons/${encodeURIComponent(slug)}`);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "queued" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const markComplete = async () => {
    if (!lesson) return;
    setSaveState("saving");
    try {
      const headers = await csrfHeaders();
      const result = await api<{ queued?: boolean }>(`/api/v1/learning/lessons/${encodeURIComponent(lesson.id)}/progress`, { method: "PUT", headers, body: JSON.stringify({ state: "completed", readingProgressPercent: 100, resumeLocator: null }) });
      const queued = Boolean(result.data?.queued);
      setSaveState(queued ? "queued" : "saved");
      setSaveMessage(queued ? "Saved offline; it will sync when you reconnect." : "Official lesson progress saved.");
    } catch (cause) {
      setSaveState("error");
      setSaveMessage(cause instanceof Error ? cause.message : "Progress could not be saved.");
    }
  };
  const previousLesson = lesson?.previousLesson ?? lesson?.navigation?.previous ?? null;
  const nextLesson = lesson?.nextLesson ?? lesson?.navigation?.next ?? null;
  return <article className={styles.screen}>
    <Link className={styles.breadcrumb} href="/learn"><AppIcon name="chevron" width={15} height={15} /> Learning catalogue</Link>
    {loading ? <LoadingCards /> : error ? <ErrorState message={error} retry={reload} /> : lesson ? <>
      <header className={styles.readingHeader}>
        <div className={styles.meta}><span className={styles.cardEyebrow}>{lesson.difficulty || "Formation"}</span>{lesson.estimatedMinutes ? <span>{lesson.estimatedMinutes} minute read</span> : null}</div>
        <h1 className={styles.title}>{lesson.title}</h1>
        {lesson.subtitle ? <p>{lesson.subtitle}</p> : null}
        <p>{lesson.shortDescription || lesson.description}</p>
        <ReportIssue app="learn" contentType="lesson" contentId={lesson.id} title={lesson.title} snapshot={lesson} />
      </header>
      <div className={styles.readerLayout}>
        <div className="min-w-0">
          {lesson.sections?.length ? <details className={styles.toc}><summary>In this lesson <AppIcon name="list" width={17} height={17} /></summary><ol>{lesson.sections.map((section, index) => <li key={section.id || index}><a href={"#lesson-section-" + (index + 1)}><span className={styles.cardEyebrow}>{String(index + 1).padStart(2, "0")}</span>{" "}{section.title || section.heading || "Part " + (index + 1)}</a></li>)}</ol></details> : null}
          {lesson.objectives?.length ? <section className="surface-card p-5"><p className={styles.eyebrow}>What you’ll discover</p><ul className="mt-4 space-y-3">{lesson.objectives.map((objective, index) => <li className="flex gap-3 text-sm leading-7" key={typeof objective === "string" ? objective : objective.id || index}><span aria-hidden="true" className="text-(--gold)"><AppIcon name="check" width={17} height={17} /></span><span>{typeof objective === "string" ? objective : objective.text || objective.objective || objective.description}</span></li>)}</ul></section> : null}
          <div className={styles.lessonSections}>{lesson.sections?.map((section, sectionIndex) => <section id={"lesson-section-" + (sectionIndex + 1)} className={styles.lessonSection} key={section.id || sectionIndex}><p className={styles.eyebrow}>Part {sectionIndex + 1}</p>{section.title || section.heading ? <h2>{section.title || section.heading}</h2> : null}<div className="space-y-5">{sectionBlocks(section).map(renderBlock)}</div></section>)}</div>
          <section className={styles.finish}>
            <h2>A little further in your journey.</h2><p>Finished reading? Save this lesson as complete in your account.</p>
            {saveMessage ? <p style={{ color: saveState === "error" ? "var(--danger)" : "var(--success)" }} role="status">{saveMessage}</p> : null}
            <button type="button" className="btn-primary" disabled={saveState === "saving" || saveState === "saved"} onClick={() => void markComplete()}>{saveState === "saving" ? "Saving…" : saveState === "saved" ? "Completed" : "Mark complete"}<AppIcon name="check" width={17} height={17} /></button>
          </section>
          <nav className={styles.lessonNav} aria-label="Lesson navigation">{previousLesson ? <Link className="btn-secondary" href={"/learn/" + previousLesson.slug}><AppIcon name="chevron" className="rotate-180 shrink-0" width={16} height={16} />{previousLesson.title}</Link> : null}{nextLesson ? <Link className="btn-primary" href={"/learn/" + nextLesson.slug}>{nextLesson.title}<AppIcon name="arrow" width={17} height={17} /></Link> : <Link className="btn-secondary" href="/learn">Explore more lessons <AppIcon name="arrow" width={17} height={17} /></Link>}</nav>
        </div>
        <aside className={styles.readerAside}>
          <LessonBookmarkControl lessonId={lesson.id} lessonTitle={lesson.title} />
          <section className="surface-card p-5"><p className={styles.eyebrow}>Go to the source</p><h2 className={styles.cardTitle}>Read. Reflect. Verify.</h2><p className={styles.description}>Explore the references behind this lesson.</p><div className="mt-4 space-y-2">{lesson.sources?.length ? lesson.sources.map((source, index) => <a key={source.id || index} className="block min-h-11 rounded-lg border border-(--border) p-3 hover:border-(--gold)" href={source.url || "#"} target={source.url ? "_blank" : undefined} rel={source.url ? "noopener noreferrer" : undefined}><span className={styles.cardEyebrow}>{source.kind || "Source"}</span>{" "}<strong className="mt-1 block text-sm leading-6">{source.reference || source.title || source.label}</strong></a>) : <p className="text-sm text-(--text-muted)">No public sources are attached.</p>}</div></section>
        </aside>
      </div>
    </> : null}
  </article>;
}

export function MasteryExperience({ groupSlug }: { groupSlug: string }) {
  const { data: group, error: groupError, loading: groupLoading, reload } = useLearningResource<CatalogueItem>(`/api/v1/learning/groups/${encodeURIComponent(groupSlug)}`);
  const [attempt, setAttempt] = useState<MasteryAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const attemptId = attempt?.id || attempt?.attemptId;
  const allAnswered = Boolean(attempt?.questions.length) && attempt!.questions.every((question) => Boolean(answers[masteryQuestionId(question)]?.length));
  const start = async () => { if (!group) return; setBusy(true); setMessage(""); try { const headers = await csrfHeaders(); const key = crypto.randomUUID(); const response = await api<MasteryAttempt>("/api/v1/learning/mastery/attempts", { method: "POST", headers, body: JSON.stringify({ groupId: group.id, idempotencyKey: key }) }); setAttempt(response.data); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Attempt could not be started."); } finally { setBusy(false); } };
  const submit = async () => { if (!attemptId) return; setBusy(true); setMessage(""); try { const headers = await csrfHeaders(); const response = await api<Record<string, unknown>>(`/api/v1/learning/mastery/attempts/${encodeURIComponent(attemptId)}/submit`, { method: "POST", headers, body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), answers: Object.entries(answers).map(([questionId, selectedOptionIds]) => ({ questionId, selectedOptionIds })) }) }); setResult(response.data); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Attempt could not be submitted."); } finally { setBusy(false); } };
  const score = result && typeof result.scorePercent === "number" ? result.scorePercent : result && typeof result.score === "number" ? result.score : null;
  return <ScreenSurface>
    <Link className={styles.breadcrumb} href={`/learn/groups/${groupSlug}`}><AppIcon name="chevron" width={15} height={15} /> Learning group</Link>
    {groupLoading ? <LoadingCards /> : groupError ? <ErrorState message={groupError} retry={reload} /> : group ? <>
      <ScreenIntro eyebrow="Official mastery" title={group.title} accent="Put your learning into practice." description="Check your understanding of this group. Sign in and stay online until your result is confirmed." />
      {result ? <section className={surface.result} aria-live="polite"><AppIcon name={result.mastered ? "trophy" : "book"} width={28} height={28} /><h2>{result.mastered ? "Mastery achieved" : "Keep learning"}</h2>{score !== null ? <strong>{score}%</strong> : null}<p>{result.mastered ? "Your mastery result is confirmed. Eligible learning groups have been checked for unlocking." : "No new group was unlocked. Review the explanations and try again when ready."}</p><div className={surface.actions}><Link className="btn-primary" href="/learn">View learning path</Link><button type="button" className="btn-secondary" onClick={() => { setAttempt(null); setResult(null); setAnswers({}); }}>Start another attempt</button></div></section> : attempt ? <form className="mt-6 space-y-5" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <p className={surface.stats}>{attempt.questions.filter((question) => Boolean(answers[masteryQuestionId(question)]?.length)).length} of {attempt.questions.length} questions answered</p>
        {attempt.questions.map((question, index) => {
          const questionId = masteryQuestionId(question);
          const multiple = question.questionType === "multiple_choice";
          const selectedOptions = answers[questionId] ?? [];
          return <fieldset key={questionId} className={surface.card}><legend className="px-2 font-[family-name:var(--font-editorial)] text-xl">{index + 1}. {question.prompt}</legend>{multiple ? <p className="mt-2 text-xs text-(--text-muted)">Select every answer that applies.</p> : null}<div className={surface.choices}>{question.options.map((option) => {
            const optionId = masteryOptionId(option);
            const checked = selectedOptions.includes(optionId);
            return <label key={optionId} className={surface.choice} data-state={checked ? "selected" : undefined}><input type={multiple ? "checkbox" : "radio"} name={questionId} value={optionId} checked={checked} disabled={busy} onChange={() => setAnswers((current) => ({ ...current, [questionId]: multiple ? checked ? selectedOptions.filter((id) => id !== optionId) : [...selectedOptions, optionId] : [optionId] }))} /><span>{option.label ?? option.content}</span></label>;
          })}</div><ReportIssue app="learn" contentType="question" contentId={questionId} title={question.prompt} snapshot={question} /></fieldset>;
        })}
        <button className="btn-primary" type="submit" disabled={!allAnswered || busy}>{busy ? "Scoring…" : "Submit for official scoring"}</button>
      </form> : <section className={surface.card}><h2>Ready to begin?</h2><p className="text-(--text-muted)">Answer each question, then submit your attempt for official scoring. Stay online until your result is confirmed.</p><button type="button" className="btn-primary mt-5" disabled={busy} onClick={() => void start()}>{busy ? "Starting…" : "Start mastery attempt"}</button></section>}
      {message ? <p className="mt-4 text-sm text-(--danger)" role="alert">{message}</p> : null}
    </> : null}
  </ScreenSurface>;
}

export function LearningSearch() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const url = useMemo(() => `/api/v1/learning/search?q=${encodeURIComponent(submitted)}&page=1&pageSize=20`, [submitted]);
  const { data, error, loading, reload } = useLearningResource<CatalogueItem[]>(url);
  return <div className={styles.screen}><Link className={styles.breadcrumb} href="/learn"><AppIcon name="chevron" width={15} height={15} /> All programmes</Link><header className={styles.intro}><p className={styles.eyebrow}>Find your next lesson</p><h1 className={styles.title}>A question. <em>A discovery.</em></h1><p>Search lessons, subjects, sources, and references.</p></header><form className="flex flex-col gap-3 sm:flex-row" role="search" onSubmit={(event) => { event.preventDefault(); setSubmitted(query.trim()); }}><div className="min-w-0 flex-1"><StudySearch id="learning-search" label="Search lessons and subjects" value={query} onChange={setQuery} placeholder="What would you like to understand?" /></div><button className="btn-primary" type="submit">Search lessons <AppIcon name="arrow" width={17} height={17} /></button></form><section className="mt-7" aria-live="polite">{loading ? <LoadingCards /> : error ? <ErrorState message={error} retry={reload} /> : data?.length ? <div className={styles.catalogue}>{data.map((item, index) => <CatalogueCard key={`${item.id}-${item.slug}`} item={item} index={index} kind={(item.lessons ? "group" : "lesson")} />)}</div> : <div className={styles.empty}><AppIcon name="search" /><h2>{submitted ? "No lessons found just yet." : "Follow a question."}</h2><p>{submitted ? "Try a broader word or a different reference." : "Enter a word, a topic, or a source to begin exploring."}</p></div>}</section></div>;
}

type PracticeQuestion = MasteryQuestion;
type PracticeResult = { correct: boolean; explanation?: string; references?: string[] };

export function PublishedPractice() {
  const { data, error, loading, reload } = useLearningResource<PracticeQuestion[]>("/api/v1/learning/practice?limit=8");
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [check, setCheck] = useState<PracticeResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");
  const question = data?.[index];
  const answered = check !== null;
  const choose = async (optionId: string) => {
    if (answered || checking || !question) return;
    setSelected(optionId);
    setChecking(true);
    setCheckError("");
    try {
      const result = await api<PracticeResult>("/api/v1/learning/practice/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ questionId: masteryQuestionId(question), optionId }) });
      setCheck(result.data);
      if (result.data.correct) setScore((current) => current + 1);
    } catch (cause) {
      setSelected(null);
      setCheckError(cause instanceof Error ? cause.message : "This answer could not be checked.");
    } finally { setChecking(false); }
  };
  const next = () => { setSelected(null); setCheck(null); setCheckError(""); setIndex((current) => current + 1); };
  return <ScreenSurface>
    <Link className={styles.breadcrumb} href="/learn"><AppIcon name="chevron" width={15} height={15} /> Back to learning</Link>
    <ScreenIntro eyebrow="Solo practice" title="A little practice." accent="A deeper understanding." description="Take a question at your own pace, then explore its explanation. Practice scores do not grant official mastery or unlocks." />
    {loading ? <LoadingCards /> : error ? <ErrorState message={error} retry={reload} /> : !data?.length ? <div className={styles.empty}><AppIcon name="book" /><h2>No published practice questions are available.</h2><p>Return to your learning or check back for more questions.</p></div> : index >= data.length ? <section className={surface.result} aria-live="polite"><AppIcon name="spark" width={28} height={28} /><p>Practice complete</p><h2>A little further, every day.</h2><strong>{score} of {data.length}</strong><p>Practice scores remain separate from official mastery.</p><div className={surface.actions}><button className="btn-primary" onClick={() => { setIndex(0); setSelected(null); setCheck(null); setScore(0); }}>Practice again</button><Link className="btn-secondary" href="/learn">Review lessons</Link></div></section> : question ? <section>
      <div className={surface.stats}><span>Question {index + 1} of {data.length}</span><span>{score} correct so far</span></div>
      <div className={surface.question}><p>Take a moment to think</p><h2>{question.prompt}</h2></div>
      <div className={surface.choices}>{question.options.map((option, optionIndex) => { const optionId = masteryOptionId(option); const isSelected = optionId === selected; return <button key={optionId} type="button" disabled={answered || checking} onClick={() => void choose(optionId)} className={surface.choice} data-state={isSelected ? check ? check.correct ? "correct" : "wrong" : "selected" : undefined}><span className={surface.letter} aria-hidden="true">{String.fromCharCode(65 + optionIndex)}</span><span>{option.label ?? option.content}</span></button>; })}</div>
      {checking ? <p className="mt-4 text-sm text-(--text-muted)" role="status">Checking answer…</p> : null}{checkError ? <p className="mt-4 text-sm text-(--danger)" role="alert">{checkError}</p> : null}
      {check ? <div className={surface.feedback} aria-live="polite"><strong>{check.correct ? "Correct" : "Review this answer"}</strong>{check.explanation ? <p className="text-(--text-muted)">{check.explanation}</p> : null}{check.references?.length ? <p className="text-(--text-muted)">Sources: {check.references.join(" · ")}</p> : null}<button className="btn-primary mt-4 w-full" onClick={next}>{index + 1 === data.length ? "See result" : "Next question"}</button></div> : null}
      <ReportIssue app="learn" contentType="question" contentId={masteryQuestionId(question)} title={question.prompt} snapshot={{ ...question, ...(check ? { feedback: check } : {}) }} />
    </section> : null}
  </ScreenSurface>;
}
