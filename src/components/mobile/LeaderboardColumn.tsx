"use client";

import type { ScorerWithChange, StreakerWithChange } from "@/types/quiz";

interface LeaderboardColumnProps {
  scorers: ScorerWithChange[];
  streakers: StreakerWithChange[];
}

export function LeaderboardColumn({ scorers, streakers }: LeaderboardColumnProps) {
  return (
    <div 
      className="flex flex-col h-full py-2 px-1.5 overflow-y-auto"
      role="region"
      aria-label="Leaderboard"
    >
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
                    scorer.rank <= 3 ? "text-(--accent)" : "text-(--text)"
                  }`}
                >
                  {scorer.name}
                </span>
              </div>
              <span 
                className="text-(--text) text-[10px] font-bold tabular-nums shrink-0 ml-1"
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
                <span className="text-(--text) text-[10px] font-medium truncate">
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
