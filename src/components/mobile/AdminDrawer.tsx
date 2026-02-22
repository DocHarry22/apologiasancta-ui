"use client";

/**
 * Admin Drawer Component
 * 
 * A mobile-friendly bottom drawer for quiz host controls.
 * Features locked/unlocked states, admin token input, and action buttons.
 * 
 * SECURITY NOTE: This is UX gating only, not real security.
 * Prevents accidental access by viewers who find the URL.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useAdminPanel } from "@/hooks/useAdminPanel";
import type { ConnectionStatus } from "@/types/quiz";
import type { AdminStatus } from "@/lib/engineAdmin";

interface AdminDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  engineUrl: string | null;
  connectionStatus: ConnectionStatus;
}

// Connection status config
const STATUS_CONFIG = {
  connected: { label: "LIVE", color: "text-green-500" },
  connecting: { label: "CONNECTING", color: "text-yellow-500" },
  reconnecting: { label: "RECONNECTING", color: "text-yellow-500" },
  disconnected: { label: "OFFLINE", color: "text-red-500" },
};

export function AdminDrawer({ isOpen, onClose, engineUrl, connectionStatus }: AdminDrawerProps) {
  const admin = useAdminPanel(engineUrl);
  const [unlockInput, setUnlockInput] = useState("");
  const [unlockError, setUnlockError] = useState(false);
  // Initialize from admin token if available
  const [tokenInput, setTokenInput] = useState(admin.adminToken);
  const [showTokenSaved, setShowTokenSaved] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close drawer when clicking backdrop
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Handle unlock attempt
  const handleUnlock = () => {
    const success = admin.unlock(unlockInput);
    if (success) {
      setUnlockError(false);
      setUnlockInput("");
    } else {
      setUnlockError(true);
    }
  };

  // Handle token save
  const handleSaveToken = () => {
    admin.setAdminToken(tokenInput);
    setShowTokenSaved(true);
    setTimeout(() => setShowTokenSaved(false), 2000);
  };

  // Handle admin action
  const handleAction = async (action: "start" | "pause" | "next" | "reset" | "status") => {
    await admin.executeAction(action);
  };

  // Truncate URL for display
  const truncatedUrl = engineUrl 
    ? engineUrl.length > 30 
      ? `${engineUrl.substring(0, 30)}...` 
      : engineUrl
    : "Not configured";

  const statusDisplay = STATUS_CONFIG[connectionStatus];

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity motion-reduce:transition-none ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={handleBackdropClick}
        aria-hidden={!isOpen}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`fixed bottom-0 left-0 right-0 max-h-[85vh] z-50 
          bg-(--card-bg) border-t border-(--border) rounded-t-2xl shadow-2xl
          transform transition-transform motion-reduce:transition-none duration-300 ease-out
          ${isOpen ? "translate-y-0" : "translate-y-full"}
          overflow-hidden`}
        role="dialog"
        aria-modal="true"
        aria-label="Admin Panel"
      >
        {/* Drag handle */}
        <div className="flex justify-center py-2">
          <div className="w-10 h-1 rounded-full bg-(--muted) opacity-50" />
        </div>

        {/* Content */}
        <div className="px-4 pb-6 overflow-y-auto max-h-[calc(85vh-40px)]">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-(--text)">Admin Panel</h2>
            <button
              onClick={onClose}
              className="p-1 text-(--muted) hover:text-(--text) transition-colors"
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {admin.isUnlocked ? (
            /* UNLOCKED VIEW */
            <div className="space-y-4">
              {/* Connection Status */}
              <div className="p-3 rounded-lg bg-(--bg) border border-(--border)">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-(--muted)">Connection</span>
                  <span className={`text-xs font-bold ${statusDisplay.color}`}>
                    {statusDisplay.label}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-(--muted) font-mono truncate flex-1 mr-2">
                    {truncatedUrl}
                  </span>
                  <button
                    onClick={() => admin.checkEngineHealth()}
                    disabled={admin.loading || !engineUrl}
                    className="text-[10px] px-2 py-1 rounded bg-(--accent) text-white disabled:opacity-50 transition-opacity"
                  >
                    {admin.loading ? "..." : "Test"}
                  </button>
                </div>
              </div>

              {/* Admin Token */}
              <div className="p-3 rounded-lg bg-(--bg) border border-(--border)">
                <label className="text-xs text-(--muted) block mb-2">Admin Token</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Enter admin token"
                    className="flex-1 text-xs px-3 py-2 rounded-lg bg-(--card-bg) border border-(--border)
                      text-(--text) placeholder:text-(--muted) focus:outline-none focus:border-(--accent)"
                  />
                  <button
                    onClick={handleSaveToken}
                    className="text-xs px-3 py-2 rounded-lg bg-(--accent) text-white hover:opacity-90 transition-opacity"
                  >
                    {showTokenSaved ? "✓" : "Save"}
                  </button>
                </div>
                {!admin.adminToken && (
                  <p className="text-[10px] text-yellow-500 mt-1">Token required for actions</p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-2">
                <ActionButton
                  label="Start"
                  onClick={() => handleAction("start")}
                  disabled={admin.loading || !admin.adminToken}
                  color="green"
                />
                <ActionButton
                  label="Pause"
                  onClick={() => handleAction("pause")}
                  disabled={admin.loading || !admin.adminToken}
                  color="yellow"
                />
                <ActionButton
                  label="Next"
                  onClick={() => handleAction("next")}
                  disabled={admin.loading || !admin.adminToken}
                  color="blue"
                />
                <ActionButton
                  label="Reset"
                  onClick={() => handleAction("reset")}
                  disabled={admin.loading || !admin.adminToken}
                  color="red"
                />
                <ActionButton
                  label="Status"
                  onClick={() => handleAction("status")}
                  disabled={admin.loading || !admin.adminToken}
                  color="purple"
                />
                <ActionButton
                  label="Lock"
                  onClick={() => admin.lock()}
                  disabled={admin.loading}
                  color="gray"
                />
              </div>

              {/* Result Display */}
              {admin.lastResult && (
                <ResultDisplay result={admin.lastResult} onClear={admin.clearResult} />
              )}

              {/* Engine URL Warning */}
              {!engineUrl && (
                <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30">
                  <p className="text-xs text-red-400">
                    ⚠ NEXT_PUBLIC_ENGINE_URL not set. Admin actions disabled.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* LOCKED VIEW */
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-(--muted)/20 flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-(--muted)">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <p className="text-xs text-(--muted)">Enter unlock code to access controls</p>
              </div>

              <div className="space-y-2">
                <input
                  type="password"
                  value={unlockInput}
                  onChange={(e) => {
                    setUnlockInput(e.target.value);
                    setUnlockError(false);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
                  placeholder="Unlock code"
                  className={`w-full text-sm px-4 py-3 rounded-lg bg-(--bg) border 
                    ${unlockError ? "border-red-500" : "border-(--border)"}
                    text-(--text) placeholder:text-(--muted) text-center
                    focus:outline-none focus:border-(--accent)`}
                  autoFocus={isOpen && !admin.isUnlocked}
                />
                {unlockError && (
                  <p className="text-xs text-red-500 text-center">Invalid code. Try again.</p>
                )}
              </div>

              <button
                onClick={handleUnlock}
                disabled={!unlockInput}
                className="w-full py-3 text-sm font-semibold rounded-lg
                  bg-(--accent) text-white disabled:opacity-50 transition-opacity"
              >
                Unlock
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// Action Button Component
interface ActionButtonProps {
  label: string;
  onClick: () => void;
  disabled: boolean;
  color: "green" | "yellow" | "blue" | "red" | "purple" | "gray";
}

function ActionButton({ label, onClick, disabled, color }: ActionButtonProps) {
  const colorClasses = {
    green: "bg-green-600 hover:bg-green-500",
    yellow: "bg-yellow-600 hover:bg-yellow-500",
    blue: "bg-blue-600 hover:bg-blue-500",
    red: "bg-red-600 hover:bg-red-500",
    purple: "bg-purple-600 hover:bg-purple-500",
    gray: "bg-gray-600 hover:bg-gray-500",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`py-2.5 text-xs font-semibold rounded-lg text-white
        ${colorClasses[color]} disabled:opacity-40 disabled:cursor-not-allowed
        transition-all motion-reduce:transition-none`}
    >
      {label}
    </button>
  );
}

// Result Display Component
interface ResultDisplayProps {
  result: {
    action: string;
    success: boolean;
    message: string;
    data?: unknown;
  };
  onClear: () => void;
}

function ResultDisplay({ result, onClear }: ResultDisplayProps) {
  const isStatus = result.action === "status" && result.success && !!result.data;
  const statusData = isStatus ? (result.data as AdminStatus) : undefined;

  return (
    <div
      className={`p-3 rounded-lg border ${
        result.success 
          ? "bg-green-500/10 border-green-500/30" 
          : "bg-red-500/10 border-red-500/30"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className={`text-xs font-semibold ${result.success ? "text-green-400" : "text-red-400"}`}>
            {result.success ? "✓" : "✗"} {result.message}
          </p>
          
          {/* Status data display */}
          {isStatus && statusData && (
            <pre className="mt-2 text-[10px] text-(--muted) font-mono bg-(--bg) p-2 rounded overflow-x-auto">
{`running: ${statusData.running}
phase: ${statusData.phase}
question: ${statusData.questionIndex + 1}/${statusData.totalQuestions}
clients: ${statusData.connectedClients}`}
            </pre>
          )}
        </div>
        <button
          onClick={onClear}
          className="text-(--muted) hover:text-(--text) p-1 transition-colors"
          aria-label="Clear"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
