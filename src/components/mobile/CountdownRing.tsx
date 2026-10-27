"use client";

import { useState, useEffect, useRef } from "react";
import type { QuizPhase } from "@/types/quiz";
import { getCountdownProgress } from "@/lib/mobileUx";
import styles from "./QuizScreen.module.css";

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

  return <div className={styles.timer} role="timer" aria-label={phase === "OPEN" ? secondsLeft + " seconds remaining" : phaseLabel}>
    <div><span className={styles.eyebrow}>{phaseLabel}</span><p>{phase === "OPEN" ? "Choose one answer. Your selection locks immediately." : phase === "REVEAL" ? "Take a moment to reflect on the answer." : "Waiting for the host to reveal the answer."}</p></div>
    <div className={styles.ring}>
      <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="42" fill="none" stroke="var(--timer-ring-bg)" strokeWidth="4" /><circle cx="50" cy="50" r="42" fill="none" stroke={isUrgent ? "var(--timer-urgent)" : "var(--gold)"} strokeWidth="4" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} className="transition-[stroke-dashoffset] duration-200 ease-linear" /></svg>
      <span className={styles.timerNumber} style={isUrgent ? { color: "var(--danger)" } : undefined}>{phase === "OPEN" ? formatTime(secondsLeft) : "—"}</span>
    </div>
  </div>;
}
