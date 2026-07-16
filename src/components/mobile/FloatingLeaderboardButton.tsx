"use client";

import { motion, useReducedMotion } from "framer-motion";

interface FloatingLeaderboardButtonProps {
  rank?: number;
  pulseKey?: string | number;
  onClick: () => void;
}

export function FloatingLeaderboardButton({ rank, pulseKey, onClick }: FloatingLeaderboardButtonProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.button
      key={pulseKey}
      type="button"
      onClick={onClick}
      className="fixed z-40 flex h-16 w-16 flex-col items-center justify-center rounded-full border border-(--gold) bg-(--button-primary-bg) text-(--button-primary-text) shadow-[0_18px_45px_var(--accent-glow)] ring-4 ring-(--accent-glow) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--focus-ring) lg:hidden"
      style={{ right: "1rem", bottom: "calc(5.25rem + env(safe-area-inset-bottom))" }}
      initial={false}
      animate={
        prefersReducedMotion
          ? undefined
          : {
              scale: [1, 1.08, 1],
            }
      }
      transition={{ duration: 0.7, ease: "easeOut" }}
      aria-label="Open leaderboard"
    >
      {rank ? <span className="absolute -right-1 top-0 rounded-full border-2 border-(--surface) bg-(--blue) px-1.5 py-0.5 text-[9px] font-bold text-white">#{rank}</span> : null}
      <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18 2H6v3H3v4c0 2.2 1.8 4 4 4h.3A6 6 0 0 0 11 16.9V20H7v2h10v-2h-4v-3.1a6 6 0 0 0 3.7-3.9h.3c2.2 0 4-1.8 4-4V5h-3V2ZM7 11c-1.1 0-2-.9-2-2V7h1v2c0 .7.1 1.4.4 2H7Zm12-2c0 1.1-.9 2-2 2h-.4c.3-.6.4-1.3.4-2V7h2v2Z" />
      </svg>
      <span className="mt-1 text-[9px] font-bold uppercase tracking-wide">Leaderboard</span>
    </motion.button>
  );
}
