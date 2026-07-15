"use client";

import { useCallback, useEffect, useState } from "react";
import { PLAYER_NAME_KEY } from "@/components/mobile/YourScoreCard";
import {
  clearStoredPlayerIdentity,
  readStoredPlayerIdentity,
  saveStoredJoinToken,
  saveStoredPlayerIdentity,
} from "@/lib/playerIdentity";

type UseRoomRegistrationParams = {
  engineUrl: string | null;
  roomId: string | null;
};

type JoinResponse = {
  ok?: boolean;
  joinToken?: string;
  userId?: string;
  username?: string;
  reason?: string;
  error?: string;
};

export function useRoomRegistration({ engineUrl, roomId }: UseRoomRegistrationParams) {
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [joinToken, setJoinToken] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isCheckingRegistration, setIsCheckingRegistration] = useState(true);

  const resetRegistrationState = useCallback(() => {
    clearStoredPlayerIdentity();
    localStorage.removeItem(PLAYER_NAME_KEY);
    setIsRegistered(false);
    setUserId(null);
    setUsername(null);
    setJoinToken(null);
  }, []);

  const applyRegistration = useCallback((nextUserId: string, nextUsername: string, nextJoinToken: string) => {
    saveStoredPlayerIdentity(nextUserId, nextUsername);
    saveStoredJoinToken(nextJoinToken);
    localStorage.setItem(PLAYER_NAME_KEY, nextUsername);
    setUserId(nextUserId);
    setUsername(nextUsername);
    setJoinToken(nextJoinToken);
    setIsRegistered(true);
    setIsCheckingRegistration(false);
  }, []);

  useEffect(() => {
    if (!engineUrl || !roomId) {
      setIsRegistered(false);
      setUserId(null);
      setJoinToken(null);
      setIsCheckingRegistration(false);
      return;
    }

    const stored = readStoredPlayerIdentity();
    if (!stored.userId || !stored.username || !stored.joinToken) {
      setIsRegistered(false);
      setUserId(null);
      setUsername(stored.username);
      setJoinToken(null);
      setIsCheckingRegistration(false);
      return;
    }

    let cancelled = false;
    setIsRegistered(false);
    setUserId(null);
    setUsername(stored.username);
    setJoinToken(null);
    setIsCheckingRegistration(true);

    fetch(`${engineUrl}/rooms/${encodeURIComponent(roomId)}/join`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${stored.joinToken}`,
      },
      body: JSON.stringify({ userId: stored.userId }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({})) as JoinResponse;
        if (cancelled) return;

        if (response.ok && data.joinToken) {
          applyRegistration(stored.userId!, data.username || stored.username!, data.joinToken);
          return;
        }

        if (response.status === 401 || data.reason === "not_registered") {
          resetRegistrationState();
          return;
        }

        // Network and room availability failures do not prove the saved identity is invalid.
        setIsRegistered(false);
        setUserId(null);
        setJoinToken(null);
      })
      .catch(() => {
        if (cancelled) return;
        setIsRegistered(false);
        setUserId(null);
        setJoinToken(null);
      })
      .finally(() => {
        if (!cancelled) setIsCheckingRegistration(false);
      });

    return () => { cancelled = true; };
  }, [applyRegistration, engineUrl, resetRegistrationState, roomId]);

  const handleJoined = useCallback(
    (nextUserId: string, nextUsername: string, nextJoinToken: string) => {
      applyRegistration(nextUserId, nextUsername, nextJoinToken);
    },
    [applyRegistration]
  );

  return {
    userId,
    username,
    joinToken,
    isRegistered,
    isCheckingRegistration,
    handleJoined,
    resetRegistrationState,
  };
}
