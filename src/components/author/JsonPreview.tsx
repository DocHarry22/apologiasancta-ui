"use client";

import type { Question } from "@/types/content";

interface Props {
  question: Question;
}

export default function JsonPreview({ question }: Props) {
  // Ensure property order matches schema
  const orderedQuestion = {
    id: question.id,
    topicId: question.topicId,
    difficulty: question.difficulty,
    question: question.question,
    choices: {
      A: question.choices.A,
      B: question.choices.B,
      C: question.choices.C,
      D: question.choices.D,
    },
    correctId: question.correctId,
    teaching: {
      title: question.teaching.title,
      body: question.teaching.body,
      refs: question.teaching.refs,
    },
    tags: question.tags,
  };

  const jsonStr = JSON.stringify(orderedQuestion, null, 2);

  return (
    <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 space-y-2">
      <h3 className="text-sm font-semibold">JSON Preview</h3>
      <pre className="rounded-lg bg-[color:var(--bg)] border border-[color:var(--border)] p-3 text-xs font-mono overflow-x-auto max-h-96 overflow-y-auto">
        <code className="text-[color:var(--text-secondary)]">{jsonStr}</code>
      </pre>
    </section>
  );
}
