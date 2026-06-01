"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
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
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

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

  const loadRooms = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${engineUrl}/rooms`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(response.status === 503 ? "Engine unavailable" : `Unable to load rooms (${response.status})`);
      }
      const data = (await response.json()) as RoomsResponse;
      setRooms(data.rooms);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Engine unavailable");
    } finally {
      setLoading(false);
    }
  }, [engineUrl]);

  const filteredRooms = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rooms;
    return rooms.filter((room) => `${room.name} ${room.roomId}`.toLowerCase().includes(normalized));
  }, [query, rooms]);

  const selectRoom = (room: RoomSummary) => {
    if (currentRoomId && currentRoomId !== room.roomId) {
      const confirmed = window.confirm("Switch rooms? Your local answer selection and room context will reset.");
      if (!confirmed) return;
    }
    onSelected(room);
  };

  const copyRoomLink = async (room: RoomSummary) => {
    const url = `${window.location.origin}/mobile?roomId=${encodeURIComponent(room.roomId)}`;
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Room link copied.");
    } catch {
      setNotice(url);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="flex w-full max-w-lg flex-col rounded-2xl shadow-2xl max-h-[90dvh]"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--card-border)",
        }}
      >
        <div className="shrink-0 px-8 pt-8 pb-4 text-center">
          <h2 className="text-2xl font-bold" style={{ color: "var(--accent)" }}>
            Choose a room
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

        <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-8">
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
              onClick={() => void loadRooms()}
              className="w-full rounded-xl py-3 text-sm font-semibold text-white"
              style={{ backgroundColor: "var(--accent)" }}
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="sr-only" htmlFor="room-search">Search rooms</label>
            <input
              id="room-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search rooms"
              className="min-h-11 w-full rounded-xl border border-(--mobile-border) bg-(--mobile-elevated) px-4 py-3 text-sm text-(--mobile-text) outline-none focus:border-(--accent)"
            />
            {notice ? (
              <div className="rounded-xl border border-(--mobile-border) bg-(--mobile-elevated) px-3 py-2 text-xs text-(--mobile-muted)">
                {notice}
              </div>
            ) : null}
            {filteredRooms.map((room) => {
              const playable = isPlayableRoom(room);

              return (
                <div
                  key={room.roomId}
                  className="rounded-xl border p-4 transition-all"
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
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={!playable}
                      onClick={() => selectRoom(room)}
                      className="min-h-11 rounded-lg bg-(--accent) px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {room.roomId === currentRoomId ? "Stay here" : playable ? "Join room" : "Room is closed"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void copyRoomLink(room)}
                      className="min-h-11 rounded-lg border border-(--mobile-border) px-3 py-2 text-sm font-semibold text-(--mobile-muted)"
                    >
                      Copy link
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredRooms.length === 0 ? (
              <div className="rounded-xl border border-dashed border-(--border) p-4 text-center text-sm" style={{ color: "var(--muted)" }}>
                No rooms match that search.
              </div>
            ) : null}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
