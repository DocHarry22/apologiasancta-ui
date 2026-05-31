export type DangerousActionLevel = "destructive" | "very_destructive";

export interface DangerousActionDefinition {
  id: string;
  label: string;
  summary: string;
  consequences: string[];
  level: DangerousActionLevel;
  confirmationText?: string;
}

export function requiresTypedConfirmation(action: DangerousActionDefinition): boolean {
  return action.level === "very_destructive" && Boolean(action.confirmationText);
}

export function isDangerConfirmationValid(action: DangerousActionDefinition, value: string): boolean {
  if (!requiresTypedConfirmation(action)) {
    return true;
  }

  return value.trim() === action.confirmationText;
}

export const dangerousActions = {
  resetRoom: (roomName: string): DangerousActionDefinition => ({
    id: "reset-room",
    label: "Reset room",
    summary: `Reset ${roomName}.`,
    consequences: ["The active game state is reset.", "Players may lose current round context."],
    level: "destructive",
  }),
  closeRoom: (roomName: string): DangerousActionDefinition => ({
    id: "close-room",
    label: "Close room",
    summary: `Close ${roomName}.`,
    consequences: ["New live play stops for this room.", "Existing players can still view stale room state."],
    level: "destructive",
  }),
  clearContentBank: (): DangerousActionDefinition => ({
    id: "clear-content-bank",
    label: "Clear local content bank",
    summary: "Clear the engine's local content bank.",
    consequences: ["The active in-memory question bank is emptied.", "GitHub content is not deleted."],
    level: "destructive",
  }),
  clearGitHubContent: (): DangerousActionDefinition => ({
    id: "clear-github-content",
    label: "Clear GitHub content",
    summary: "Delete question files from the configured GitHub content store.",
    consequences: ["Question files are deleted from GitHub.", "This cannot be undone from the dashboard."],
    level: "very_destructive",
    confirmationText: "DELETE QUESTIONS",
  }),
  saveSequence: (): DangerousActionDefinition => ({
    id: "save-sequence",
    label: "Save sequence",
    summary: "Replace the current live topic sequence.",
    consequences: ["The live engine uses the new topic order.", "Current live operations may advance differently."],
    level: "destructive",
  }),
  skipTopic: (): DangerousActionDefinition => ({
    id: "skip-topic",
    label: "Skip topic",
    summary: "Skip the active topic.",
    consequences: ["The current topic is ended.", "Scores or streaks may reset depending on engine behavior."],
    level: "destructive",
  }),
  replayTopic: (): DangerousActionDefinition => ({
    id: "replay-topic",
    label: "Replay topic",
    summary: "Replay the current topic from the beginning.",
    consequences: ["The active topic restarts.", "Scores or streaks may reset depending on engine behavior."],
    level: "destructive",
  }),
};
