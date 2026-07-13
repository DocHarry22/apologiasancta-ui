"use client";

import { useState, useCallback, useEffect } from "react";
import { PLAYER_NAME_KEY } from "./YourScoreCard";
import { getEngineUrl } from "@/lib/publicEnv";
import {
  clearStoredPlayerIdentity,
  readStoredPlayerIdentity,
  saveStoredPlayerIdentity,
} from "@/lib/playerIdentity";
import { getReusableStoredUserId, getSavedIdentityDecision } from "@/lib/registrationRecovery";

interface JoinGameModalProps {
  roomId: string;
  roomName?: string | null;
  onJoined: (userId: string, username: string) => void;
  onCancel?: () => void;
}

interface RegistrationState {
  status: "idle" | "loading" | "error";
  errorMessage?: string;
}

const API_URL = getEngineUrl();

export function JoinGameModal({ roomId, roomName, onJoined, onCancel }: JoinGameModalProps) {
  const [username, setUsername] = useState("");
  const [state, setState] = useState<RegistrationState>({ status: "idle" });

  useEffect(() => {
    if (!API_URL) return;
    let cancelled = false;

    const { userId: storedUserId, username: storedUsername } = readStoredPlayerIdentity();
    if (storedUsername) {
      setUsername(storedUsername);
    }

    if (!storedUserId || !storedUsername) return;
    setState({ status: "loading" });

    fetch(`${API_URL}/register/me?userId=${encodeURIComponent(storedUserId)}&roomId=${encodeURIComponent(roomId)}`)
      .then(async (res) => {
        if (cancelled) return;
        const data = await res.json().catch(() => ({})) as {
          userId?: string;
          username?: string;
          reason?: string;
          error?: string;
          message?: string;
        };
        const decision = getSavedIdentityDecision({ ok: res.ok, status: res.status, reason: data.reason });

        if (decision === "resume" && data.userId && data.username) {
          onJoined(data.userId, data.username);
          return;
        }

        if (decision === "clear_identity") {
          clearStoredPlayerIdentity();
          setState({ status: "idle" });
          return;
        }

        setState({
          status: "error",
          errorMessage: decision === "choose_room"
            ? data.error || data.message || "That room is no longer available. Choose another room."
            : "We could not verify your saved player yet. Check your connection or retry below.",
        });
      })
      .catch(() => {
        if (cancelled) return;
        setState({
          status: "error",
          errorMessage: "We could not verify your saved player yet. Check your connection or retry below.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [onJoined, roomId]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const trimmed = username.trim();
      if (!trimmed) return;

      if (!API_URL) {
        setState({
          status: "error",
          errorMessage: "Engine unavailable. Live registration is not configured yet.",
        });
        return;
      }

      setState({ status: "loading" });

      try {
        const storedIdentity = readStoredPlayerIdentity();
        const reusableUserId = getReusableStoredUserId(
          storedIdentity.userId,
          storedIdentity.username,
          trimmed
        );
        const res = await fetch(`${API_URL}/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: trimmed, roomId, userId: reusableUserId }),
        });

        const data = await res.json();

        if (res.ok) {
          saveStoredPlayerIdentity(data.userId, data.username);
          localStorage.setItem(PLAYER_NAME_KEY, data.username);
          onJoined(data.userId, data.username);
          return;
        }

        if (res.status === 409) {
          setState({ status: "error", errorMessage: data.error || data.message || "That name is already taken in this room." });
          return;
        }

        if (res.status === 400) {
          setState({ status: "error", errorMessage: data.error || data.message || "Use 3-20 letters, numbers, or underscores." });
          return;
        }

        if (res.status === 429) {
          setState({ status: "error", errorMessage: "Too many attempts. Please wait a moment and try again." });
          return;
        }

        setState({ status: "error", errorMessage: data.error || data.message || "Registration failed. Please try again." });
      } catch {
        setState({ status: "error", errorMessage: "Engine unavailable. Check your connection and try again." });
      }
    },
    [username, roomId, onJoined]
  );

  const isValidUsername =
    username.trim().length >= 3 &&
    username.trim().length <= 20 &&
    /^[a-zA-Z0-9_]+$/.test(username.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-(--card-border) bg-(--card) p-6 shadow-2xl">
        <div className="mb-6 text-center">
          <h1 className="mb-2 text-3xl font-bold text-(--accent)">Apologia Sancta</h1>
          <p className="text-sm text-(--text-secondary)">
            Join room <span className="font-semibold text-foreground">{roomName || roomId}</span>
          </p>
          {roomName && roomName !== roomId ? (
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-(--muted)">{roomId}</p>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="username" className="mb-2 block text-sm font-medium text-foreground">
              Enter your display name
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your display name"
              disabled={state.status === "loading"}
              className="min-h-12 w-full rounded-lg border-2 border-(--option-border) bg-(--option-bg) px-4 py-3 text-lg text-foreground outline-none transition-all focus:border-(--accent)"
              autoFocus
              autoComplete="nickname"
              maxLength={20}
            />
            <p className="mt-2 text-sm text-(--muted)">3-20 characters: letters, numbers, underscores.</p>
          </div>

          {state.status === "error" && state.errorMessage && (
            <div className="rounded-lg bg-(--wrong-bg) p-3 text-sm text-(--wrong)">
              {state.errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={!API_URL || !isValidUsername || state.status === "loading"}
            className="min-h-12 w-full rounded-lg bg-(--accent) py-3 text-lg font-bold text-white transition-all disabled:cursor-not-allowed disabled:bg-(--muted) disabled:text-(--text-secondary) disabled:opacity-60"
          >
            {state.status === "loading" ? "Joining..." : "Join Game"}
          </button>

          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={state.status === "loading"}
              className="min-h-11 w-full rounded-lg border border-(--option-border) py-2.5 text-sm font-semibold text-(--text-secondary) transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              Choose another room
            </button>
          ) : null}
        </form>

        <p className="mt-6 text-center text-xs text-(--muted)">
          {API_URL
            ? "Your name and score will be tracked inside this room."
            : "Engine unavailable. Live registration is disabled until NEXT_PUBLIC_ENGINE_URL is configured."}
        </p>
      </div>
    </div>
  );
}
