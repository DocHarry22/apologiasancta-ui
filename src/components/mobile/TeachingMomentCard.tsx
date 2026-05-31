"use client";

import { useState } from "react";

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
    <div className="mx-3 my-2">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-t-lg border border-(--teaching-border) bg-(--teaching-bg) px-3 py-2 text-left"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="text-xs text-(--accent)" aria-hidden="true">*</span>
          <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-(--muted)">
            {title}
          </span>
        </span>
        <span className="text-[10px] font-semibold text-(--accent)">
          {isOpen ? "Hide" : "Open"}
        </span>
      </button>

      {isOpen ? (
        <div className="max-h-56 overflow-y-auto rounded-b-lg border border-t-0 border-(--teaching-border) bg-(--teaching-bg) px-3 py-2">
          <p className="mb-2 text-sm leading-relaxed text-(--text) sm:text-xs">
            {safeExplanation}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-(--muted)">
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
