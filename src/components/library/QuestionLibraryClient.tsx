"use client";

import { useMemo, useState } from "react";
import type { Question } from "@/types/content";

interface Props {
  questions: Question[];
  availableTags: string[];
}

export function QuestionLibraryClient({ questions, availableTags }: Props) {
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<number | "all">("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return questions.filter((item) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        item.question.toLowerCase().includes(normalizedQuery);

      const matchesDifficulty =
        difficulty === "all" || item.difficulty === difficulty;

      const matchesTags =
        selectedTags.length === 0 ||
        selectedTags.every((tag) => item.tags.includes(tag));

      return matchesQuery && matchesDifficulty && matchesTags;
    });
  }, [questions, query, difficulty, selectedTags]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-(--border) bg-(--card) p-4 space-y-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search question title"
          className="w-full rounded-lg border border-(--border) bg-transparent px-3 py-2 text-sm outline-none focus:border-(--accent)"
        />

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-(--muted)">Difficulty</span>
          <button
            onClick={() => setDifficulty("all")}
            className={`px-2 py-1 rounded-full text-xs border ${
              difficulty === "all"
                ? "border-(--accent) text-(--accent)"
                : "border-(--border) text-(--muted)"
            }`}
          >
            All
          </button>
          {[1, 2, 3, 4, 5].map((level) => (
            <button
              key={level}
              onClick={() => setDifficulty(level)}
              className={`px-2 py-1 rounded-full text-xs border ${
                difficulty === level
                  ? "border-(--accent) text-(--accent)"
                  : "border-(--border) text-(--muted)"
              }`}
            >
              {level}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {availableTags.map((tag) => {
            const active = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-2 py-1 rounded-full text-xs border transition-colors ${
                  active
                    ? "border-(--accent2) text-(--accent2)"
                    : "border-(--border) text-(--muted) hover:text-foreground"
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map((item) => (
          <article
            key={item.id}
            className="rounded-xl border border-(--border) bg-(--card) p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-foreground">
                {item.question}
              </h3>
              <span className="text-xs text-(--muted)">D{item.difficulty}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {item.tags.map((tag) => (
                <span
                  key={`${item.id}-${tag}`}
                  className="rounded-full bg-(--ticker-bg) px-2 py-0.5 text-[10px] text-(--text-secondary)"
                >
                  {tag}
                </span>
              ))}
            </div>
          </article>
        ))}

        {filtered.length === 0 && (
          <p className="text-sm text-(--muted)">No questions match your filters.</p>
        )}
      </div>
    </section>
  );
}
