"use client";

/**
 * Admin Drawer Component
 * 
 * A mobile-friendly bottom drawer for quiz host controls.
 * Features locked/unlocked states with server-side token validation.
 * 
 * SECURITY: Token is validated against the engine's /admin/status endpoint.
 * Controls are only shown after successful server-side validation.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useAdminPanel } from "@/hooks/useAdminPanel";
import { quizActions, topicActions, type LoopMode } from "@/lib/engineAdmin";
import type { ConnectionStatus } from "@/types/quiz";
import type { AdminStatus, TopicInfo } from "@/lib/engineAdmin";

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
  const [tokenInput, setTokenInput] = useState("");
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [availableTopics, setAvailableTopics] = useState<TopicInfo[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [topicLoading, setTopicLoading] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(10);
  // Loop control state
  const [topicLoopMode, setTopicLoopMode] = useState<LoopMode>("off");
  const [seriesLoopMode, setSeriesLoopMode] = useState<LoopMode>("off");
  const [loopLoading, setLoopLoading] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Fetch available topics when drawer opens and admin is authenticated
  useEffect(() => {
    const fetchTopics = async () => {
      if (!isOpen || !engineUrl || !admin.adminToken || !admin.isUnlocked) return;
      
      const result = await topicActions.getSequence(engineUrl, admin.adminToken);
      if (result.success && result.data) {
        setAvailableTopics(result.data.availableTopicsWithTitles);
      }
    };
    
    fetchTopics();
  }, [isOpen, engineUrl, admin.adminToken, admin.isUnlocked]);

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

  // Handle token validation and unlock
  const handleValidateToken = async () => {
    if (!tokenInput.trim()) {
      setTokenError("Please enter an admin token");
      return;
    }
    
    setTokenError(null);
    const result = await admin.validateAndUnlock(tokenInput);
    
    if (!result.success) {
      setTokenError(result.error || "Invalid token");
    }
  };

  // Handle admin action
  const handleAction = async (action: "start" | "pause" | "next" | "reset" | "status") => {
    await admin.executeAction(action);
  };

  // Handle shuffle (reshuffle current question pool)
  const handleShuffle = async () => {
    if (!engineUrl || !admin.adminToken) return;
    
    // Call setPool with empty topicIds (uses all) and shuffle=true
    const result = await quizActions.setPool(engineUrl, admin.adminToken, [], true);
    
    if (result.success && result.data) {
      admin.clearResult();
      // Show success message - we'll reuse lastResult mechanism if needed or show inline
    }
  };

  // Handle starting a specific topic
  const handleStartTopic = async () => {
    if (!engineUrl || !admin.adminToken || !selectedTopicId) return;
    
    setTopicLoading(true);
    const result = await topicActions.startTopic(engineUrl, admin.adminToken, selectedTopicId);
    setTopicLoading(false);
    
    if (result.success && result.data) {
      admin.clearResult();
      // Could update lastResult to show success
    }
  };

  // Handle starting next topic in sequence
  const handleStartNextTopic = async () => {
    if (!engineUrl || !admin.adminToken) return;
    
    setTopicLoading(true);
    const result = await topicActions.startNextTopic(engineUrl, admin.adminToken);
    setTopicLoading(false);
    
    if (result.success && result.data) {
      admin.clearResult();
    }
  };

  // Handle cancelling auto-advance
  const handleCancelAutoAdvance = async () => {
    if (!engineUrl || !admin.adminToken) return;
    
    const result = await topicActions.cancelAutoAdvance(engineUrl, admin.adminToken);
    if (result.success) {
      admin.clearResult();
    }
  };

  // Handle skipping current topic
  const handleSkipTopic = async () => {
    if (!engineUrl || !admin.adminToken) return;
    
    setTopicLoading(true);
    const result = await topicActions.skipTopic(engineUrl, admin.adminToken);
    setTopicLoading(false);
    
    if (result.success && result.data) {
      admin.clearResult();
    }
  };

  // Handle replaying current topic
  const handleReplayTopic = async () => {
    if (!engineUrl || !admin.adminToken) return;
    
    setTopicLoading(true);
    const result = await topicActions.replayTopic(engineUrl, admin.adminToken);
    setTopicLoading(false);
    
    if (result.success && result.data) {
      admin.clearResult();
    }
  };

  // Handle countdown before topic start
  const handleCountdownTopic = async () => {
    if (!engineUrl || !admin.adminToken) return;
    
    setTopicLoading(true);
    const result = await topicActions.countdownTopic(
      engineUrl, 
      admin.adminToken, 
      countdownSeconds,
      selectedTopicId || undefined
    );
    setTopicLoading(false);
    
    if (result.success) {
      admin.clearResult();
    }
  };
  
  // Handle setting topic loop mode
  const handleSetTopicLoop = async (mode: LoopMode) => {
    if (!engineUrl || !admin.adminToken) return;
    
    setLoopLoading(true);
    const result = await topicActions.setTopicLoop(engineUrl, admin.adminToken, mode);
    setLoopLoading(false);
    
    if (result.success && result.data) {
      setTopicLoopMode(result.data.topicLoopMode);
      admin.clearResult();
    }
  };
  
  // Handle setting series loop mode
  const handleSetSeriesLoop = async (mode: LoopMode) => {
    if (!engineUrl || !admin.adminToken) return;
    
    setLoopLoading(true);
    const result = await topicActions.setSeriesLoop(engineUrl, admin.adminToken, mode);
    setLoopLoading(false);
    
    if (result.success && result.data) {
      setSeriesLoopMode(result.data.seriesLoopMode);
      admin.clearResult();
    }
  };
  
  // Handle setting countdown duration
  const handleSetCountdownDuration = async () => {
    if (!engineUrl || !admin.adminToken) return;
    
    setLoopLoading(true);
    const result = await topicActions.setCountdownDuration(engineUrl, admin.adminToken, countdownSeconds);
    setLoopLoading(false);
    
    if (result.success && result.data) {
      setCountdownSeconds(result.data.countdownSeconds);
      admin.clearResult();
    }
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
          bg-(--card) border-t border-(--border) rounded-t-2xl shadow-2xl
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
            <h2 className="text-sm font-bold text-foreground">Admin Panel</h2>
            <button
              onClick={onClose}
              className="p-1 text-(--muted) hover:text-foreground transition-colors"
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
              <div className="p-3 rounded-lg bg-background border border-(--border)">
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
                  label="Shuffle"
                  onClick={handleShuffle}
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

              {/* Topic Management Section */}
              <div className="p-3 rounded-lg bg-background border border-(--border)">
                <label className="text-xs text-(--muted) block mb-2">Topic Management</label>
                
                {/* Start specific topic */}
                <div className="flex gap-2 mb-2">
                  <select
                    value={selectedTopicId}
                    onChange={(e) => setSelectedTopicId(e.target.value)}
                    className="flex-1 text-xs px-3 py-2 rounded-lg bg-(--card) border border-(--border)
                      text-foreground focus:outline-none focus:border-(--accent)"
                    style={{
                      backgroundColor: "var(--card)",
                      color: "var(--foreground)",
                    }}
                  >
                    <option value="" style={{ backgroundColor: "var(--card)", color: "var(--foreground)" }}>
                      Select topic...
                    </option>
                    {availableTopics.map((topic) => (
                      <option 
                        key={topic.id} 
                        value={topic.id}
                        style={{ backgroundColor: "var(--card)", color: "var(--foreground)" }}
                      >
                        {topic.title}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleStartTopic}
                    disabled={topicLoading || !admin.adminToken || !selectedTopicId}
                    className="text-xs px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-500 
                      disabled:opacity-40 transition-all"
                  >
                    {topicLoading ? "..." : "Start"}
                  </button>
                </div>
                
                {/* Quick actions */}
                <div className="flex gap-2">
                  <button
                    onClick={handleStartNextTopic}
                    disabled={topicLoading || !admin.adminToken}
                    className="flex-1 text-xs py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 
                      disabled:opacity-40 transition-all"
                  >
                    Next Topic
                  </button>
                  <button
                    onClick={handleCancelAutoAdvance}
                    disabled={topicLoading || !admin.adminToken}
                    className="flex-1 text-xs py-2 rounded-lg bg-yellow-600 text-white hover:bg-yellow-500 
                      disabled:opacity-40 transition-all"
                  >
                    Cancel Auto
                  </button>
                </div>
                
                {/* Additional topic actions */}
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleSkipTopic}
                    disabled={topicLoading || !admin.adminToken}
                    className="flex-1 text-xs py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-500 
                      disabled:opacity-40 transition-all"
                    title="Skip current topic and start next"
                  >
                    Skip Topic
                  </button>
                  <button
                    onClick={handleReplayTopic}
                    disabled={topicLoading || !admin.adminToken}
                    className="flex-1 text-xs py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-500 
                      disabled:opacity-40 transition-all"
                    title="Restart current topic from beginning"
                  >
                    Replay Topic
                  </button>
                </div>
                
                {/* Countdown before topic */}
                <div className="flex gap-2 mt-2 items-center">
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={countdownSeconds}
                    onChange={(e) => setCountdownSeconds(Math.max(1, Math.min(60, parseInt(e.target.value) || 10)))}
                    className="w-16 text-xs px-2 py-2 rounded-lg bg-(--card) border border-(--border)
                      text-foreground text-center focus:outline-none focus:border-(--accent)"
                  />
                  <button
                    onClick={handleCountdownTopic}
                    disabled={topicLoading || !admin.adminToken}
                    className="flex-1 text-xs py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 
                      disabled:opacity-40 transition-all"
                    title="Start countdown before beginning topic"
                  >
                    Countdown ({countdownSeconds}s)
                  </button>
                </div>
              </div>
              
              {/* Loop Controls Section */}
              <div className="p-3 rounded-lg bg-background border border-(--border)">
                <label className="text-xs text-(--muted) block mb-2">Repeat / Loop</label>
                
                {/* Topic Loop Controls */}
                <div className="mb-2">
                  <span className="text-[10px] text-(--muted) block mb-1">Topic Loop: <span className="text-(--accent) font-medium">{topicLoopMode}</span></span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleSetTopicLoop("off")}
                      disabled={loopLoading || !admin.adminToken}
                      className={`flex-1 text-[10px] py-1.5 rounded-lg transition-all disabled:opacity-40
                        ${topicLoopMode === "off" ? "bg-(--accent) text-white" : "bg-(--card) border border-(--border) text-(--muted) hover:border-(--accent)"}`}
                    >
                      Off
                    </button>
                    <button
                      onClick={() => handleSetTopicLoop("once")}
                      disabled={loopLoading || !admin.adminToken}
                      className={`flex-1 text-[10px] py-1.5 rounded-lg transition-all disabled:opacity-40
                        ${topicLoopMode === "once" ? "bg-purple-600 text-white" : "bg-(--card) border border-(--border) text-(--muted) hover:border-purple-500"}`}
                    >
                      Once
                    </button>
                    <button
                      onClick={() => handleSetTopicLoop("infinite")}
                      disabled={loopLoading || !admin.adminToken}
                      className={`flex-1 text-[10px] py-1.5 rounded-lg transition-all disabled:opacity-40
                        ${topicLoopMode === "infinite" ? "bg-orange-600 text-white" : "bg-(--card) border border-(--border) text-(--muted) hover:border-orange-500"}`}
                    >
                      Loop ∞
                    </button>
                  </div>
                </div>
                
                {/* Series Loop Controls */}
                <div>
                  <span className="text-[10px] text-(--muted) block mb-1">Series Loop: <span className="text-(--accent) font-medium">{seriesLoopMode}</span></span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleSetSeriesLoop("off")}
                      disabled={loopLoading || !admin.adminToken}
                      className={`flex-1 text-[10px] py-1.5 rounded-lg transition-all disabled:opacity-40
                        ${seriesLoopMode === "off" ? "bg-(--accent) text-white" : "bg-(--card) border border-(--border) text-(--muted) hover:border-(--accent)"}`}
                    >
                      Off
                    </button>
                    <button
                      onClick={() => handleSetSeriesLoop("once")}
                      disabled={loopLoading || !admin.adminToken}
                      className={`flex-1 text-[10px] py-1.5 rounded-lg transition-all disabled:opacity-40
                        ${seriesLoopMode === "once" ? "bg-purple-600 text-white" : "bg-(--card) border border-(--border) text-(--muted) hover:border-purple-500"}`}
                    >
                      Once
                    </button>
                    <button
                      onClick={() => handleSetSeriesLoop("infinite")}
                      disabled={loopLoading || !admin.adminToken}
                      className={`flex-1 text-[10px] py-1.5 rounded-lg transition-all disabled:opacity-40
                        ${seriesLoopMode === "infinite" ? "bg-orange-600 text-white" : "bg-(--card) border border-(--border) text-(--muted) hover:border-orange-500"}`}
                    >
                      Loop ∞
                    </button>
                  </div>
                </div>
                
                {/* Countdown duration setting */}
                <div className="flex gap-2 mt-2 items-center">
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={countdownSeconds}
                    onChange={(e) => setCountdownSeconds(Math.max(1, Math.min(60, parseInt(e.target.value) || 10)))}
                    className="w-16 text-xs px-2 py-1.5 rounded-lg bg-(--card) border border-(--border)
                      text-foreground text-center focus:outline-none focus:border-(--accent)"
                  />
                  <button
                    onClick={handleSetCountdownDuration}
                    disabled={loopLoading || !admin.adminToken}
                    className="flex-1 text-[10px] py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-500 
                      disabled:opacity-40 transition-all"
                    title="Set default countdown duration between topics"
                  >
                    Set Duration
                  </button>
                </div>
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
            /* LOCKED VIEW - Token validation required */
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-(--muted)/20 flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-(--muted)">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <p className="text-xs text-(--muted)">Enter admin token to access controls</p>
                <p className="text-[10px] text-(--muted) mt-1">Token is validated against the server</p>
              </div>

              <div className="space-y-2">
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => {
                    setTokenInput(e.target.value);
                    setTokenError(null);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleValidateToken()}
                  placeholder="Admin token"
                  className={`w-full text-sm px-4 py-3 rounded-lg bg-background border 
                    ${tokenError ? "border-red-500" : "border-(--border)"}
                    text-foreground placeholder:text-(--muted) text-center
                    focus:outline-none focus:border-(--accent)`}
                  autoFocus={isOpen && !admin.isUnlocked}
                  disabled={admin.validating}
                />
                {tokenError && (
                  <p className="text-xs text-red-500 text-center">{tokenError}</p>
                )}
                {!engineUrl && (
                  <p className="text-xs text-yellow-500 text-center">Engine URL not configured</p>
                )}
              </div>

              <button
                onClick={handleValidateToken}
                disabled={!tokenInput || admin.validating || !engineUrl}
                className="w-full py-3 text-sm font-semibold rounded-lg
                  bg-(--accent) text-white disabled:opacity-50 transition-opacity
                  flex items-center justify-center gap-2"
              >
                {admin.validating ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Validating...
                  </>
                ) : (
                  "Unlock"
                )}
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
            <pre className="mt-2 text-[10px] text-(--muted) font-mono bg-background p-2 rounded overflow-x-auto">
{`running: ${statusData.running}
phase: ${statusData.phase}
question: ${statusData.questionIndex + 1}/${statusData.totalQuestions}
clients: ${statusData.connectedClients}`}
            </pre>
          )}
        </div>
        <button
          onClick={onClear}
          className="text-(--muted) hover:text-foreground p-1 transition-colors"
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
