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

  // Serialize array contents so the effect only re-runs when data actually
  // changes, not on every render where the leaderboard object gets a new reference.
  const scorersKey = JSON.stringify(leaderboard.topScorers);
  const streakersKey = JSON.stringify(leaderboard.topStreaks);

  useEffect(() => {
    const prevScorers = prevScorersRef.current;
    const prevStreakers = prevStreakersRef.current;

    // Diff scorers - mark as changed if score increased or rank changed
    const scorersWithChanges: ScorerWithChange[] = leaderboard.topScorers.map((scorer) => {
      const prev = prevScorers.find((p) => p.name === scorer.name);
      const changed = prev 
        ? prev.score !== scorer.score || prev.rank !== scorer.rank
        : true; // New entry
      return {
        ...scorer,
        changed,
        rankDelta: prev ? prev.rank - scorer.rank : undefined,
        scoreDelta: prev ? scorer.score - prev.score : undefined,
        enteredTop10: !prev,
      };
    });

    // Diff streakers - mark as changed if streak increased or rank changed
    const streakersWithChanges: StreakerWithChange[] = leaderboard.topStreaks.map((streaker) => {
      const prev = prevStreakers.find((p) => p.name === streaker.name);
      const changed = prev 
        ? prev.streak !== streaker.streak || prev.rank !== streaker.rank
        : true; // New entry
      return {
        ...streaker,
        changed,
        rankDelta: prev ? prev.rank - streaker.rank : undefined,
      };
    });

    // Store current as previous for next effect
    prevScorersRef.current = leaderboard.topScorers;
    prevStreakersRef.current = leaderboard.topStreaks;

    setResult({
      topScorers: scorersWithChanges,
      topStreaks: streakersWithChanges,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scorersKey, streakersKey]);

  return result;
}
