"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

interface ScoreBurstProps {
  points: number;
  eventKey: string | number;
}

export function ScoreBurst({ points, eventKey }: ScoreBurstProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatePresence mode="popLayout">
      {points > 0 ? (
        <motion.span
          key={eventKey}
          className="pointer-events-none absolute left-[58%] top-3 z-10 rounded-full px-3 py-1 text-lg font-black text-(--gold-hover)"
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.72, y: 8 }}
          animate={
            prefersReducedMotion
              ? { opacity: [0, 1, 0] }
              : { opacity: [0, 1, 1, 0], scale: [0.72, 1.08, 1, 0.92], y: [8, -10, -18, -24] }
          }
          exit={{ opacity: 0 }}
          transition={{ duration: 1.05, ease: "easeOut" }}
          style={{ textShadow: "0 0 18px var(--accent-glow)" }}
        >
          +{points}
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
}
