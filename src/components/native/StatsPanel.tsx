"use client";

import { useScoreHistory } from "@/hooks/useScoreHistory";

export function StatsPanel() {
  const { totalQuizzes, accuracy, bestScore } = useScoreHistory();

  const stats = [
    { label: "Quizzes", value: totalQuizzes },
    { label: "Accuracy", value: `${accuracy}%` },
    { label: "Best Score", value: bestScore > 0 ? bestScore.toLocaleString() : "—" },
  ];

  return (
    <section className="mx-4 mb-6">
      <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(244,239,229,0.5)" }}>
        Your Stats
      </h2>
      <div className="grid grid-cols-3 gap-3">
        {stats.map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl px-3 py-3 flex flex-col items-center justify-center"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <span
              className="text-xl font-bold"
              style={{ color: "var(--accent, #d4af37)" }}
            >
              {value}
            </span>
            <span className="text-xs mt-0.5" style={{ color: "rgba(244,239,229,0.55)" }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
