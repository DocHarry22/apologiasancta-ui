export const LEARNING_PROGRESS_KEY = "apologia-learning-progress-v1";

export type PendingPracticeAttempt = {
  id: string;
  kind: "practice_attempt";
  score: number;
  occurredAt: string;
};

export type LearningProgressSyncMetadata = {
  /** Opaque server-issued scope used only to select this account's local archive. */
  accountScope: string | null;
  /** Last server revision observed for accountScope. */
  revision: number;
  /** Attempts inherited from the v1 aggregate before idempotent attempt events were introduced. */
  practiceAttemptsFloor: number;
  /** Events remain here until the server acknowledges their IDs. */
  pendingPracticeAttempts: PendingPracticeAttempt[];
  lastSyncedAt: string | null;
};

export type LearningProgress = {
  completedLessonIds: string[];
  practiceBest: number;
  practiceAttempts: number;
  updatedAt: number | null;
  sync: LearningProgressSyncMetadata;
};

export const EMPTY_LEARNING_PROGRESS: LearningProgress = {
  completedLessonIds: [],
  practiceBest: 0,
  practiceAttempts: 0,
  updatedAt: null,
  sync: {
    accountScope: null,
    revision: 0,
    practiceAttemptsFloor: 0,
    pendingPracticeAttempts: [],
    lastSyncedAt: null,
  },
};

const MAX_SAFE_PROGRESS_COUNT = 1_000_000;
const MUTATION_ID_PATTERN = /^[A-Za-z0-9_-]{16,80}$/;
const ACCOUNT_SCOPE_PATTERN = /^[A-Za-z0-9_-]{16,80}$/;

function finiteInteger(value: unknown, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(MAX_SAFE_PROGRESS_COUNT, Math.max(0, Math.trunc(Number(value))));
}

function validIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function parsePendingPracticeAttempts(value: unknown): PendingPracticeAttempt[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const attempts: PendingPracticeAttempt[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") continue;
    const item = candidate as Partial<PendingPracticeAttempt>;
    if (
      item.kind !== "practice_attempt" ||
      typeof item.id !== "string" ||
      !MUTATION_ID_PATTERN.test(item.id) ||
      !Number.isInteger(item.score) ||
      Number(item.score) < 0 ||
      Number(item.score) > 10_000 ||
      !validIsoTimestamp(item.occurredAt) ||
      seen.has(item.id)
    ) continue;
    seen.add(item.id);
    attempts.push({
      id: item.id,
      kind: "practice_attempt",
      score: Number(item.score),
      occurredAt: item.occurredAt,
    });
  }
  return attempts;
}

export function parseLearningProgress(value: string | null): LearningProgress {
  if (!value) return structuredClone(EMPTY_LEARNING_PROGRESS);

  try {
    const parsed = JSON.parse(value) as Partial<LearningProgress>;
    const practiceAttempts = finiteInteger(parsed.practiceAttempts);
    const rawSync = parsed.sync && typeof parsed.sync === "object"
      ? parsed.sync as Partial<LearningProgressSyncMetadata>
      : null;
    return {
      completedLessonIds: Array.isArray(parsed.completedLessonIds)
        ? [...new Set(parsed.completedLessonIds.filter((id): id is string => typeof id === "string" && Boolean(id.trim())))]
        : [],
      practiceBest: finiteInteger(parsed.practiceBest),
      practiceAttempts,
      updatedAt: Number.isFinite(parsed.updatedAt) ? Math.max(0, Number(parsed.updatedAt)) : null,
      sync: {
        accountScope: typeof rawSync?.accountScope === "string" && ACCOUNT_SCOPE_PATTERN.test(rawSync.accountScope)
          ? rawSync.accountScope
          : null,
        revision: finiteInteger(rawSync?.revision),
        // A legacy v1 value has no sync metadata. Treat its full aggregate as a
        // floor, then count all newly-created events exactly once.
        practiceAttemptsFloor: rawSync
          ? Math.min(practiceAttempts, finiteInteger(rawSync.practiceAttemptsFloor))
          : practiceAttempts,
        pendingPracticeAttempts: parsePendingPracticeAttempts(rawSync?.pendingPracticeAttempts),
        lastSyncedAt: validIsoTimestamp(rawSync?.lastSyncedAt) ? rawSync.lastSyncedAt : null,
      },
    };
  } catch {
    return structuredClone(EMPTY_LEARNING_PROGRESS);
  }
}

function createMutationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `attempt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
}

export function completeLesson(progress: LearningProgress, lessonId: string): LearningProgress {
  return {
    ...progress,
    completedLessonIds: [...new Set([...progress.completedLessonIds, lessonId])],
    updatedAt: Date.now(),
  };
}

export function recordPracticeAttempt(
  progress: LearningProgress,
  score: number,
  event: Pick<PendingPracticeAttempt, "id" | "occurredAt"> = {
    id: createMutationId(),
    occurredAt: new Date().toISOString(),
  }
): LearningProgress {
  const normalizedScore = finiteInteger(score);
  const mutation: PendingPracticeAttempt = {
    id: event.id,
    kind: "practice_attempt",
    score: normalizedScore,
    occurredAt: event.occurredAt,
  };
  return {
    ...progress,
    practiceBest: Math.max(progress.practiceBest, normalizedScore),
    practiceAttempts: progress.practiceAttempts + 1,
    updatedAt: Date.now(),
    sync: {
      ...progress.sync,
      pendingPracticeAttempts: [...progress.sync.pendingPracticeAttempts, mutation],
    },
  };
}

export type RemoteLearningProgress = {
  completedLessonIds: string[];
  practiceBest: number;
  practiceAttempts: number;
  revision: number;
  updatedAt: string | null;
};

/**
 * The merge is monotonic: cloud data can add completions, raise a best score,
 * or raise an attempt count, but can never erase newer offline work.
 */
export function mergeRemoteLearningProgress(
  local: LearningProgress,
  remote: RemoteLearningProgress,
  acknowledgedMutationIds: readonly string[] = [],
  syncedAt = new Date().toISOString()
): LearningProgress {
  const acknowledged = new Set(acknowledgedMutationIds);
  const remoteUpdatedAt = remote.updatedAt ? Date.parse(remote.updatedAt) : Number.NaN;
  return {
    completedLessonIds: [...new Set([...local.completedLessonIds, ...remote.completedLessonIds])],
    practiceBest: Math.max(local.practiceBest, remote.practiceBest),
    practiceAttempts: Math.max(local.practiceAttempts, remote.practiceAttempts),
    updatedAt: Math.max(local.updatedAt ?? 0, Number.isFinite(remoteUpdatedAt) ? remoteUpdatedAt : 0) || null,
    sync: {
      ...local.sync,
      revision: remote.revision,
      pendingPracticeAttempts: local.sync.pendingPracticeAttempts.filter((item) => !acknowledged.has(item.id)),
      lastSyncedAt: syncedAt,
    },
  };
}
