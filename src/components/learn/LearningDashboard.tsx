"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { learningPath } from "@/lib/learningContent";
import {
  EMPTY_LEARNING_PROGRESS,
  LEARNING_PROGRESS_KEY,
  parseLearningProgress,
  type LearningProgress,
} from "@/lib/learningProgress";

export function LearningDashboard() {
  const [progress, setProgress] = useState<LearningProgress>(EMPTY_LEARNING_PROGRESS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setProgress(parseLearningProgress(localStorage.getItem(LEARNING_PROGRESS_KEY)));
    setHydrated(true);
  }, []);

  const nextLesson = useMemo(
    () => learningPath.lessons.find((lesson) => !progress.completedLessonIds.includes(lesson.id)),
    [progress.completedLessonIds]
  );
  const completion = Math.round((progress.completedLessonIds.length / learningPath.lessons.length) * 100);

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl border border-[#d4af37]/20 bg-[linear-gradient(135deg,#211d17_0%,#13110f_75%)] p-6 shadow-2xl sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#d4af37]">Core learning path</p>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_260px] lg:items-end">
          <div>
            <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-[#f7f1e7] sm:text-5xl">
              {learningPath.title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#c8beae]">{learningPath.description}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#c8beae]">Path progress</span>
              <span className="font-bold text-[#f7f1e7]">{hydrated ? `${completion}%` : "—"}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/35">
              <div className="h-full rounded-full bg-[#d4af37] transition-all" style={{ width: `${hydrated ? completion : 0}%` }} />
            </div>
            <p className="mt-3 text-xs text-[#9f9586]">
              {progress.completedLessonIds.length} of {learningPath.lessons.length} lessons complete
            </p>
          </div>
        </div>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href={nextLesson ? `/learn/${nextLesson.id}` : "/practice"}
            className="rounded-xl bg-[#d4af37] px-5 py-3 text-sm font-bold text-[#17130a] transition hover:bg-[#e2c45c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {nextLesson ? `${progress.completedLessonIds.length ? "Continue" : "Begin"}: Lesson ${nextLesson.order}` : "Review with practice"}
          </Link>
          <Link
            href="/practice"
            className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-[#f7f1e7] transition hover:border-[#d4af37]/60 hover:bg-white/10"
          >
            Practice now
          </Link>
        </div>
      </section>

      <section aria-labelledby="lessons-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9f9586]">Structured formation</p>
            <h2 id="lessons-heading" className="mt-1 text-2xl font-bold text-[#f7f1e7]">Lessons</h2>
          </div>
          <p className="hidden text-sm text-[#9f9586] sm:block">Every lesson includes primary-source references.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {learningPath.lessons.map((lesson) => {
            const completed = progress.completedLessonIds.includes(lesson.id);
            return (
              <Link
                key={lesson.id}
                href={`/learn/${lesson.id}`}
                className="group rounded-2xl border border-white/10 bg-[#1c1915] p-5 transition hover:-translate-y-0.5 hover:border-[#d4af37]/50 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]"
              >
                <div className="flex items-start gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#d4af37]/35 bg-[#d4af37]/10 font-serif text-lg font-bold text-[#d4af37]">
                    {completed ? "✓" : lesson.order}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#9f9586]">
                      <span>{lesson.difficulty}</span><span aria-hidden="true">·</span><span>{lesson.durationMinutes} min</span>
                    </div>
                    <h3 className="mt-2 text-xl font-bold text-[#f7f1e7] group-hover:text-[#e4c760]">{lesson.title}</h3>
                    <p className="mt-1 text-sm font-medium text-[#b9ae9d]">{lesson.subtitle}</p>
                    <p className="mt-3 text-sm leading-6 text-[#9f9586]">{lesson.summary}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-[#171512] p-5">
          <p className="text-sm text-[#9f9586]">Practice best</p>
          <p className="mt-2 text-3xl font-bold text-[#f7f1e7]">{hydrated ? `${progress.practiceBest}/${8}` : "—"}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#171512] p-5">
          <p className="text-sm text-[#9f9586]">Practice attempts</p>
          <p className="mt-2 text-3xl font-bold text-[#f7f1e7]">{hydrated ? progress.practiceAttempts : "—"}</p>
        </div>
        <div className="rounded-2xl border border-[#d4af37]/20 bg-[#211d17] p-5">
          <p className="text-sm text-[#c8beae]">Ready for competition?</p>
          <Link href="/mobile" className="mt-2 inline-block text-lg font-bold text-[#e4c760] hover:underline">Enter a live room →</Link>
        </div>
      </section>
    </div>
  );
}
