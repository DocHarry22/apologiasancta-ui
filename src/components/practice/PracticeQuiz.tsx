"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ProgressBar } from "@/components/ui/Primitives";
import { practiceQuestions } from "@/lib/learningContent";
import { LEARNING_PROGRESS_KEY, parseLearningProgress, recordPracticeAttempt } from "@/lib/learningProgress";

export function PracticeQuiz() {
  const questions = useMemo(() => practiceQuestions, []);
  const [index, setIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const question = questions[index];
  const answered = selectedId !== null;

  const choose = (choiceId: string) => { if (answered) return; setSelectedId(choiceId); if (choiceId === question.correctId) setScore((value) => value + 1); };
  const next = () => {
    if (index < questions.length - 1) { setIndex((value) => value + 1); setSelectedId(null); return; }
    const progress = parseLearningProgress(localStorage.getItem(LEARNING_PROGRESS_KEY));
    localStorage.setItem(LEARNING_PROGRESS_KEY, JSON.stringify(recordPracticeAttempt(progress, score)));
    setFinished(true);
  };
  const restart = () => { setIndex(0); setSelectedId(null); setScore(0); setFinished(false); };

  if (finished) {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <section className="surface-card-elevated mx-auto max-w-2xl p-7 text-center sm:p-10" aria-live="polite">
        <p className="eyebrow">Practice complete</p><p className="editorial-heading mt-5 text-6xl font-semibold">{score}/{questions.length}</p>
        <p className="mt-3 text-lg leading-7 text-(--text-muted)">{percentage >= 88 ? "Strong foundation. You are ready to test it live." : percentage >= 63 ? "Good progress. Review the explanations you missed." : "Return to the lessons, then try again with the sources open."}</p>
        <p className="mt-2 text-xs text-(--text-muted)">This best score and attempt are stored on this device.</p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><button type="button" onClick={restart} className="btn-primary">Try again</button><Link href="/learn" className="btn-secondary">Review lessons</Link><Link href="/mobile" className="btn-secondary">Play live</Link></div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl" aria-labelledby="practice-question">
      <div className="mb-3 flex items-center justify-between text-sm text-(--text-muted)"><span>Question {index + 1} of {questions.length}</span><span>{score} correct so far</span></div>
      <ProgressBar value={((index + (answered ? 1 : 0)) / questions.length) * 100} label="Practice progress" />
      <div className="surface-card-elevated mt-6 p-5 sm:p-8">
        <p className="eyebrow">Foundations review</p><h2 id="practice-question" className="editorial-heading mt-3 text-2xl font-semibold leading-tight sm:text-3xl">{question.prompt}</h2>
        <div className="mt-6 grid gap-3">{question.choices.map((choice) => {
          const selected = choice.id === selectedId;
          const correct = answered && choice.id === question.correctId;
          const wrong = answered && selected && choice.id !== question.correctId;
          const statusClass = correct ? "border-(--correct) bg-(--correct-bg) text-(--correct)" : wrong ? "border-(--wrong) bg-(--wrong-bg) text-(--wrong)" : "border-(--quiz-option-border) bg-(--quiz-option-bg) text-(--text) hover:border-(--gold) hover:bg-(--quiz-option-hover)";
          return <button key={choice.id} type="button" onClick={() => choose(choice.id)} disabled={answered} className={`flex min-h-16 items-center rounded-xl border px-4 py-3 text-left text-base font-semibold ${statusClass} disabled:cursor-default`}><span className="mr-3 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-current text-sm uppercase">{correct ? "✓" : wrong ? "×" : choice.id}</span><span>{choice.label}</span><span className="sr-only">{correct ? " Correct answer" : wrong ? " Incorrect selection" : ""}</span></button>;
        })}</div>
        {answered ? <div className="mt-6 rounded-xl border border-(--gold) bg-[color-mix(in_srgb,var(--gold)_8%,var(--surface))] p-5" aria-live="polite"><p className="font-bold">{selectedId === question.correctId ? "Correct" : "Not quite"}</p><p className="mt-2 text-sm leading-6 text-(--text-muted)">{question.explanation}</p><p className="mt-3 text-xs font-semibold text-(--gold-hover)">Sources: {question.references.join(" · ")}</p><button type="button" onClick={next} className="btn-primary mt-5 w-full sm:w-auto">{index < questions.length - 1 ? "Next question" : "See results"}</button></div> : null}
      </div>
    </section>
  );
}
