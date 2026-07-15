export const LEARNING_PROGRESS_KEY = "apologia-learning-progress-v1";

export type LearningProgress = {
  completedLessonIds: string[];
  practiceBest: number;
  practiceAttempts: number;
  updatedAt: number | null;
};

export const EMPTY_LEARNING_PROGRESS: LearningProgress = {
  completedLessonIds: [],
  practiceBest: 0,
  practiceAttempts: 0,
  updatedAt: null,
};

export function parseLearningProgress(value: string | null): LearningProgress {
  if (!value) return EMPTY_LEARNING_PROGRESS;

  try {
    const parsed = JSON.parse(value) as Partial<LearningProgress>;
    return {
      completedLessonIds: Array.isArray(parsed.completedLessonIds)
        ? parsed.completedLessonIds.filter((id): id is string => typeof id === "string")
        : [],
      practiceBest: Number.isFinite(parsed.practiceBest) ? Math.max(0, Number(parsed.practiceBest)) : 0,
      practiceAttempts: Number.isFinite(parsed.practiceAttempts)
        ? Math.max(0, Number(parsed.practiceAttempts))
        : 0,
      updatedAt: Number.isFinite(parsed.updatedAt) ? Number(parsed.updatedAt) : null,
    };
  } catch {
    return EMPTY_LEARNING_PROGRESS;
  }
}

export function completeLesson(progress: LearningProgress, lessonId: string): LearningProgress {
  return {
    ...progress,
    completedLessonIds: [...new Set([...progress.completedLessonIds, lessonId])],
    updatedAt: Date.now(),
  };
}

export function recordPracticeAttempt(progress: LearningProgress, score: number): LearningProgress {
  return {
    ...progress,
    practiceBest: Math.max(progress.practiceBest, score),
    practiceAttempts: progress.practiceAttempts + 1,
    updatedAt: Date.now(),
  };
}
