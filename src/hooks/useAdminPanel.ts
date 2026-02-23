"use client";

/**
 * Admin Panel Hook
 * 
 * Manages admin drawer state including:
 * - Lock/unlock mechanism with server-side token validation
 * - Admin token storage
 * - Auto-lock timer (30 min default)
 * - Admin action execution
 * 
 * SECURITY: Token is validated against the engine's /admin/status endpoint.
 * Controls are only shown after successful server-side validation.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { adminActions, checkHealth, type HealthResponse, type EngineResponse } from "@/lib/engineAdmin";

// localStorage keys
const STORAGE_KEYS = {
  UNLOCKED: "as_admin_unlocked",
  UNLOCKED_AT: "as_admin_unlocked_at",
  ADMIN_TOKEN: "as_admin_token",
  TOKEN_VALIDATED: "as_admin_token_validated",
} as const;

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
  validateAndUnlock: (token: string) => Promise<{ success: boolean; error?: string }>;
  lock: () => void;
  setAdminToken: (token: string) => void;
  executeAction: (action: "start" | "pause" | "next" | "reset" | "status") => Promise<void>;
  checkEngineHealth: () => Promise<EngineResponse<HealthResponse>>;
  clearResult: () => void;
}

export function useAdminPanel(engineUrl: string | null): AdminPanelState & AdminPanelActions {
  // State
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [adminToken, setAdminTokenState] = useState("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [lastResult, setLastResult] = useState<AdminPanelState["lastResult"]>(null);
  
  // Auto-lock timer ref
  const autoLockTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Track if we've tried to restore session
  const sessionRestoredRef = useRef(false);

  /**
   * Initialize state from localStorage
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionRestoredRef.current) return;
    sessionRestoredRef.current = true;

    // Load admin token
    const storedToken = safeStorageGet(STORAGE_KEYS.ADMIN_TOKEN);
    if (storedToken) {
      setAdminTokenState(storedToken);
    }

    // Check if was previously validated (with expiry check)
    // Note: We still need to re-validate on next action, but we restore UI state
    const unlockedStr = safeStorageGet(STORAGE_KEYS.UNLOCKED);
    const unlockedAtStr = safeStorageGet(STORAGE_KEYS.UNLOCKED_AT);
    const tokenValidated = safeStorageGet(STORAGE_KEYS.TOKEN_VALIDATED);
    
    if (unlockedStr === "true" && unlockedAtStr && tokenValidated === storedToken && storedToken) {
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
          safeStorageRemove(STORAGE_KEYS.TOKEN_VALIDATED);
        }, remaining);
      } else {
        // Expired, clear localStorage
        safeStorageRemove(STORAGE_KEYS.UNLOCKED);
        safeStorageRemove(STORAGE_KEYS.UNLOCKED_AT);
        safeStorageRemove(STORAGE_KEYS.TOKEN_VALIDATED);
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
      safeStorageRemove(STORAGE_KEYS.TOKEN_VALIDATED);
      safeStorageRemove(STORAGE_KEYS.UNLOCKED_AT);
    }
    if (autoLockTimerRef.current) {
      clearTimeout(autoLockTimerRef.current);
      autoLockTimerRef.current = null;
    }
  }, []);

  /**
   * Validate admin token against the server and unlock if valid
   */
  const validateAndUnlock = useCallback(async (token: string): Promise<{ success: boolean; error?: string }> => {
    if (!engineUrl) {
      return { success: false, error: "Engine URL not configured" };
    }

    if (!token.trim()) {
      return { success: false, error: "Token cannot be empty" };
    }

    setValidating(true);
    
    try {
      // Validate token by calling /admin/status endpoint
      const result = await adminActions.status(engineUrl, token);
      
      if (result.success) {
        // Token is valid - unlock the panel
        setAdminTokenState(token);
        setIsUnlocked(true);
        
        if (typeof window !== "undefined") {
          safeStorageSet(STORAGE_KEYS.ADMIN_TOKEN, token);
          safeStorageSet(STORAGE_KEYS.UNLOCKED, "true");
          safeStorageSet(STORAGE_KEYS.UNLOCKED_AT, Date.now().toString());
          safeStorageSet(STORAGE_KEYS.TOKEN_VALIDATED, token);
        }
        
        // Start auto-lock timer
        if (autoLockTimerRef.current) {
          clearTimeout(autoLockTimerRef.current);
        }
        autoLockTimerRef.current = setTimeout(() => {
          lock();
        }, AUTO_LOCK_TIMEOUT_MS);
        
        return { success: true };
      } else {
        // Token is invalid
        return { success: false, error: result.error || "Invalid admin token" };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to validate token" 
      };
    } finally {
      setValidating(false);
    }
  }, [engineUrl, lock]);

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
    loading,
    validating,
    lastResult,
    // Actions
    validateAndUnlock,
    lock,
    setAdminToken,
    executeAction,
    checkEngineHealth,
    clearResult,
  };
}
