"use client";

/**
 * Admin Drawer Component
 *
 * A mobile-friendly bottom drawer for quiz host controls.
 * Unlock is session-based: the user must be logged in as an admin at /admin/login.
 * No admin token is ever stored in or sent from the browser.
 *
 * SECURITY: All admin mutations go through /api/admin/* (server-side proxy).
 * The browser never holds the engine admin token.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useAdminPanel } from "@/hooks/useAdminPanel";
import { adminProxy, roomProxy, quizProxy, topicProxy, type LoopMode } from "@/lib/adminProxyClient";
import type { ConnectionStatus, RoomSummary } from "@/types/quiz";
import type { AdminRoomStatus, AdminStatus, HealthResponse, TopicInfo } from "@/lib/engineAdmin";

interface AdminDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  engineUrl: string | null;
  connectionStatus: ConnectionStatus;
  roomId?: string | null;
  roomName?: string | null;
  onRoomSelected?: (room: RoomSummary) => void;
}

// Connection status config
const STATUS_CONFIG = {
  connected: { label: "LIVE", color: "text-green-500" },
  connecting: { label: "CONNECTING", color: "text-yellow-500" },
  reconnecting: { label: "RECONNECTING", color: "text-yellow-500" },
  polling: { label: "POLLING", color: "text-blue-500" },
  disconnected: { label: "OFFLINE", color: "text-red-500" },
};

export function AdminDrawer({ isOpen, onClose, engineUrl, connectionStatus, roomId = null, roomName = null, onRoomSelected }: AdminDrawerProps) {
  const admin = useAdminPanel();
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [availableTopics, setAvailableTopics] = useState<TopicInfo[]>([]);
  const [availableRooms, setAvailableRooms] = useState<AdminRoomStatus[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomId, setNewRoomId] = useState("");
  const [topicLoading, setTopicLoading] = useState(false);
  const [roomLoading, setRoomLoading] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(10);
  const [roomNotice, setRoomNotice] = useState<string | null>(null);
  // Loop control state
  const [topicLoopMode, setTopicLoopMode] = useState<LoopMode>("off");
  const [seriesLoopMode, setSeriesLoopMode] = useState<LoopMode>("off");
  const [loopLoading, setLoopLoading] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  const refreshRoomScopedData = useCallback(async () => {
    if (!isOpen || !admin.isUnlocked) return;

    const [topicsResult, roomsResult] = await Promise.all([
      topicProxy.getSequence(roomId),
      roomProxy.list(),
    ]);

    if (topicsResult.success && topicsResult.data) {
      setAvailableTopics(topicsResult.data.availableTopicsWithTitles);
      setCountdownSeconds(topicsResult.data.config.countdownSeconds);
      setTopicLoopMode(topicsResult.data.config.topicLoopMode);
      setSeriesLoopMode(topicsResult.data.config.seriesLoopMode);
    }

    if (roomsResult.success && roomsResult.data) {
      setAvailableRooms(roomsResult.data.rooms);
    }
  }, [isOpen, admin.isUnlocked, roomId]);

  useEffect(() => {
    void refreshRoomScopedData();
  }, [refreshRoomScopedData]);

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

  // Handle session-based unlock
  const handleValidateToken = async () => {
    setTokenError(null);
    const result = await admin.validateAndUnlock();
    
    if (!result.success) {
      setTokenError(result.error || "Session check failed");
    }
  };

  // Handle admin action
  const handleAction = async (action: "start" | "pause" | "next" | "reset" | "status") => {
    await admin.executeAction(action, roomId);
  };

  // Handle shuffle (reshuffle current question pool)
  const handleShuffle = async () => {
    if (roomId && roomId !== "global") {
      setRoomNotice("Pool shuffle currently targets the default room only.");
      return;
    }
    
    const result = await quizProxy.setPool([], true);
    
    if (result.success && result.data) {
      admin.clearResult();
    }
  };

  // Handle starting a specific topic
  const handleStartTopic = async () => {
    if (!selectedTopicId) return;
    
    setTopicLoading(true);
    const result = await topicProxy.startTopic(selectedTopicId, roomId);
    setTopicLoading(false);
    
    if (result.success && result.data) {
      admin.clearResult();
    }
  };

  // Handle starting next topic in sequence
  const handleStartNextTopic = async () => {
    setTopicLoading(true);
    const result = await topicProxy.startNextTopic(undefined, roomId);
    setTopicLoading(false);
    
    if (result.success && result.data) {
      admin.clearResult();
    }
  };

  // Handle cancelling auto-advance
  const handleCancelAutoAdvance = async () => {
    const result = await topicProxy.cancelAutoAdvance(roomId);
    if (result.success) {
      admin.clearResult();
    }
  };

  // Handle skipping current topic
  const handleSkipTopic = async () => {
    setTopicLoading(true);
    const result = await topicProxy.skipTopic(roomId);
    setTopicLoading(false);
    
    if (result.success && result.data) {
      admin.clearResult();
    }
  };

  // Handle replaying current topic
  const handleReplayTopic = async () => {
    setTopicLoading(true);
    const result = await topicProxy.replayTopic(roomId);
    setTopicLoading(false);
    
    if (result.success && result.data) {
      admin.clearResult();
    }
  };

  // Handle countdown before topic start
  const handleCountdownTopic = async () => {
    setTopicLoading(true);
    const result = await topicProxy.countdownTopic(
      countdownSeconds,
      selectedTopicId || undefined,
      roomId
    );
    setTopicLoading(false);
    
    if (result.success) {
      admin.clearResult();
    }
  };
  
  // Handle setting topic loop mode
  const handleSetTopicLoop = async (mode: LoopMode) => {
    setLoopLoading(true);
    const result = await topicProxy.setTopicLoop(mode, roomId);
    setLoopLoading(false);
    
    if (result.success && result.data) {
      setTopicLoopMode(result.data.topicLoopMode);
      admin.clearResult();
    }
  };
  
  // Handle setting series loop mode
  const handleSetSeriesLoop = async (mode: LoopMode) => {
    setLoopLoading(true);
    const result = await topicProxy.setSeriesLoop(mode, roomId);
    setLoopLoading(false);
    
    if (result.success && result.data) {
      setSeriesLoopMode(result.data.seriesLoopMode);
      admin.clearResult();
    }
  };
  
  // Handle setting countdown duration
  const handleSetCountdownDuration = async () => {
    setLoopLoading(true);
    const result = await topicProxy.setCountdownDuration(countdownSeconds, roomId);
    setLoopLoading(false);
    
    if (result.success && result.data) {
      setCountdownSeconds(result.data.countdownSeconds);
      admin.clearResult();
    }
  };

  const handleSelectRoom = useCallback((room: AdminRoomStatus) => {
    onRoomSelected?.({
      roomId: room.roomId,
      name: room.name,
      isActive: room.isActive,
      playerCount: room.playerCount,
    });
    setRoomNotice(`Selected room: ${room.name}`);
  }, [onRoomSelected]);

  const handleCreateRoom = async () => {
    const trimmedName = newRoomName.trim();
    const trimmedRoomId = newRoomId.trim().toLowerCase();
    if (!trimmedName) {
      setRoomNotice("Room name is required.");
      return;
    }

    setRoomLoading(true);
    const result = await roomProxy.create(trimmedName, trimmedRoomId || undefined);
    setRoomLoading(false);

    if (result.success && result.data) {
      setNewRoomName("");
      setNewRoomId("");
      setRoomNotice(`Created room: ${result.data.room.name}`);
      await refreshRoomScopedData();
      handleSelectRoom({
        roomId: result.data.room.roomId,
        name: result.data.room.name,
        isActive: result.data.room.isActive,
        playerCount: result.data.room.playerCount,
        connectedClients: 0,
        gameplayPlayerCount: 0,
      });
    } else {
      setRoomNotice(result.error || "Failed to create room.");
    }
  };

  const handleCloseRoom = async (targetRoomId: string) => {
    if (targetRoomId === "global") return;

    setRoomLoading(true);
    const result = await roomProxy.close(targetRoomId);
    setRoomLoading(false);

    if (result.success && result.data) {
      setRoomNotice(`Closed room: ${result.data.room.name}`);
      await refreshRoomScopedData();
    } else {
      setRoomNotice(result.error || "Failed to close room.");
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
                    onClick={() => admin.checkEngineHealth(engineUrl)}
                    disabled={admin.loading || !engineUrl}
                    className="text-[10px] px-2 py-1 rounded bg-(--accent) text-white disabled:opacity-50 transition-opacity"
                  >
                    {admin.loading ? "..." : "Test"}
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-background border border-(--border)">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-(--muted)">Active Room</p>
                    <p className="text-sm font-semibold text-foreground">{roomName || roomId || "No room selected"}</p>
                    {roomId ? <p className="text-[10px] font-mono text-(--muted)">{roomId}</p> : null}
                  </div>
                  <button
                    onClick={() => void refreshRoomScopedData()}
                    disabled={roomLoading }
                    className="rounded-lg border border-(--border) px-2 py-1 text-[10px] font-semibold text-(--accent) disabled:opacity-50"
                  >
                    Refresh Rooms
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-(--border) p-1">
                    {availableRooms.map((room) => {
                      const selected = room.roomId === roomId;
                      return (
                        <div key={room.roomId} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSelectRoom(room)}
                            className={`flex-1 rounded-lg px-2 py-2 text-left text-[11px] transition-colors ${selected ? "bg-(--accent)/15 text-foreground" : "bg-(--card) text-(--text-secondary) hover:text-foreground"}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate font-semibold">{room.name}</span>
                              <span className="text-[9px] font-mono uppercase">{room.isActive ? "open" : "closed"}</span>
                            </div>
                            <div className="mt-1 text-[9px] text-(--muted)">
                              {room.roomId} • p:{room.playerCount} • l:{room.connectedClients}
                            </div>
                          </button>
                          {room.roomId !== "global" ? (
                            <button
                              type="button"
                              onClick={() => void handleCloseRoom(room.roomId)}
                              disabled={roomLoading || !room.isActive}
                              className="rounded-lg bg-red-600 px-2 py-2 text-[10px] font-semibold text-white disabled:opacity-40"
                            >
                              Close
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <input
                      type="text"
                      value={newRoomName}
                      onChange={(event) => setNewRoomName(event.target.value)}
                      placeholder="New room name"
                      className="rounded-lg border border-(--border) bg-(--card) px-3 py-2 text-xs text-foreground outline-none focus:border-(--accent)"
                    />
                    <input
                      type="text"
                      value={newRoomId}
                      onChange={(event) => setNewRoomId(event.target.value)}
                      placeholder="room-id (optional)"
                      className="rounded-lg border border-(--border) bg-(--card) px-3 py-2 text-xs text-foreground outline-none focus:border-(--accent)"
                    />
                    <button
                      type="button"
                      onClick={() => void handleCreateRoom()}
                      disabled={roomLoading }
                      className="rounded-lg bg-(--accent) px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                    >
                      {roomLoading ? "..." : "Create"}
                    </button>
                  </div>

                  {roomNotice ? (
                    <p className="text-[10px] text-(--muted)">{roomNotice}</p>
                  ) : null}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-2">
                <ActionButton
                  label="Start"
                  onClick={() => handleAction("start")}
                  disabled={admin.loading }
                  color="green"
                />
                <ActionButton
                  label="Pause"
                  onClick={() => handleAction("pause")}
                  disabled={admin.loading }
                  color="yellow"
                />
                <ActionButton
                  label="Next"
                  onClick={() => handleAction("next")}
                  disabled={admin.loading }
                  color="blue"
                />
                <ActionButton
                  label="Reset"
                  onClick={() => handleAction("reset")}
                  disabled={admin.loading }
                  color="red"
                />
                <ActionButton
                  label="Shuffle"
                  onClick={handleShuffle}
                  disabled={admin.loading  || Boolean(roomId && roomId !== "global")}
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
                    disabled={topicLoading  || !selectedTopicId}
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
                    disabled={topicLoading }
                    className="flex-1 text-xs py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 
                      disabled:opacity-40 transition-all"
                  >
                    Next Topic
                  </button>
                  <button
                    onClick={handleCancelAutoAdvance}
                    disabled={topicLoading }
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
                    disabled={topicLoading }
                    className="flex-1 text-xs py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-500 
                      disabled:opacity-40 transition-all"
                    title="Skip current topic and start next"
                  >
                    Skip Topic
                  </button>
                  <button
                    onClick={handleReplayTopic}
                    disabled={topicLoading }
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
                    disabled={topicLoading }
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
                      disabled={loopLoading }
                      className={`flex-1 text-[10px] py-1.5 rounded-lg transition-all disabled:opacity-40
                        ${topicLoopMode === "off" ? "bg-(--accent) text-white" : "bg-(--card) border border-(--border) text-(--muted) hover:border-(--accent)"}`}
                    >
                      Off
                    </button>
                    <button
                      onClick={() => handleSetTopicLoop("once")}
                      disabled={loopLoading }
                      className={`flex-1 text-[10px] py-1.5 rounded-lg transition-all disabled:opacity-40
                        ${topicLoopMode === "once" ? "bg-purple-600 text-white" : "bg-(--card) border border-(--border) text-(--muted) hover:border-purple-500"}`}
                    >
                      Once
                    </button>
                    <button
                      onClick={() => handleSetTopicLoop("infinite")}
                      disabled={loopLoading }
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
                      disabled={loopLoading }
                      className={`flex-1 text-[10px] py-1.5 rounded-lg transition-all disabled:opacity-40
                        ${seriesLoopMode === "off" ? "bg-(--accent) text-white" : "bg-(--card) border border-(--border) text-(--muted) hover:border-(--accent)"}`}
                    >
                      Off
                    </button>
                    <button
                      onClick={() => handleSetSeriesLoop("once")}
                      disabled={loopLoading }
                      className={`flex-1 text-[10px] py-1.5 rounded-lg transition-all disabled:opacity-40
                        ${seriesLoopMode === "once" ? "bg-purple-600 text-white" : "bg-(--card) border border-(--border) text-(--muted) hover:border-purple-500"}`}
                    >
                      Once
                    </button>
                    <button
                      onClick={() => handleSetSeriesLoop("infinite")}
                      disabled={loopLoading }
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
                    disabled={loopLoading }
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
                <p className="text-xs text-(--muted)">Verify your author session to access controls</p>
                <p className="text-[10px] text-(--muted) mt-1">You must be logged in at /admin/login</p>
              </div>

              <div className="space-y-2">
                {tokenError && (
                  <p className="text-xs text-red-500 text-center">{tokenError}</p>
                )}

                <button
                  type="button"
                  onClick={() => void handleValidateToken()}
                  disabled={admin.validating}
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
                      Verifying...
                    </>
                  ) : (
                    "Verify Session & Unlock"
                  )}
                </button>
              </div>
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
  const isHealth = result.action === "health" && result.success && !!result.data;
  const statusData = isStatus ? (result.data as AdminStatus) : undefined;
  const healthData = isHealth ? (result.data as HealthResponse) : undefined;

  const formatTimestamp = (timestamp: number | null | undefined): string => {
    if (!timestamp) {
      return "never";
    }

    return new Date(timestamp).toLocaleString();
  };

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

          {isHealth && healthData && (
            <>
              <pre className="mt-2 text-[10px] text-(--muted) font-mono bg-background p-2 rounded overflow-x-auto">
{`ok: ${healthData.ok}
time: ${healthData.time}
uptime: ${Math.round(healthData.uptime)}s
clients: ${healthData.clients}
rooms: ${healthData.rooms ? `${healthData.rooms.active}/${healthData.rooms.total} active` : "n/a"}
persistence: ${healthData.persistence?.configured ? "configured" : "not configured"}
savePending: ${healthData.persistence?.savePending ? "yes" : "no"}
lastSaved: ${formatTimestamp(healthData.persistence?.lastSavedAt)}
lastRestored: ${formatTimestamp(healthData.persistence?.lastRestoredAt)}`}
              </pre>

              {healthData.roomDetails && healthData.roomDetails.length > 0 && (
                <div className="mt-2 rounded bg-background p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-(--muted)">Rooms</p>
                  <div className="mt-2 space-y-1.5">
                    {healthData.roomDetails.map((room) => (
                      <div key={room.roomId} className="flex items-start justify-between gap-2 text-[10px]">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-foreground">{room.name}</p>
                          <p className="truncate font-mono text-(--muted)">{room.roomId}</p>
                        </div>
                        <div className="shrink-0 text-right font-mono text-(--muted)">
                          <p>{room.isActive ? "active" : "closed"}</p>
                          <p>m:{room.members} l:{room.connectedClients} p:{room.gameplayPlayers}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
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
