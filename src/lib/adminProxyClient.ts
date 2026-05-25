/**
 * Browser-side admin proxy client.
 *
 * All functions call internal Next.js /api/admin/... routes instead of the
 * engine directly. No admin token is ever accepted or sent from the browser.
 */

import type {
  EngineResponse,
  AdminStatus,
  AdminRoomListResponse,
  AdminRoomMutationResponse,
  AdminPersistenceSaveResponse,
  ContentStatusResponse,
  ContentImportResponse,
  ContentSyncResponse,
  ContentGitHubClearResponse,
  QuizSetResponse,
  TopicSequenceResponse,
  TopicSequenceConfig,
  StartTopicResponse,
  LoopMode,
} from "@/lib/engineAdmin";

// --------------------------------------------------------------------------
// Internal fetch wrapper
// --------------------------------------------------------------------------

/** Read the CSRF token from the as_csrf_token cookie (non-httpOnly). */
function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)as_csrf_token=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/**
 * Ask the server to refresh the CSRF cookie.
 * Best-effort — errors are silently swallowed so callers never throw.
 */
async function refreshCsrfToken(): Promise<void> {
  try {
    await fetch("/api/auth/csrf", { method: "GET", credentials: "same-origin" });
  } catch {
    // ignore — best-effort refresh
  }
}

async function proxyFetch<T = unknown>(
  path: string,
  method: "GET" | "POST" = "GET",
  body?: Record<string, unknown>,
  /** Internal flag — set to true on the single automatic retry after CSRF refresh. */
  _retried = false
): Promise<EngineResponse<T>> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Attach CSRF token for all mutation requests so the server can verify it.
    if (method !== "GET") {
      const csrf = getCsrfToken();
      if (csrf) headers["x-csrf-token"] = csrf;
    }

    const response = await fetch(`/api/admin${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (response.status === 401) {
      return {
        success: false,
        error: "Session expired. Please log in again at /author/login.",
      };
    }

    if (response.status === 403) {
      // On the first failure try refreshing the CSRF cookie and retrying once.
      if (!_retried && method !== "GET") {
        await refreshCsrfToken();
        return proxyFetch<T>(path, method, body, true);
      }
      return {
        success: false,
        error: "Request blocked: CSRF or session verification failed.",
      };
    }

    const data = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      return {
        success: false,
        error:
          (typeof data?.error === "string" && data.error) ||
          `HTTP ${response.status}`,
      };
    }

    return { success: true, data: data as T };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

function buildPath(basePath: string, roomId?: string | null): string {
  const normalizedBase = basePath.startsWith("/") ? basePath : `/${basePath}`;
  if (!roomId) return normalizedBase;
  return `/rooms/${encodeURIComponent(roomId)}${normalizedBase}`;
}

// --------------------------------------------------------------------------
// Admin engine controls
// --------------------------------------------------------------------------

export const adminProxy = {
  status: (roomId?: string | null) =>
    proxyFetch<AdminStatus>(buildPath("/status", roomId)),

  start: (roomId?: string | null) =>
    proxyFetch(buildPath("/start", roomId), "POST"),

  resume: (roomId?: string | null) =>
    proxyFetch(buildPath("/resume", roomId), "POST"),

  pause: (roomId?: string | null) =>
    proxyFetch(buildPath("/pause", roomId), "POST"),

  next: (roomId?: string | null) =>
    proxyFetch(buildPath("/next", roomId), "POST"),

  reset: (roomId?: string | null) =>
    proxyFetch(buildPath("/reset", roomId), "POST"),

  savePersistence: () =>
    proxyFetch<AdminPersistenceSaveResponse>("/persistence/save", "POST"),
};

// --------------------------------------------------------------------------
// Room management
// --------------------------------------------------------------------------

export const roomProxy = {
  list: (includeClosed = true) =>
    proxyFetch<AdminRoomListResponse>(
      `/rooms${includeClosed ? "?includeClosed=true" : ""}`
    ),

  create: (name: string, roomId?: string) =>
    proxyFetch<AdminRoomMutationResponse>("/rooms", "POST", {
      name,
      ...(roomId ? { roomId } : {}),
    }),

  close: (roomId: string) =>
    proxyFetch<AdminRoomMutationResponse>(
      `/rooms/${encodeURIComponent(roomId)}/close`,
      "POST"
    ),
};

// --------------------------------------------------------------------------
// Content management
// --------------------------------------------------------------------------

export const contentProxy = {
  status: () =>
    proxyFetch<ContentStatusResponse>("/content/status"),

  import: (
    questions: unknown[],
    options?: { commitToGitHub?: boolean; commitMessage?: string }
  ) =>
    proxyFetch<ContentImportResponse>("/content/import", "POST", {
      questions,
      ...options,
    }),

  clear: () =>
    proxyFetch("/content/clear", "POST"),

  syncFromGitHub: () =>
    proxyFetch<ContentSyncResponse>("/content/sync", "POST"),

  clearGitHub: () =>
    proxyFetch<ContentGitHubClearResponse>("/content/github/clear", "POST"),
};

// --------------------------------------------------------------------------
// Quiz pool
// --------------------------------------------------------------------------

export const quizProxy = {
  setPool: (topicIds: string[] = [], shuffle = true) =>
    proxyFetch<QuizSetResponse>("/quiz/set", "POST", { topicIds, shuffle }),
};

// --------------------------------------------------------------------------
// Topic management
// --------------------------------------------------------------------------

export const topicProxy = {
  getSequence: (roomId?: string | null) =>
    proxyFetch<TopicSequenceResponse>(buildPath("/topic/sequence", roomId)),

  setSequence: (config: Partial<TopicSequenceConfig>, roomId?: string | null) =>
    proxyFetch<{ success: boolean; config: TopicSequenceConfig }>(
      buildPath("/topic/sequence", roomId),
      "POST",
      config as Record<string, unknown>
    ),

  startNextTopic: (topicId?: string, roomId?: string | null) =>
    proxyFetch<StartTopicResponse>(
      buildPath("/topic/next", roomId),
      "POST",
      topicId ? { topicId } : undefined
    ),

  startTopic: (topicId: string, roomId?: string | null) =>
    proxyFetch<StartTopicResponse>(
      buildPath(`/topic/start/${encodeURIComponent(topicId)}`, roomId),
      "POST"
    ),

  cancelAutoAdvance: (roomId?: string | null) =>
    proxyFetch<{ success: boolean; message: string }>(
      buildPath("/topic/cancel-auto", roomId),
      "POST"
    ),

  skipTopic: (roomId?: string | null) =>
    proxyFetch<StartTopicResponse>(buildPath("/topic/skip", roomId), "POST"),

  replayTopic: (roomId?: string | null) =>
    proxyFetch<StartTopicResponse>(buildPath("/topic/replay", roomId), "POST"),

  countdownTopic: (
    countdownSeconds = 10,
    topicId?: string,
    roomId?: string | null
  ) =>
    proxyFetch<{
      success: boolean;
      message: string;
      topicId: string;
      topicTitle: string;
      countdownSeconds: number;
    }>(buildPath("/topic/countdown", roomId), "POST", {
      countdownSeconds,
      ...(topicId ? { topicId } : {}),
    }),

  setTopicLoop: (mode: LoopMode, roomId?: string | null) =>
    proxyFetch<{
      success: boolean;
      message: string;
      topicLoopMode: LoopMode;
      topicRepeatsRemaining: number;
    }>(buildPath("/topic/loop", roomId), "POST", { mode: mode as string | number }),

  setSeriesLoop: (mode: LoopMode, roomId?: string | null) =>
    proxyFetch<{
      success: boolean;
      message: string;
      seriesLoopMode: LoopMode;
      seriesRepeatsRemaining: number;
    }>(buildPath("/series/loop", roomId), "POST", { mode: mode as string | number }),

  setCountdownDuration: (seconds: number, roomId?: string | null) =>
    proxyFetch<{ success: boolean; message: string; countdownSeconds: number }>(
      buildPath("/countdown/set", roomId),
      "POST",
      { seconds }
    ),
};
