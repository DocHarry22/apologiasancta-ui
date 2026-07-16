export type AnswerRejectionReason =
  | "already_answered"
  | "too_late"
  | "locked"
  | "game_paused"
  | "not_started"
  | "not_registered"
  | "not_joined"
  | "join_token_expired"
  | "invalid_join_token"
  | "join_token_room_mismatch"
  | "join_token_user_mismatch"
  | string;

export function isAnswerWindowLocallyOpen(input: {
  phase: string;
  endsAtMs: number;
  nowMs?: number;
}): boolean {
  const nowMs = input.nowMs ?? Date.now();
  return input.phase === "OPEN" && input.endsAtMs > 0 && nowMs < input.endsAtMs;
}

export function getAnswerRejectionNotice(reason?: AnswerRejectionReason): string {
  if (reason === "already_answered") return "Already submitted for this question.";
  if (reason === "too_late" || reason === "locked") return "Answers locked. That answer was too late.";
  if (reason === "game_paused") return "The quiz is paused. Wait for the host to resume.";
  if (reason === "not_started") return "This round has not started yet.";
  if (reason === "not_registered") return "Join the game before submitting an answer.";
  if (reason === "not_joined") return "Rejoin this room before submitting an answer.";
  if (reason === "join_token_expired") return "Your room session expired. Rejoin to keep playing.";
  if (reason === "invalid_join_token" || reason === "join_token_room_mismatch" || reason === "join_token_user_mismatch") {
    return "Your room session changed. Rejoin the game to continue.";
  }
  return "Could not submit. Try again.";
}
