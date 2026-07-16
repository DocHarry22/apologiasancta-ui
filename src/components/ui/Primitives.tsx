import type { ReactNode } from "react";

export function SectionHeading({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2 className="editorial-heading mt-1 text-2xl font-semibold sm:text-[1.75rem]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const safeValue = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div>
      {label ? <span className="sr-only">{label}: {Math.round(safeValue)}%</span> : null}
      <div className="h-2 overflow-hidden rounded-full bg-(--chart-track)" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(safeValue)}>
        <div className="h-full rounded-full bg-(--progress)" style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
}

export function ProgressRing({ value, label, detail, size = 132 }: { value: number; label: string; detail?: string; size?: number }) {
  const safeValue = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full"
      style={{ width: size, height: size, background: `conic-gradient(var(--gold) ${safeValue * 3.6}deg, var(--chart-track) 0)` }}
      role="img"
      aria-label={`${label}: ${Math.round(safeValue)} percent${detail ? `, ${detail}` : ""}`}
    >
      <div className="grid place-content-center rounded-full bg-(--surface) text-center" style={{ width: size - 12, height: size - 12 }}>
        <strong className="font-[family-name:var(--font-editorial)] text-3xl font-semibold text-(--text)">{Math.round(safeValue)}%</strong>
        <span className="text-xs text-(--text-muted)">{label}</span>
        {detail ? <span className="mt-0.5 text-[0.65rem] text-(--text-muted)">{detail}</span> : null}
      </div>
    </div>
  );
}

export function StatusBadge({ tone = "neutral", children }: { tone?: "neutral" | "success" | "warning" | "danger" | "info"; children: ReactNode }) {
  const colors = {
    neutral: "border-(--border) text-(--text-muted)",
    success: "border-(--success) text-(--success)",
    warning: "border-(--warning) text-(--warning)",
    danger: "border-(--danger) text-(--danger)",
    info: "border-(--blue) text-(--blue)",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[0.7rem] font-bold ${colors[tone]}`}>{children}</span>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="surface-card px-5 py-10 text-center" role="status">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-(--border) text-xl text-(--gold)" aria-hidden="true">✦</span>
      <h3 className="editorial-heading mt-4 text-xl font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-(--text-muted)">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className = "h-5 w-full" }: { className?: string }) {
  return <span className={`block animate-pulse rounded-md bg-(--chart-track) ${className}`} aria-hidden="true" />;
}
