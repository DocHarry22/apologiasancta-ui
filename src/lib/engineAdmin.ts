/**
 * Engine Admin API utilities
 * 
 * Provides fetch wrapper for admin endpoints with token authentication.
 */

export interface EngineResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AdminStatus {
  running: boolean;
  phase: string;
  questionIndex: number;
  totalQuestions: number;
  questionSource?: "active_pool" | "legacy_fallback";
  scoringMode?: "flat" | "v2";
  connectedClients: number;
  timeRemainingMs: number;
  endsAtMs: number;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
}

/**
 * Fetch wrapper for engine API with admin token
 */
export async function engineFetch<T = unknown>(
  engineUrl: string,
  path: string,
  method: "GET" | "POST" = "GET",
  token: string,
  body?: Record<string, unknown>
): Promise<EngineResponse<T>> {
  try {
    const response = await fetch(`${engineUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": token,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || data.message || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      data: data as T,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error";
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Health check (no token required)
 */
export async function checkHealth(engineUrl: string): Promise<EngineResponse<HealthResponse>> {
  try {
    const response = await fetch(`${engineUrl}/health`);
    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      data: data as HealthResponse,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error";
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Admin actions
 */
export const adminActions = {
  start: (engineUrl: string, token: string) =>
    engineFetch(engineUrl, "/admin/start", "POST", token),

  pause: (engineUrl: string, token: string) =>
    engineFetch(engineUrl, "/admin/pause", "POST", token),

  next: (engineUrl: string, token: string) =>
    engineFetch(engineUrl, "/admin/next", "POST", token),

  reset: (engineUrl: string, token: string) =>
    engineFetch(engineUrl, "/admin/reset", "POST", token),

  status: (engineUrl: string, token: string) =>
    engineFetch<AdminStatus>(engineUrl, "/admin/status", "GET", token),
};

/** Content bank status response */
export interface ContentStatusResponse {
  bankSize: number;
  activePoolSize: number;
  topicCount: number;
  topics: Array<{ topicId: string; count: number }>;
  gitHubConfigured: boolean;
}

export interface ContentSyncResponse {
  success?: boolean;
  message?: string;
  topicsLoaded: number;
  questionsLoaded: number;
  errors?: string[];
}

export interface ContentGitHubClearResponse {
  success: boolean;
  deletedQuestions: number;
  deletedManifests: number;
  topicsProcessed: number;
}

/** Import response */
export interface ContentImportResponse {
  added: number;
  updated: number;
  ids: string[];
  committed: boolean;
  commitTarget?: {
    owner: string;
    repo: string;
    branch: string;
    contentRoot: string;
  };
  bankSize: number;
}

/** Import error response */
export interface ContentImportError {
  error: string;
  validCount?: number;
  invalidCount?: number;
  errors?: Array<{ index: number; errors: string[] }>;
}

/** Quiz set response */
export interface QuizSetResponse {
  poolSize: number;
  topicIds: string[];
  shuffle: boolean;
}

/**
 * Content management actions
 */
export const contentActions = {
  /**
   * Get content bank status
   */
  status: (engineUrl: string, token: string) =>
    engineFetch<ContentStatusResponse>(engineUrl, "/admin/content/status", "GET", token),

  /**
   * Import questions into the content bank
   */
  import: (
    engineUrl: string,
    token: string,
    questions: unknown[],
    options?: { commitToGitHub?: boolean; commitMessage?: string }
  ) =>
    engineFetch<ContentImportResponse>(engineUrl, "/admin/content/import", "POST", token, {
      questions,
      ...options,
    }),

  /**
   * Clear all questions from the content bank
   */
  clear: (engineUrl: string, token: string) =>
    engineFetch(engineUrl, "/admin/content/clear", "POST", token),

  /**
   * Sync/fetch topics & questions from GitHub into local engine bank
   */
  syncFromGitHub: (engineUrl: string, token: string) =>
    engineFetch<ContentSyncResponse>(engineUrl, "/admin/content/sync", "POST", token),

  /**
   * Danger action: delete question files from GitHub content store
   */
  clearGitHub: (engineUrl: string, token: string) =>
    engineFetch<ContentGitHubClearResponse>(engineUrl, "/admin/content/github/clear", "POST", token),
};

/**
 * Quiz set management actions
 */
export const quizActions = {
  /**
   * Configure the active quiz question pool
   */
  setPool: (
    engineUrl: string,
    token: string,
    topicIds: string[] = [],
    shuffle: boolean = true
  ) =>
    engineFetch<QuizSetResponse>(engineUrl, "/admin/quiz/set", "POST", token, {
      topicIds,
      shuffle,
    }),
};

// ============== Topic Management ==============

/** Loop mode type matching engine */
export type LoopMode = "off" | "once" | "infinite" | number;

export interface TopicSequenceConfig {
  topicSequence: string[];
  congratsDisplayTimeMs: number;
  countdownSeconds: number;
  autoAdvance: boolean;
  topicLoopMode: LoopMode;
  topicRepeatsRemaining: number;
  seriesLoopMode: LoopMode;
  seriesRepeatsRemaining: number;
}

export interface TopicInfo {
  id: string;
  title: string;
}

export interface TopicSequenceResponse {
  config: TopicSequenceConfig;
  availableTopics: string[];
  availableTopicsWithTitles: TopicInfo[];
}

export interface StartTopicResponse {
  success: boolean;
  message: string;
  topicTitle: string;
  status: AdminStatus;
}

/**
 * Topic management actions
 */
export const topicActions = {
  /**
   * Get topic sequence configuration and available topics
   */
  getSequence: (engineUrl: string, token: string) =>
    engineFetch<TopicSequenceResponse>(engineUrl, "/admin/topic/sequence", "GET", token),

  /**
   * Update topic sequence configuration
   */
  setSequence: (
    engineUrl: string,
    token: string,
    config: Partial<TopicSequenceConfig>
  ) =>
    engineFetch<{ success: boolean; config: TopicSequenceConfig }>(
      engineUrl,
      "/admin/topic/sequence",
      "POST",
      token,
      config
    ),

  /**
   * Start the next topic in sequence (or specific topicId)
   */
  startNextTopic: (engineUrl: string, token: string, topicId?: string) =>
    engineFetch<StartTopicResponse>(
      engineUrl,
      "/admin/topic/next",
      "POST",
      token,
      topicId ? { topicId } : undefined
    ),

  /**
   * Start a specific topic by ID
   */
  startTopic: (engineUrl: string, token: string, topicId: string) =>
    engineFetch<StartTopicResponse>(
      engineUrl,
      `/admin/topic/start/${encodeURIComponent(topicId)}`,
      "POST",
      token
    ),

  /**
   * Cancel auto-advance to next topic
   */
  cancelAutoAdvance: (engineUrl: string, token: string) =>
    engineFetch<{ success: boolean; message: string }>(
      engineUrl,
      "/admin/topic/cancel-auto",
      "POST",
      token
    ),

  /**
   * Skip current topic and move to next
   * Resets scores/streaks and starts next topic immediately
   */
  skipTopic: (engineUrl: string, token: string) =>
    engineFetch<StartTopicResponse>(
      engineUrl,
      "/admin/topic/skip",
      "POST",
      token
    ),

  /**
   * Replay current topic from beginning
   * Resets scores/streaks and restarts same topic
   */
  replayTopic: (engineUrl: string, token: string) =>
    engineFetch<StartTopicResponse>(
      engineUrl,
      "/admin/topic/replay",
      "POST",
      token
    ),

  /**
   * Start a countdown before beginning a topic
   * Emits topicCountdown event for UI display
   */
  countdownTopic: (engineUrl: string, token: string, countdownSeconds: number = 10, topicId?: string) =>
    engineFetch<{ success: boolean; message: string; topicId: string; topicTitle: string; countdownSeconds: number }>(
      engineUrl,
      "/admin/topic/countdown",
      "POST",
      token,
      { countdownSeconds, ...(topicId ? { topicId } : {}) }
    ),

  /**
   * Set topic loop mode
   * Controls whether current topic repeats after completion
   */
  setTopicLoop: (engineUrl: string, token: string, mode: LoopMode) =>
    engineFetch<{ success: boolean; message: string; topicLoopMode: LoopMode; topicRepeatsRemaining: number }>(
      engineUrl,
      "/admin/topic/loop",
      "POST",
      token,
      { mode }
    ),

  /**
   * Set series loop mode
   * Controls whether entire topic sequence repeats after completion
   */
  setSeriesLoop: (engineUrl: string, token: string, mode: LoopMode) =>
    engineFetch<{ success: boolean; message: string; seriesLoopMode: LoopMode; seriesRepeatsRemaining: number }>(
      engineUrl,
      "/admin/series/loop",
      "POST",
      token,
      { mode }
    ),

  /**
   * Set countdown duration
   */
  setCountdownDuration: (engineUrl: string, token: string, seconds: number) =>
    engineFetch<{ success: boolean; message: string; countdownSeconds: number }>(
      engineUrl,
      "/admin/countdown/set",
      "POST",
      token,
      { seconds }
    ),
};
