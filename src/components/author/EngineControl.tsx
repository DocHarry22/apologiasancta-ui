"use client";

import { useState, useEffect, useCallback } from "react";
import {
  contentActions,
  quizActions,
  adminActions,
  topicActions,
  roomActions,
  type ContentStatusResponse,
  type AdminStatus,
  type AdminRoomStatus,
} from "@/lib/engineAdmin";

interface Props {
  engineUrl: string;
  adminToken: string;
}

export default function EngineControl({ engineUrl, adminToken }: Props) {
  const [contentStatus, setContentStatus] = useState<ContentStatusResponse | null>(null);
  const [adminStatus, setAdminStatus] = useState<AdminStatus | null>(null);
  const [rooms, setRooms] = useState<AdminRoomStatus[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [shuffle, setShuffle] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState(10);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomId, setNewRoomId] = useState("");

  const formatTimestamp = (timestamp: number | null | undefined): string => {
    if (!timestamp) {
      return "Never";
    }

    return new Date(timestamp).toLocaleString();
  };

  const fetchStatus = useCallback(async () => {
    const [contentRes, adminRes, roomsRes] = await Promise.all([
      contentActions.status(engineUrl, adminToken),
      adminActions.status(engineUrl, adminToken),
      roomActions.list(engineUrl, adminToken),
    ]);

    if (contentRes.success && contentRes.data) {
      setContentStatus(contentRes.data);
    }
    if (adminRes.success && adminRes.data) {
      setAdminStatus(adminRes.data);
    }
    if (roomsRes.success && roomsRes.data) {
      setRooms(roomsRes.data.rooms);
    }
  }, [engineUrl, adminToken]);

  useEffect(() => {
    // Use microtask to avoid synchronous setState in effect body
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        fetchStatus();
      }
    });
    // Refresh every 10 seconds
    const interval = setInterval(fetchStatus, 10000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [fetchStatus]);

  const handleSetPool = async () => {
    setLoading(true);
    setMessage(null);

    const result = await quizActions.setPool(engineUrl, adminToken, selectedTopics, shuffle);

    if (result.success && result.data) {
      setMessage({
        type: "success",
        text: `Pool set: ${result.data.poolSize} questions from ${result.data.topicIds.length} topic(s)`,
      });
      fetchStatus();
    } else {
      setMessage({ type: "error", text: result.error || "Failed to set pool" });
    }

    setLoading(false);
  };

  const handleClearBank = async () => {
    if (!confirm("Clear local engine bank only? This does NOT delete from GitHub.")) return;

    setLoading(true);
    const result = await contentActions.clear(engineUrl, adminToken);

    if (result.success) {
      setMessage({ type: "success", text: "Content bank cleared" });
      fetchStatus();
    } else {
      setMessage({ type: "error", text: result.error || "Failed to clear bank" });
    }

    setLoading(false);
  };

  const handleFetchFromGitHub = async () => {
    setLoading(true);
    setMessage(null);

    const result = await contentActions.syncFromGitHub(engineUrl, adminToken);

    if (result.success && result.data) {
      setMessage({
        type: "success",
        text: `Fetched ${result.data.questionsLoaded} question(s) from ${result.data.topicsLoaded} topic(s) on GitHub`,
      });
      setSelectedTopics([]);
      await fetchStatus();
    } else {
      setMessage({ type: "error", text: result.error || "Failed to fetch from GitHub" });
    }

    setLoading(false);
  };

  const handleClearGitHub = async () => {
    if (!confirm("Delete question files from GitHub content store? This cannot be undone.")) return;

    setLoading(true);
    setMessage(null);

    const result = await contentActions.clearGitHub(engineUrl, adminToken);

    if (result.success && result.data) {
      setMessage({
        type: "success",
        text: `Deleted ${result.data.deletedQuestions} GitHub question file(s) across ${result.data.topicsProcessed} topic(s)`,
      });
      await fetchStatus();
    } else {
      setMessage({ type: "error", text: result.error || "Failed to clear GitHub content" });
    }

    setLoading(false);
  };

  const handleAdminAction = async (action: "start" | "resume" | "pause" | "next" | "reset") => {
    setLoading(true);
    const result = await adminActions[action](engineUrl, adminToken);

    if (result.success) {
      const successText =
        action === "resume"
          ? "Quiz resumed from saved checkpoint"
          : action === "reset"
            ? "Quiz reset"
            : `Quiz ${action}ed`;
      setMessage({ type: "success", text: successText });
      fetchStatus();
    } else {
      setMessage({ type: "error", text: result.error || `Failed to ${action}` });
    }

    setLoading(false);
  };

  const handleSavePersistence = async () => {
    setLoading(true);
    setMessage(null);

    const result = await adminActions.savePersistence(engineUrl, adminToken);

    if (result.success) {
      setMessage({ type: "success", text: "Runtime state saved" });
      await fetchStatus();
    } else {
      setMessage({ type: "error", text: result.error || "Failed to save runtime state" });
    }

    setLoading(false);
  };

  const handleCreateRoom = async () => {
    const trimmedName = newRoomName.trim();
    const trimmedRoomId = newRoomId.trim().toLowerCase();

    if (!trimmedName) {
      setMessage({ type: "error", text: "Room name is required" });
      return;
    }

    setLoading(true);
    setMessage(null);

    const result = await roomActions.create(
      engineUrl,
      adminToken,
      trimmedName,
      trimmedRoomId || undefined
    );

    if (result.success && result.data) {
      setMessage({ type: "success", text: `Created room: ${result.data.room.name}` });
      setNewRoomName("");
      setNewRoomId("");
      await fetchStatus();
    } else {
      setMessage({ type: "error", text: result.error || "Failed to create room" });
    }

    setLoading(false);
  };

  const handleCloseRoom = async (room: AdminRoomStatus) => {
    if (room.roomId === "global") {
      return;
    }

    if (!confirm(`Close room \"${room.name}\"? Players can still view it, but new live room play will stop.`)) {
      return;
    }

    setLoading(true);
    setMessage(null);

    const result = await roomActions.close(engineUrl, adminToken, room.roomId);

    if (result.success && result.data) {
      setMessage({ type: "success", text: `Closed room: ${result.data.room.name}` });
      await fetchStatus();
    } else {
      setMessage({ type: "error", text: result.error || "Failed to close room" });
    }

    setLoading(false);
  };

  // Topic Management Handlers
  const handleSkipTopic = async () => {
    setLoading(true);
    setMessage(null);
    const result = await topicActions.skipTopic(engineUrl, adminToken);
    if (result.success && result.data) {
      setMessage({ type: "success", text: `Skipped to: ${result.data.topicTitle}` });
      fetchStatus();
    } else {
      setMessage({ type: "error", text: result.error || "Failed to skip topic" });
    }
    setLoading(false);
  };

  const handleReplayTopic = async () => {
    setLoading(true);
    setMessage(null);
    const result = await topicActions.replayTopic(engineUrl, adminToken);
    if (result.success && result.data) {
      setMessage({ type: "success", text: `Replaying: ${result.data.topicTitle}` });
      fetchStatus();
    } else {
      setMessage({ type: "error", text: result.error || "Failed to replay topic" });
    }
    setLoading(false);
  };

  const handleCountdownTopic = async () => {
    setLoading(true);
    setMessage(null);
    const result = await topicActions.countdownTopic(engineUrl, adminToken, countdownSeconds);
    if (result.success) {
      setMessage({ type: "success", text: `Starting ${countdownSeconds}s countdown...` });
      fetchStatus();
    } else {
      setMessage({ type: "error", text: result.error || "Failed to start countdown" });
    }
    setLoading(false);
  };

  const handleStartNextTopic = async () => {
    setLoading(true);
    setMessage(null);
    const result = await topicActions.startNextTopic(engineUrl, adminToken);
    if (result.success && result.data) {
      setMessage({ type: "success", text: `Started: ${result.data.topicTitle}` });
      fetchStatus();
    } else {
      setMessage({ type: "error", text: result.error || "Failed to start next topic" });
    }
    setLoading(false);
  };

  const toggleTopic = (topicId: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topicId)
        ? prev.filter((t) => t !== topicId)
        : [...prev, topicId]
    );
  };

  return (
    <div className="space-y-6">
      {/* Engine Status */}
      <section className="rounded-lg border border-(--border) bg-background p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Engine Status</h3>
            {adminStatus?.persistence?.lastRestoreSucceeded && !adminStatus.running ? (
              <span className="inline-flex rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-medium text-sky-400">
                Checkpoint Ready
              </span>
            ) : null}
          </div>
          <button
            onClick={fetchStatus}
            className="text-xs text-(--accent) hover:underline"
          >
            Refresh
          </button>
        </div>

        {adminStatus?.persistence?.lastRestoreSucceeded && !adminStatus.running ? (
          <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-300">
            A restored quiz checkpoint is loaded. Use Resume to continue from the saved question position, or Start to begin the loaded pool as a fresh run.
          </div>
        ) : null}

        {adminStatus ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="space-y-1">
              <span className="text-xs text-(--muted)">State</span>
              <p className={`font-medium ${adminStatus.running ? "text-green-400" : "text-(--muted)"}`}>
                {adminStatus.running ? "Running" : "Stopped"}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-(--muted)">Phase</span>
              <p className="font-mono">{adminStatus.phase}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-(--muted)">Question</span>
              <p className="font-mono">{adminStatus.questionIndex + 1}/{adminStatus.totalQuestions}</p>
              {adminStatus.questionSource === "legacy_fallback" && (
                <p className="text-[10px] text-(--muted)">Using legacy sample set</p>
              )}
            </div>
            <div className="space-y-1">
              <span className="text-xs text-(--muted)">Clients</span>
              <p>{adminStatus.connectedClients}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-(--muted)">Scoring</span>
              <p className="font-mono">{adminStatus.scoringMode || "unknown"}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-(--muted)">Loading...</p>
        )}

        {/* Quiz Controls */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-(--border)">
          <button
            onClick={() => handleAdminAction("resume")}
            disabled={loading || adminStatus?.running || !adminStatus?.persistence?.lastRestoreSucceeded}
            className="px-3 py-1.5 text-xs rounded-lg bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-50"
            title="Resume the current restored quiz checkpoint without resetting the question position"
          >
            Resume
          </button>
          <button
            onClick={() => handleAdminAction("start")}
            disabled={loading || adminStatus?.running}
            className="px-3 py-1.5 text-xs rounded-lg bg-green-600 text-white hover:bg-green-500 disabled:opacity-50"
          >
            Start
          </button>
          <button
            onClick={() => handleAdminAction("pause")}
            disabled={loading || !adminStatus?.running}
            className="px-3 py-1.5 text-xs rounded-lg bg-yellow-600 text-white hover:bg-yellow-500 disabled:opacity-50"
          >
            Pause
          </button>
          <button
            onClick={() => handleAdminAction("next")}
            disabled={loading}
            className="px-3 py-1.5 text-xs rounded-lg bg-(--accent) text-white hover:opacity-90 disabled:opacity-50"
          >
            Next
          </button>
          <button
            onClick={() => handleAdminAction("reset")}
            disabled={loading}
            className="px-3 py-1.5 text-xs rounded-lg border border-(--border) hover:border-(--wrong) hover:text-(--wrong) disabled:opacity-50"
          >
            Reset
          </button>
        </div>

        {adminStatus?.persistence && (
          <div className="rounded-lg border border-(--border) bg-(--card) p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-(--muted)">Persistence</h4>
                <p className="text-xs text-(--muted)">Content bank, active pool, controller checkpoint, rooms, players, and leaderboard history.</p>
              </div>
              <button
                onClick={handleSavePersistence}
                disabled={loading || !adminStatus.persistence.configured}
                className="rounded-lg border border-(--border) px-3 py-1.5 text-xs hover:border-(--accent) hover:text-(--accent) disabled:opacity-50"
              >
                Save Now
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div className="space-y-1">
                <span className="text-xs text-(--muted)">Configured</span>
                <p className={adminStatus.persistence.configured ? "text-green-400" : "text-(--muted)"}>
                  {adminStatus.persistence.configured ? "Yes" : "No"}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-(--muted)">Last Restore</span>
                <p className={adminStatus.persistence.lastRestoreSucceeded ? "text-green-400" : "text-(--muted)"}>
                  {adminStatus.persistence.lastRestoreSucceeded ? "Succeeded" : "No snapshot"}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-(--muted)">Pending Save</span>
                <p>{adminStatus.persistence.savePending ? "Yes" : "No"}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-(--muted)">Last Saved</span>
                <p className="text-xs">{formatTimestamp(adminStatus.persistence.lastSavedAt)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div className="space-y-1">
                <span className="text-xs text-(--muted)">Last Restored</span>
                <p className="text-xs">{formatTimestamp(adminStatus.persistence.lastRestoredAt)}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-(--muted)">Restore Behavior</span>
                <p className="text-xs text-(--muted)">Recovered quiz checkpoints stay paused until you explicitly resume the engine.</p>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-(--muted)">State File</span>
              <p className="break-all font-mono text-xs text-(--accent)">{adminStatus.persistence.path}</p>
            </div>
          </div>
        )}
      </section>

      {/* Topic Management */}
      <section className="rounded-lg border border-(--border) bg-background p-4 space-y-3">
        <h3 className="text-sm font-semibold">Topic Management</h3>
        <p className="text-xs text-(--muted)">Control topic transitions and resets</p>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-(--border)">
          <button
            onClick={handleStartNextTopic}
            disabled={loading}
            className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
          >
            Next Topic
          </button>
          <button
            onClick={handleSkipTopic}
            disabled={loading}
            className="px-3 py-1.5 text-xs rounded-lg bg-orange-600 text-white hover:bg-orange-500 disabled:opacity-50"
            title="Skip current topic and start next"
          >
            Skip Topic
          </button>
          <button
            onClick={handleReplayTopic}
            disabled={loading}
            className="px-3 py-1.5 text-xs rounded-lg bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-50"
            title="Restart current topic from beginning"
          >
            Replay Topic
          </button>
        </div>

        {/* Countdown */}
        <div className="flex items-center gap-2 pt-2">
          <input
            type="number"
            min="1"
            max="60"
            value={countdownSeconds}
            onChange={(e) => setCountdownSeconds(Math.max(1, Math.min(60, parseInt(e.target.value) || 10)))}
            className="w-16 px-2 py-1.5 text-xs text-center rounded-lg border border-(--border) bg-transparent focus:border-(--accent) outline-none"
          />
          <button
            onClick={handleCountdownTopic}
            disabled={loading}
            className="px-3 py-1.5 text-xs rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50"
            title="Start countdown before beginning topic"
          >
            Countdown ({countdownSeconds}s)
          </button>
        </div>
      </section>

      {/* Room Management */}
      <section className="rounded-lg border border-(--border) bg-background p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Room Management</h3>
          <p className="text-xs text-(--muted)">Create and close player rooms. Room scoring is isolated, but live topic progression is still shared engine-wide.</p>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(180px,0.8fr)_auto]">
          <input
            type="text"
            value={newRoomName}
            onChange={(event) => setNewRoomName(event.target.value)}
            placeholder="New room name"
            className="rounded-lg border border-(--border) bg-transparent px-3 py-2 text-sm focus:border-(--accent) outline-none"
          />
          <input
            type="text"
            value={newRoomId}
            onChange={(event) => setNewRoomId(event.target.value.replace(/[^a-z0-9-]/g, "").toLowerCase())}
            placeholder="Optional room-id"
            className="rounded-lg border border-(--border) bg-transparent px-3 py-2 text-sm focus:border-(--accent) outline-none"
          />
          <button
            onClick={handleCreateRoom}
            disabled={loading || !newRoomName.trim()}
            className="rounded-lg bg-(--accent) px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Create Room
          </button>
        </div>

        <div className="overflow-hidden rounded-lg border border-(--border)">
          <div className="grid grid-cols-[minmax(0,1.2fr)_110px_84px_84px_84px_110px] gap-2 border-b border-(--border) bg-(--card) px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-(--muted)">
            <span>Room</span>
            <span>Status</span>
            <span>Members</span>
            <span>Live</span>
            <span>Play</span>
            <span>Action</span>
          </div>
          <div className="divide-y divide-(--border)">
            {rooms.map((room) => (
              <div
                key={room.roomId}
                className="grid grid-cols-[minmax(0,1.2fr)_110px_84px_84px_84px_110px] gap-2 px-3 py-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{room.name}</div>
                  <div className="truncate text-xs text-(--muted)">{room.roomId}</div>
                </div>
                <div>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      room.isActive ? "bg-green-500/15 text-green-400" : "bg-(--ticker-bg) text-(--muted)"
                    }`}
                  >
                    {room.isActive ? "Active" : "Closed"}
                  </span>
                </div>
                <div className="font-mono">{room.playerCount}</div>
                <div className="font-mono">{room.connectedClients}</div>
                <div className="font-mono">{room.gameplayPlayerCount}</div>
                <div>
                  {room.roomId !== "global" && room.isActive ? (
                    <button
                      onClick={() => handleCloseRoom(room)}
                      disabled={loading}
                      className="rounded-lg border border-(--border) px-2 py-1 text-xs hover:border-(--wrong) hover:text-(--wrong) disabled:opacity-50"
                    >
                      Close
                    </button>
                  ) : (
                    <span className="text-xs text-(--muted)">{room.roomId === "global" ? "Pinned" : "-"}</span>
                  )}
                </div>
              </div>
            ))}
            {rooms.length === 0 && (
              <div className="px-3 py-4 text-sm text-(--muted)">No rooms returned by the engine.</div>
            )}
          </div>
        </div>
      </section>

      {/* Content Bank */}
      <section className="rounded-lg border border-(--border) bg-background p-4 space-y-3">
        <h3 className="text-sm font-semibold">Content Bank</h3>

        {contentStatus ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className="space-y-1">
                <span className="text-xs text-(--muted)">Total Questions</span>
                <p className="font-mono text-lg">{contentStatus.bankSize}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-(--muted)">Active Pool</span>
                <p className="font-mono text-lg text-(--accent)">{contentStatus.activePoolSize}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-(--muted)">Topics</span>
                <p>{contentStatus.topicCount}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-(--muted)">GitHub</span>
                <p className={contentStatus.gitHubConfigured ? "text-green-400" : "text-(--muted)"}>
                  {contentStatus.gitHubConfigured ? "Connected" : "Not configured"}
                </p>
              </div>
            </div>

            {/* Topic Selection */}
            {contentStatus.topics.length > 0 && (
              <div className="pt-3 border-t border-(--border) space-y-2">
                <p className="text-xs font-medium text-(--muted)">
                  Select topics for quiz pool (empty = all):
                </p>
                <div className="flex flex-wrap gap-2">
                  {contentStatus.topics.map((topic) => (
                    <button
                      key={topic.topicId}
                      onClick={() => toggleTopic(topic.topicId)}
                      className={`px-2 py-1 text-xs rounded-lg border transition-colors ${
                        selectedTopics.includes(topic.topicId)
                          ? "border-(--accent) bg-(--accent)/10 text-(--accent)"
                          : "border-(--border) hover:border-(--accent)"
                      }`}
                    >
                      {topic.topicId} ({topic.count})
                    </button>
                  ))}
                </div>

                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={shuffle}
                    onChange={(e) => setShuffle(e.target.checked)}
                    className="rounded border-(--border)"
                  />
                  <span>Shuffle questions</span>
                </label>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-(--muted)">Loading...</p>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-(--border)">
          <button
            onClick={handleFetchFromGitHub}
            disabled={loading || !contentStatus || !contentStatus.gitHubConfigured}
            className="px-3 py-1.5 text-xs rounded-lg border border-(--border) hover:border-(--accent) hover:text-(--accent) disabled:opacity-50"
            title="Fetch latest topics/questions from GitHub into the local engine bank"
          >
            Fetch from GitHub
          </button>
          <button
            onClick={handleSetPool}
            disabled={loading || !contentStatus || contentStatus.bankSize === 0}
            className="px-3 py-1.5 text-xs rounded-lg bg-(--accent) text-white hover:opacity-90 disabled:opacity-50"
          >
            Set Quiz Pool
          </button>
          <button
            onClick={handleClearBank}
            disabled={loading || !contentStatus || contentStatus.bankSize === 0}
            className="px-3 py-1.5 text-xs rounded-lg border border-(--border) hover:border-(--wrong) hover:text-(--wrong) disabled:opacity-50"
          >
            Clear Local Bank
          </button>
          <button
            onClick={handleClearGitHub}
            disabled={loading || !contentStatus || !contentStatus.gitHubConfigured}
            className="px-3 py-1.5 text-xs rounded-lg border border-(--wrong) text-(--wrong) hover:bg-(--wrong)/10 disabled:opacity-50"
            title="Danger: delete question files from GitHub"
          >
            Clear GitHub Questions
          </button>
        </div>
        <p className="text-xs text-(--muted)">
          Clear Local Bank only resets in-memory engine content. Use Fetch from GitHub to repopulate.
        </p>
      </section>

      {/* Message */}
      {message && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            message.type === "success"
              ? "border-green-500/30 bg-green-500/10 text-green-400"
              : "border-(--wrong)/30 bg-(--wrong)/10 text-(--wrong)"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Config Info */}
      <div className="rounded-lg border border-dashed border-(--border) p-4 text-xs text-(--muted)">
        <p className="font-medium mb-1">Engine URL:</p>
        <code className="text-(--accent)">{engineUrl}</code>
      </div>
    </div>
  );
}
