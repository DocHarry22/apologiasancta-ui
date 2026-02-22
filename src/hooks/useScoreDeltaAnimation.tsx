"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { scoreToColor, MAX_SCORE_POINTS } from "@/lib/scoreColor";

interface AnimationObject {
  id: string;
  text: string;
  color: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  startTime: number;
}

interface UseScoreDeltaAnimationReturn {
  /** Ref to attach to the source element (question panel) */
  sourceRef: React.RefObject<HTMLDivElement | null>;
  /** Ref to attach to the target element (YourScore card) */
  targetRef: React.RefObject<HTMLDivElement | null>;
  /** Call this to trigger a score delta animation */
  triggerAnimation: (deltaPoints: number) => void;
  /** Portal component to render the animation */
  AnimationPortal: () => React.ReactElement | null;
}

/** Animation duration in milliseconds */
const ANIMATION_DURATION = 800;

/** Check if user prefers reduced motion */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Hook for animating score delta from question panel to YourScore card.
 * 
 * Usage:
 * 1. Attach sourceRef to the question panel container
 * 2. Attach targetRef to the YourScore card
 * 3. Call triggerAnimation(deltaPoints) when score changes
 * 4. Render <AnimationPortal /> somewhere in your component tree
 * 
 * Respects prefers-reduced-motion: falls back to pulse on target
 */
export function useScoreDeltaAnimation(): UseScoreDeltaAnimationReturn {
  const sourceRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const [animations, setAnimations] = useState<AnimationObject[]>([]);
  const [mounted, setMounted] = useState(false);
  const animationIdCounter = useRef(0);

  // Track mount state for portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  /**
   * Trigger a score delta animation
   */
  const triggerAnimation = useCallback((deltaPoints: number) => {
    if (deltaPoints < 0) return; // Don't animate negative scores
    
    const source = sourceRef.current;
    const target = targetRef.current;
    
    // Get positions
    const sourceRect = source?.getBoundingClientRect();
    const targetRect = target?.getBoundingClientRect();
    
    // Calculate center positions
    const startX = sourceRect 
      ? sourceRect.left + sourceRect.width / 2 
      : window.innerWidth / 2;
    const startY = sourceRect 
      ? sourceRect.top + sourceRect.height / 2 
      : window.innerHeight / 3;
    const endX = targetRect 
      ? targetRect.left + targetRect.width / 2 
      : window.innerWidth - 100;
    const endY = targetRect 
      ? targetRect.top + 30 // Aim for upper part of card
      : 50;

    // Color based on score magnitude
    const color = scoreToColor(deltaPoints, MAX_SCORE_POINTS);
    
    // Check reduced motion preference
    if (prefersReducedMotion()) {
      // Just pulse the target card
      if (target) {
        target.classList.add("score-pulse");
        setTimeout(() => target.classList.remove("score-pulse"), 600);
      }
      return;
    }

    // Create animation object
    const animation: AnimationObject = {
      id: `delta-${Date.now()}-${animationIdCounter.current++}`,
      text: deltaPoints > 0 ? `+${deltaPoints}` : "+0",
      color,
      startX,
      startY,
      endX,
      endY,
      startTime: performance.now(),
    };

    setAnimations((prev) => [...prev, animation]);

    // Remove animation after duration
    setTimeout(() => {
      setAnimations((prev) => prev.filter((a) => a.id !== animation.id));
      
      // Pulse the target on arrival
      if (target) {
        target.classList.add("score-pulse");
        setTimeout(() => target.classList.remove("score-pulse"), 600);
      }
    }, ANIMATION_DURATION);
  }, []);

  /**
   * Portal component that renders floating score deltas
   */
  const AnimationPortal = useCallback(() => {
    if (!mounted || typeof document === "undefined") return null;
    if (animations.length === 0) return null;

    return createPortal(
      <div 
        className="fixed inset-0 pointer-events-none z-[9999]" 
        aria-hidden="true"
      >
        {animations.map((anim) => (
          <ScoreDeltaElement key={anim.id} animation={anim} />
        ))}
      </div>,
      document.body
    );
  }, [mounted, animations]);

  return {
    sourceRef,
    targetRef,
    triggerAnimation,
    AnimationPortal,
  };
}

/**
 * Individual animated score delta element
 */
function ScoreDeltaElement({ animation }: { animation: AnimationObject }) {
  const [position, setPosition] = useState({ x: animation.startX, y: animation.startY });
  const [opacity, setOpacity] = useState(1);
  const [scale, setScale] = useState(1.5);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const animate = () => {
      const elapsed = performance.now() - animation.startTime;
      const progress = Math.min(elapsed / ANIMATION_DURATION, 1);
      
      // Easing function (ease-out cubic)
      const eased = 1 - Math.pow(1 - progress, 3);
      
      // Interpolate position
      const x = animation.startX + (animation.endX - animation.startX) * eased;
      const y = animation.startY + (animation.endY - animation.startY) * eased;
      
      // Scale: starts big, shrinks to normal
      const newScale = 1.5 - (0.5 * eased);
      
      // Opacity: fade out in last 30%
      const newOpacity = progress > 0.7 ? 1 - ((progress - 0.7) / 0.3) : 1;
      
      setPosition({ x, y });
      setScale(newScale);
      setOpacity(newOpacity);
      
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [animation]);

  return (
    <div
      className="fixed font-bold text-2xl drop-shadow-lg"
      style={{
        left: position.x,
        top: position.y,
        transform: `translate(-50%, -50%) scale(${scale})`,
        opacity,
        color: animation.color,
        textShadow: `0 0 10px ${animation.color}40`,
        willChange: "transform, opacity",
      }}
    >
      {animation.text}
    </div>
  );
}

export default useScoreDeltaAnimation;
