"use client";

interface Reference {
  label: string;
  value: string;
}

interface TeachingMomentProps {
  explanation: string;
  references: Reference[];
}

export function TeachingMoment({ explanation, references }: TeachingMomentProps) {
  return (
    <div className="mx-4 my-3 p-4 rounded-lg bg-[color:var(--teaching-bg)] border border-[color:var(--teaching-border)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[color:var(--accent)]">✦</span>
          <span className="text-xs font-semibold tracking-wider text-[color:var(--muted)]">
            TEACHING MOMENT
          </span>
          <span className="text-[color:var(--accent)]">·</span>
        </div>
        <button className="text-[color:var(--muted)] hover:text-[color:var(--text)]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
          </svg>
        </button>
      </div>

      {/* Explanation */}
      <p className="text-sm text-[color:var(--text)] leading-relaxed mb-3">
        {explanation}
      </p>

      {/* References */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[color:var(--muted)]">
        {references.map((ref, index) => (
          <span key={index}>
            <span className="text-[color:var(--text-secondary)]">{ref.label}:</span>{" "}
            {ref.value}
          </span>
        ))}
      </div>
    </div>
  );
}
