"use client";

interface QuestionCardProps {
  text: string;
}

export function QuestionCard({ text }: QuestionCardProps) {
  return (
    <div className="px-3 py-2">
      <h2 className="text-sm font-semibold text-(--text) text-center leading-snug">
        {text}
      </h2>
      <div className="mt-2 mx-auto w-12 h-px bg-(--border)" />
    </div>
  );
}
