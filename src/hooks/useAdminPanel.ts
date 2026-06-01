"use client";

/**
 * Admin Panel Hook
 *
 * Manages admin drawer state including:
 * - Session-based unlock (no admin token stored in browser)
 * - Auto-lock timer (30 min default)
 * - Admin action execution via the server-side proxy
 *
 * SECURITY: The hook verifies the author session via /api/auth/csrf.
 * No admin token is ever stored in or passed from the browser.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { adminProxy } from "@/lib/adminProxyClient";
import { checkHealth, type HealthResponse, type EngineResponse } from "@/lib/engineAdmin";

const UNLOCKED_KEY = "as_admin_unlocked";
const UNLOCKED_AT_KEY = "as_admin_unlocked_at";

// Auto-lock timeout in milliseconds (30 minutes)
const AUTO_LOCK_TIMEOUT_MS = 30 * 60 * 1000;

function safeStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors (private mode / blocked storage)
  }
}

function safeStorageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage errors (private mode / blocked storage)
  }
}

export interface AdminPanelState {
  isUnlocked: boolean;
  loading: boolean;
  validating: boolean;
  lastResult: {
    action: string;
    success: boolean;
    message: string;
    data?: unknown;
  } | null;
}

export interface AdminPanelActions {
  /**
   * Verify the author session with the server and unlock the panel if valid.
   */
  validateAndUnlock: () => Promise<{ success: boolean; error?: string }>;
  lock: () => void;
  executeAction: (action: "start" | "pause" | "next" | "reset" | "status", roomId?: string | null) => Promise<void>;
  checkEngineHealth: (engineUrl: string | null) => Promise<EngineResponse<HealthResponse>>;
  clearResult: () => void;
}

export function useAdminPanel(): AdminPanelState & AdminPanelActions {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [lastResult, setLastResult] = useState<AdminPanelState["lastResult"]>(null);

  const autoLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track if we've tried to restore session
  const sessionRestoredRef = useRef(false);

  const lock = useCallback(() => {
    setIsUnlocked(false);
    setLastResult(null);
    if (typeof window !== "undefined") {
      safeStorageRemove(UNLOCKED_KEY);
      safeStorageRemove(UNLOCKED_AT_KEY);
    }
    if (autoLockTimerRef.current) {
      clearTimeout(autoLockTimerRef.current);
      autoLockTimerRef.current = null;
    }
  }, []);

  /**
   * Restore unlock state from localStorage on mount.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionRestoredRef.current) return;
    sessionRestoredRef.current = true;

    const unlockedStr = safeStorageGet(UNLOCKED_KEY);
    const unlockedAtStr = safeStorageGet(UNLOCKED_AT_KEY);

    if (unlockedStr === "true" && unlockedAtStr) {
      const unlockedAt = parseInt(unlockedAtStr, 10);
      const elapsed = Date.now() - unlockedAt;

      if (elapsed < AUTO_LOCK_TIMEOUT_MS) {
        setIsUnlocked(true);
        const remaining = AUTO_LOCK_TIMEOUT_MS - elapsed;
        autoLockTimerRef.current = setTimeout(() => {
          lock();
        }, remaining);
      } else {
        safeStorageRemove(UNLOCKED_KEY);
        safeStorageRemove(UNLOCKED_AT_KEY);
      }
    }

    return () => {
      if (autoLockTimerRef.current) clearTimeout(autoLockTimerRef.current);
    };
  }, [lock]);

  /**
   * Verify session via server and unlock the panel.
   */
  const validateAndUnlock = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    setValidating(true);
    try {
      const res = await fetch("/api/auth/csrf", { method: "GET", credentials: "same-origin" });

      if (res.ok) {
        setIsUnlocked(true);
        if (typeof window !== "undefined") {
          safeStorageSet(UNLOCKED_KEY, "true");
          safeStorageSet(UNLOCKED_AT_KEY, Date.now().toString());
        }
        if (autoLockTimerRef.current) clearTimeout(autoLockTimerRef.current);
        autoLockTimerRef.current = setTimeout(() => {
          lock();
        }, AUTO_LOCK_TIMEOUT_MS);
        return { success: true };
      }

      if (res.status === 401) {
        return { success: false, error: "Not logged in. Please log in at /admin/login." };
      }

      return { success: false, error: `Unexpected server response: ${res.status}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Network error" };
    } finally {
      setValidating(false);
    }
  }, [lock]);

  /**
   * Execute an admin action via the server-side proxy.
   */
  const executeAction = useCallback(async (action: "start" | "pause" | "next" | "reset" | "status", roomId?: string | null) => {
    setLoading(true);
    setLastResult(null);

    try {
      const actionFn = adminProxy[action === "status" ? "status" : action] as (roomId?: string | null) => Promise<EngineResponse<unknown>>;
      const result = await actionFn(roomId);

      setLastResult({
        action,
        success: result.success,
        message: result.success
          ? `${action.charAt(0).toUpperCase() + action.slice(1)} successful`
          : (result.error ?? "Unknown error"),
        data: result.success ? result.data : undefined,
      });
    } catch (error) {
      setLastResult({
        action,
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Check engine health (no admin token required — /health is public).
   */
  const checkEngineHealth = useCallback(async (engineUrl: string | null): Promise<EngineResponse<HealthResponse>> => {
    if (!engineUrl) {
      return { success: false, error: "Engine URL not configured" };
    }

    setLoading(true);
    try {
      const result = await checkHealth(engineUrl);
      setLastResult({
        action: "health",
        success: result.success,
        message: result.success ? "Engine is healthy" : (result.error ?? "Health check failed"),
        data: result.data,
      });
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearResult = useCallback(() => {
    setLastResult(null);
  }, []);

  return {
    isUnlocked,
    loading,
    validating,
    lastResult,
    validateAndUnlock,
    lock,
    executeAction,
    checkEngineHealth,
    clearResult,
  };
}
