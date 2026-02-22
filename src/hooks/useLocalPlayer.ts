"use client";

import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import type { Leaderboard, LocalPlayerData } from "@/types/quiz";
import { PLAYER_NAME_KEY } from "@/components/mobile/YourScoreCard";

/**
 * Subscribe to localStorage changes for player name.
 * Uses useSyncExternalStore for proper React 18+ patterns.
 */
function subscribeToPlayerName(callback: () => void) {
  const handleStorage = (e: StorageEvent) => {
    if (e.key === PLAYER_NAME_KEY) {
      callback();
    }
  };
  window.addEventListener("storage", handleStorage);
  return () => window.removeEventListener("storage", handleStorage);
}

function getPlayerNameSnapshot(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(PLAYER_NAME_KEY);
}

function getServerSnapshot(): string | null {
  return null;
}

/**
 * Hook for managing local player data derived from leaderboard.
 * 
 * Computes:
 * - totalPoints (from leaderboard lookup)
 * - previousPoints (for delta calculation)
 * - lastAwardedPoints (delta when entering REVEAL)
 * - streak (from streaks leaderboard)
 * - rank (position in scorers)
 * - distanceToTop10 (points needed to reach 10th place)
 * 
 * Future: When engine provides per-user SSE events, this hook
 * can be updated to use those values directly instead of
 * computing from leaderboard deltas.
 */
export function useLocalPlayer(leaderboard: Leaderboard, phase: string): LocalPlayerData {
  // Use useSyncExternalStore for localStorage - proper React 18+ pattern
  const playerName = useSyncExternalStore(
    subscribeToPlayerName,
    getPlayerNameSnapshot,
    getServerSnapshot
  );
  
  const [previousPoints, setPreviousPoints] = useState<number>(0);
  const [lastAwardedPoints, setLastAwardedPoints] = useState<number>(0);
  
  // Ref to track previous phase for transition detection
  const prevPhaseRef = useRef<string>(phase);
  const snapshotPointsRef = useRef<number>(0);

  // Find player in scorers
  const scorer = playerName
    ? leaderboard.topScorers.find(
        (s) => s.name.toLowerCase() === playerName.toLowerCase()
      )
    : null;

  // Find player in streakers
  const streaker = playerName
    ? leaderboard.topStreaks.find(
        (s) => s.name.toLowerCase() === playerName.toLowerCase()
      )
    : null;

  // Current totals
  const totalPoints = scorer?.score ?? 0;
  const streak = streaker?.streak ?? 0;
  const rank = scorer?.rank;

  // Calculate distance to top 10
  const tenthPlace = leaderboard.topScorers[9];
  const distanceToTop10 =
    tenthPlace && (!rank || rank > 10)
      ? Math.max(0, tenthPlace.score - totalPoints + 1)
      : undefined;

  // Track phase transitions and calculate deltas
  useEffect(() => {
    const wasNotReveal = prevPhaseRef.current !== "REVEAL";
    const isNowReveal = phase === "REVEAL";
    const wasNotOpen = prevPhaseRef.current !== "OPEN";
    const isNowOpen = phase === "OPEN";
    
    if (wasNotReveal && isNowReveal) {
      // Transitioning into REVEAL - calculate delta
      const delta = totalPoints - snapshotPointsRef.current;
      setLastAwardedPoints(Math.max(0, delta));
      setPreviousPoints(snapshotPointsRef.current);
    } else if (wasNotOpen && isNowOpen) {
      // Transitioning into OPEN - snapshot for next delta calculation
      snapshotPointsRef.current = totalPoints;
      setLastAwardedPoints(0);
    }
    
    prevPhaseRef.current = phase;
  }, [phase, totalPoints]);

  return {
    playerName,
    totalPoints,
    previousPoints,
    lastAwardedPoints,
    streak,
    rank,
    distanceToTop10,
  };
}

export default useLocalPlayer;
