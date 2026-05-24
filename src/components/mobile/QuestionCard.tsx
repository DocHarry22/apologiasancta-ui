"use client";

interface QuestionCardProps {
  text: string;
}

export function QuestionCard({ text }: QuestionCardProps) {
  return (
    <div className="px-4 py-3 lg:px-3 lg:py-2">
      <div className="relative overflow-hidden rounded-2xl border border-(--mobile-border) bg-(--mobile-panel) px-4 py-5 shadow-[0_10px_26px_var(--mobile-shadow)] lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:shadow-none">
        <div className="pointer-events-none absolute right-4 top-4 hidden text-5xl text-(--mobile-border) opacity-45 sm:block" aria-hidden="true">
          +
        </div>
        <h2 className="relative text-center text-[1.35rem] font-semibold leading-snug text-(--mobile-text) sm:text-[1.45rem] lg:text-sm lg:text-(--text)">
          {text}
        </h2>
      </div>
      <div className="mx-auto mt-3 h-px w-16 bg-[#d9a51c]/45 lg:mt-2 lg:w-12 lg:bg-(--border)" />
    </div>
  );
}
