"use client";

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
}: TeachingMomentCardProps) {
  // Always visible - no collapsible behavior
  return (
    <div className="mx-3 my-2">
      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 py-2 rounded-t-lg bg-(--teaching-bg) border border-(--teaching-border) border-b-0">
        <span className="text-(--accent) text-xs" aria-hidden="true">
          ✦
        </span>
        <span className="text-[10px] font-semibold tracking-wider text-(--muted) uppercase">
          {title}
        </span>
      </div>

      {/* Content - always visible */}
      <div className="px-3 py-2 rounded-b-lg bg-(--teaching-bg) border border-(--teaching-border)">
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
  );
}
