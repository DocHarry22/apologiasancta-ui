"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

function normalizeRoomCode(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
}

export function QuickJoinForm({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const normalized = normalizeRoomCode(roomCode);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (normalized.length < 3) return;
    router.push(`/mobile?roomId=${encodeURIComponent(normalized)}`);
  };

  return (
    <form onSubmit={submit} className={compact ? "space-y-2" : "surface-card p-3"}>
      <label htmlFor="room-code" className="sr-only">Room code</label>
      <div className={`flex flex-col gap-2 ${compact ? "" : "sm:flex-row"}`}>
        <input
          id="room-code"
          value={roomCode}
          onChange={(event) => setRoomCode(event.target.value)}
          placeholder="Enter room code"
          autoComplete="off"
          inputMode="text"
          className="form-control min-h-12 flex-1 text-base"
        />
        <button
          type="submit"
          disabled={normalized.length < 3}
          className="btn-primary min-h-12 px-6 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Join live room
        </button>
      </div>
      <p className="mt-2 px-1 text-xs leading-5 text-(--text-muted)">No account required. Choose a safe display name after joining.</p>
    </form>
  );
}
