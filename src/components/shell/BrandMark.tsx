import Link from "next/link";

export function Crest({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 56" aria-hidden="true">
      <path d="M24 2 44 10v17c0 12-7.8 21.2-20 27C11.8 48.2 4 39 4 27V10L24 2Z" fill="var(--navy)" stroke="var(--gold)" strokeWidth="2" />
      <path d="M22 11h4v10h8v4h-8v17h-4V25h-8v-4h8V11Z" fill="var(--gold)" />
      <path d="M11 39c4-2.7 8.3-4 13-4s9 1.3 13 4" fill="none" stroke="var(--gold)" strokeWidth="1.5" />
      <path d="m13 43 3-5 3 5 5-5 5 5 3-5 3 5" fill="none" stroke="var(--gold)" strokeWidth="1.2" />
    </svg>
  );
}

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="group inline-flex min-h-12 items-center gap-2.5 rounded-md" aria-label="Apologia Sancta home">
      <Crest className="h-10 w-9 shrink-0 sm:h-11 sm:w-10" />
      {!compact ? (
        <span className="font-[family-name:var(--font-editorial)] text-[0.94rem] font-semibold uppercase leading-[0.92] tracking-[0.12em] text-(--text) group-hover:text-(--gold-hover)">
          <span className="block">Apologia</span>
          <span className="mt-1 block">Sancta</span>
        </span>
      ) : null}
    </Link>
  );
}
