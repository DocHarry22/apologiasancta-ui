"use client";

import { useStreak } from "@/hooks/useStreak";

export function StreakBadge() {
  const { streak } = useStreak();

  if (streak === 0) return null;

  return (
    <div
      className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
      style={{
        background: "rgba(212,175,55,0.15)",
        border: "1px solid rgba(212,175,55,0.35)",
        color: "var(--accent, #d4af37)",
      }}
      title={`${streak}-day streak`}
    >
      <span style={{ fontSize: "0.9rem" }}>🔥</span>
      <span>{streak} day{streak !== 1 ? "s" : ""}</span>
    </div>
  );
}
