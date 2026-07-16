"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

interface StreakToastProps {
  streak: number;
  eventKey: string | number;
}

export function StreakToast({ streak, eventKey }: StreakToastProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatePresence mode="popLayout">
      {streak > 1 ? (
        <motion.div
          key={eventKey}
          className="pointer-events-none absolute right-4 top-5 z-10 rounded-full border border-(--warning) bg-(--surface-elevated) px-3 py-1.5 text-xs font-bold text-(--warning) shadow-[0_0_28px_var(--accent-glow)]"
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.86, x: 12 }}
          animate={
            prefersReducedMotion
              ? { opacity: [0, 1, 0] }
              : { opacity: [0, 1, 1, 0], scale: [0.86, 1.04, 1, 0.96], x: [12, 0, 0, 8] }
          }
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92, x: 10 }}
          transition={{ duration: 1.8, ease: "easeOut" }}
        >
          Streak x{streak}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
