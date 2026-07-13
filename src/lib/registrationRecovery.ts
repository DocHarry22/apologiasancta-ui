export type SavedIdentityDecision = "resume" | "clear_identity" | "choose_room" | "retry";

export function getSavedIdentityDecision(input: {
  ok: boolean;
  status: number;
  reason?: string;
}): SavedIdentityDecision {
  if (input.ok) return "resume";
  if (input.status === 404 && input.reason === "not_registered") return "clear_identity";
  if (input.status === 404 || input.status === 409) return "choose_room";
  return "retry";
}

export function getReusableStoredUserId(
  storedUserId: string | null,
  storedUsername: string | null,
  requestedUsername: string
): string | undefined {
  if (!storedUserId || !storedUsername) return undefined;
  return storedUsername.trim().toLowerCase() === requestedUsername.trim().toLowerCase()
    ? storedUserId
    : undefined;
}
