"use client";

import type { LeaderboardPeriod, LeaderboardScope, ScorerWithChange, StreakerWithChange } from "@/types/quiz";

export type LeaderboardMode = "room-all-time" | "room-daily" | "room-weekly" | "global-all-time";

interface LeaderboardColumnProps {
  scorers: ScorerWithChange[];
  streakers: StreakerWithChange[];
  roomName?: string;
  scope?: LeaderboardScope;
  period?: LeaderboardPeriod;
  selectedMode?: LeaderboardMode;
  onModeChange?: (mode: LeaderboardMode) => void;
  loading?: boolean;
  error?: string | null;
}

const MODE_OPTIONS: Array<{ id: LeaderboardMode; label: string }> = [
  { id: "room-all-time", label: "Room All-Time" },
  { id: "room-daily", label: "Room Daily" },
  { id: "room-weekly", label: "Room Weekly" },
  { id: "global-all-time", label: "Global All-Time" },
];

export function LeaderboardColumn({
  scorers,
  streakers,
  roomName,
  scope = "room",
  period = "all-time",
  selectedMode = "room-all-time",
  onModeChange,
  loading = false,
  error = null,
}: LeaderboardColumnProps) {
  return (
    <div 
      className="flex flex-col h-full py-2 px-1.5 overflow-y-auto"
      role="region"
      aria-label="Leaderboard"
    >
      <div className="mb-3 rounded-lg border border-(--border) px-2 py-2">
        <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-(--muted)">Leaderboard</div>
        <div className="mt-1 text-[11px] font-semibold text-foreground">{roomName || "Current Room"}</div>
        <div className="mt-1 text-[9px] uppercase tracking-[0.16em] text-(--text-secondary)">{scope} • {period}</div>
        <div className="mt-2 grid grid-cols-2 gap-1">
          {MODE_OPTIONS.map((option) => {
            const active = option.id === selectedMode;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onModeChange?.(option.id)}
                className="rounded-md px-2 py-1 text-[10px] font-semibold transition-colors"
                style={{
                  backgroundColor: active ? "var(--accent)" : "var(--ticker-bg)",
                  color: active ? "#fff" : "var(--text-secondary)",
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg px-2 py-2 text-[10px]" style={{ backgroundColor: "var(--wrong-bg)", color: "var(--wrong)" }}>
          {error}
        </div>
      )}

      {loading && (
        <div className="mb-3 rounded-lg px-2 py-2 text-[10px]" style={{ backgroundColor: "var(--ticker-bg)", color: "var(--muted)" }}>
          Loading leaderboard...
        </div>
      )}

      {/* Top Scorers */}
      <div className="mb-3">
        <h3 
          className="text-(--muted) font-semibold tracking-wider text-[9px] mb-1.5 uppercase"
          id="top-scorers-heading"
        >
          Top Scorers
        </h3>
        <div className="flex flex-col" role="list" aria-labelledby="top-scorers-heading">
          {scorers.slice(0, 10).map((scorer) => (
            <div
              key={`scorer-${scorer.rank}-${scorer.name}`}
              role="listitem"
              className={`flex items-center justify-between py-0.5 px-0.5 rounded transition-colors ${
                scorer.changed ? "score-changed" : ""
              }`}
            >
              <div className="flex items-center gap-1 min-w-0">
                <span 
                  className="text-(--muted) text-[10px] w-2.5 text-right shrink-0"
                  aria-label={`Rank ${scorer.rank}`}
                >
                  {scorer.rank}
                </span>
                <span
                  className={`text-[10px] font-medium truncate ${
                    scorer.rank <= 3 ? "text-(--accent)" : "text-foreground"
                  }`}
                >
                  {scorer.name}
                </span>
              </div>
              <span 
                className="text-foreground text-[10px] font-bold tabular-nums shrink-0 ml-1"
                aria-label={`${scorer.score} points`}
              >
                {scorer.score}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Streaks */}
      <div>
        <h3 
          className="text-(--muted) font-semibold tracking-wider text-[9px] mb-1.5 uppercase"
          id="top-streaks-heading"
        >
          Top Streaks
        </h3>
        <div className="flex flex-col" role="list" aria-labelledby="top-streaks-heading">
          {streakers.slice(0, 5).map((streaker) => (
            <div
              key={`streaker-${streaker.rank}-${streaker.name}`}
              role="listitem"
              className={`flex items-center justify-between py-0.5 px-0.5 rounded transition-colors ${
                streaker.changed ? "score-changed" : ""
              }`}
            >
              <div className="flex items-center gap-1 min-w-0">
                <span 
                  className="text-(--muted) text-[10px] w-2.5 text-right shrink-0"
                  aria-label={`Rank ${streaker.rank}`}
                >
                  {streaker.rank}
                </span>
                <span className="text-foreground text-[10px] font-medium truncate">
                  {streaker.name}
                </span>
              </div>
              <div 
                className="flex items-center gap-0.5 text-(--streak-icon) shrink-0 ml-1"
                aria-label={`${streaker.streak} streak`}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                <span className="text-[10px] font-bold">{streaker.streak}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
