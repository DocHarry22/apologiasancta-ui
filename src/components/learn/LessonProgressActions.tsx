"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { completeLesson } from "@/lib/learningProgress";
import {
  readLocalLearningProgress,
  syncLocalLearningProgress,
  writeLocalLearningProgress,
} from "@/lib/learningProgressSync";

export function LessonProgressActions({ lessonId, nextLessonId }: { lessonId: string; nextLessonId?: string }) {
  const [completed, setCompleted] = useState(false);
  useEffect(() => { setCompleted(readLocalLearningProgress().completedLessonIds.includes(lessonId)); }, [lessonId]);
  const markComplete = () => {
    writeLocalLearningProgress(completeLesson(readLocalLearningProgress(), lessonId));
    setCompleted(true);
    void syncLocalLearningProgress();
  };
  return (
    <div className="surface-card flex flex-col gap-3 border-(--gold) p-5 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="font-bold">{completed ? "Lesson complete" : "Finish this lesson"}</p><p className="mt-1 text-sm text-(--text-muted)">Saved on this device and synced when you are signed in and online.</p></div>
      <div className="flex flex-wrap gap-2">{!completed ? <button type="button" onClick={markComplete} className="btn-primary">Mark complete</button> : null}<Link href={nextLessonId ? `/learn/${nextLessonId}` : "/practice"} className="btn-secondary">{nextLessonId ? "Next lesson" : "Start practice"} →</Link></div>
    </div>
  );
}
