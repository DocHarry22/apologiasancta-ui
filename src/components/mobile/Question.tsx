"use client";

interface QuestionProps {
  text: string;
}

export function Question({ text }: QuestionProps) {
  return (
    <div className="px-4 py-3 text-center">
      <h2 className="text-lg font-semibold text-(--text) leading-snug">
        {text}
      </h2>
    </div>
  );
}
