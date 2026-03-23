"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getEngineUrl } from "@/lib/publicEnv";

const ENGINE_URL = getEngineUrl();

interface EngineTopic {
  id: string;
  title: string;
  questionCount: number;
}

interface EngineTopicsResponse {
  topics: EngineTopic[];
  totalQuestions: number;
}

/**
 * Client component that fetches topics from the engine API.
 * Shows loading state while fetching, and fallback message if engine is unavailable.
 */
export function EngineTopicsList() {
  const [topics, setTopics] = useState<EngineTopic[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTopics = async (initial = false) => {
    if (!ENGINE_URL) {
      setError("Engine URL not configured");
      setLoading(false);
      return;
    }

    if (initial) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    const url = `${ENGINE_URL}/topics`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Failed to fetch topics: ${res.status}`);
      }
      const data: EngineTopicsResponse = await res.json();
      setTopics(data.topics);
      setTotalQuestions(data.totalQuestions);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load topics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchTopics(true);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-(--muted)">Loading topics from engine...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-6 text-center">
        <p className="text-sm text-yellow-500">{error}</p>
        <p className="mt-2 text-xs text-(--muted)">
          Import questions via the Author dashboard to populate the engine.
        </p>
      </div>
    );
  }

  if (topics.length === 0) {
    return (
      <div className="rounded-xl border border-(--border) bg-(--card) p-6 text-center">
        <p className="text-sm text-(--muted)">No topics available in engine bank.</p>
        <p className="mt-2 text-xs text-(--muted)">
          Engine URL: {ENGINE_URL || "not set"}
        </p>
        <p className="mt-2 text-xs text-(--muted)">
          Import questions via the{" "}
          <Link href="/author" className="text-(--accent) hover:underline">
            Author dashboard
          </Link>{" "}
          to get started.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-(--muted)">
          {topics.length} topic{topics.length !== 1 ? "s" : ""} • {totalQuestions} total questions
        </p>
        <button
          onClick={() => void fetchTopics(false)}
          disabled={refreshing}
          className="rounded-lg border border-(--border) px-3 py-1 text-xs font-medium text-(--muted) hover:border-(--accent) hover:text-(--accent) transition-colors disabled:opacity-60"
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {topics.map((topic) => (
          <Link
            key={topic.id}
            href={`/library/${topic.id}`}
            className="rounded-xl border border-(--border) bg-(--card) p-4 hover:border-(--accent) transition-colors"
          >
            <h2 className="text-lg font-semibold">{topic.title}</h2>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-(--muted)">{topic.questionCount} questions</span>
              <span className="text-xs text-(--accent)">Open</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
