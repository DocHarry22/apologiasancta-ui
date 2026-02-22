"use client";

import { useState, useEffect, useCallback } from "react";
import {
  contentActions,
  quizActions,
  adminActions,
  topicActions,
  type ContentStatusResponse,
  type AdminStatus,
} from "@/lib/engineAdmin";

interface Props {
  engineUrl: string;
  adminToken: string;
}

export default function EngineControl({ engineUrl, adminToken }: Props) {
  const [contentStatus, setContentStatus] = useState<ContentStatusResponse | null>(null);
  const [adminStatus, setAdminStatus] = useState<AdminStatus | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [shuffle, setShuffle] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState(10);

  const fetchStatus = useCallback(async () => {
    const [contentRes, adminRes] = await Promise.all([
      contentActions.status(engineUrl, adminToken),
      adminActions.status(engineUrl, adminToken),
    ]);

    if (contentRes.success && contentRes.data) {
      setContentStatus(contentRes.data);
    }
    if (adminRes.success && adminRes.data) {
      setAdminStatus(adminRes.data);
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

  const handleAdminAction = async (action: "start" | "pause" | "next" | "reset") => {
    setLoading(true);
    const result = await adminActions[action](engineUrl, adminToken);

    if (result.success) {
      setMessage({ type: "success", text: `Quiz ${action}ed` });
      fetchStatus();
    } else {
      setMessage({ type: "error", text: result.error || `Failed to ${action}` });
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
        <h3 className="text-sm font-semibold flex items-center justify-between">
          Engine Status
          <button
            onClick={fetchStatus}
            className="text-xs text-(--accent) hover:underline"
          >
            Refresh
          </button>
        </h3>

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
