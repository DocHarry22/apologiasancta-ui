"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

function normalizeRoomCode(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
}

export function QuickJoinForm() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const normalized = normalizeRoomCode(roomCode);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (normalized.length < 3) return;
    router.push(`/mobile?roomId=${encodeURIComponent(normalized)}`);
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-white/12 bg-black/25 p-3 shadow-2xl backdrop-blur-sm">
      <label htmlFor="room-code" className="sr-only">Room code</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="room-code"
          value={roomCode}
          onChange={(event) => setRoomCode(event.target.value)}
          placeholder="Enter room code"
          autoComplete="off"
          inputMode="text"
          className="min-h-12 flex-1 rounded-xl border border-white/15 bg-[#12100d] px-4 text-base text-[#f6f0e4] outline-none placeholder:text-[#8f8474] focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/25"
        />
        <button
          type="submit"
          disabled={normalized.length < 3}
          className="min-h-12 rounded-xl bg-[#d4af37] px-6 font-bold text-[#17130a] transition hover:bg-[#e2c45c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          Join live room
        </button>
      </div>
      <p className="mt-2 px-1 text-xs text-[#b8ad9c]">No account required. Choose a safe display name after joining.</p>
    </form>
  );
}
