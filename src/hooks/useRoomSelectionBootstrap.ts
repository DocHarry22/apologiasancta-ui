"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { sanitizeRoomIdParam } from "@/lib/mobileUx";
import { readStoredRoomSelection, saveStoredRoomSelection } from "@/lib/playerIdentity";

export function useRoomSelectionBootstrap(searchParams: ReadonlyURLSearchParams) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [roomNotice, setRoomNotice] = useState<string | null>(null);

  useEffect(() => {
    const queryRoomId = sanitizeRoomIdParam(searchParams.get("roomId") || searchParams.get("room"));
    const rawQueryRoomId = searchParams.get("roomId") || searchParams.get("room");

    if (rawQueryRoomId && !queryRoomId) {
      setRoomNotice("That room link is invalid. Choose a room from the list.");
    }

    const { roomId: savedRoomId, roomName: savedRoomName } = readStoredRoomSelection();
    const nextRoomId = queryRoomId || savedRoomId;
    const nextRoomName = queryRoomId ? queryRoomId : savedRoomName || nextRoomId;

    if (!nextRoomId) {
      return;
    }

    setRoomId(nextRoomId);
    setRoomName(nextRoomName);

    if (queryRoomId) {
      saveStoredRoomSelection(queryRoomId, queryRoomId);
      setRoomNotice(`Room link detected: ${queryRoomId}`);
    }
  }, [searchParams]);

  const applyRoomSelection = useCallback((nextRoomId: string, nextRoomName: string) => {
    setRoomId(nextRoomId);
    setRoomName(nextRoomName);
    setRoomNotice(null);
    saveStoredRoomSelection(nextRoomId, nextRoomName);
  }, []);

  return {
    roomId,
    setRoomId,
    roomName,
    setRoomName,
    roomNotice,
    setRoomNotice,
    applyRoomSelection,
  };
}
