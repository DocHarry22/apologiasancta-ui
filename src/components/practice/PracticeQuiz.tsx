"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { practiceQuestions } from "@/lib/learningContent";
import {
  LEARNING_PROGRESS_KEY,
  parseLearningProgress,
  recordPracticeAttempt,
} from "@/lib/learningProgress";

export function PracticeQuiz() {
  const questions = useMemo(() => practiceQuestions, []);
  const [index, setIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const question = questions[index];
  const answered = selectedId !== null;

  const choose = (choiceId: string) => {
    if (answered) return;
    setSelectedId(choiceId);
    if (choiceId === question.correctId) setScore((value) => value + 1);
  };

  const next = () => {
    if (index < questions.length - 1) {
      setIndex((value) => value + 1);
      setSelectedId(null);
      return;
    }

    const finalScore = score;
    const progress = parseLearningProgress(localStorage.getItem(LEARNING_PROGRESS_KEY));
    localStorage.setItem(LEARNING_PROGRESS_KEY, JSON.stringify(recordPracticeAttempt(progress, finalScore)));
    setFinished(true);
  };

  const restart = () => {
    setIndex(0);
    setSelectedId(null);
    setScore(0);
    setFinished(false);
  };

  if (finished) {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <section className="mx-auto max-w-2xl rounded-3xl border border-[#d4af37]/25 bg-[#1c1915] p-7 text-center shadow-2xl sm:p-10" aria-live="polite">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#d4af37]">Practice complete</p>
        <p className="mt-5 text-6xl font-bold text-[#f7f1e7]">{score}/{questions.length}</p>
        <p className="mt-3 text-lg text-[#c8beae]">
          {percentage >= 88 ? "Strong foundation. You are ready to test it live." : percentage >= 63 ? "Good progress. Review the explanations you missed." : "Return to the lessons, then try again with the sources open."}
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button onClick={restart} className="rounded-xl bg-[#d4af37] px-5 py-3 font-bold text-[#17130a] hover:bg-[#e2c45c]">Try again</button>
          <Link href="/learn" className="rounded-xl border border-white/15 px-5 py-3 font-bold text-[#f7f1e7] hover:border-[#d4af37]/60">Review lessons</Link>
          <Link href="/mobile" className="rounded-xl border border-white/15 px-5 py-3 font-bold text-[#f7f1e7] hover:border-[#d4af37]/60">Play live</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl" aria-labelledby="practice-question">
      <div className="mb-4 flex items-center justify-between text-sm text-[#9f9586]">
        <span>Question {index + 1} of {questions.length}</span>
        <span>{score} correct</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/8">
        <div className="h-full rounded-full bg-[#d4af37] transition-all" style={{ width: `${((index + (answered ? 1 : 0)) / questions.length) * 100}%` }} />
      </div>

      <div className="mt-6 rounded-3xl border border-white/10 bg-[#1c1915] p-6 shadow-2xl sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d4af37]">Foundations review</p>
        <h1 id="practice-question" className="mt-3 text-2xl font-bold leading-tight text-[#f7f1e7] sm:text-3xl">{question.prompt}</h1>
        <div className="mt-6 grid gap-3">
          {question.choices.map((choice) => {
            const isSelected = choice.id === selectedId;
            const isCorrect = answered && choice.id === question.correctId;
            const isWrong = answered && isSelected && choice.id !== question.correctId;
            return (
              <button
                key={choice.id}
                type="button"
                onClick={() => choose(choice.id)}
                disabled={answered}
                className={`min-h-14 rounded-2xl border px-4 py-3 text-left text-base font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] ${
                  isCorrect
                    ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-100"
                    : isWrong
                      ? "border-red-400/70 bg-red-500/15 text-red-100"
                      : "border-white/12 bg-white/[0.035] text-[#e9e2d6] hover:border-[#d4af37]/55 hover:bg-[#d4af37]/8 disabled:cursor-default"
                }`}
              >
                <span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-full border border-current/25 text-sm uppercase">{choice.id}</span>
                {choice.label}
              </button>
            );
          })}
        </div>

        {answered ? (
          <div className="mt-6 rounded-2xl border border-[#d4af37]/20 bg-[#211d17] p-5" aria-live="polite">
            <p className="font-bold text-[#f7f1e7]">{selectedId === question.correctId ? "Correct" : "Not quite"}</p>
            <p className="mt-2 text-sm leading-6 text-[#c8beae]">{question.explanation}</p>
            <p className="mt-3 text-xs font-semibold text-[#d4af37]">Sources: {question.references.join(" · ")}</p>
            <button onClick={next} className="mt-5 w-full rounded-xl bg-[#d4af37] px-5 py-3 font-bold text-[#17130a] hover:bg-[#e2c45c] sm:w-auto">
              {index < questions.length - 1 ? "Next question" : "See results"}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
