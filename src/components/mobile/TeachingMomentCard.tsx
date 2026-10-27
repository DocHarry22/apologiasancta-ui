"use client";

import { useState } from "react";
import styles from "./QuizScreen.module.css";

interface Reference {
  label: string;
  value: string;
}

interface TeachingMomentCardProps {
  title?: string;
  explanation: string;
  references: Reference[];
  defaultOpen?: boolean;
}

export function TeachingMomentCard({
  title = "Teaching Moment",
  explanation,
  references,
  defaultOpen = true,
}: TeachingMomentCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const safeExplanation = explanation?.trim() || "No teaching note is available for this question yet.";

  return (
    <div className={styles.teaching}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className={styles.teachingButton}
      >
        <span>{title}</span>
        <span>
          {isOpen ? "Hide" : "Open"}
        </span>
      </button>

      {isOpen ? (
        <div className={styles.teachingContent}>
          <p>
            {safeExplanation}
          </p>
          <div className={styles.references}>
            {references.length > 0 ? references.map((ref, index) => (
              <span key={`${ref.label}-${ref.value}-${index}`}>
                <span className="text-(--text-secondary)">{ref.label}:</span>{" "}
                {ref.value}
              </span>
            )) : (
              <span>References not provided.</span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
