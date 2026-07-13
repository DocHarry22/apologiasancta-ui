"use client";

import { useCallback, useEffect, useState } from "react";
import { PLAYER_NAME_KEY } from "@/components/mobile/YourScoreCard";
import {
  clearStoredPlayerIdentity,
  readStoredPlayerIdentity,
  saveStoredPlayerIdentity,
} from "@/lib/playerIdentity";
import { getSavedIdentityDecision } from "@/lib/registrationRecovery";

type UseRoomRegistrationParams = {
  engineUrl: string | null;
  roomId: string | null;
};

export function useRoomRegistration({ engineUrl, roomId }: UseRoomRegistrationParams) {
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isCheckingRegistration, setIsCheckingRegistration] = useState(true);

  const resetRegistrationState = useCallback(() => {
    clearStoredPlayerIdentity();
    localStorage.removeItem(PLAYER_NAME_KEY);
    setIsRegistered(false);
    setUserId(null);
    setUsername(null);
  }, []);

  const applyRegistration = useCallback((nextUserId: string, nextUsername: string) => {
    saveStoredPlayerIdentity(nextUserId, nextUsername);
    localStorage.setItem(PLAYER_NAME_KEY, nextUsername);
    setUserId(nextUserId);
    setUsername(nextUsername);
    setIsRegistered(true);
    setIsCheckingRegistration(false);
  }, []);

  useEffect(() => {
    if (!engineUrl) {
      setIsCheckingRegistration(false);
      return;
    }

    if (!roomId) {
      setIsRegistered(false);
      setUserId(null);
      setUsername(null);
      setIsCheckingRegistration(false);
      return;
    }

    const { userId: storedUserId, username: storedUsername } = readStoredPlayerIdentity();
    if (!storedUserId || !storedUsername) {
      setIsRegistered(false);
      setUserId(null);
      setUsername(null);
      setIsCheckingRegistration(false);
      return;
    }

    let cancelled = false;
    setIsRegistered(false);
    setUserId(null);
    setUsername(storedUsername);
    setIsCheckingRegistration(true);

    fetch(`${engineUrl}/register/me?userId=${encodeURIComponent(storedUserId)}&roomId=${encodeURIComponent(roomId)}`)
      .then(async (res) => {
        if (cancelled) return;

        const data = await res.json().catch(() => ({})) as {
          userId?: string;
          username?: string;
          reason?: string;
        };
        const decision = getSavedIdentityDecision({ ok: res.ok, status: res.status, reason: data.reason });

        if (decision === "clear_identity") {
          resetRegistrationState();
          return;
        }

        if (decision !== "resume" || !data.userId || !data.username) {
          // Keep the globally reusable saved identity. The join dialog can retry
          // or re-register the same player ID without colliding on the username.
          setIsRegistered(false);
          setUserId(null);
          setUsername(storedUsername);
          return;
        }

        applyRegistration(data.userId, data.username);
      })
      .catch(() => {
        if (cancelled) return;
        // A network outage does not prove that the player record is invalid.
        setIsRegistered(false);
        setUserId(null);
        setUsername(storedUsername);
      })
      .finally(() => {
        if (!cancelled) {
          setIsCheckingRegistration(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applyRegistration, engineUrl, resetRegistrationState, roomId]);

  const handleJoined = useCallback(
    (nextUserId: string, nextUsername: string) => {
      applyRegistration(nextUserId, nextUsername);
    },
    [applyRegistration]
  );

  return {
    userId,
    username,
    isRegistered,
    isCheckingRegistration,
    handleJoined,
    resetRegistrationState,
  };
}
