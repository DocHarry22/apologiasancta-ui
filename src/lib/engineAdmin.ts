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
