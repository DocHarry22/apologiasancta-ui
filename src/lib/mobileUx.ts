import type { ConnectionStatus, QuizPhase } from "@/types/quiz";

export type MobileOnboardingState =
  | "engine_unavailable"
  | "no_room_selected"
  | "no_player_name"
  | "player_name_saved"
  | "room_selected_not_registered"
  | "registered_waiting"
  | "ready";

export type AnswerSubmissionState = "idle" | "submitting" | "submitted" | "error";
export type LeaderboardMode = "room-all-time" | "room-daily" | "room-weekly" | "global-all-time";
export type LeaderboardDrawerTab = "room" | "daily" | "weekly" | "global" | "streaks";

export function getLeaderboardTab(mode: LeaderboardMode): LeaderboardDrawerTab {
  if (mode === "global-all-time") return "global";
  if (mode === "room-daily") return "daily";
  if (mode === "room-weekly") return "weekly";
  return "room";
}

export function getLeaderboardMode(tab: LeaderboardDrawerTab): LeaderboardMode | null {
  if (tab === "global") return "global-all-time";
  if (tab === "daily") return "room-daily";
  if (tab === "weekly") return "room-weekly";
  if (tab === "room") return "room-all-time";
  return null;
}

export function sanitizeRoomIdParam(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(trimmed)) return null;
  return trimmed;
}

export function getMobileOnboardingState(input: {
  engineConfigured: boolean;
  roomId: string | null;
  playerName: string | null;
  isRegistered: boolean;
  phase: QuizPhase;
}): MobileOnboardingState {
  if (!input.engineConfigured) return "engine_unavailable";
  if (!input.roomId) return "no_room_selected";
  if (!input.playerName) return "no_player_name";
  if (!input.isRegistered) return "room_selected_not_registered";
  if (input.phase !== "OPEN") return "registered_waiting";
  return "ready";
}

export function getConnectionLabel(status: ConnectionStatus): string {
  if (status === "connected") return "Live";
  if (status === "reconnecting") return "Reconnecting";
  if (status === "polling") return "Polling";
  if (status === "connecting") return "Connecting";
  return "Offline";
}

export function getPhaseCopy(input: {
  phase: QuizPhase;
  hasTopicCountdown: boolean;
  hasTopicComplete: boolean;
  hasCongrats: boolean;
  connectionStatus: ConnectionStatus;
}): { title: string; detail: string } {
  if (input.connectionStatus === "disconnected") {
    return { title: "Engine unavailable", detail: "Keeping the last known quiz state while we retry." };
  }
  if (input.connectionStatus === "reconnecting") {
    return { title: "Reconnecting...", detail: "Your selected answer stays on this screen." };
  }
  if (input.connectionStatus === "polling") {
    return { title: "Polling", detail: "Live updates are using a fallback connection." };
  }
  if (input.hasTopicCountdown) {
    return { title: "Topic countdown", detail: "Get ready. The next topic is about to begin." };
  }
  if (input.hasCongrats) {
    return { title: "Well done", detail: "Review the room results before the next topic." };
  }
  if (input.hasTopicComplete) {
    return { title: "Topic complete", detail: "The host may start the next topic soon." };
  }
  if (input.phase === "OPEN") {
    return { title: "Answer now", detail: "Choose one answer. Your selection locks immediately." };
  }
  if (input.phase === "LOCKED") {
    return { title: "Answers locked", detail: "Waiting for the host to reveal the answer." };
  }
  return { title: "Answer revealed", detail: "Check the teaching moment and your points." };
}

export function isAnswerInteractionDisabled(
  phase: QuizPhase,
  selectedId: string | undefined,
  submissionState: AnswerSubmissionState
): boolean {
  if (phase !== "OPEN") return true;
  if (submissionState === "submitting" || submissionState === "submitted") return true;
  return Boolean(selectedId);
}
