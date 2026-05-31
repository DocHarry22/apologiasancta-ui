"use client";

import { useMemo } from "react";
import { getDailyVerse } from "@/lib/verses";

export function VerseOfTheDay() {
  const verse = useMemo(() => getDailyVerse(), []);

  return (
    <section className="mx-4 mb-6">
      <div
        className="rounded-2xl px-5 py-4 border"
        style={{
          background: "linear-gradient(135deg, rgba(212,175,55,0.08) 0%, rgba(212,175,55,0.03) 100%)",
          borderColor: "rgba(212,175,55,0.25)",
        }}
      >
        <p className="text-xs font-semibold mb-2 uppercase tracking-widest" style={{ color: "var(--accent, #d4af37)" }}>
          Verse of the Day
        </p>
        {/* Cross icon */}
        <div className="flex items-start gap-3">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            className="shrink-0 mt-1"
            style={{ color: "var(--accent, #d4af37)" }}
          >
            <path d="M12 2v20M2 7h20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <blockquote>
            <p className="text-sm leading-relaxed italic" style={{ color: "var(--mobile-text, #f4efe5)" }}>
              &ldquo;{verse.text}&rdquo;
            </p>
            <cite className="block mt-2 text-xs not-italic font-semibold" style={{ color: "var(--accent, #d4af37)" }}>
              — {verse.reference}
            </cite>
          </blockquote>
        </div>
      </div>
    </section>
  );
}
