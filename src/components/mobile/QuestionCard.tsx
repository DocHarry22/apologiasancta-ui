"use client";

interface QuestionCardProps {
  text: string;
}

export function QuestionCard({ text }: QuestionCardProps) {
  return (
    <div className="px-4 py-3 lg:px-3 lg:py-2">
      <div className="relative overflow-hidden rounded-2xl border border-(--mobile-border) bg-(--mobile-panel) px-4 py-5 shadow-[0_10px_26px_var(--mobile-shadow)] lg:border-(--border) lg:bg-(--card) lg:px-5 lg:py-4 lg:shadow-sm">
        <div className="pointer-events-none absolute right-4 top-4 hidden text-5xl text-(--mobile-border) opacity-45 sm:block" aria-hidden="true">
          +
        </div>
        <h2 className="relative break-words text-center text-[1.35rem] font-semibold leading-snug text-(--mobile-text) sm:text-[1.45rem] lg:text-xl lg:text-(--text) xl:text-2xl">
          {text}
        </h2>
      </div>
      <div className="mx-auto mt-3 h-px w-16 bg-[#d9a51c]/45 lg:mt-2 lg:w-12 lg:bg-(--border)" />
    </div>
  );
}
