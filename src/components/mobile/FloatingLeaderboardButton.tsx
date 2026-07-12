"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface FloatingLeaderboardButtonProps {
  rank?: number;
  pulseKey?: string | number;
  onClick: () => void;
}

export function FloatingLeaderboardButton({ rank, pulseKey, onClick }: FloatingLeaderboardButtonProps) {
  const prefersReducedMotion = useReducedMotion();
  const [hasNativeTabs, setHasNativeTabs] = useState(false);

  useEffect(() => {
    setHasNativeTabs(Boolean((window as { Capacitor?: unknown }).Capacitor));
  }, []);

  return (
    <motion.button
      key={pulseKey}
      type="button"
      onClick={onClick}
      className="fixed z-40 flex h-16 w-16 flex-col items-center justify-center rounded-full border border-white/70 bg-linear-to-br from-[#d9a51c] via-[#b98512] to-[#7f560b] text-white shadow-[0_18px_45px_rgba(145,96,9,0.34)] ring-4 ring-[#f6d680]/35 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d4af37] lg:hidden"
      style={{ right: "1rem", bottom: hasNativeTabs ? "calc(5.25rem + env(safe-area-inset-bottom))" : "calc(1rem + env(safe-area-inset-bottom))" }}
      initial={false}
      animate={
        prefersReducedMotion
          ? undefined
          : {
              scale: [1, 1.08, 1],
              boxShadow: [
                "0 18px 45px rgba(145,96,9,0.34)",
                "0 18px 60px rgba(217,165,28,0.54)",
                "0 18px 45px rgba(145,96,9,0.34)",
              ],
            }
      }
      transition={{ duration: 0.7, ease: "easeOut" }}
      aria-label="Open leaderboard"
    >
      {rank ? <span className="absolute -right-1 top-0 rounded-full border-2 border-white bg-[#174f6f] px-1.5 py-0.5 text-[9px] font-bold">#{rank}</span> : null}
      <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18 2H6v3H3v4c0 2.2 1.8 4 4 4h.3A6 6 0 0 0 11 16.9V20H7v2h10v-2h-4v-3.1a6 6 0 0 0 3.7-3.9h.3c2.2 0 4-1.8 4-4V5h-3V2ZM7 11c-1.1 0-2-.9-2-2V7h1v2c0 .7.1 1.4.4 2H7Zm12-2c0 1.1-.9 2-2 2h-.4c.3-.6.4-1.3.4-2V7h2v2Z" />
      </svg>
      <span className="mt-1 text-[9px] font-bold uppercase tracking-wide">Leaderboard</span>
    </motion.button>
  );
}
