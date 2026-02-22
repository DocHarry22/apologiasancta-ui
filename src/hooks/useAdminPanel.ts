"use client";

/**
 * Admin Panel Hook
 * 
 * Manages admin drawer state including:
 * - Lock/unlock mechanism with localStorage
 * - Admin token storage
 * - Auto-lock timer (30 min default)
 * - Admin action execution
 * 
 * SECURITY NOTE: This is UX gating only, not real security.
 * The unlock code prevents accidental access by viewers.
 * The admin token provides actual authentication with the engine.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { adminActions, checkHealth, type HealthResponse, type EngineResponse } from "@/lib/engineAdmin";

// localStorage keys
const STORAGE_KEYS = {
  UNLOCK_CODE: "as_admin_unlock_code",
  UNLOCKED: "as_admin_unlocked",
  UNLOCKED_AT: "as_admin_unlocked_at",
  ADMIN_TOKEN: "as_admin_token",
} as const;

// Default unlock code (can be changed by host)
const DEFAULT_UNLOCK_CODE = "sancta";

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
  adminToken: string;
  unlockCode: string;
  loading: boolean;
  lastResult: {
    action: string;
    success: boolean;
    message: string;
    data?: unknown;
  } | null;
}

export interface AdminPanelActions {
  unlock: (code: string) => boolean;
  lock: () => void;
  setAdminToken: (token: string) => void;
  setUnlockCode: (code: string) => void;
  executeAction: (action: "start" | "pause" | "next" | "reset" | "status") => Promise<void>;
  checkEngineHealth: () => Promise<EngineResponse<HealthResponse>>;
  clearResult: () => void;
}

export function useAdminPanel(engineUrl: string | null): AdminPanelState & AdminPanelActions {
  // State
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [adminToken, setAdminTokenState] = useState("");
  const [unlockCode, setUnlockCodeState] = useState(DEFAULT_UNLOCK_CODE);
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<AdminPanelState["lastResult"]>(null);
  
  // Auto-lock timer ref
  const autoLockTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Initialize state from localStorage
   */
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Load unlock code
    const storedCode = safeStorageGet(STORAGE_KEYS.UNLOCK_CODE);
    if (storedCode) {
      setUnlockCodeState(storedCode);
    }

    // Load admin token
    const storedToken = safeStorageGet(STORAGE_KEYS.ADMIN_TOKEN);
    if (storedToken) {
      setAdminTokenState(storedToken);
    }

    // Check if already unlocked (with expiry check)
    const unlockedStr = safeStorageGet(STORAGE_KEYS.UNLOCKED);
    const unlockedAtStr = safeStorageGet(STORAGE_KEYS.UNLOCKED_AT);
    
    if (unlockedStr === "true" && unlockedAtStr) {
      const unlockedAt = parseInt(unlockedAtStr, 10);
      const elapsed = Date.now() - unlockedAt;
      
      if (elapsed < AUTO_LOCK_TIMEOUT_MS) {
        setIsUnlocked(true);
        // Set remaining auto-lock timer
        const remaining = AUTO_LOCK_TIMEOUT_MS - elapsed;
        autoLockTimerRef.current = setTimeout(() => {
          // Inline lock logic to avoid dependency issues
          setIsUnlocked(false);
          setLastResult(null);
          safeStorageRemove(STORAGE_KEYS.UNLOCKED);
          safeStorageRemove(STORAGE_KEYS.UNLOCKED_AT);
        }, remaining);
      } else {
        // Expired, clear localStorage
        safeStorageRemove(STORAGE_KEYS.UNLOCKED);
        safeStorageRemove(STORAGE_KEYS.UNLOCKED_AT);
      }
    }

    return () => {
      if (autoLockTimerRef.current) {
        clearTimeout(autoLockTimerRef.current);
      }
    };
  }, []);

  /**
   * Lock the admin panel
   */
  const lock = useCallback(() => {
    setIsUnlocked(false);
    setLastResult(null);
    if (typeof window !== "undefined") {
      safeStorageRemove(STORAGE_KEYS.UNLOCKED);
      safeStorageRemove(STORAGE_KEYS.UNLOCKED_AT);
    }
    if (autoLockTimerRef.current) {
      clearTimeout(autoLockTimerRef.current);
      autoLockTimerRef.current = null;
    }
  }, []);

  /**
   * Attempt to unlock with code
   */
  const unlock = useCallback((code: string): boolean => {
    // Get current unlock code from localStorage or use default
    const currentCode = typeof window !== "undefined" 
      ? safeStorageGet(STORAGE_KEYS.UNLOCK_CODE) || DEFAULT_UNLOCK_CODE
      : DEFAULT_UNLOCK_CODE;

    if (code.toLowerCase() === currentCode.toLowerCase()) {
      setIsUnlocked(true);
      if (typeof window !== "undefined") {
        safeStorageSet(STORAGE_KEYS.UNLOCKED, "true");
        safeStorageSet(STORAGE_KEYS.UNLOCKED_AT, Date.now().toString());
      }
      
      // Start auto-lock timer
      if (autoLockTimerRef.current) {
        clearTimeout(autoLockTimerRef.current);
      }
      autoLockTimerRef.current = setTimeout(() => {
        lock();
      }, AUTO_LOCK_TIMEOUT_MS);
      
      return true;
    }
    return false;
  }, [lock]);

  /**
   * Save admin token to localStorage
   */
  const setAdminToken = useCallback((token: string) => {
    setAdminTokenState(token);
    if (typeof window !== "undefined") {
      safeStorageSet(STORAGE_KEYS.ADMIN_TOKEN, token);
    }
  }, []);

  /**
   * Update unlock code (host can change it)
   */
  const setUnlockCode = useCallback((code: string) => {
    setUnlockCodeState(code);
    if (typeof window !== "undefined") {
      safeStorageSet(STORAGE_KEYS.UNLOCK_CODE, code);
    }
  }, []);

  /**
   * Execute an admin action
   */
  const executeAction = useCallback(async (action: "start" | "pause" | "next" | "reset" | "status") => {
    if (!engineUrl) {
      setLastResult({
        action,
        success: false,
        message: "Engine URL not configured",
      });
      return;
    }

    if (!adminToken) {
      setLastResult({
        action,
        success: false,
        message: "Admin token not set",
      });
      return;
    }

    setLoading(true);
    setLastResult(null);

    try {
      const actionFn = adminActions[action];
      const result = await actionFn(engineUrl, adminToken);

      if (result.success) {
        setLastResult({
          action,
          success: true,
          message: `${action.charAt(0).toUpperCase() + action.slice(1)} successful`,
          data: result.data,
        });
      } else {
        setLastResult({
          action,
          success: false,
          message: result.error || "Unknown error",
        });
      }
    } catch (error) {
      setLastResult({
        action,
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }, [engineUrl, adminToken]);

  /**
   * Check engine health (no token required)
   */
  const checkEngineHealth = useCallback(async (): Promise<EngineResponse<HealthResponse>> => {
    if (!engineUrl) {
      return {
        success: false,
        error: "Engine URL not configured",
      };
    }

    setLoading(true);
    try {
      const result = await checkHealth(engineUrl);
      setLastResult({
        action: "health",
        success: result.success,
        message: result.success ? "Engine is healthy" : (result.error || "Health check failed"),
        data: result.data,
      });
      return result;
    } finally {
      setLoading(false);
    }
  }, [engineUrl]);

  /**
   * Clear last result
   */
  const clearResult = useCallback(() => {
    setLastResult(null);
  }, []);

  return {
    // State
    isUnlocked,
    adminToken,
    unlockCode,
    loading,
    lastResult,
    // Actions
    unlock,
    lock,
    setAdminToken,
    setUnlockCode,
    executeAction,
    checkEngineHealth,
    clearResult,
  };
}
