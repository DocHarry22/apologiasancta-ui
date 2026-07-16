"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EmptyState, Skeleton, StatusBadge } from "@/components/ui/Primitives";
import { getEngineUrl } from "@/lib/publicEnv";

export interface EngineTopicResponse {
  id: string;
  title: string;
  questionCount: number;
  questions: Array<{ id: string; text: string; themeTitle: string; difficulty: number; choices: Array<{ id: string; label: string; text: string }> }>;
}

export function EngineTopicDetails({ topicId, fallbackTopic = null }: { topicId: string; fallbackTopic?: EngineTopicResponse | null }) {
  const [topic, setTopic] = useState<EngineTopicResponse | null>(null);
  const [source, setSource] = useState<"engine" | "bundled" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"index" | "id-asc" | "id-desc">("index");

  useEffect(() => {
    const engineUrl = getEngineUrl();
    const applyFallback = () => { if (fallbackTopic) { setTopic(fallbackTopic); setSource("bundled"); setError(null); } else { setError("This topic is unavailable from both the live Engine and bundled catalogue."); } setLoading(false); };
    if (!engineUrl) { applyFallback(); return; }
    const controller = new AbortController();
    fetch(`${engineUrl}/topics/${encodeURIComponent(topicId)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(`Topic unavailable (${response.status})`); return response.json() as Promise<EngineTopicResponse>; })
      .then((data) => { setTopic(data); setSource("engine"); setError(null); setLoading(false); })
      .catch((loadError) => { if ((loadError as Error).name !== "AbortError") applyFallback(); });
    return () => controller.abort();
  }, [fallbackTopic, topicId]);

  const filtered = useMemo(() => {
    if (!topic) return [];
    const normalized = query.trim().toLowerCase();
    const next = topic.questions.map((question, index) => ({ question, index })).filter(({ question }) => !normalized || question.text.toLowerCase().includes(normalized) || question.id.toLowerCase().includes(normalized));
    if (sortBy === "id-asc") next.sort((a, b) => a.question.id.localeCompare(b.question.id, undefined, { numeric: true }));
    if (sortBy === "id-desc") next.sort((a, b) => b.question.id.localeCompare(a.question.id, undefined, { numeric: true }));
    return next;
  }, [query, sortBy, topic]);

  return (
    <div className="page-container py-8 sm:py-11">
      <div className="mx-auto max-w-4xl">
        <Link href="/library" className="text-sm font-bold text-(--gold-hover) hover:underline">← Back to library</Link>
        {loading ? <header className="mt-6 space-y-3"><Skeleton className="h-4 w-28" /><Skeleton className="h-12 w-72 max-w-full" /></header>
        : error ? <div className="mt-6"><EmptyState title="Topic unavailable" description={error} action={<Link href="/library" className="btn-secondary">Browse the library</Link>} /></div>
        : topic ? <>
          <header className="mt-6 border-b border-(--border) pb-7"><div className="flex flex-wrap items-center gap-2"><p className="eyebrow">Question collection</p><StatusBadge tone={source === "engine" ? "success" : "warning"}>{source === "engine" ? "Live Engine" : "Bundled offline copy"}</StatusBadge></div><h1 className="editorial-heading mt-2 text-4xl font-semibold sm:text-5xl">{topic.title}</h1><p className="mt-3 text-(--text-muted)">{topic.questionCount} published questions. Answers are intentionally hidden in library browsing; use Practice to test yourself with explanations.</p></header>
          <section className="surface-card mt-6 p-4" aria-label="Question filters"><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-(--text-muted)">Search questions<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Question text or ID" className="form-control mt-1" /></label><label className="text-xs font-bold text-(--text-muted)">Sort order<select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className="form-control mt-1"><option value="index">Original order</option><option value="id-asc">ID (A→Z)</option><option value="id-desc">ID (Z→A)</option></select></label></div><p className="mt-3 text-xs text-(--text-muted)">Showing {filtered.length} of {topic.questions.length} questions</p></section>
          <section className="mt-4 space-y-3" aria-label={`${topic.title} questions`}>{filtered.map(({ question, index }) => {
            const expanded = expandedId === question.id;
            const difficulty = question.difficulty <= 2 ? "Foundation" : question.difficulty === 3 ? "Intermediate" : "Advanced";
            return <article key={question.id} className="surface-card overflow-hidden"><h2><button type="button" onClick={() => setExpandedId(expanded ? null : question.id)} aria-expanded={expanded} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-(--surface-elevated)"><span className="font-mono text-xs text-(--text-muted)">#{index + 1}</span><span className="min-w-0 flex-1 font-semibold">{question.text}</span><StatusBadge>{difficulty}</StatusBadge><span className={expanded ? "rotate-180" : ""} aria-hidden="true">⌄</span></button></h2>{expanded ? <div className="border-t border-(--border) p-4"><div className="grid gap-2 sm:grid-cols-2">{question.choices.map((choice) => <div key={choice.id} className="flex min-h-12 items-center gap-3 rounded-lg border border-(--border) bg-(--surface-elevated) px-3 py-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-(--gold) text-xs font-bold text-(--gold-hover)">{choice.label}</span><span className="text-sm">{choice.text}</span></div>)}</div><p className="mt-3 text-xs text-(--text-muted)">Topic: {question.themeTitle} · ID: {question.id}</p></div> : null}</article>;
          })}</section>
          {!filtered.length ? <EmptyState title="No matching questions" description="Try a different word or clear the search field." /> : null}
        </> : null}
      </div>
    </div>
  );
}
