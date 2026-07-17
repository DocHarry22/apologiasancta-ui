"use client";

import { useCallback, useEffect, useState } from "react";
import { PLAYER_NAME_KEY } from "./YourScoreCard";
import { getEngineUrl } from "@/lib/publicEnv";
import {
  clearStoredPlayerIdentity,
  isAuthSessionEpochCurrent,
  isStoredAccountPlayerIdentity,
  readAuthSessionEpoch,
  readStoredPlayerIdentity,
  saveStoredAccountPlayerIdentity,
  saveStoredGuestPlayerIdentity,
} from "@/lib/playerIdentity";
import { getReusableStoredUserId } from "@/lib/registrationRecovery";
import { requestAccountPlayerIdentity } from "@/lib/accountPlayerIdentity";
import { Dialog } from "@/components/ui/Dialog";

interface JoinGameModalProps {
  roomId: string;
  roomName?: string | null;
  onJoined: (userId: string, username: string, joinToken?: string | null) => void;
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
    const stored = readStoredPlayerIdentity();
    if (stored.username) setUsername(stored.username);
  }, []);

  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) return;

    if (!API_URL) {
      setState({ status: "error", errorMessage: "The live engine is not configured yet." });
      return;
    }

    setState({ status: "loading" });
    const authSessionEpoch = readAuthSessionEpoch();
    try {
      const accountIdentity = await requestAccountPlayerIdentity({ roomId, displayName: trimmed });
      if (accountIdentity.kind === "joined") {
        // Recheck at the final browser side-effect boundary. The request helper
        // also rejects an epoch change while awaiting the server, while this
        // closes the smaller gap between promise resolution and persistence.
        if (!isAuthSessionEpochCurrent(authSessionEpoch)) {
          setState({ status: "error", errorMessage: "Your account session changed while joining. Try again." });
          return;
        }
        saveStoredAccountPlayerIdentity(
          accountIdentity.userId,
          accountIdentity.username,
          accountIdentity.joinToken,
          accountIdentity.sessionBinding
        );
        localStorage.setItem(PLAYER_NAME_KEY, accountIdentity.username);
        onJoined(accountIdentity.userId, accountIdentity.username, accountIdentity.joinToken);
        return;
      }
      if (accountIdentity.kind === "error") {
        setState({ status: "error", errorMessage: accountIdentity.message });
        return;
      }

      let stored = readStoredPlayerIdentity();
      if (isStoredAccountPlayerIdentity(stored)) {
        clearStoredPlayerIdentity();
        stored = readStoredPlayerIdentity();
      }
      const reusableUserId = stored.joinToken
        ? getReusableStoredUserId(stored.userId, stored.username, trimmed)
        : undefined;
      const response = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(stored.joinToken ? { Authorization: `Bearer ${stored.joinToken}` } : {}),
        },
        body: JSON.stringify({ username: trimmed, roomId, userId: reusableUserId }),
      });
      const data = await response.json().catch(() => ({})) as {
        userId?: string;
        username?: string;
        joinToken?: string;
        error?: string;
        message?: string;
      };

      if (response.ok && data.userId && data.username) {
        saveStoredGuestPlayerIdentity(data.userId, data.username, data.joinToken);
        localStorage.setItem(PLAYER_NAME_KEY, data.username);
        onJoined(data.userId, data.username, data.joinToken ?? null);
        return;
      }

      if (response.status === 401) {
        clearStoredPlayerIdentity();
        localStorage.removeItem(PLAYER_NAME_KEY);
        setState({ status: "error", errorMessage: "Your saved room session is no longer valid. Choose a new display name to create a fresh player session." });
        return;
      }
      if (response.status === 409) {
        setState({ status: "error", errorMessage: data.error || data.message || "That display name is already in use." });
        return;
      }
      if (response.status === 429) {
        setState({ status: "error", errorMessage: "Too many attempts. Wait a moment and try again." });
        return;
      }
      setState({ status: "error", errorMessage: data.error || data.message || "Could not join this room." });
    } catch {
      setState({ status: "error", errorMessage: "The live engine could not be reached. Check your connection and retry." });
    }
  }, [onJoined, roomId, username]);

  const isValidUsername = username.trim().length >= 3 && username.trim().length <= 20 && /^[a-zA-Z0-9_]+$/.test(username.trim());

  return (
    <Dialog titleId="join-room-title" descriptionId="join-room-description" onClose={onCancel} className="max-w-md rounded-2xl p-6">
        <div className="mb-6 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-(--muted)">Live quiz</p>
          <h2 id="join-room-title" className="editorial-heading mt-2 text-3xl font-semibold">Join {roomName || roomId}</h2>
          <p id="join-room-description" className="mt-2 text-sm text-(--text-muted)">Choose a safe public display name for this room.</p>
          {roomName && roomName !== roomId ? <p className="mt-1 text-xs uppercase tracking-[0.18em] text-(--muted)">{roomId}</p> : null}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="username" className="mb-2 block text-sm font-medium text-foreground">Safe display name</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="e.g. Thomas_Aquinas"
              disabled={state.status === "loading"}
              className="min-h-12 w-full rounded-lg border-2 border-(--option-border) bg-(--option-bg) px-4 py-3 text-lg text-foreground outline-none transition-all focus:border-(--accent) focus:ring-2 focus:ring-(--accent)/20"
              autoFocus
              autoComplete="nickname"
              maxLength={20}
            />
            <p className="mt-2 text-sm text-(--muted)">3–20 letters, numbers, or underscores. Do not use personal contact details.</p>
          </div>

          {state.status === "error" && state.errorMessage ? (
            <div role="alert" className="rounded-lg bg-(--wrong-bg) p-3 text-sm text-(--wrong)">{state.errorMessage}</div>
          ) : null}

          <button
            type="submit"
            disabled={!API_URL || !isValidUsername || state.status === "loading"}
            className="btn-primary min-h-12 w-full text-base disabled:cursor-not-allowed disabled:opacity-60"
          >
            {state.status === "loading" ? "Joining securely…" : "Join game"}
          </button>

          {onCancel ? (
            <button type="button" onClick={onCancel} disabled={state.status === "loading"} className="min-h-11 w-full rounded-lg border border-(--option-border) py-2.5 text-sm font-semibold text-(--text-secondary) disabled:opacity-50">
              Choose another room
            </button>
          ) : null}
        </form>
    </Dialog>
  );
}
