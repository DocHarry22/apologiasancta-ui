"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { getEngineUrl } from "@/lib/publicEnv";

const ENGINE_URL = getEngineUrl();

interface EngineChoice {
  id: string;
  label: string;
  text: string;
}

interface EngineQuestion {
  id: string;
  text: string;
  themeTitle: string;
  difficulty: number;
  choices: EngineChoice[];
}

interface EngineTopicResponse {
  id: string;
  title: string;
  questionCount: number;
  questions: EngineQuestion[];
}

interface Props {
  topicId: string;
}

/**
 * Client component that fetches and displays topic details from the engine.
 */
export function EngineTopicDetails({ topicId }: Props) {
  const [topic, setTopic] = useState<EngineTopicResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"index" | "id-asc" | "id-desc">("index");

  useEffect(() => {
    console.log(`[EngineTopicDetails] Loading topic: ${topicId}, ENGINE_URL: ${ENGINE_URL}`);
    if (!ENGINE_URL) {
      setError("Engine URL not configured");
      setLoading(false);
      return;
    }

    const fetchTopic = async () => {
      const url = `${ENGINE_URL}/topics/${encodeURIComponent(topicId)}`;
      console.log(`[EngineTopicDetails] Fetching from: ${url}`);
      try {
        const res = await fetch(url);
        console.log(`[EngineTopicDetails] Response status: ${res.status}`);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("Topic not found in engine bank");
          }
          throw new Error(`Failed to fetch topic: ${res.status}`);
        }
        const data: EngineTopicResponse = await res.json();
        console.log(`[EngineTopicDetails] Received: ${data.questions?.length || 0} questions`);
        setTopic(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load topic");
      } finally {
        setLoading(false);
      }
    };

    fetchTopic();
  }, [topicId]);

  const getDifficultyLabel = (d: number) => {
    if (d <= 1) return "Easy";
    if (d <= 2) return "Easy";
    if (d === 3) return "Medium";
    if (d === 4) return "Hard";
    return "Very Hard";
  };

  const getDifficultyColor = (d: number) => {
    if (d <= 2) return "text-green-500";
    if (d === 3) return "text-yellow-500";
    return "text-red-500";
  };

  const filteredQuestions = useMemo(() => {
    if (!topic) return [];

    const normalized = query.trim().toLowerCase();
    const withIndex = topic.questions.map((question, index) => ({ question, index }));

    const filtered = withIndex.filter(({ question }) => {
      if (!normalized) return true;
      return (
        question.text.toLowerCase().includes(normalized) ||
        question.id.toLowerCase().includes(normalized)
      );
    });

    if (sortBy === "id-asc") {
      filtered.sort((a, b) => a.question.id.localeCompare(b.question.id, undefined, { numeric: true }));
    } else if (sortBy === "id-desc") {
      filtered.sort((a, b) => b.question.id.localeCompare(a.question.id, undefined, { numeric: true }));
    }

    return filtered;
  }, [topic, query, sortBy]);

  return (
    <main className="min-h-screen bg-background text-foreground p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="space-y-2">
          <div className="flex items-center justify-between">
            <Link href="/library" className="text-sm text-[var(--accent)] hover:underline">
              ← Back to topics
            </Link>
            <ThemeToggle />
          </div>
          
          {loading ? (
            <div className="animate-pulse">
              <div className="h-4 w-24 bg-[var(--muted)]/20 rounded mb-2" />
              <div className="h-8 w-48 bg-[var(--muted)]/20 rounded" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
              <p className="text-sm text-yellow-500">{error}</p>
            </div>
          ) : topic ? (
            <>
              <p className="text-xs uppercase tracking-widest text-(--muted)">{topic.id}</p>
              <h1 className="text-3xl font-semibold">{topic.title}</h1>
              <p className="text-sm text-(--text-secondary)">{topic.questionCount} questions</p>
            </>
          ) : null}
        </header>

        {!loading && !error && topic && (
          <section className="space-y-3">
            <div className="rounded-xl border border-(--border) bg-(--card) p-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by question text or ID"
                  className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "index" | "id-asc" | "id-desc")}
                  className="w-full rounded-lg border border-(--border) bg-(--card) px-3 py-2 text-sm text-foreground outline-none focus:border-(--accent)"
                  style={{ color: "var(--foreground)", backgroundColor: "var(--card)" }}
                >
                  <option value="index" style={{ color: "var(--foreground)", backgroundColor: "var(--card)" }}>
                    Sort: Original Order
                  </option>
                  <option value="id-asc" style={{ color: "var(--foreground)", backgroundColor: "var(--card)" }}>
                    Sort: ID (A→Z)
                  </option>
                  <option value="id-desc" style={{ color: "var(--foreground)", backgroundColor: "var(--card)" }}>
                    Sort: ID (Z→A)
                  </option>
                </select>
              </div>
              <p className="text-xs text-(--muted)">
                Showing {filteredQuestions.length} of {topic.questions.length} questions
              </p>
            </div>

            {filteredQuestions.map(({ question: q, index }) => (
              <div
                key={q.id}
                className="rounded-xl border border-(--border) bg-(--card) overflow-hidden"
              >
                <button
                  onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                  className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-(--card-border)/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-(--muted)">
                      #{index + 1}
                    </span>
                    <span className="text-xs font-mono text-(--muted)">{q.id}</span>
                    <span className="text-sm font-medium line-clamp-1">{q.text}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-medium ${getDifficultyColor(q.difficulty)}`}>
                      {getDifficultyLabel(q.difficulty)}
                    </span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className={`text-(--muted) transition-transform ${expandedId === q.id ? "rotate-180" : ""}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </button>

                {expandedId === q.id && (
                  <div className="px-4 pb-4 pt-2 border-t border-(--border)">
                    <p className="text-sm mb-3">{q.text}</p>
                    <div className="grid gap-2">
                      {q.choices.map((choice) => (
                        <div
                          key={choice.id}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background border border-(--border)"
                        >
                          <span className="w-6 h-6 flex items-center justify-center rounded-full border border-(--accent) text-xs font-bold text-(--accent)">
                            {choice.label}
                          </span>
                          <span className="text-sm">{choice.text}</span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-(--muted)">
                      Theme: {q.themeTitle} • ID: {q.id} • Index: {index + 1}
                    </p>
                  </div>
                )}
              </div>
            ))}

            {filteredQuestions.length === 0 && (
              <div className="rounded-xl border border-(--border) bg-(--card) p-6 text-center">
                <p className="text-sm text-(--muted)">No questions match your search.</p>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
