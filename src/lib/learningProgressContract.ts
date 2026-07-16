import type { PendingPracticeAttempt, RemoteLearningProgress } from "./learningProgress";

export const LEARNING_PROGRESS_API_PATH = "/api/learning/progress";
export const MAX_PROGRESS_SYNC_BODY_BYTES = 64 * 1024;
export const MAX_COMPLETED_LESSONS_PER_SYNC = 200;
export const MAX_PRACTICE_EVENTS_PER_SYNC = 100;

export type LearningProgressSyncInput = {
  baseRevision: number;
  completedLessonIds: string[];
  practiceBest: number;
  /** Legacy v1 aggregate only; new attempts are represented by idempotent events. */
  practiceAttemptsFloor: number;
  clientUpdatedAt: string | null;
  practiceAttempts: PendingPracticeAttempt[];
};

export type LearningProgressSuccessResponse = {
  ok: true;
  progress: RemoteLearningProgress;
  conflictMerged?: boolean;
  acknowledgedMutationIds?: string[];
};

export type LearningProgressUnavailableResponse = {
  ok: false;
  code: "learning_sync_disabled" | "learning_sync_unavailable";
  error: string;
  localFallback: true;
};

export type LearningProgressErrorResponse = {
  ok: false;
  code?: string;
  error: string;
  details?: string[];
};
