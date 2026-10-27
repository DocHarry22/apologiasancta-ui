"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Crest } from "@/components/shell/BrandMark";
import styles from "./StartupBootOverlay.module.css";

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
          className={styles.overlay}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0.12 : 0.22, ease: "easeOut" }}
          aria-label="Starting Apologia Sancta"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-5">
            <motion.div
              className={styles.badge}
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
              <Crest className="h-16 w-14" />
            </motion.div>

            <div className="text-center">
              <p className={styles.name}>Apologia Sancta</p>
              <p className={styles.motto}>Faith seeking understanding</p>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
