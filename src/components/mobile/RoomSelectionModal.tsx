"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import type { RoomSummary } from "@/types/quiz";
import { Dialog } from "@/components/ui/Dialog";
import { AppIcon } from "@/components/native/AppIcon";
import { StudySearch } from "@/components/native/StudyUI";
import styles from "./QuizScreen.module.css";

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
    <Dialog titleId="room-selection-title" descriptionId="room-selection-description" onClose={onClose} className={`flex max-h-[90dvh] max-w-lg flex-col ${styles.dialog}`}>
        <div className={styles.modalHeader}>
          <p className={styles.eyebrow}>Better together</p>
          <h2 id="room-selection-title">
            Choose a room
          </h2>
          <p id="room-selection-description">
            Find your room, join the quiz, and learn with others.
          </p>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="mt-1"
            >
              Close
            </button>
          ) : null}
        </div>

        <div className={styles.modalBody}>
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
              className="btn-primary w-full"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <StudySearch id="room-search" label="Search rooms" value={query} onChange={setQuery} placeholder="Search by room name or code…" />
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
                      <h3 className={styles.roomTitle}>
                        {room.name}
                      </h3>
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
                      {room.roomId === currentRoomId ? "Selected" : playable ? "Open" : "Closed"}
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
                      className="btn-primary min-h-11 px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {room.roomId === currentRoomId ? "Stay here" : playable ? "Join room" : "Room is closed"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void copyRoomLink(room)}
                      className="min-h-11 rounded-lg border border-(--mobile-border) px-3 py-2 text-sm font-semibold text-(--mobile-muted)"
                    >
                      Copy link <AppIcon className="inline-block" name="arrow" width={12} height={12} />
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
    </Dialog>
  );
}
