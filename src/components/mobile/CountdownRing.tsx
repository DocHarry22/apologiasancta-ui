"use client";

import { useState, useEffect, useRef } from "react";

interface CountdownRingProps {
  /** Unix timestamp (ms) when timer ends */
  endsAtMs: number;
  /** Duration for calculating progress (seconds) */
  durationSeconds: number;
}

function calculateRemaining(endsAtMs: number): number {
  return Math.max(0, Math.ceil((endsAtMs - Date.now()) / 1000));
}

export function CountdownRing({ endsAtMs, durationSeconds }: CountdownRingProps) {
  const [secondsLeft, setSecondsLeft] = useState(() => calculateRemaining(endsAtMs));
  const rafRef = useRef<number | null>(null);
  const lastSecondRef = useRef(secondsLeft);
  const prevEndsAtRef = useRef(endsAtMs);
  
  // Run the countdown animation loop
  useEffect(() => {
    // Check if this is a new phase (endsAtMs changed by more than 1 second)
    const hasNewPhase = Math.abs(endsAtMs - prevEndsAtRef.current) > 1000;
    if (hasNewPhase) {
      prevEndsAtRef.current = endsAtMs;
    }
    
    const tick = () => {
      const currentRemaining = calculateRemaining(prevEndsAtRef.current);
      
      // Only update state when second changes
      if (currentRemaining !== lastSecondRef.current) {
        lastSecondRef.current = currentRemaining;
        setSecondsLeft(currentRemaining);
      }
      
      if (currentRemaining > 0) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    
    rafRef.current = requestAnimationFrame(tick);
    
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [endsAtMs]);

  const progress = (secondsLeft / durationSeconds) * 100;
  const circumference = 2 * Math.PI * 42; // radius = 42
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  const isUrgent = secondsLeft <= 5 && secondsLeft > 0;

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div 
      className="flex flex-col items-center py-3"
      role="timer"
      aria-live="polite"
      aria-label={`${secondsLeft} seconds remaining`}
    >
      <div className={`relative w-24 h-24 ${isUrgent ? "timer-urgent" : ""}`}>
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
          <span 
            className={`text-xl font-bold tabular-nums leading-none transition-colors duration-300 ${
                  isUrgent ? "text-(--timer-urgent)" : "text-foreground"
            }`}
          >
            {formatTime(secondsLeft)}
          </span>
        </div>
      </div>
      <span 
        className={`text-[10px] font-semibold tracking-widest mt-1 uppercase transition-colors duration-300 ${
          isUrgent ? "text-(--timer-urgent)" : "text-(--accent)"
        }`}
      >
        {isUrgent ? "Hurry!" : "Answer Now"}
      </span>
    </div>
  );
}
