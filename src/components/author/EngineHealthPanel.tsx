"use client";

import { useCallback, useEffect, useState } from "react";
import { checkHealth, type HealthResponse } from "@/lib/engineAdmin";

interface Props {
  engineUrl: string | null;
}

const REFRESH_INTERVAL_MS = 15000;

function formatTimestamp(timestamp: number | null | undefined): string {
  if (!timestamp) {
    return "Never";
  }

  return new Date(timestamp).toLocaleString();
}

export default function EngineHealthPanel({ engineUrl }: Props) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    if (!engineUrl) {
      setHealth(null);
      setError("Engine URL is not configured");
      return;
    }

    setLoading(true);
    const result = await checkHealth(engineUrl);

    if (result.success && result.data) {
      setHealth(result.data);
      setError(null);
    } else {
      setHealth(null);
      setError(result.error || "Health check failed");
    }

    setLoading(false);
  }, [engineUrl]);

  useEffect(() => {
    void fetchHealth();

    if (!engineUrl) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void fetchHealth();
    }, REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [engineUrl, fetchHealth]);

  return (
    <section className="rounded-xl border border-(--border) bg-background p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Engine Health</h3>
          <p className="text-xs text-(--muted)">Public runtime status from the engine health endpoint.</p>
        </div>
        <button
          type="button"
          onClick={() => void fetchHealth()}
          disabled={loading}
          className="rounded-lg border border-(--border) px-3 py-1 text-xs text-(--muted) hover:border-(--accent) hover:text-(--accent) disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-(--wrong)/30 bg-(--wrong)/10 px-3 py-2 text-sm text-(--wrong)">
          {error}
        </div>
      )}

      {health && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div className="space-y-1">
              <span className="text-xs text-(--muted)">Status</span>
              <p className={health.ok ? "text-green-400 font-medium" : "text-(--wrong) font-medium"}>
                {health.ok ? "Healthy" : "Unhealthy"}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-(--muted)">Clients</span>
              <p className="font-mono">{health.clients}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-(--muted)">Rooms</span>
              <p className="font-mono">
                {health.rooms ? `${health.rooms.active}/${health.rooms.total} active` : "n/a"}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-(--muted)">Uptime</span>
              <p className="font-mono">{Math.round(health.uptime)}s</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div className="space-y-1">
              <span className="text-xs text-(--muted)">Server Time</span>
              <p className="font-mono text-xs break-all">{health.time}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-(--muted)">Persistence</span>
              <p className={health.persistence?.configured ? "text-green-400" : "text-(--muted)"}>
                {health.persistence?.configured ? "Configured" : "Not configured"}
              </p>
            </div>
          </div>

          {health.persistence && (
            <div className="rounded-lg border border-(--border) bg-(--card) p-3 space-y-2 text-sm">
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                  <span className="text-xs text-(--muted)">Pending Save</span>
                  <p>{health.persistence.savePending ? "Yes" : "No"}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-(--muted)">Last Restore</span>
                  <p className={health.persistence.lastRestoreSucceeded ? "text-green-400" : "text-(--muted)"}>
                    {health.persistence.lastRestoreSucceeded ? "Succeeded" : "No snapshot"}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-(--muted)">Last Saved</span>
                  <p className="text-xs">{formatTimestamp(health.persistence.lastSavedAt)}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-(--muted)">Last Restored</span>
                  <p className="text-xs">{formatTimestamp(health.persistence.lastRestoredAt)}</p>
                </div>
              </div>
              <p className="text-xs text-(--muted)">
                Restart recovery restores content, room state, and the quiz checkpoint, but live timers remain paused until an admin resumes the engine.
              </p>
              <div className="space-y-1">
                <span className="text-xs text-(--muted)">State File</span>
                <p className="break-all font-mono text-xs text-(--accent)">{health.persistence.path}</p>
              </div>
            </div>
          )}

          {health.roomDetails && health.roomDetails.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-(--border)">
              <div className="grid grid-cols-[minmax(0,1.2fr)_88px_80px_80px_88px] gap-2 border-b border-(--border) bg-(--card) px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-(--muted)">
                <span>Room</span>
                <span>Status</span>
                <span>Members</span>
                <span>Live</span>
                <span>Play</span>
              </div>
              <div className="divide-y divide-(--border)">
                {health.roomDetails.map((room) => (
                  <div
                    key={room.roomId}
                    className="grid grid-cols-[minmax(0,1.2fr)_88px_80px_80px_88px] gap-2 px-3 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{room.name}</div>
                      <div className="truncate text-xs text-(--muted)">{room.roomId}</div>
                    </div>
                    <div>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          room.isActive ? "bg-green-500/15 text-green-400" : "bg-(--card) text-(--muted)"
                        }`}
                      >
                        {room.isActive ? "Active" : "Closed"}
                      </span>
                    </div>
                    <div className="font-mono">{room.members}</div>
                    <div className="font-mono">{room.connectedClients}</div>
                    <div className="font-mono">{room.gameplayPlayers}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}