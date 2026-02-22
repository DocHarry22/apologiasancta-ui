"use client";

import { useRef, useState, useEffect } from "react";
import type { 
  Leaderboard, 
  LeaderboardWithChanges, 
  Scorer, 
  Streaker,
  ScorerWithChange,
  StreakerWithChange
} from "@/types/quiz";

/**
 * Hook that diffs consecutive leaderboard updates and marks changed entries.
 * Changed entries trigger a one-shot animation via CSS class.
 * 
 * @param leaderboard - Current leaderboard data from server
 * @returns Leaderboard with `changed` flags for animation
 */
export function useLeaderboardDiff(leaderboard: Leaderboard): LeaderboardWithChanges {
  const prevScorersRef = useRef<Scorer[]>([]);
  const prevStreakersRef = useRef<Streaker[]>([]);
  const [result, setResult] = useState<LeaderboardWithChanges>({
    topScorers: leaderboard.topScorers.map(s => ({ ...s, changed: false })),
    topStreaks: leaderboard.topStreaks.map(s => ({ ...s, changed: false })),
  });

  useEffect(() => {
    const prevScorers = prevScorersRef.current;
    const prevStreakers = prevStreakersRef.current;

    // Diff scorers - mark as changed if score increased or rank changed
    const scorersWithChanges: ScorerWithChange[] = leaderboard.topScorers.map((scorer) => {
      const prev = prevScorers.find((p) => p.name === scorer.name);
      const changed = prev 
        ? prev.score !== scorer.score || prev.rank !== scorer.rank
        : true; // New entry
      return { ...scorer, changed };
    });

    // Diff streakers - mark as changed if streak increased or rank changed
    const streakersWithChanges: StreakerWithChange[] = leaderboard.topStreaks.map((streaker) => {
      const prev = prevStreakers.find((p) => p.name === streaker.name);
      const changed = prev 
        ? prev.streak !== streaker.streak || prev.rank !== streaker.rank
        : true; // New entry
      return { ...streaker, changed };
    });

    // Store current as previous for next effect
    prevScorersRef.current = leaderboard.topScorers;
    prevStreakersRef.current = leaderboard.topStreaks;

    setResult({
      topScorers: scorersWithChanges,
      topStreaks: streakersWithChanges,
    });
  }, [leaderboard]);

  return result;
}
