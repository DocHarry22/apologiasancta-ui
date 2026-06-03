"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type StartupBootOverlayProps = {
  show: boolean;
};

export function StartupBootOverlay({ show }: StartupBootOverlayProps) {
  const reducedMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          key="startup-overlay"
          className="fixed inset-0 z-120 flex items-center justify-center"
          style={{
            background:
              "radial-gradient(circle at 50% 35%, rgba(212,175,55,0.16) 0%, rgba(26,24,22,0.96) 42%, rgba(16,15,14,1) 100%)",
          }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0.12 : 0.22, ease: "easeOut" }}
          aria-label="Starting Apologia Sancta"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-5">
            <motion.div
              className="flex h-24 w-24 items-center justify-center rounded-full border border-[#d4af37]/45"
              style={{
                background: "rgba(22, 20, 18, 0.86)",
              }}
              initial={reducedMotion ? false : { scale: 0.96, opacity: 0.85 }}
              animate={
                reducedMotion
                  ? { opacity: 1 }
                  : {
                      scale: [0.96, 1.015, 0.99],
                      opacity: [0.85, 1, 0.95],
                      boxShadow: [
                        "0 0 0 0 rgba(212,175,55,0.0)",
                        "0 0 36px 4px rgba(212,175,55,0.28)",
                        "0 0 16px 2px rgba(212,175,55,0.16)",
                      ],
                    }
              }
              transition={{ duration: 1.25, ease: "easeInOut", repeat: reducedMotion ? 0 : Infinity }}
            >
              <svg width="50" height="50" viewBox="0 0 34 38" fill="none" aria-hidden="true">
                <path
                  d="M17 1L2 7v11c0 9.63 6.45 18.64 15 21 8.55-2.36 15-11.37 15-21V7L17 1z"
                  fill="rgba(212,175,55,0.12)"
                  stroke="#d4af37"
                  strokeWidth="1.5"
                />
                <line x1="17" y1="10" x2="17" y2="28" stroke="#d4af37" strokeWidth="1.8" strokeLinecap="round" />
                <line x1="9" y1="18" x2="25" y2="18" stroke="#d4af37" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="17" cy="6" r="1.5" fill="#d4af37" />
                <circle cx="11" cy="8" r="1" fill="#d4af37" />
                <circle cx="23" cy="8" r="1" fill="#d4af37" />
              </svg>
            </motion.div>

            <div className="text-center">
              <p className="text-sm font-semibold tracking-[0.2em] text-[#f4efe5]">APOLOGIA SANCTA</p>
              <p className="mt-1 text-[11px] tracking-[0.15em] text-[#b8ad98]">Defend the Faith. Learn the Truth.</p>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
