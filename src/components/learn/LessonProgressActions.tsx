"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  LEARNING_PROGRESS_KEY,
  completeLesson,
  parseLearningProgress,
} from "@/lib/learningProgress";

export function LessonProgressActions({ lessonId, nextLessonId }: { lessonId: string; nextLessonId?: string }) {
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const progress = parseLearningProgress(localStorage.getItem(LEARNING_PROGRESS_KEY));
    setCompleted(progress.completedLessonIds.includes(lessonId));
  }, [lessonId]);

  const markComplete = () => {
    const progress = parseLearningProgress(localStorage.getItem(LEARNING_PROGRESS_KEY));
    localStorage.setItem(LEARNING_PROGRESS_KEY, JSON.stringify(completeLesson(progress, lessonId)));
    setCompleted(true);
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#d4af37]/25 bg-[#211d17] p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-bold text-[#f7f1e7]">{completed ? "Lesson complete" : "Finish this lesson"}</p>
        <p className="mt-1 text-sm text-[#a99f90]">Progress is saved on this device.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {!completed ? (
          <button onClick={markComplete} className="rounded-xl bg-[#d4af37] px-4 py-2.5 text-sm font-bold text-[#17130a] hover:bg-[#e2c45c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            Mark complete
          </button>
        ) : null}
        <Link
          href={nextLessonId ? `/learn/${nextLessonId}` : "/practice"}
          className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold text-[#f7f1e7] hover:border-[#d4af37]/60"
        >
          {nextLessonId ? "Next lesson" : "Start practice"} →
        </Link>
      </div>
    </div>
  );
}
