"use client";

import { useEffect, useState, useRef } from "react";
import type { TopicCompleteEvent } from "@/types/quiz";

interface TopicSummaryPanelProps {
  /** Topic complete event data */
  event: TopicCompleteEvent;
  /** Time remaining until auto-advance (ms), 0 if no auto-advance */
  autoAdvanceMs: number;
  /** Callback when summary is dismissed (auto or manual) */
  onDismiss?: () => void;
  /** Whether the user prefers reduced motion */
  prefersReducedMotion?: boolean;
}

/**
 * Topic Summary Panel - Displayed when a topic completes
 * 
 * Shows:
 * - Congratulatory message with topic name
 * - Top scorer card
 * - Top streak card  
 * - Final leaderboard (top 10)
 * - Next topic preview (if available)
 * - Auto-advance countdown (if enabled)
 */
export function TopicSummaryPanel({
  event,
  autoAdvanceMs,
  onDismiss,
  prefersReducedMotion = false,
}: TopicSummaryPanelProps) {
  const [visible, setVisible] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  
  // Animate in on mount
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);
  
  // Countdown timer for auto-advance
  useEffect(() => {
    if (autoAdvanceMs <= 0) return;
    
    const startTime = Date.now();
    
    countdownRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, autoAdvanceMs - elapsed);
      setCountdown(remaining);
      
      if (remaining <= 0) {
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
        }
        onDismiss?.();
      }
    }, 100);
    
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [autoAdvanceMs, onDismiss]);
  
  const { summary, topicTitle, nextTopicTitle, isSeriesComplete } = event;
  const topScorer = summary.leaders[0];
  const topStreaker = summary.topStreaks[0];
  
  const animationClass = prefersReducedMotion
    ? ""
    : `transition-all duration-500 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`;

  return (
    <div
      className={`flex flex-col h-full py-2 px-1.5 overflow-y-auto ${animationClass}`}
      role="region"
      aria-label="Topic Summary"
      aria-live="polite"
    >
      {/* Congratulations Header */}
      <div className="text-center mb-3">
        <div className="text-2xl mb-1" aria-hidden="true">🎉</div>
        <h2 className="text-(--accent) font-bold text-sm uppercase tracking-wider">
          Topic Complete!
        </h2>
        <p className="text-(--text) text-xs font-medium mt-0.5">
          {topicTitle}
        </p>
      </div>
      
      {/* Top Scorer Card */}
      {topScorer && (
        <div className="bg-(--card) rounded-lg p-2 mb-2 border border-(--border)">
          <div className="flex items-center gap-2">
            <div className="text-lg" aria-hidden="true">👑</div>
            <div className="flex-1 min-w-0">
              <div className="text-(--muted) text-[9px] uppercase tracking-wider">
                Top Scorer
              </div>
              <div className="text-(--text) text-xs font-bold truncate">
                {topScorer.name}
              </div>
            </div>
            <div className="text-(--accent) text-sm font-bold tabular-nums">
              {topScorer.score}
            </div>
          </div>
        </div>
      )}
      
      {/* Top Streak Card */}
      {topStreaker && (
        <div className="bg-(--card) rounded-lg p-2 mb-3 border border-(--border)">
          <div className="flex items-center gap-2">
            <div className="text-lg" aria-hidden="true">🔥</div>
            <div className="flex-1 min-w-0">
              <div className="text-(--muted) text-[9px] uppercase tracking-wider">
                Best Streak
              </div>
              <div className="text-(--text) text-xs font-bold truncate">
                {topStreaker.name}
              </div>
            </div>
            <div className="text-(--streak-icon) text-sm font-bold tabular-nums">
              {topStreaker.streak}
            </div>
          </div>
        </div>
      )}
      
      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        <div className="bg-(--card) rounded p-1.5 text-center border border-(--border)">
          <div className="text-(--accent) text-sm font-bold">
            {summary.stats.averageCorrectPct}%
          </div>
          <div className="text-(--muted) text-[8px] uppercase">Avg Correct</div>
        </div>
        <div className="bg-(--card) rounded p-1.5 text-center border border-(--border)">
          <div className="text-(--text) text-sm font-bold">
            {summary.stats.totalParticipants}
          </div>
          <div className="text-(--muted) text-[8px] uppercase">Players</div>
        </div>
      </div>
      
      {/* Final Leaderboard */}
      <div className="flex-1">
        <h3 
          className="text-(--muted) font-semibold tracking-wider text-[9px] mb-1.5 uppercase"
          id="final-standings-heading"
        >
          Final Standings
        </h3>
        <div 
          className="flex flex-col bg-(--card) rounded-lg border border-(--border) overflow-hidden" 
          role="list" 
          aria-labelledby="final-standings-heading"
        >
          {summary.leaders.slice(0, 10).map((scorer, index) => (
            <div
              key={`final-${scorer.rank}-${scorer.name}`}
              role="listitem"
              className={`flex items-center justify-between py-1 px-2 ${
                index > 0 ? "border-t border-(--border)" : ""
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span 
                  className={`text-[10px] w-4 text-center shrink-0 font-bold ${
                    scorer.rank <= 3 ? "text-(--accent)" : "text-(--muted)"
                  }`}
                  aria-label={`Rank ${scorer.rank}`}
                >
                  {scorer.rank <= 3 ? ["🥇", "🥈", "🥉"][scorer.rank - 1] : scorer.rank}
                </span>
                <span className="text-(--text) text-[10px] font-medium truncate">
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
      
      {/* Next Topic Preview or Series Complete */}
      <div className="mt-3 pt-2 border-t border-(--border)">
        {isSeriesComplete ? (
          <div className="text-center">
            <div className="text-xl mb-1" aria-hidden="true">🏆</div>
            <p className="text-(--accent) text-xs font-semibold">
              Series Complete!
            </p>
            <p className="text-(--muted) text-[10px] mt-0.5">
              All topics finished. Great job!
            </p>
          </div>
        ) : nextTopicTitle ? (
          <div className="text-center">
            <p className="text-(--muted) text-[10px] uppercase tracking-wider">
              Next Topic
            </p>
            <p className="text-(--text) text-xs font-semibold mt-0.5">
              {nextTopicTitle}
            </p>
            {countdown > 0 && (
              <p className="text-(--accent) text-[10px] mt-1 tabular-nums">
                Starting in {Math.ceil(countdown / 1000)}s...
              </p>
            )}
          </div>
        ) : (
          <div className="text-center">
            <p className="text-(--muted) text-[10px]">
              Waiting for next topic...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
