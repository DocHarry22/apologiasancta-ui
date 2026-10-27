"use client";

import { ReportIssue } from "@/components/content/ReportIssue";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/Primitives";
import { getEngineUrl } from "@/lib/publicEnv";
import { AppIcon } from "@/components/native/AppIcon";
import { StudySearch } from "@/components/native/StudyUI";
import styles from "@/components/native/StudyUI.module.css";

export interface EngineTopicResponse {
  id: string;
  title: string;
  questionCount: number;
  questions: Array<{ id: string; text: string; themeTitle: string; difficulty: number; choices: Array<{ id: string; label: string; text: string }> }>;
}

export function EngineTopicDetails({ topicId, fallbackTopic = null }: { topicId: string; fallbackTopic?: EngineTopicResponse | null }) {
  const [topic, setTopic] = useState<EngineTopicResponse | null>(fallbackTopic);
  const [source, setSource] = useState<"engine" | "bundled" | null>(fallbackTopic ? "bundled" : null);
  const [loading, setLoading] = useState(!fallbackTopic);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"index" | "title" | "difficulty">("index");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setTopic(fallbackTopic);
    setSource(fallbackTopic ? "bundled" : null);
    setLoading(!fallbackTopic);
    setError(null);
    const engineUrl = getEngineUrl();
    const applyFallback = () => { if (fallbackTopic) { setTopic(fallbackTopic); setSource("bundled"); setError(null); } else { setError("This topic is unavailable from both the live Engine and bundled catalogue."); } setLoading(false); };
    if (!engineUrl) { applyFallback(); return; }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    fetch(`${engineUrl}/topics/${encodeURIComponent(topicId)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(`Topic unavailable (${response.status})`); return response.json() as Promise<EngineTopicResponse>; })
      .then((data) => { if (!Array.isArray(data.questions)) throw new Error("Invalid topic"); if (active) { setTopic(data); setSource("engine"); setError(null); setLoading(false); } })
      .catch(() => { if (active) applyFallback(); })
      .finally(() => window.clearTimeout(timeout));
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [fallbackTopic, topicId, attempt]);

  const filtered = useMemo(() => {
    if (!topic) return [];
    const normalized = query.trim().toLowerCase();
    const next = topic.questions.map((question, index) => ({ question, index })).filter(({ question }) => (!normalized || question.text.toLowerCase().includes(normalized) || question.id.toLowerCase().includes(normalized)) && (difficultyFilter === "all" || question.difficulty === Number(difficultyFilter)));
    if (sortBy === "title") next.sort((a, b) => a.question.text.localeCompare(b.question.text));
    if (sortBy === "difficulty") next.sort((a, b) => a.question.difficulty - b.question.difficulty);
    return next;
  }, [query, sortBy, difficultyFilter, topic]);

  return <div className={styles.screen}>
    <Link href="/library" className={styles.breadcrumb}><AppIcon name="chevron" width={15} height={15} /> Back to library</Link>
    {loading ? <header className="space-y-3" aria-label="Loading collection"><Skeleton className="h-4 w-28" /><Skeleton className="h-12 w-72 max-w-full" /></header>
      : error ? <div className={styles.empty} role="alert"><AppIcon name="library" /><h1>Topic unavailable</h1><p>{error}</p><button type="button" className="btn-secondary" onClick={() => setAttempt((value) => value + 1)}>Try again</button></div>
      : topic ? <>
        <header className={styles.intro}><p className={styles.eyebrow}>Question collection</p><h1 className={styles.title}>{topic.title}</h1><p>Explore the questions. Consider the possibilities. Take your understanding a little deeper.</p><div className={styles.stats}><span><strong>{topic.questionCount}</strong> published questions</span><span>{source === "engine" ? "Updated from the live catalogue" : "Bundled collection"}</span></div></header>
        <StudySearch id="topic-search" label="Search questions" value={query} onChange={setQuery} placeholder="Find a question in this collection…" />
        <details className={styles.filters}><summary><AppIcon name="filter" width={16} height={16} /> Refine this collection{difficultyFilter !== "all" ? " · difficulty filter active" : ""}</summary><div className={styles.filterGrid}>
          <label>Difficulty<select value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value)}><option value="all">All levels</option>{[1, 2, 3, 4, 5].map((level) => <option key={level} value={level}>Level {level}</option>)}</select></label>
          <label>Sort order<select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}><option value="index">Original order</option><option value="title">Question title A–Z</option><option value="difficulty">Difficulty</option></select></label>
        </div></details>
        <div className={styles.sectionHeading}><div><h2>A question to reflect on</h2><p aria-live="polite">Showing {filtered.length} of {topic.questions.length} questions</p></div></div>
        <section className={styles.questionList} aria-label={topic.title + " questions"}>{filtered.map(({ question, index }) => {
          const expanded = expandedId === question.id;
          const difficulty = question.difficulty <= 2 ? "Foundation" : question.difficulty === 3 ? "Intermediate" : "Advanced";
          return <article key={question.id} className={styles.question}>
            <h2><button type="button" className={styles.questionButton} onClick={() => setExpandedId(expanded ? null : question.id)} aria-expanded={expanded} aria-controls={"question-choices-" + index}><span className={styles.questionNumber}>{String(index + 1).padStart(2, "0")}</span><span className={styles.questionText}><strong>{question.text}</strong><small>{difficulty} · Tap to {expanded ? "close" : "explore"}</small></span><AppIcon name="chevron" width={16} height={16} /></button></h2>
            {expanded ? <div className={styles.questionContent} id={"question-choices-" + index}><div className={styles.choices}>{question.choices.map((choice) => <div key={choice.id} className={styles.choice}><span>{choice.label}</span><span>{choice.text}</span></div>)}</div><p className={styles.sourceNote}>Answers and explanations are available in Practice. Browsing a collection does not submit an answer.</p><ReportIssue app="quiz" contentType="question" contentId={question.id} title={question.text} snapshot={question} /></div> : null}
          </article>;
        })}</section>
        {!filtered.length ? <div className={styles.empty}><AppIcon name="search" /><h2>No matching questions.</h2><p>Try a different word or broaden the difficulty filter.</p><button type="button" className="btn-secondary" onClick={() => { setQuery(""); setDifficultyFilter("all"); }}>Clear filters</button></div> : null}
        <section className={styles.compactFeature}><div><h2>Ready to test what you know?</h2><p>Switch to Practice for questions with answer explanations.</p></div><Link href="/practice" aria-label="Open practice"><AppIcon name="arrow" width={21} height={21} /></Link></section>
      </> : null}
  </div>;
}
