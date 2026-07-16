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
import { learningPath } from "./learningContent";

export const LEARNING_PROGRESS_CHANGED_EVENT = "apologia:learning-progress-changed";
export const LEARNING_PROGRESS_ANONYMOUS_KEY = "apologia-learning-progress-anonymous-v1";
export const LEARNING_PROGRESS_ACCOUNT_KEY_PREFIX = "apologia-learning-progress-account-v1:";

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
let accountContextGeneration = 0;
const CURRENT_LESSON_IDS = new Set(learningPath.lessons.map((lesson) => lesson.id));
const ACCOUNT_SCOPE_PATTERN = /^[A-Za-z0-9_-]{16,80}$/;
const EARLIEST_SERVER_TIMESTAMP_MS = Date.parse("2020-01-01T00:00:00.000Z");
const MAX_SERVER_CLOCK_LEAD_MS = 4 * 60 * 1000;

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

function accountStorageKey(accountScope: string): string {
  return `${LEARNING_PROGRESS_ACCOUNT_KEY_PREFIX}${accountScope}`;
}

function readStoredProgress(key: string): LearningProgress | null {
  if (!browserStorageAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : parseLearningProgress(raw);
  } catch {
    return null;
  }
}

function writeStoredProgress(key: string, progress: LearningProgress): void {
  if (!browserStorageAvailable()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(progress));
  } catch {
    // The active in-memory/device value remains usable when storage is denied.
  }
}

function removeStoredProgress(key: string): boolean {
  if (!browserStorageAvailable()) return false;
  try {
    window.localStorage.removeItem(key);
    return window.localStorage.getItem(key) === null;
  } catch {
    return false;
  }
}

function archiveProgress(progress: LearningProgress): void {
  const key = progress.sync.accountScope
    ? accountStorageKey(progress.sync.accountScope)
    : LEARNING_PROGRESS_ANONYMOUS_KEY;
  writeStoredProgress(key, progress);
}

function invalidateAccountContext(): void {
  accountContextGeneration += 1;
  // The request itself cannot be cancelled here, but runSync checks the
  // generation before every account-selecting write. Let the new account start
  // its own sync immediately instead of sharing the stale promise.
  activeSync = null;
}

export function writeLocalLearningProgress(progress: LearningProgress): void {
  if (!browserStorageAvailable()) return;
  try {
    window.localStorage.setItem(LEARNING_PROGRESS_KEY, JSON.stringify(progress));
    archiveProgress(progress);
    window.dispatchEvent(new CustomEvent(LEARNING_PROGRESS_CHANGED_EVENT, { detail: progress }));
  } catch {
    // Storage can be denied or full. The caller still retains its in-memory value.
  }
}

function withAccountScope(progress: LearningProgress, accountScope: string): LearningProgress {
  return { ...progress, sync: { ...progress.sync, accountScope } };
}

function selectProgressForAccount(accountScope: string): LearningProgress {
  const active = readLocalLearningProgress();
  let base: LearningProgress;

  if (active.sync.accountScope === accountScope) {
    base = active;
  } else {
    // Account A is archived before account B becomes active. Nothing from A is
    // considered for B's POST, even if the browser changes sessions directly.
    archiveProgress(active);
    const archivedForAccount = readStoredProgress(accountStorageKey(accountScope));
    if (archivedForAccount) {
      base = withAccountScope(archivedForAccount, accountScope);
    } else if (active.sync.accountScope === null) {
      // Anonymous work can be claimed once by the first account that sees it.
      // Removing the anonymous slot prevents a later account claiming it too.
      base = removeStoredProgress(LEARNING_PROGRESS_ANONYMOUS_KEY)
        ? withAccountScope(active, accountScope)
        : withAccountScope(parseLearningProgress(null), accountScope);
    } else {
      base = withAccountScope(parseLearningProgress(null), accountScope);
    }
  }

  return base;
}

/** Activate the scope returned by login/signup before navigation can mutate progress. */
export function activateLearningProgressAccountScope(accountScope: string): LearningProgress {
  if (!ACCOUNT_SCOPE_PATTERN.test(accountScope)) return readLocalLearningProgress();
  invalidateAccountContext();
  const selected = selectProgressForAccount(accountScope);
  writeLocalLearningProgress(selected);
  return selected;
}

function activateAccountProgress(
  accountScope: string,
  remote: RemoteLearningProgress,
  serverTime: string
): LearningProgress {
  return mergeRemoteLearningProgress(selectProgressForAccount(accountScope), remote, [], serverTime);
}

/** Archive the signed-in account and restore a separate anonymous workspace. */
export function detachLearningProgressAccount(): void {
  invalidateAccountContext();
  if (!browserStorageAvailable()) return;
  const active = readLocalLearningProgress();
  archiveProgress(active);
  if (active.sync.accountScope === null) return;

  const anonymous = readStoredProgress(LEARNING_PROGRESS_ANONYMOUS_KEY) ?? parseLearningProgress(null);
  writeLocalLearningProgress({
    ...anonymous,
    sync: {
      ...anonymous.sync,
      accountScope: null,
      revision: 0,
      lastSyncedAt: null,
    },
  });
}

/** Clear both the active key and its device archive; cloud data may later restore it. */
export function clearActiveLearningProgressDeviceCopy(): boolean {
  if (!browserStorageAvailable()) return false;
  const active = readLocalLearningProgress();
  const archiveKey = active.sync.accountScope
    ? accountStorageKey(active.sync.accountScope)
    : LEARNING_PROGRESS_ANONYMOUS_KEY;
  const activeCleared = removeStoredProgress(LEARNING_PROGRESS_KEY);
  const archiveCleared = removeStoredProgress(archiveKey);
  if (activeCleared && archiveCleared) {
    window.dispatchEvent(new CustomEvent(LEARNING_PROGRESS_CHANGED_EVENT, {
      detail: parseLearningProgress(null),
    }));
  }
  return activeCleared && archiveCleared;
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
    return body.ok === true
      && typeof body.accountScope === "string"
      && ACCOUNT_SCOPE_PATTERN.test(body.accountScope)
      && typeof body.serverTime === "string"
      && Number.isFinite(Date.parse(body.serverTime))
      && isRemoteLearningProgress(body.progress)
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

function currentCompletedLessonIds(progress: LearningProgress): string[] {
  // Keep retired IDs in the offline record so an app update never destroys
  // user history, but do not send IDs the current server contract rejects.
  return progress.completedLessonIds.filter((lessonId) => CURRENT_LESSON_IDS.has(lessonId));
}

function normalizeTimestampForServer(value: string | number | null, serverTime: string): string | null {
  if (value === null) return null;
  const serverTimeMs = Date.parse(serverTime);
  const candidateMs = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(serverTimeMs)) return null;
  if (
    !Number.isFinite(candidateMs)
    || candidateMs < EARLIEST_SERVER_TIMESTAMP_MS
    || candidateMs > serverTimeMs + MAX_SERVER_CLOCK_LEAD_MS
  ) {
    return new Date(serverTimeMs).toISOString();
  }
  return new Date(candidateMs).toISOString();
}

function hasProgressNotYetInRemote(local: LearningProgress, remote: RemoteLearningProgress): boolean {
  const remoteLessons = new Set(remote.completedLessonIds);
  return currentCompletedLessonIds(local).some((lessonId) => !remoteLessons.has(lessonId))
    || local.practiceBest > remote.practiceBest
    || local.sync.practiceAttemptsFloor > remote.practiceAttempts
    || local.sync.pendingPracticeAttempts.length > 0;
}

async function runSync(): Promise<LearningProgressSyncOutcome> {
  let local = readLocalLearningProgress();
  const startingAccountScope = local.sync.accountScope;
  const syncGeneration = accountContextGeneration;
  let serverTime: string;
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
  const accountScope = remoteBody.accountScope;
  serverTime = remoteBody.serverTime;

  const latestBeforeActivation = readLocalLearningProgress();
  if (
    accountContextGeneration !== syncGeneration
    || latestBeforeActivation.sync.accountScope !== startingAccountScope
  ) {
    return { status: "local_only", progress: latestBeforeActivation };
  }

  // Select the account archive before considering any browser data for POST.
  // This is the account-switch boundary that prevents A's copy entering B.
  local = activateAccountProgress(accountScope, remoteBody.progress, serverTime);
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
    if (
      accountContextGeneration !== syncGeneration
      || beforeRequest.sync.accountScope !== accountScope
    ) {
      return { status: "local_only", progress: beforeRequest };
    }
    const sentEvents = beforeRequest.sync.pendingPracticeAttempts.slice(0, MAX_PRACTICE_EVENTS_PER_SYNC);
    const payload: LearningProgressSyncInput = {
      baseRevision: beforeRequest.sync.revision,
      completedLessonIds: currentCompletedLessonIds(beforeRequest),
      practiceBest: beforeRequest.practiceBest,
      practiceAttemptsFloor: beforeRequest.sync.practiceAttemptsFloor,
      clientUpdatedAt: normalizeTimestampForServer(beforeRequest.updatedAt, serverTime),
      practiceAttempts: sentEvents.map((event) => ({
        ...event,
        occurredAt: normalizeTimestampForServer(event.occurredAt, serverTime) ?? serverTime,
      })),
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
    if (accountContextGeneration !== syncGeneration || body.accountScope !== accountScope) {
      return { status: "local_only", progress: readLocalLearningProgress() };
    }
    serverTime = body.serverTime;

    const acknowledged = body.acknowledgedMutationIds ?? sentEvents.map((event) => event.id);
    const latest = readLocalLearningProgress();
    if (latest.sync.accountScope !== accountScope) {
      return { status: "local_only", progress: latest };
    }
    local = mergeRemoteLearningProgress(latest, body.progress, acknowledged, serverTime);
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
