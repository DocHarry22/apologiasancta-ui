"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProgressBar, SectionHeading, StatusBadge } from "@/components/ui/Primitives";

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

export type LessonBlock = {
  id?: string;
  type: string;
  level?: 2 | 3 | 4;
  heading?: string;
  text?: string;
  body?: string;
  reference?: string;
  paraphrase?: string;
  citation?: string;
  quote?: string;
  attribution?: string;
  locator?: string;
  summary?: string;
  url?: string;
  assetId?: string;
  alt?: string;
  caption?: string;
  claim?: string;
  objection?: string;
  fairRepresentation?: string;
  response?: string;
  sourceId?: string;
  sourceIds?: string[];
  lessonIds?: string[];
  categoryIds?: string[];
  recordIds?: string[];
  items?: Array<{ title?: string; body?: string; marker?: string; text?: string; sourceId?: string; locator?: string }>;
  headers?: string[];
  columns?: string[];
  rows?: string[][];
  events?: Array<{ label: string; description: string; sourceIds?: string[] }>;
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
  return <div className="surface-card border-(--danger) p-6" role="alert"><p className="font-bold">Learning content could not be loaded.</p><p className="mt-2 text-sm text-(--text-muted)">{message}</p><button type="button" className="btn-secondary mt-4" onClick={retry}>Try again</button></div>;
}

function itemHref(item: CatalogueItem, kind: "programme" | "subject" | "group" | "lesson") {
  if (kind === "programme") return `/learn/programmes/${item.slug}`;
  if (kind === "subject") return `/learn/subjects/${item.slug}`;
  if (kind === "group") return `/learn/groups/${item.slug}`;
  return `/learn/${item.slug}`;
}

function masteryQuestionId(question: MasteryQuestion): string { return question.id ?? question.questionId ?? ""; }
function masteryOptionId(option: MasteryQuestion["options"][number]): string { return option.id ?? option.optionId ?? ""; }

function CatalogueCard({ item, kind }: { item: CatalogueItem; kind: "programme" | "subject" | "group" | "lesson" }) {
  const locked = (item.visibility === "locked" && item.unlocked !== true && item.isInitiallyUnlocked !== true) || item.unlocked === false;
  const comingSoon = item.visibility === "coming_soon";
  const content = <>
    <div className="flex flex-wrap items-center gap-2"><span className="eyebrow">{kind}</span>{locked ? <StatusBadge>Locked</StatusBadge> : null}{comingSoon ? <StatusBadge tone="info">Coming soon</StatusBadge> : null}{item.completed ? <StatusBadge tone="success">Complete</StatusBadge> : null}</div>
    <h3 className="editorial-heading mt-4 text-2xl font-semibold">{item.title}</h3>
    <p className="mt-3 text-sm leading-6 text-(--text-muted)">{item.shortDescription || item.description || "Open this part of the learning path."}</p>
    <div className="mt-5 flex flex-wrap gap-3 text-xs text-(--text-muted)">{item.difficulty ? <span>{item.difficulty}</span> : null}{item.estimatedMinutes ? <span>{item.estimatedMinutes} min</span> : null}</div>
    {typeof item.completionPercent === "number" ? <div className="mt-4"><ProgressBar value={item.completionPercent} label={`${item.title} completion`} /></div> : null}
  </>;
  const className = `surface-card block h-full p-6 transition-colors ${locked || comingSoon ? "opacity-70" : "hover:border-(--gold)"}`;
  return locked || comingSoon ? <div className={className} aria-disabled="true">{content}</div> : <Link className={className} href={itemHref(item, kind)}>{content}</Link>;
}

export function LearningCatalogue() {
  const { data, error, loading, reload } = useLearningResource<CatalogueItem[]>("/api/v1/learning/programmes");
  return <div className="page-container py-8 sm:py-11">
    <header className="max-w-3xl border-b border-(--border) pb-8"><p className="eyebrow">Formation catalogue</p><h1 className="editorial-heading mt-2 text-4xl font-semibold sm:text-5xl">Learn the faith, step by step.</h1><p className="mt-4 text-lg leading-8 text-(--text-muted)">Published programmes are ordered by the curriculum, with prerequisites and mastery confirmed by the server.</p><div className="mt-6 flex flex-wrap gap-3"><Link href="/learn/search" className="btn-secondary">Search learning content</Link><Link href="/mobile" className="btn-primary">Join the live quiz</Link></div></header>
    <section className="mt-8" aria-labelledby="programmes-heading"><SectionHeading eyebrow="Your path" title="Learning programmes" />{loading ? <LoadingCards /> : error ? <ErrorState message={error} retry={reload} /> : data?.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" id="programmes-heading">{data.map((item) => <CatalogueCard key={item.id} item={item} kind="programme" />)}</div> : <div className="surface-card p-6"><p className="font-bold">No published programmes yet.</p><p className="mt-2 text-sm text-(--text-muted)">Staff can prepare and review the first programme in the Learning CMS.</p></div>}</section>
    <aside className="surface-card mt-7 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="eyebrow">Offline aware</p><p className="mt-2 text-sm text-(--text-muted)">Recently opened published lessons remain readable offline. Official mastery always requires a server connection.</p></div><StatusBadge tone="info">Web · PWA · Android</StatusBadge></aside>
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
  const children = data ? ((kind === "programme" ? data.subjects : kind === "subject" ? data.groups : data.lessons) ?? []).map((item) => kind === "subject" && unlockedGroupIds.has(item.id) ? { ...item, unlocked: true } : item) : [];
  const childKind = kind === "programme" ? "subject" : kind === "subject" ? "group" : "lesson";
  return <div className="page-container py-8 sm:py-11"><nav className="mb-6 text-sm"><Link className="font-bold text-(--gold-hover) hover:underline" href="/learn">← Learning catalogue</Link></nav>{loading ? <LoadingCards /> : error ? <ErrorState message={error} retry={reload} /> : data ? <><header className="max-w-4xl border-b border-(--border) pb-8"><p className="eyebrow">{kind}</p><h1 className="editorial-heading mt-2 text-4xl font-semibold sm:text-5xl">{data.title}</h1><p className="mt-4 max-w-3xl text-lg leading-8 text-(--text-muted)">{data.shortDescription || data.description}</p><div className="mt-5 flex gap-2">{data.difficulty ? <StatusBadge>{data.difficulty}</StatusBadge> : null}{data.estimatedMinutes ? <StatusBadge tone="info">{data.estimatedMinutes} minutes</StatusBadge> : null}</div></header><section className="mt-8"><SectionHeading eyebrow="Continue" title={kind === "group" ? "Lessons" : kind === "subject" ? "Learning groups" : "Subjects"} />{children.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children.map((item) => <CatalogueCard key={item.id} item={item} kind={childKind} />)}</div> : <div className="surface-card p-6 text-sm text-(--text-muted)">No published items are available here yet.</div>}</section>{kind === "group" && data.id ? <div className="surface-card mt-7 flex flex-col gap-3 border-(--gold) p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">Group mastery</p><p className="mt-1 text-sm text-(--text-muted)">Complete 12 server-scored questions with 100% accuracy to unlock eligible groups.</p></div><Link className="btn-primary" href={`/learn/groups/${data.slug}/mastery`}>Start mastery</Link></div> : null}</> : null}</div>;
}

function renderBlock(block: LessonBlock, index: number) {
  const key = block.id || `${block.type}-${index}`;
  if (["paragraph", "rich_text", "text"].includes(block.type)) return <p key={key} className="text-base leading-8 text-(--text-muted)">{block.text || block.body}</p>;
  if (block.type === "heading") {
    const Heading = block.level === 2 ? "h2" : block.level === 4 ? "h4" : "h3";
    return <Heading key={key} className="editorial-heading pt-3 text-2xl font-semibold">{block.heading || block.text}</Heading>;
  }
  if (block.type === "scripture_card") return <aside key={key} className="rounded-r-lg border-l-4 border-(--gold) bg-[color-mix(in_srgb,var(--gold)_9%,transparent)] px-5 py-4"><p className="eyebrow">Sacred Scripture</p><strong className="mt-1 block">{block.reference}</strong><p className="mt-2 leading-7 text-(--text-muted)">{block.paraphrase}</p></aside>;
  if (block.type === "catechism_card") return <aside key={key} className="rounded-r-lg border-l-4 border-(--blue) bg-(--surface-elevated) px-5 py-4"><p className="eyebrow">Catechism and Magisterium</p><strong className="mt-1 block">{block.locator}</strong><p className="mt-2 leading-7 text-(--text-muted)">{block.summary}</p></aside>;
  if (["scripture_reference", "catechism_reference", "reference"].includes(block.type)) return <aside key={key} className="rounded-r-lg border-l-4 border-(--gold) bg-[color-mix(in_srgb,var(--gold)_9%,transparent)] px-5 py-4"><strong>{block.reference || block.citation}</strong>{block.text || block.body ? <p className="mt-2 leading-7 text-(--text-muted)">{block.text || block.body}</p> : null}</aside>;
  if (["quote", "quotation"].includes(block.type)) return <blockquote key={key} className="border-l-4 border-(--blue) pl-5 text-lg italic leading-8"><p>{block.quote || block.text}</p>{block.attribution ? <footer className="mt-2 text-sm not-italic text-(--text-muted)">— {block.attribution}</footer> : null}</blockquote>;
  if (["table", "distinction_table"].includes(block.type) && block.rows) return <div key={key} className="overflow-x-auto"><table className="w-full border-collapse text-left text-sm">{block.caption ? <caption className="mb-2 text-left font-bold">{block.caption}</caption> : null}<thead>{block.headers || block.columns ? <tr>{(block.headers || block.columns || []).map((cell) => <th className="border border-(--border) p-3" key={cell}>{cell}</th>)}</tr> : null}</thead><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td className="border border-(--border) p-3" key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>;
  if (block.type === "timeline" && block.events) return <figure key={key} className="surface-card p-5"><figcaption className="font-bold">{block.caption}</figcaption><ol className="mt-4 space-y-4 border-l-2 border-(--gold) pl-5">{block.events.map((event) => <li key={`${event.label}-${event.description}`}><strong>{event.label}</strong><p className="mt-1 text-sm leading-6 text-(--text-muted)">{event.description}</p></li>)}</ol></figure>;
  if (block.type === "image") return <figure key={key}>
    {block.url ? <>
      {/* eslint-disable-next-line @next/next/no-img-element -- CMS-managed lesson assets may use approved external storage. */}
      <img className="w-full rounded-xl border border-(--border)" src={block.url} alt={block.alt || "Lesson illustration"} />
    </> : <div className="grid min-h-40 place-items-center rounded-xl border border-dashed border-(--border) bg-(--surface-elevated) p-6 text-center text-sm text-(--text-muted)" role="img" aria-label={block.alt || "Lesson illustration"}>Approved asset resolves at publication.</div>}
    {block.caption ? <figcaption className="mt-2 text-sm text-(--text-muted)">{block.caption}</figcaption> : null}
  </figure>;
  if (block.type === "footnotes" && block.items) return <aside key={key} className="border-t border-(--border) pt-4"><h4 className="font-bold">Footnotes</h4><ol className="mt-3 space-y-2 text-sm text-(--text-muted)">{block.items.map((item, itemIndex) => <li key={`${item.marker || itemIndex}-${item.locator || ""}`}><span className="font-bold text-(--text)">{item.marker || itemIndex + 1}.</span> {item.text}{item.locator ? ` (${item.locator})` : ""}</li>)}</ol></aside>;
  if (block.type === "related_content") return <aside key={key} className="surface-card p-4"><p className="eyebrow">Related lessons</p><ul className="mt-2 space-y-1 text-sm text-(--text-muted)">{(block.lessonIds || []).map((lessonId) => <li key={lessonId}>{lessonId}</li>)}</ul></aside>;
  if (block.type === "graph_references") return <aside key={key} className="surface-card p-4"><p className="eyebrow">Apologia Graph</p><p className="mt-2 text-sm text-(--text-muted)">{[...(block.categoryIds || []), ...(block.recordIds || [])].join(" · ") || "Graph mapping pending."}</p></aside>;
  if (["audio", "video"].includes(block.type) && block.url) return <div key={key} className="surface-card p-4">{block.type === "audio" ? <audio className="w-full" controls preload="metadata" src={block.url} /> : <video className="w-full rounded-lg" controls preload="metadata" src={block.url} />}{block.caption ? <p className="mt-2 text-sm text-(--text-muted)">{block.caption}</p> : null}</div>;
  if (["expandable", "explanation"].includes(block.type)) return <details key={key} className="surface-card p-4"><summary className="cursor-pointer font-bold">{block.heading || "Read the explanation"}</summary><p className="mt-3 leading-7 text-(--text-muted)">{block.body || block.text}</p></details>;
  if (["comparison", "distinction"].includes(block.type) && block.items) return <div key={key} className="grid gap-3 md:grid-cols-2">{block.items.map((item, itemIndex) => <div key={itemIndex} className="surface-card p-4"><strong>{item.title}</strong><p className="mt-2 text-sm leading-6 text-(--text-muted)">{item.body}</p></div>)}</div>;
  if (["objection_response", "objection"].includes(block.type)) return <aside key={key} className="surface-card border-(--gold) p-5"><p className="eyebrow">Objection</p><p className="mt-2 font-bold">{block.objection || block.claim || block.heading}</p>{block.fairRepresentation ? <><p className="eyebrow mt-5">Fair representation</p><p className="mt-2 leading-7 text-(--text-muted)">{block.fairRepresentation}</p></> : null}<p className="eyebrow mt-5">Catholic response</p><p className="mt-2 leading-7 text-(--text-muted)">{block.response || block.body}</p></aside>;
  return <p key={key} className="text-base leading-8 text-(--text-muted)">{block.text || block.body || ""}</p>;
}

export function StructuredLessonBlocks({ blocks }: { blocks: LessonBlock[] }) {
  return <div className="space-y-5">{blocks.map(renderBlock)}</div>;
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
  return <article className="page-container py-8 sm:py-11"><nav className="mb-6 text-sm"><Link className="font-bold text-(--gold-hover) hover:underline" href="/learn">← Learning catalogue</Link></nav>{loading ? <LoadingCards /> : error ? <ErrorState message={error} retry={reload} /> : lesson ? <><header className="mx-auto max-w-4xl border-b border-(--border) pb-8"><div className="flex flex-wrap gap-2"><StatusBadge>{lesson.difficulty || "Formation"}</StatusBadge>{lesson.estimatedMinutes ? <StatusBadge tone="info">{lesson.estimatedMinutes} minutes</StatusBadge> : null}</div><h1 className="editorial-heading mt-5 text-4xl font-semibold sm:text-5xl">{lesson.title}</h1>{lesson.subtitle ? <p className="mt-3 text-xl text-(--gold-hover)">{lesson.subtitle}</p> : null}<p className="mt-5 text-lg leading-8 text-(--text-muted)">{lesson.shortDescription || lesson.description}</p></header><div className="mx-auto mt-8 grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]"><div>{lesson.objectives?.length ? <section className="surface-card p-5"><p className="eyebrow">Learning objectives</p><ul className="mt-4 space-y-3">{lesson.objectives.map((objective, index) => <li className="flex gap-3" key={typeof objective === "string" ? objective : objective.id || index}><span aria-hidden="true" className="text-(--gold)">✓</span><span>{typeof objective === "string" ? objective : objective.text || objective.objective || objective.description}</span></li>)}</ul></section> : null}<div className="mt-9 space-y-10">{lesson.sections?.map((section, sectionIndex) => <section key={section.id || sectionIndex}><p className="eyebrow">Part {sectionIndex + 1}</p>{section.title || section.heading ? <h2 className="editorial-heading mt-2 text-3xl font-semibold">{section.title || section.heading}</h2> : null}<div className="mt-5 space-y-5">{sectionBlocks(section).map(renderBlock)}</div></section>)}</div><section className="surface-card mt-10 flex flex-col gap-4 border-(--gold) p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">Finish this lesson</p><p className="mt-1 text-sm text-(--text-muted)">Official progress is account-linked and confirmed by the server.</p>{saveMessage ? <p className={`mt-2 text-sm ${saveState === "error" ? "text-(--danger)" : "text-(--success)"}`} role="status">{saveMessage}</p> : null}</div><button type="button" className="btn-primary" disabled={saveState === "saving" || saveState === "saved"} onClick={() => void markComplete()}>{saveState === "saving" ? "Saving…" : saveState === "saved" ? "Completed" : "Mark complete"}</button></section><nav className="mt-6 flex flex-wrap justify-between gap-3" aria-label="Lesson navigation">{previousLesson ? <Link className="btn-secondary" href={`/learn/${previousLesson.slug}`}>← {previousLesson.title}</Link> : <span />}{nextLesson ? <Link className="btn-primary" href={`/learn/${nextLesson.slug}`}>{nextLesson.title} →</Link> : <Link className="btn-primary" href="/learn">Back to catalogue</Link>}</nav></div><aside className="space-y-4 lg:sticky lg:top-28 lg:self-start"><LessonBookmarkControl lessonId={lesson.id} lessonTitle={lesson.title} /><section className="surface-card p-5"><p className="eyebrow">Sources</p><h2 className="editorial-heading mt-2 text-xl font-semibold">Verify the lesson</h2><div className="mt-4 space-y-2">{lesson.sources?.length ? lesson.sources.map((source, index) => <a key={source.id || index} className="block rounded-lg border border-(--border) p-3 hover:border-(--gold)" href={source.url || "#"} target={source.url ? "_blank" : undefined} rel={source.url ? "noopener noreferrer" : undefined}><span className="text-xs uppercase text-(--text-muted)">{source.kind || "Source"}</span><strong className="mt-1 block text-sm">{source.reference || source.title || source.label}</strong></a>) : <p className="text-sm text-(--text-muted)">No public sources are attached.</p>}</div></section></aside></div></> : null}</article>;
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
  return <div className="page-container py-8 sm:py-11">
    <nav className="mb-6 text-sm"><Link className="font-bold text-(--gold-hover) hover:underline" href={`/learn/groups/${groupSlug}`}>← Learning group</Link></nav>
    {groupLoading ? <LoadingCards /> : groupError ? <ErrorState message={groupError} retry={reload} /> : group ? <>
      <header className="max-w-3xl border-b border-(--border) pb-8"><p className="eyebrow">Official mastery</p><h1 className="editorial-heading mt-2 text-4xl font-semibold">{group.title}</h1><p className="mt-4 leading-7 text-(--text-muted)">The server selects 12 questions and requires 100% accuracy. Correct answers are withheld until submission, and offline practice never grants an unlock.</p></header>
      {result ? <section className="surface-card mt-8 border-(--gold) p-6" aria-live="polite"><p className="eyebrow">Attempt complete</p><h2 className="editorial-heading mt-2 text-3xl font-semibold">{result.mastered ? "Mastery achieved" : "Keep learning"}</h2>{score !== null ? <p className="mt-3 text-lg">Score: <strong>{score}%</strong></p> : null}<p className="mt-3 text-sm text-(--text-muted)">{result.mastered ? "The server recorded mastery and recomputed eligible unlocks." : "No new group was unlocked. Review the permitted explanations and try again when ready."}</p><div className="mt-5 flex gap-3"><Link className="btn-primary" href="/learn">View learning path</Link><button type="button" className="btn-secondary" onClick={() => { setAttempt(null); setResult(null); setAnswers({}); }}>Start another attempt</button></div></section> : attempt ? <form className="mt-8 space-y-5" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        {attempt.questions.map((question, index) => {
          const questionId = masteryQuestionId(question);
          const multiple = question.questionType === "multiple_choice";
          const selectedOptions = answers[questionId] ?? [];
          return <fieldset key={questionId} className="surface-card p-5"><legend className="px-2 font-bold">{index + 1}. {question.prompt}</legend>{multiple ? <p className="mt-2 text-xs text-(--text-muted)">Select every answer that applies.</p> : null}<div className="mt-4 grid gap-2">{question.options.map((option) => {
            const optionId = masteryOptionId(option);
            const checked = selectedOptions.includes(optionId);
            return <label key={optionId} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border p-3 ${checked ? "border-(--gold) bg-[color-mix(in_srgb,var(--gold)_8%,transparent)]" : "border-(--border)"}`}><input type={multiple ? "checkbox" : "radio"} name={questionId} value={optionId} checked={checked} onChange={() => setAnswers((current) => ({ ...current, [questionId]: multiple ? checked ? selectedOptions.filter((id) => id !== optionId) : [...selectedOptions, optionId] : [optionId] }))} /><span>{option.label ?? option.content}</span></label>;
          })}</div></fieldset>;
        })}
        <button className="btn-primary" type="submit" disabled={!allAnswered || busy}>{busy ? "Scoring…" : "Submit for official scoring"}</button>
      </form> : <section className="surface-card mt-8 p-6"><h2 className="editorial-heading text-2xl font-semibold">Ready to begin?</h2><p className="mt-3 text-sm leading-6 text-(--text-muted)">Stay online until your submission is confirmed. Refreshing is safe: the attempt and selected question versions are stored server-side.</p><button type="button" className="btn-primary mt-5" disabled={busy} onClick={() => void start()}>{busy ? "Starting…" : "Start mastery attempt"}</button></section>}
      {message ? <p className="mt-4 text-sm text-(--danger)" role="alert">{message}</p> : null}
    </> : null}
  </div>;
}

export function LearningSearch() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const url = useMemo(() => `/api/v1/learning/search?q=${encodeURIComponent(submitted)}&page=1&pageSize=20`, [submitted]);
  const { data, error, loading, reload } = useLearningResource<CatalogueItem[]>(url);
  return <div className="page-container py-8 sm:py-11"><header className="max-w-3xl"><p className="eyebrow">Discovery</p><h1 className="editorial-heading mt-2 text-4xl font-semibold">Search published learning content</h1></header><form className="mt-7 flex max-w-2xl gap-2" role="search" onSubmit={(event) => { event.preventDefault(); setSubmitted(query.trim()); }}><label className="sr-only" htmlFor="learning-search">Search lessons and subjects</label><input id="learning-search" className="form-control" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by title, keyword, source, or reference" /><button className="btn-primary" type="submit">Search</button></form><section className="mt-8" aria-live="polite">{loading ? <LoadingCards /> : error ? <ErrorState message={error} retry={reload} /> : data?.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.map((item) => <CatalogueCard key={`${item.id}-${item.slug}`} item={item} kind={(item.lessons ? "group" : "lesson")} />)}</div> : <div className="surface-card p-6 text-sm text-(--text-muted)">{submitted ? "No published results matched your search." : "Enter a search term to explore the catalogue."}</div>}</section></div>;
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
  return <div className="page-container py-8 sm:py-11"><header className="max-w-3xl border-b border-(--border) pb-8"><p className="eyebrow">Guest practice</p><h1 className="editorial-heading mt-2 text-4xl font-semibold">Practice with published questions</h1><p className="mt-4 leading-7 text-(--text-muted)">This is an explanatory practice activity. It can be cached where licensing permits, but it never grants official mastery or unlocks.</p></header>{loading ? <div className="mt-8"><LoadingCards /></div> : error ? <div className="mt-8"><ErrorState message={error} retry={reload} /></div> : !data?.length ? <div className="surface-card mt-8 p-6 text-sm text-(--text-muted)">No published practice questions are available.</div> : index >= data.length ? <section className="surface-card mt-8 border-(--gold) p-6"><p className="eyebrow">Practice complete</p><h2 className="editorial-heading mt-2 text-3xl font-semibold">{score} of {data.length}</h2><p className="mt-3 text-sm text-(--text-muted)">Practice scores remain separate from official mastery.</p><button className="btn-secondary mt-5" onClick={() => { setIndex(0); setSelected(null); setCheck(null); setScore(0); }}>Practice again</button></section> : question ? <section className="surface-card mt-8 max-w-3xl p-6"><div className="flex items-center justify-between gap-3"><p className="eyebrow">Question {index + 1} of {data.length}</p><StatusBadge tone="info">Practice only</StatusBadge></div><h2 className="editorial-heading mt-4 text-2xl font-semibold leading-snug">{question.prompt}</h2><div className="mt-6 grid gap-3">{question.options.map((option) => { const optionId = masteryOptionId(option); const isSelected = optionId === selected; return <button key={optionId} type="button" disabled={answered || checking} onClick={() => void choose(optionId)} className={`min-h-12 rounded-lg border p-3 text-left ${check && isSelected ? check.correct ? "border-(--success) bg-(--correct-bg)" : "border-(--danger) bg-(--wrong-bg)" : isSelected ? "border-(--gold)" : "border-(--border) hover:border-(--gold)"}`}>{option.label ?? option.content}</button>; })}</div>{checking ? <p className="mt-4 text-sm text-(--text-muted)" role="status">Checking answer…</p> : null}{checkError ? <p className="mt-4 text-sm text-(--danger)" role="alert">{checkError}</p> : null}{check ? <div className="mt-5 rounded-lg border border-(--border) p-4" aria-live="polite"><p className="font-bold">{check.correct ? "Correct" : "Review this answer"}</p>{check.explanation ? <p className="mt-2 text-sm leading-6 text-(--text-muted)">{check.explanation}</p> : null}{check.references?.length ? <p className="mt-2 text-xs text-(--text-muted)">Sources: {check.references.join(" · ")}</p> : null}<button className="btn-primary mt-4" onClick={next}>{index + 1 === data.length ? "See result" : "Next question"}</button></div> : null}</secti