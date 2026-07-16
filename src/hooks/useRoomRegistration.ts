"use client";

import { useCallback, useEffect, useState } from "react";
import { PLAYER_NAME_KEY } from "@/components/mobile/YourScoreCard";
import {
  clearStoredJoinToken,
  clearStoredPlayerIdentity,
  readStoredPlayerIdentity,
  saveStoredJoinToken,
  saveStoredPlayerIdentity,
} from "@/lib/playerIdentity";
import { getSavedIdentityDecision } from "@/lib/registrationRecovery";

type UseRoomRegistrationParams = { engineUrl: string | null; roomId: string | null };
type JoinResponse = { ok?: boolean; joinToken?: string; userId?: string; username?: string; reason?: string; error?: string };

export function useRoomRegistration({ engineUrl, roomId }: UseRoomRegistrationParams) {
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [joinToken, setJoinToken] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isCheckingRegistration, setIsCheckingRegistration] = useState(true);

  const resetRegistrationState = useCallback(() => {
    clearStoredPlayerIdentity(); localStorage.removeItem(PLAYER_NAME_KEY);
    setIsRegistered(false); setUserId(null); setUsername(null); setJoinToken(null);
  }, []);

  const applyRegistration = useCallback((nextUserId: string, nextUsername: string, nextJoinToken: string | null) => {
    saveStoredPlayerIdentity(nextUserId, nextUsername);
    if (nextJoinToken) saveStoredJoinToken(nextJoinToken); else clearStoredJoinToken();
    localStorage.setItem(PLAYER_NAME_KEY, nextUsername);
    setUserId(nextUserId); setUsername(nextUsername); setJoinToken(nextJoinToken);
    setIsRegistered(true); setIsCheckingRegistration(false);
  }, []);

  useEffect(() => {
    if (!engineUrl || !roomId) { setIsRegistered(false); setUserId(null); setJoinToken(null); setIsCheckingRegistration(false); return; }
    const stored = readStoredPlayerIdentity();
    if (!stored.userId || !stored.username) { setIsRegistered(false); setUserId(null); setUsername(stored.username); setJoinToken(null); setIsCheckingRegistration(false); return; }

    let cancelled = false;
    setIsRegistered(false); setUserId(null); setUsername(stored.username); setJoinToken(null); setIsCheckingRegistration(true);

    const resumeLegacy = async () => {
      const response = await fetch(`${engineUrl}/register/me?userId=${encodeURIComponent(stored.userId!)}&roomId=${encodeURIComponent(roomId)}`);
      const data = await response.json().catch(() => ({})) as JoinResponse;
      if (cancelled) return;
      const decision = getSavedIdentityDecision({ ok: response.ok, status: response.status, reason: data.reason });
      if (decision === "resume" && data.userId && data.username) { applyRegistration(data.userId, data.username, null); return; }
      if (decision === "clear_identity") { resetRegistrationState(); return; }
      setIsRegistered(false); setUserId(null); setUsername(stored.username); setJoinToken(null);
    };

    const resume = async () => {
      if (!stored.joinToken) { await resumeLegacy(); return; }
      const response = await fetch(`${engineUrl}/rooms/${encodeURIComponent(roomId)}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${stored.joinToken}` },
        body: JSON.stringify({ userId: stored.userId }),
      });
      const data = await response.json().catch(() => ({})) as JoinResponse;
      if (cancelled) return;
      if (response.ok) { applyRegistration(stored.userId!, data.username || stored.username!, data.joinToken || stored.joinToken); return; }
      if ([404, 405].includes(response.status)) { await resumeLegacy(); return; }
      if (response.status === 401 || data.reason === "not_registered") { resetRegistrationState(); return; }
      setIsRegistered(false); setUserId(null); setJoinToken(null);
    };

    void resume().catch(() => { if (!cancelled) { setIsRegistered(false); setUserId(null); setUsername(stored.username); setJoinToken(null); } }).finally(() => { if (!cancelled) setIsCheckingRegistration(false); });
    return () => { cancelled = true; };
  }, [applyRegistration, engineUrl, resetRegistrationState, roomId]);

  const handleJoined = useCallback((nextUserId: string, nextUsername: string, nextJoinToken?: string | null) => { applyRegistration(nextUserId, nextUsername, nextJoinToken ?? null); }, [applyRegistration]);
  return { userId, username, joinToken, isRegistered, isCheckingRegistration, handleJoined, resetRegistrationState };
}
