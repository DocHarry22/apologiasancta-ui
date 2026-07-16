"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { JoinGameModal } from "@/components/mobile/JoinGameModal";
import { RoomSelectionModal } from "@/components/mobile/RoomSelectionModal";
import { getEngineUrl } from "@/lib/publicEnv";
import { isNativePlatform } from "@/lib/native";
import {
  readStoredPlayerIdentity,
  readStoredRoomSelection,
  saveStoredRoomSelection,
} from "@/lib/playerIdentity";
import type { RoomSummary } from "@/types/quiz";

export function useQuizEntryGate() {
  const pathname = usePathname();
  const router = useRouter();
  const engineUrl = useMemo(() => getEngineUrl(), []);

  const [isRoomPickerOpen, setIsRoomPickerOpen] = useState(false);
  const [pendingRoomId, setPendingRoomId] = useState<string | null>(null);
  const [pendingRoomName, setPendingRoomName] = useState<string | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);

  useEffect(() => {
    setCurrentRoomId(readStoredRoomSelection().roomId);
  }, [pathname]);

  const closeOnboarding = useCallback(() => {
    setIsRoomPickerOpen(false);
    setPendingRoomId(null);
    setPendingRoomName(null);
  }, []);

  const openJoinForStoredRoom = useCallback(() => {
    const { roomId: storedRoomId, roomName: storedRoomName } = readStoredRoomSelection();
    if (!storedRoomId) {
      setIsRoomPickerOpen(true);
      return;
    }

    setPendingRoomId(storedRoomId);
    setPendingRoomName(storedRoomName || storedRoomId);
  }, []);

  const requestQuizEntry = useCallback(() => {
    if (pathname === "/mobile") {
      return;
    }

    if (!isNativePlatform() || !engineUrl) {
      router.push("/mobile");
      return;
    }

    const { roomId: storedRoomId } = readStoredRoomSelection();
    const { userId: storedUserId, username: storedUsername } = readStoredPlayerIdentity();

    if (storedRoomId && storedUserId && storedUsername) {
      router.push(`/mobile?roomId=${encodeURIComponent(storedRoomId)}`);
      return;
    }

    openJoinForStoredRoom();
  }, [engineUrl, openJoinForStoredRoom, pathname, router]);

  const handleRoomSelected = useCallback((room: RoomSummary) => {
    saveStoredRoomSelection(room.roomId, room.name);
    setCurrentRoomId(room.roomId);
    setIsRoomPickerOpen(false);
    setPendingRoomId(room.roomId);
    setPendingRoomName(room.name);
  }, []);

  const handleJoined = useCallback(
    () => {
      if (!pendingRoomId) {
        closeOnboarding();
        router.push("/mobile");
        return;
      }

      const roomParam = encodeURIComponent(pendingRoomId);
      closeOnboarding();
      router.push(`/mobile?roomId=${roomParam}`);
    },
    [closeOnboarding, pendingRoomId, router]
  );

  const onboardingModals = (
    <>
      {isRoomPickerOpen && engineUrl ? (
        <RoomSelectionModal
          engineUrl={engineUrl}
          onSelected={handleRoomSelected}
          currentRoomId={currentRoomId}
          onClose={closeOnboarding}
        />
      ) : null}

      {pendingRoomId ? (
        <JoinGameModal
          roomId={pendingRoomId}
          roomName={pendingRoomName}
          onJoined={handleJoined}
          onCancel={() => {
            setPendingRoomId(null);
            setPendingRoomName(null);
            setIsRoomPickerOpen(true);
          }}
        />
      ) : null}
    </>
  );

  return {
    requestQuizEntry,
    onboardingModals,
  };
}
