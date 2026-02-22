"use client";

import { useState, useRef, useEffect } from "react";

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
  defaultOpen = false,
}: TeachingMomentCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number>(0);

  // Measure content height for smooth animation
  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [explanation, references]);

  const panelId = "teaching-moment-panel";
  const buttonId = "teaching-moment-button";

  return (
    <div className="mx-3 my-2">
      <button
        id={buttonId}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-(--teaching-bg) border border-(--teaching-border) hover:bg-(--option-hover) transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-offset-1"
      >
        <div className="flex items-center gap-1.5">
          <span 
            className={`text-(--accent) text-xs transition-transform duration-300 ${isOpen ? "rotate-[360deg]" : ""}`}
            aria-hidden="true"
          >
            ✦
          </span>
          <span className="text-[10px] font-semibold tracking-wider text-(--muted) uppercase">
            {title}
          </span>
        </div>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`text-(--muted) transition-transform duration-300 ease-out ${isOpen ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Collapsible content with smooth height animation */}
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        aria-hidden={!isOpen}
        className="overflow-hidden transition-all duration-300 ease-out"
        style={{
          maxHeight: isOpen ? contentHeight + 16 : 0,
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div 
          ref={contentRef}
          className="px-3 py-2 mt-1 rounded-lg bg-(--teaching-bg) border border-(--teaching-border)"
        >
          <p className="text-xs text-(--text) leading-relaxed mb-2">
            {explanation}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-(--muted)">
            {references.map((ref, index) => (
              <span key={index}>
                <span className="text-(--text-secondary)">{ref.label}:</span>{" "}
                {ref.value}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
