"use client";

import {
  LEARNING_PROGRESS_KEY,
  mergeRemoteLearningProgress,
  parseLearningProgress,
  type LearningProgress,
  type RemoteLearningProgress,
} from "./learningProgress";
import {
  LEARNING_PROGRESS_API_PATH,
  MAX_PRACTICE_EVENTS_PER_SYNC,
  type LearningProgressSuccessResponse,
  type LearningProgressSyncInput,
} from "./learningProgressContract";

export const LEARNING_PROGRESS_CHANGED_EVENT = "apologia:learning-progress-changed";

export type LearningProgressSyncStatus =
  | "synced"
  | "local_only"
  | "offline"
  | "signed_out";

export type LearningProgressSyncOutcome = {
  status: LearningProgressSyncStatus;
  progress: LearningProgress;
};

let activeSync: Promise<LearningProgressSyncOutcome> | null = null;

function browserStorageAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readLocalLearningProgress(): LearningProgress {
  if (!browserStorageAvailable()) return parseLearningProgress(null);
  try {
    return parseLearningProgress(window.localStorage.getItem(LEARNING_PROGRESS_KEY));
  } catch {
    return parseLearningProgress(null);
  }
}

export function writeLocalLearningProgress(progress: LearningProgress): void {
  if (!browserStorageAvailable()) return;
  try {
    window.localStorage.setItem(LEARNING_PROGRESS_KEY, JSON.stringify(progress));
    window.dispatchEvent(new CustomEvent(LEARNING_PROGRESS_CHANGED_EVENT, { detail: progress }));
  } catch {
    // Storage can be denied or full. The caller still retains its in-memory value.
  }
}

function isRemoteLearningProgress(value: unknown): value is RemoteLearningProgress {
  if (!value || typeof value !== "object") return false;
  const progress = value as Partial<RemoteLearningProgress>;
  return Array.isArray(progress.completedLessonIds)
    && progress.completedLessonIds.every((id) => typeof id === "string")
    && Number.isSafeInteger(progress.practiceBest)
    && Number(progress.practiceBest) >= 0
    && Number.isSafeInteger(progress.practiceAttempts)
    && Number(progress.practiceAttempts) >= 0
    && Number.isSafeInteger(progress.revision)
    && Number(progress.revision) >= 0
    && (progress.updatedAt === null || (typeof progress.updatedAt === "string" && Number.isFinite(Date.parse(progress.updatedAt))));
}

async function readSuccessResponse(response: Response): Promise<LearningProgressSuccessResponse | null> {
  try {
    const body = await response.json() as Partial<LearningProgressSuccessResponse>;
    return body.ok === true && isRemoteLearningProgress(body.progress)
      ? body as LearningProgressSuccessResponse
      : null;
  } catch {
    return null;
  }
}

async function getCsrfToken(): Promise<string | null> {
  try {
    const response = await fetch("/api/auth/csrf", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const body = await response.json() as { csrfToken?: unknown };
    return typeof body.csrfToken === "string" && body.csrfToken ? body.csrfToken : null;
  } catch {
    return null;
  }
}

function statusForFailedResponse(response: Response): LearningProgressSyncStatus {
  if (response.status === 401) return "signed_out";
  return "local_only";
}

function hasProgressNotYetInRemote(local: LearningProgress, remote: RemoteLearningProgress): boolean {
  const remoteLessons = new Set(remote.completedLessonIds);
  return local.completedLessonIds.some((lessonId) => !remoteLessons.has(lessonId))
    || local.practiceBest > remote.practiceBest
    || local.sync.practiceAttemptsFloor > remote.practiceAttempts
    || local.sync.pendingPracticeAttempts.length > 0;
}

async function runSync(): Promise<LearningProgressSyncOutcome> {
  let local = readLocalLearningProgress();
  let remoteResponse: Response;
  try {
    remoteResponse = await fetch(LEARNING_PROGRESS_API_PATH, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  } catch {
    return { status: "offline", progress: local };
  }
  if (!remoteResponse.ok) return { status: statusForFailedResponse(remoteResponse), progress: local };
  const remoteBody = await readSuccessResponse(remoteResponse);
  if (!remoteBody) return { status: "local_only", progress: local };

  // Merge the read with the latest local value so a lesson completed while the
  // request was in flight cannot be overwritten.
  local = mergeRemoteLearningProgress(readLocalLearningProgress(), remoteBody.progress);
  writeLocalLearningProgress(local);
  // A read can update local revision/sync metadata without creating anything
  // the server needs. Avoid fetching CSRF or issuing a revision-bumping POST
  // unless the local copy contributes actual monotonic progress.
  if (!hasProgressNotYetInRemote(local, remoteBody.progress)) {
    return { status: "synced", progress: local };
  }

  const csrfToken = await getCsrfToken();
  if (!csrfToken) return { status: "local_only", progress: local };

  // Bound foreground work. Any remaining offline events stay durable and are
  // retried on the next page load, online event, or progress change.
  for (let batch = 0; batch < 10; batch += 1) {
    const beforeRequest = readLocalLearningProgress();
    const sentEvents = beforeRequest.sync.pendingPracticeAttempts.slice(0, MAX_PRACTICE_EVENTS_PER_SYNC);
    const payload: LearningProgressSyncInput = {
      baseRevision: beforeRequest.sync.revision,
      completedLessonIds: beforeRequest.completedLessonIds,
      practiceBest: beforeRequest.practiceBest,
      practiceAttemptsFloor: beforeRequest.sync.practiceAttemptsFloor,
      clientUpdatedAt: beforeRequest.updatedAt ? new Date(beforeRequest.updatedAt).toISOString() : null,
      practiceAttempts: sentEvents,
    };

    let response: Response;
    try {
      response = await fetch(LEARNING_PROGRESS_API_PATH, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify(payload),
      });
    } catch {
      return { status: "offline", progress: readLocalLearningProgress() };
    }
    if (!response.ok) {
      return { status: statusForFailedResponse(response), progress: readLocalLearningProgress() };
    }
    const body = await readSuccessResponse(response);
    if (!body) return { status: "local_only", progress: readLocalLearningProgress() };

    const acknowledged = body.acknowledgedMutationIds ?? sentEvents.map((event) => event.id);
    local = mergeRemoteLearningProgress(readLocalLearningProgress(), body.progress, acknowledged);
    writeLocalLearningProgress(local);
    if (!hasProgressNotYetInRemote(local, body.progress)) {
      return { status: "synced", progress: local };
    }
  }

  return { status: "local_only", progress: readLocalLearningProgress() };
}

export function syncLocalLearningProgress(): Promise<LearningProgressSyncOutcome> {
  if (activeSync) return activeSync;
  const pending = runSync();
  activeSync = pending;
  void pending.finally(() => {
    if (activeSync === pending) activeSync = null;
  });
  return pending;
}
