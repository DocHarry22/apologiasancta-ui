"use client";

import type { LeaderboardPeriod, LeaderboardScope, ScorerWithChange, StreakerWithChange } from "@/types/quiz";
import type { LeaderboardMode as SharedLeaderboardMode } from "@/lib/mobileUx";

export type LeaderboardMode = SharedLeaderboardMode;

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
      className="flex h-full flex-col overflow-y-auto px-3 py-3"
      role="region"
      aria-label="Leaderboard"
    >
      <div className="mb-4 rounded-xl border border-(--border) px-3 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-(--muted)">Leaderboard</div>
        <div className="mt-1 text-sm font-semibold text-foreground">{roomName || "Current Room"}</div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-(--text-secondary)">{scope} • {period}</div>
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          {MODE_OPTIONS.map((option) => {
            const active = option.id === selectedMode;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onModeChange?.(option.id)}
                aria-pressed={active}
                className="min-h-9 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
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
        <div className="mb-3 rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: "var(--wrong-bg)", color: "var(--wrong)" }}>
          {error}
        </div>
      )}

      {loading && (
        <div className="mb-3 rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: "var(--ticker-bg)", color: "var(--muted)" }}>
          Loading leaderboard...
        </div>
      )}

      {/* Top Scorers */}
      <div className="mb-3">
        <h3 
          className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-(--muted)"
          id="top-scorers-heading"
        >
          Top Scorers
        </h3>
        <div className="flex flex-col" role="list" aria-labelledby="top-scorers-heading">
          {scorers.slice(0, 10).map((scorer) => (
            <div
              key={`scorer-${scorer.name}`}
              role="listitem"
              className={`flex min-h-8 items-center justify-between rounded px-1.5 py-1 transition-colors ${
                scorer.changed ? "score-changed" : ""
              }`}
            >
              <div className="flex items-center gap-1 min-w-0">
                <span 
                  className="w-4 shrink-0 text-right text-[11px] text-(--muted)"
                  aria-label={`Rank ${scorer.rank}`}
                >
                  {scorer.rank}
                </span>
                <span
                  className={`truncate text-xs font-medium ${
                    scorer.rank <= 3 ? "text-(--accent)" : "text-foreground"
                  }`}
                >
                  {scorer.name}
                </span>
              </div>
              <span 
                className="ml-1 shrink-0 text-xs font-bold tabular-nums text-foreground"
                aria-label={`${scorer.score} points`}
              >
                {scorer.score}
              </span>
              {scorer.rankDelta && scorer.rankDelta > 0 ? (
                <span className="ml-1 rounded-sm bg-(--correct-bg) px-1 text-[8px] font-bold text-(--correct)">
                  +{scorer.rankDelta}
                </span>
              ) : null}
            </div>
          ))}
          {scorers.length === 0 && !loading && !error ? (
            <p className="rounded-lg border border-dashed border-(--border) px-3 py-4 text-center text-xs text-(--muted)">No scores yet</p>
          ) : null}
        </div>
      </div>

      {/* Top Streaks */}
      <div>
        <h3 
          className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-(--muted)"
          id="top-streaks-heading"
        >
          Top Streaks
        </h3>
        <div className="flex flex-col" role="list" aria-labelledby="top-streaks-heading">
          {streakers.slice(0, 5).map((streaker) => (
            <div
              key={`streaker-${streaker.name}`}
              role="listitem"
              className={`flex min-h-8 items-center justify-between rounded px-1.5 py-1 transition-colors ${
                streaker.changed ? "score-changed" : ""
              }`}
            >
              <div className="flex items-center gap-1 min-w-0">
                <span 
                  className="w-4 shrink-0 text-right text-[11px] text-(--muted)"
                  aria-label={`Rank ${streaker.rank}`}
                >
                  {streaker.rank}
                </span>
                <span className="truncate text-xs font-medium text-foreground">
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
              {streaker.rankDelta && streaker.rankDelta > 0 ? (
                <span className="ml-1 rounded-sm bg-(--correct-bg) px-1 text-[8px] font-bold text-(--correct)">
                  +{streaker.rankDelta}
                </span>
              ) : null}
            </div>
          ))}
          {streakers.length === 0 && !loading && !error ? (
            <p className="rounded-lg border border-dashed border-(--border) px-3 py-4 text-center text-xs text-(--muted)">No streaks yet</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
