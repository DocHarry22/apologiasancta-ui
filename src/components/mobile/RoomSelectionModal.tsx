"use client";

import { useEffect, useState } from "react";
import type { RoomSummary } from "@/types/quiz";

interface RoomSelectionModalProps {
  engineUrl: string;
  onSelected: (room: RoomSummary) => void;
  currentRoomId?: string | null;
  onClose?: () => void;
}

interface RoomsResponse {
  rooms: RoomSummary[];
}

function isPlayableRoom(room: RoomSummary): boolean {
  return room.isActive;
}

export function RoomSelectionModal({ engineUrl, onSelected, currentRoomId = null, onClose }: RoomSelectionModalProps) {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadRooms = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${engineUrl}/rooms`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Failed to load rooms (${response.status})`);
        }

        const data = (await response.json()) as RoomsResponse;
        if (cancelled) {
          return;
        }

        setRooms(data.rooms);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Failed to load rooms");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadRooms();

    return () => {
      cancelled = true;
    };
  }, [engineUrl]);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    fetch(`${engineUrl}/rooms`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load rooms (${response.status})`);
        }

        const data = (await response.json()) as RoomsResponse;
        setRooms(data.rooms);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Failed to load rooms");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="mx-4 w-full max-w-lg rounded-2xl p-8 shadow-2xl"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--card-border)",
        }}
      >
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold" style={{ color: "var(--accent)" }}>
            Choose a Battle Room
          </h2>
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            Pick an active room before you join the live quiz.
          </p>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-(--muted) transition-colors hover:text-foreground"
            >
              Close
            </button>
          ) : null}
        </div>

        {loading ? (
          <div className="rounded-xl p-4 text-sm" style={{ backgroundColor: "var(--option-bg)", color: "var(--muted)" }}>
            Loading available rooms...
          </div>
        ) : error ? (
          <div className="space-y-3">
            <div className="rounded-xl p-4 text-sm" style={{ backgroundColor: "var(--wrong-bg)", color: "var(--wrong)" }}>
              {error}
            </div>
            <button
              type="button"
              onClick={handleRetry}
              className="w-full rounded-xl py-3 text-sm font-semibold text-white"
              style={{ backgroundColor: "var(--accent)" }}
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {rooms.map((room) => {
              const playable = isPlayableRoom(room);

              return (
                <button
                  key={room.roomId}
                  type="button"
                  disabled={!playable}
                  onClick={() => onSelected(room)}
                  className="w-full rounded-xl border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    borderColor: room.roomId === currentRoomId ? "var(--accent2)" : playable ? "var(--accent)" : "var(--border)",
                    backgroundColor: room.roomId === currentRoomId ? "var(--option-hover)" : "var(--option-bg)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold" style={{ color: "var(--text)" }}>
                        {room.name}
                      </div>
                      <div className="mt-1 text-xs uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                        {room.roomId}
                      </div>
                    </div>
                    <span
                      className="rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider"
                      style={{
                        backgroundColor: room.roomId === currentRoomId ? "rgba(74, 168, 224, 0.18)" : playable ? "var(--correct-bg)" : "var(--ticker-bg)",
                        color: room.roomId === currentRoomId ? "var(--accent2)" : playable ? "var(--correct)" : "var(--muted)",
                      }}
                    >
                      {room.roomId === currentRoomId ? "Selected" : playable ? "Live now" : "Closed"}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm" style={{ color: "var(--text-secondary)" }}>
                    <span>{room.playerCount} players</span>
                    <span>{room.roomId === currentRoomId ? "Current room" : playable ? "Enter room" : "Unavailable"}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}