"use client";

import { useState, useCallback, useEffect } from "react";
import { PLAYER_NAME_KEY } from "./YourScoreCard";
import { getEngineUrl } from "@/lib/publicEnv";

interface JoinGameModalProps {
  roomId: string;
  roomName?: string | null;
  onJoined: (userId: string, username: string) => void;
}

interface RegistrationState {
  status: "idle" | "loading" | "error";
  errorMessage?: string;
}

const API_URL = getEngineUrl();

export function JoinGameModal({ roomId, roomName, onJoined }: JoinGameModalProps) {
  const [username, setUsername] = useState("");
  const [state, setState] = useState<RegistrationState>({ status: "idle" });

  useEffect(() => {
    if (!API_URL) {
      return;
    }

    const storedUserId = localStorage.getItem("userId");
    const storedUsername = localStorage.getItem("playerName");

    if (!storedUserId || !storedUsername) {
      return;
    }

    fetch(
      `${API_URL}/register/me?userId=${encodeURIComponent(storedUserId)}&roomId=${encodeURIComponent(roomId)}`
    )
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          onJoined(data.userId, data.username);
          return;
        }

        localStorage.removeItem("userId");
        localStorage.removeItem("playerName");
      })
      .catch(() => {
        localStorage.removeItem("userId");
        localStorage.removeItem("playerName");
      });
  }, [onJoined, roomId]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const trimmed = username.trim();
      if (!trimmed) return;

      if (!API_URL) {
        setState({
          status: "error",
          errorMessage: "Engine URL not configured. Set NEXT_PUBLIC_ENGINE_URL before joining the live game.",
        });
        return;
      }

      setState({ status: "loading" });

      try {
        const res = await fetch(`${API_URL}/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: trimmed, roomId }),
        });

        const data = await res.json();

        if (res.ok) {
          localStorage.setItem("userId", data.userId);
          localStorage.setItem("playerName", data.username);
          localStorage.setItem(PLAYER_NAME_KEY, data.username);
          onJoined(data.userId, data.username);
          return;
        }

        if (res.status === 409) {
          setState({
            status: "error",
            errorMessage: data.error || data.message || "Username already taken. Please choose another.",
          });
          return;
        }

        if (res.status === 400) {
          setState({
            status: "error",
            errorMessage: data.error || data.message || "Invalid username. Use 3-20 characters (letters, numbers, underscores).",
          });
          return;
        }

        if (res.status === 429) {
          setState({
            status: "error",
            errorMessage: "Too many attempts. Please wait a moment and try again.",
          });
          return;
        }

        setState({
          status: "error",
          errorMessage: data.error || data.message || "Registration failed. Please try again.",
        });
      } catch (error) {
        console.error("Registration error:", error);
        setState({
          status: "error",
          errorMessage: "Connection failed. Please check your internet and try again.",
        });
      }
    },
    [username, roomId, onJoined]
  );

  const isValidUsername =
    username.trim().length >= 3 &&
    username.trim().length <= 20 &&
    /^[a-zA-Z0-9_]+$/.test(username.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="mx-4 w-full max-w-md rounded-2xl p-8 shadow-2xl"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--card-border)",
        }}
      >
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold" style={{ color: "var(--accent)" }}>
            ✝ Apologia Sancta
          </h1>
          <p style={{ color: "var(--text-secondary)" }}>
            Join room <span className="font-semibold" style={{ color: "var(--text)" }}>{roomName || roomId}</span>
          </p>
          {roomName && roomName !== roomId ? (
            <p className="mt-1 text-xs uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
              {roomId}
            </p>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="username"
              className="mb-2 block text-sm font-medium"
              style={{ color: "var(--text)" }}
            >
              Choose your username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter a unique name..."
              disabled={state.status === "loading"}
              className="w-full rounded-lg px-4 py-3 text-lg outline-none transition-all"
              style={{
                backgroundColor: "var(--option-bg)",
                border: "2px solid var(--option-border)",
                color: "var(--text)",
              }}
              autoFocus
              autoComplete="off"
              maxLength={20}
            />
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              3-20 characters: letters, numbers, underscores
            </p>
          </div>

          {state.status === "error" && state.errorMessage && (
            <div
              className="rounded-lg p-3 text-sm"
              style={{
                backgroundColor: "var(--wrong-bg)",
                color: "var(--wrong)",
              }}
            >
              {state.errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={!API_URL || !isValidUsername || state.status === "loading"}
            className="w-full rounded-lg py-4 text-lg font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: isValidUsername ? "var(--accent)" : "var(--muted)",
              color: isValidUsername ? "#fff" : "var(--text-secondary)",
            }}
          >
            {state.status === "loading" ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⟳</span>
                Joining...
              </span>
            ) : (
              "Join Game"
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs" style={{ color: "var(--muted)" }}>
          {API_URL
            ? "Your username and score will be tracked inside this room."
            : "Live registration is disabled until NEXT_PUBLIC_ENGINE_URL is configured."}
        </p>
      </div>
    </div>
  );
}
