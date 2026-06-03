"use client";

import { useCallback, useEffect, useState } from "react";
import { PLAYER_NAME_KEY } from "@/components/mobile/YourScoreCard";
import {
  clearStoredPlayerIdentity,
  readStoredPlayerIdentity,
  saveStoredPlayerIdentity,
} from "@/lib/playerIdentity";

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
    setIsCheckingRegistration(true);

    fetch(`${engineUrl}/register/me?userId=${encodeURIComponent(storedUserId)}&roomId=${encodeURIComponent(roomId)}`)
      .then(async (res) => {
        if (cancelled) return;

        if (!res.ok) {
          resetRegistrationState();
          return;
        }

        const data = await res.json();
        applyRegistration(data.userId, data.username);
      })
      .catch(() => {
        if (cancelled) return;
        resetRegistrationState();
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
