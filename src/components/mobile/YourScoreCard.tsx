"use client";

import { useState, useCallback, useRef, useEffect, forwardRef, useSyncExternalStore } from "react";

/** Local storage key for player name */
export const PLAYER_NAME_KEY = "as_player_name";

// Storage subscription for useSyncExternalStore
let listeners: Array<() => void> = [];

function subscribeToLocalName(callback: () => void) {
  listeners.push(callback);
  
  const handleStorage = (e: StorageEvent) => {
    if (e.key === PLAYER_NAME_KEY) {
      listeners.forEach(l => l());
    }
  };
  window.addEventListener("storage", handleStorage);
  
  return () => {
    listeners = listeners.filter(l => l !== callback);
    window.removeEventListener("storage", handleStorage);
  };
}

function getLocalNameSnapshot(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(PLAYER_NAME_KEY);
}

function getLocalNameServerSnapshot(): string | null {
  return null;
}

// Notify all subscribers when we update localStorage
function setLocalNameInStorage(name: string | null) {
  if (name) {
    localStorage.setItem(PLAYER_NAME_KEY, name);
  } else {
    localStorage.removeItem(PLAYER_NAME_KEY);
  }
  // Notify subscribers
  listeners.forEach(l => l());
}

interface YourScoreCardProps {
  /** Player's total score (computed from leaderboard or state) */
  totalPoints: number;
  /** Previous points (for count-up animation) */
  previousPoints?: number;
  /** Current streak */
  streak: number;
  /** Player's rank in scorers list (null if not in top scorers) */
  rank?: number;
  /** Distance to 10th place (points needed to enter top 10) */
  distanceToTop10?: number;
  /** Callback when player name changes */
  onPlayerNameChange?: (name: string | null) => void;
  /** Initial player name from parent (for controlled mode) */
  playerName?: string | null;
}

/**
 * Your Score card - displays local player's score info.
 * Pinned at top of leaderboard column.
 * 
 * Uses forwardRef to allow parent to attach refs for animations.
 */
export const YourScoreCard = forwardRef<HTMLDivElement, YourScoreCardProps>(
  function YourScoreCard(
    {
      totalPoints,
      previousPoints,
      streak,
      rank,
      distanceToTop10,
      onPlayerNameChange,
      playerName: controlledName,
    },
    ref
  ) {
    // Use useSyncExternalStore for localStorage - proper React 18+ pattern
    const storedName = useSyncExternalStore(
      subscribeToLocalName,
      getLocalNameSnapshot,
      getLocalNameServerSnapshot
    );
    
    const [isEditing, setIsEditing] = useState(false);
    const [inputValue, setInputValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const [displayedPoints, setDisplayedPoints] = useState(totalPoints);
    const prevTotalRef = useRef(totalPoints);
    const animationRef = useRef<number | null>(null);

    // Use controlled name if provided, otherwise localStorage
    const playerName = controlledName !== undefined ? controlledName : storedName;

    // Count-up animation when totalPoints changes
    useEffect(() => {
      const prev = previousPoints ?? prevTotalRef.current;
      const diff = totalPoints - prev;
      
      // Update ref for next comparison
      prevTotalRef.current = totalPoints;
      
      // Cancel any existing animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      
      if (diff <= 0) {
        // Use requestAnimationFrame to schedule update outside render
        animationRef.current = requestAnimationFrame(() => {
          setDisplayedPoints(totalPoints);
        });
        return;
      }

      // Animate count-up over 600ms
      const duration = 600;
      const startTime = performance.now();
      const startValue = prev;

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 2); // ease-out quad
        
        const current = Math.round(startValue + diff * eased);
        setDisplayedPoints(current);
        
        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        }
      };

      animationRef.current = requestAnimationFrame(animate);
      
      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }, [totalPoints, previousPoints]);

    // Start editing
    const handleStartEdit = useCallback(() => {
      setInputValue(playerName || "");
      setIsEditing(true);
      setTimeout(() => inputRef.current?.focus(), 0);
    }, [playerName]);

    // Save name
    const handleSave = useCallback(() => {
      const trimmed = inputValue.trim();
      const newName = trimmed || null;
      
      setLocalNameInStorage(newName);
      setIsEditing(false);
      onPlayerNameChange?.(newName);
    }, [inputValue, onPlayerNameChange]);

    // Handle key press
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
          handleSave();
        } else if (e.key === "Escape") {
          setIsEditing(false);
          setInputValue(playerName || "");
        }
      },
      [handleSave, playerName]
    );

    return (
      <div
        ref={ref}
        className="your-score-card bg-(--card) border border-(--card-border) rounded-lg mx-1 mb-2 p-2 shadow-sm transition-all"
        role="region"
        aria-label="Your Score"
      >
        {/* Header with name */}
        <div className="flex items-center justify-between mb-1.5">
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              placeholder="Enter your name"
              className="text-[10px] font-semibold bg-transparent border-b border-(--accent) text-(--text) outline-none w-full max-w-[80px]"
              maxLength={20}
            />
          ) : (
            <button
              onClick={handleStartEdit}
              className="text-[10px] font-semibold text-(--accent) hover:underline truncate max-w-[80px]"
              title={playerName ? `Click to change: ${playerName}` : "Set your username"}
            >
              {playerName || "Set Username"}
            </button>
          )}
          
          {/* Rank badge */}
          {rank && (
            <span 
              className="text-[9px] font-bold bg-(--accent) text-white px-1.5 py-0.5 rounded-full"
              title={`Rank #${rank}`}
            >
              #{rank}
            </span>
          )}
        </div>

        {/* Score display */}
        {playerName && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-(--muted) uppercase tracking-wide">
                Score
              </span>
              <span className="text-sm font-bold text-(--text) tabular-nums your-score-value">
                {displayedPoints}
              </span>
            </div>

            {/* Streak */}
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-[9px] text-(--muted) uppercase tracking-wide">
                Streak
              </span>
              <div className="flex items-center gap-0.5">
                <span className="text-[10px] text-(--streak-icon)">🔥</span>
                <span className="text-[10px] font-semibold text-(--text) tabular-nums">
                  {streak}
                </span>
              </div>
            </div>

            {/* Distance to top 10 */}
            {distanceToTop10 !== undefined && distanceToTop10 > 0 && (
              <div className="flex items-center justify-between mt-0.5 pt-1 border-t border-(--border)">
                <span className="text-[8px] text-(--muted)">
                  To Top 10
                </span>
                <span className="text-[9px] font-medium text-(--accent2)">
                  +{distanceToTop10} pts
                </span>
              </div>
            )}
          </>
        )}

        {/* Prompt to set name when not logged in */}
        {!playerName && !isEditing && (
          <div className="text-[9px] text-(--muted) text-center py-1">
            <button 
              onClick={handleStartEdit}
              className="text-(--accent) hover:underline"
            >
              Set your name
            </button>
            {" to track your score"}
          </div>
        )}
      </div>
    );
  }
);

export default YourScoreCard;
