"use client";

import { useEffect, useState, useRef } from "react";
import type { TopicCountdownEvent } from "@/types/quiz";

interface TopicCountdownProps {
  /** Topic countdown event data */
  event: TopicCountdownEvent;
  /** Whether the user prefers reduced motion */
  prefersReducedMotion?: boolean;
  /** Callback when countdown completes */
  onComplete?: () => void;
}

/**
 * Topic Countdown Overlay - Displayed before a topic starts
 * 
 * Shows an animated countdown with the topic title.
 * Respects prefers-reduced-motion for accessibility.
 */
export function TopicCountdown({
  event,
  prefersReducedMotion = false,
  onComplete,
}: TopicCountdownProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(event.countdownSeconds);
  const [visible, setVisible] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Animate in on mount
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);
  
  // Countdown logic
  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((event.endsAtMs - now) / 1000));
      setSecondsRemaining(remaining);
      
      if (remaining <= 0) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        onComplete?.();
      }
    };
    
    // Initial update
    updateCountdown();
    
    // Update every 100ms for smooth countdown
    intervalRef.current = setInterval(updateCountdown, 100);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [event.endsAtMs, onComplete]);
  
  const animationClass = prefersReducedMotion
    ? ""
    : `transition-all duration-300 ${visible ? "opacity-100 scale-100" : "opacity-0 scale-95"}`;
  
  // Pulse animation class for the number
  const pulseClass = prefersReducedMotion
    ? ""
    : "animate-pulse";

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/80 ${animationClass}`}
      role="alertdialog"
      aria-modal="true"
      aria-label={`Topic starting in ${secondsRemaining} seconds`}
      aria-live="assertive"
    >
      <div className="text-center p-8">
        {/* Topic Title */}
        <p className="text-(--muted) text-sm uppercase tracking-wider mb-2">
          Up Next
        </p>
        <h2 className="text-(--text) text-2xl font-bold mb-8">
          {event.topicTitle}
        </h2>
        
        {/* Countdown Number */}
        <div className="relative">
          {/* Background ring */}
          <div 
            className={`w-32 h-32 mx-auto rounded-full border-4 border-(--accent) flex items-center justify-center ${
              !prefersReducedMotion ? "animate-[ping_1s_ease-out_infinite]" : ""
            }`}
            style={{ 
              animationDuration: "1s",
              opacity: 0.3,
            }}
            aria-hidden="true"
          />
          
          {/* Main countdown display */}
          <div 
            className={`absolute inset-0 w-32 h-32 mx-auto rounded-full border-4 border-(--accent) 
              flex items-center justify-center bg-(--background) ${pulseClass}`}
          >
            <span 
              className="text-(--accent) text-5xl font-bold tabular-nums"
              aria-hidden="true"
            >
              {secondsRemaining}
            </span>
          </div>
        </div>
        
        {/* Label */}
        <p className="text-(--muted) text-xs mt-6 uppercase tracking-wider">
          Get Ready!
        </p>
      </div>
    </div>
  );
}
