"use client";

interface Scorer {
  rank: number;
  name: string;
  score: number;
}

interface Streaker {
  rank: number;
  name: string;
  streak: number;
}

interface LeaderboardProps {
  scorers: Scorer[];
  streakers: Streaker[];
}

export function Leaderboard({ scorers, streakers }: LeaderboardProps) {
  return (
    <div className="flex flex-col h-full py-3 px-2 text-xs">
      {/* Top Scorers */}
      <div className="mb-4">
        <h3 className="text-[color:var(--muted)] font-semibold tracking-wider text-[10px] mb-2">
          TOP SCORERS
        </h3>
        <div className="flex flex-col gap-1">
          {scorers.map((scorer) => (
            <div
              key={scorer.rank}
              className="flex items-center justify-between py-0.5"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[color:var(--muted)] w-3 text-right">
                  {scorer.rank}
                </span>
                <span
                  className={`text-[color:var(--text)] font-medium ${
                    scorer.rank <= 3 ? "text-[color:var(--accent)]" : ""
                  }`}
                >
                  {scorer.name}
                </span>
              </div>
              <span className="text-[color:var(--text)] font-bold tabular-nums">
                {scorer.score}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Streaks */}
      <div>
        <h3 className="text-[color:var(--muted)] font-semibold tracking-wider text-[10px] mb-2">
          TOP STREAKS
        </h3>
        <div className="flex flex-col gap-1">
          {streakers.map((streaker) => (
            <div
              key={streaker.rank}
              className="flex items-center justify-between py-0.5"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[color:var(--muted)] w-3 text-right">
                  {streaker.rank}
                </span>
                <span className="text-[color:var(--text)] font-medium">
                  {streaker.name}
                </span>
              </div>
              <div className="flex items-center gap-0.5 text-[color:var(--streak-icon)]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                <span className="font-bold">{streaker.streak}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
