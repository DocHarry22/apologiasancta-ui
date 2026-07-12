"use client";

import { useState, useEffect, useRef } from "react";
import type { QuizPhase } from "@/types/quiz";
import { getCountdownProgress } from "@/lib/mobileUx";

interface CountdownRingProps {
  /** Unix timestamp (ms) when timer ends */
  endsAtMs: number;
  /** Duration for calculating progress (seconds) */
  durationSeconds: number;
  /** Current quiz phase */
  phase?: QuizPhase;
}

function calculateRemaining(endsAtMs: number): number {
  return Math.max(0, Math.ceil((endsAtMs - Date.now()) / 1000));
}

function shouldResetCountdown(previous: number, next: number): boolean {
  return next > previous + 1;
}

export function CountdownRing({ endsAtMs, durationSeconds, phase = "OPEN" }: CountdownRingProps) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    phase === "OPEN" ? calculateRemaining(endsAtMs) : 0
  );
  const rafRef = useRef<number | null>(null);
  const lastSecondRef = useRef(secondsLeft);
  const currentEndsAtRef = useRef(endsAtMs);
  
  // Run the countdown animation loop
  useEffect(() => {
    currentEndsAtRef.current = endsAtMs;
    if (phase !== "OPEN") {
      lastSecondRef.current = 0;
      setSecondsLeft(0);
      return;
    }
    
    // Reset countdown when entering OPEN phase
    const initialRemaining = calculateRemaining(endsAtMs);
    lastSecondRef.current = initialRemaining;
    setSecondsLeft(initialRemaining);
    
    const tick = () => {
      const rawRemaining = calculateRemaining(currentEndsAtRef.current);
      const previous = lastSecondRef.current;

      // Keep countdown monotonic within a phase.
      // Allow upward jumps only when a new phase/question starts.
      const nextRemaining = shouldResetCountdown(previous, rawRemaining)
        ? rawRemaining
        : Math.min(previous, rawRemaining);
      
      // Only update state when second changes
      if (nextRemaining !== previous) {
        lastSecondRef.current = nextRemaining;
        setSecondsLeft(nextRemaining);
      }
      
      if (nextRemaining > 0) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    
    rafRef.current = requestAnimationFrame(tick);
    
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [endsAtMs, phase]);

  const progress = getCountdownProgress(secondsLeft, durationSeconds);
  const circumference = 2 * Math.PI * 42; // radius = 42
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  const isUrgent = secondsLeft <= 5 && secondsLeft > 0;

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const phaseLabel = phase === "OPEN" ? (isUrgent ? "Hurry!" : "Answer Now") : phase === "REVEAL" ? "Reveal" : "Locked";

  return (
    <div 
      className="quiz-countdown flex flex-col items-center py-4 lg:py-3"
      role="timer"
      aria-label={`${secondsLeft} seconds remaining`}
    >
      <div className={`quiz-countdown-ring relative h-32 w-32 sm:h-36 sm:w-36 lg:h-28 lg:w-28 ${isUrgent ? "timer-urgent" : ""}`}>
        <svg 
          className="w-full h-full transform -rotate-90" 
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          {/* Background ring */}
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="var(--timer-ring-bg)"
            strokeWidth="4"
          />
          {/* Progress ring */}
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke={isUrgent ? "var(--timer-urgent)" : "url(#timerGradientCompact)"}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-[stroke-dashoffset] duration-200 ease-linear"
            style={{
              filter: isUrgent ? "drop-shadow(0 0 6px var(--timer-urgent))" : undefined,
            }}
          />
          <defs>
            <linearGradient id="timerGradientCompact" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--timer-ring-gold)" />
              <stop offset="100%" stopColor="var(--timer-ring-blue)" />
            </linearGradient>
          </defs>
        </svg>
        {/* Timer text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <svg className="mb-1 h-5 w-5 text-(--mobile-muted) opacity-80 lg:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          <span
            className={`text-3xl font-bold tabular-nums leading-none transition-colors duration-300 lg:text-2xl ${
                  isUrgent ? "text-(--timer-urgent)" : "text-foreground"
            }`}
          >
            {formatTime(secondsLeft)}
          </span>
        </div>
      </div>
      <span 
        className={`mt-2 text-sm font-bold uppercase tracking-[0.22em] transition-colors duration-300 lg:mt-1 lg:text-xs ${
          isUrgent ? "text-(--timer-urgent)" : "text-(--accent)"
        }`}
      >
        {phaseLabel}
      </span>
    </div>
  );
}
