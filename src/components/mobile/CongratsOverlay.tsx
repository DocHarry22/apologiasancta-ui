"use client";

import { useEffect, useState, useRef } from "react";
import type { CongratsEvent } from "@/types/quiz";

interface CongratsOverlayProps {
  /** Congrats event data */
  event: CongratsEvent;
  /** Callback when congrats period ends */
  onComplete?: () => void;
  /** Whether the user prefers reduced motion */
  prefersReducedMotion?: boolean;
}

/**
 * Congrats Overlay - Displayed after topic completes, before countdown
 * 
 * Overlays the left column (quiz/answers area) completely.
 * Does NOT cover the top bar.
 * 
 * Shows:
 * - Congratulatory message with topic name
 * - Top scorer highlight
 * - Top streak highlight
 * - Summary stats
 * - Countdown to next phase
 */
export function CongratsOverlay({
  event,
  onComplete,
  prefersReducedMotion = false,
}: CongratsOverlayProps) {
  const [visible, setVisible] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Animate in on mount
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);
  
  // Countdown timer based on endsAtMs
  useEffect(() => {
    const updateTimer = () => {
      const remaining = Math.max(0, event.endsAtMs - Date.now());
      setTimeRemaining(remaining);
      
      if (remaining <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        onComplete?.();
      }
    };
    
    updateTimer(); // Initial update
    timerRef.current = setInterval(updateTimer, 100);
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [event.endsAtMs, onComplete]);
  
  const { summary, topicTitle, nextTopicTitle, isSeriesComplete } = event;
  const topScorer = summary.leaders[0];
  const topStreaker = summary.topStreaks[0];
  
  const animationClass = prefersReducedMotion
    ? ""
    : `transition-all duration-500 ${visible ? "opacity-100 scale-100" : "opacity-0 scale-95"}`;

  return (
    <div
      className={`absolute inset-0 z-20 flex flex-col bg-(--bg)/95 backdrop-blur-sm ${animationClass}`}
      role="dialog"
      aria-label="Topic Complete Celebration"
      aria-live="polite"
    >
      <div className="flex-1 flex flex-col justify-center items-center p-4 overflow-y-auto">
        {/* Celebration Header */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-2 animate-bounce" aria-hidden="true">🎉</div>
          <h2 className="text-(--accent) font-bold text-xl uppercase tracking-wider">
            Congratulations!
          </h2>
          <p className="text-(--text) text-sm font-medium mt-1">
            You completed <span className="text-(--accent)">{topicTitle}</span>
          </p>
        </div>
        
        {/* Top Performers Row */}
        <div className="w-full max-w-xs space-y-3 mb-6">
          {/* Top Scorer Card */}
          {topScorer && (
            <div className="bg-(--card) rounded-xl p-3 border border-(--accent)/30 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="text-2xl" aria-hidden="true">👑</div>
                <div className="flex-1 min-w-0">
                  <div className="text-(--accent) text-[10px] uppercase tracking-wider font-semibold">
                    Top Scorer
                  </div>
                  <div className="text-(--text) text-sm font-bold truncate">
                    {topScorer.name}
                  </div>
                </div>
                <div className="text-(--accent) text-lg font-bold tabular-nums">
                  {topScorer.score}
                </div>
              </div>
            </div>
          )}
          
          {/* Top Streak Card */}
          {topStreaker && (
            <div className="bg-(--card) rounded-xl p-3 border border-(--streak-icon)/30 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="text-2xl" aria-hidden="true">🔥</div>
                <div className="flex-1 min-w-0">
                  <div className="text-(--streak-icon) text-[10px] uppercase tracking-wider font-semibold">
                    Best Streak
                  </div>
                  <div className="text-(--text) text-sm font-bold truncate">
                    {topStreaker.name}
                  </div>
                </div>
                <div className="text-(--streak-icon) text-lg font-bold tabular-nums">
                  {topStreaker.streak}
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Quick Stats */}
        <div className="flex gap-4 mb-6">
          <div className="text-center">
            <div className="text-(--accent) text-xl font-bold">
              {summary.stats.averageCorrectPct}%
            </div>
            <div className="text-(--muted) text-[9px] uppercase tracking-wider">
              Avg Correct
            </div>
          </div>
          <div className="w-px bg-(--border)" />
          <div className="text-center">
            <div className="text-(--text) text-xl font-bold">
              {summary.stats.totalParticipants}
            </div>
            <div className="text-(--muted) text-[9px] uppercase tracking-wider">
              Players
            </div>
          </div>
          <div className="w-px bg-(--border)" />
          <div className="text-center">
            <div className="text-(--text) text-xl font-bold">
              {summary.stats.questionCount}
            </div>
            <div className="text-(--muted) text-[9px] uppercase tracking-wider">
              Questions
            </div>
          </div>
        </div>
        
        {/* Next Topic / Series Complete Preview */}
        <div className="text-center">
          {isSeriesComplete ? (
            <>
              <div className="text-3xl mb-1" aria-hidden="true">🏆</div>
              <p className="text-(--accent) text-sm font-semibold">
                Series Complete!
              </p>
            </>
          ) : nextTopicTitle ? (
            <>
              <p className="text-(--muted) text-[10px] uppercase tracking-wider">
                Coming Up Next
              </p>
              <p className="text-(--text) text-sm font-semibold mt-0.5">
                {nextTopicTitle}
              </p>
            </>
          ) : null}
        </div>
      </div>
      
      {/* Bottom Countdown Bar */}
      <div className="px-4 py-3 bg-(--card) border-t border-(--border)">
        <div className="flex items-center justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-(--accent) animate-pulse" />
          <span className="text-(--muted) text-xs">
            {isSeriesComplete ? "Finishing up..." : "Get ready..."}
          </span>
          <span className="text-(--accent) text-sm font-bold tabular-nums">
            {Math.ceil(timeRemaining / 1000)}s
          </span>
        </div>
        
        {/* Progress bar */}
        <div className="mt-2 h-1 bg-(--border) rounded-full overflow-hidden">
          <div
            className="h-full bg-(--accent) transition-all duration-100"
            style={{
              width: `${Math.max(0, (timeRemaining / event.displayDurationMs) * 100)}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
