"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LEARNING_PROGRESS_KEY, completeLesson, parseLearningProgress } from "@/lib/learningProgress";

export function LessonProgressActions({ lessonId, nextLessonId }: { lessonId: string; nextLessonId?: string }) {
  const [completed, setCompleted] = useState(false);
  useEffect(() => { setCompleted(parseLearningProgress(localStorage.getItem(LEARNING_PROGRESS_KEY)).completedLessonIds.includes(lessonId)); }, [lessonId]);
  const markComplete = () => { const progress = parseLearningProgress(localStorage.getItem(LEARNING_PROGRESS_KEY)); localStorage.setItem(LEARNING_PROGRESS_KEY, JSON.stringify(completeLesson(progress, lessonId))); setCompleted(true); };
  return (
    <div className="surface-card flex flex-col gap-3 border-(--gold) p-5 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="font-bold">{completed ? "Lesson complete" : "Finish this lesson"}</p><p className="mt-1 text-sm text-(--text-muted)">Progress is saved on this device.</p></div>
      <div className="flex flex-wrap gap-2">{!completed ? <button type="button" onClick={markComplete} className="btn-primary">Mark complete</button> : null}<Link href={nextLessonId ? `/learn/${nextLessonId}` : "/practice"} className="btn-secondary">{nextLessonId ? "Next lesson" : "Start practice"} →</Link></div>
    </div>
  );
}
