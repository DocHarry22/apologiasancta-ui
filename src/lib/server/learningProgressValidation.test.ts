import { describe, expect, it } from "vitest";
import { validateLearningProgressSyncBody } from "./learningProgressValidation";

const now = Date.parse("2026-07-16T13:00:00.000Z");
const validBody = {
  baseRevision: 2,
  completedLessonIds: ["real-presence-eucharist"],
  practiceBest: 7,
  practiceAttemptsFloor: 3,
  clientUpdatedAt: "2026-07-16T12:00:00.000Z",
  practiceAttempts: [{
    id: "practice_event_00000001",
    kind: "practice_attempt",
    score: 7,
    occurredAt: "2026-07-16T12:00:00.000Z",
  }],
};

describe("learning progress API validation", () => {
  it("accepts and normalizes the documented contract", () => {
    const result = validateLearningProgressSyncBody(validBody, now);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.clientUpdatedAt).toBe("2026-07-16T12:00:00.000Z");
      expect(result.value.practiceAttempts).toHaveLength(1);
    }
  });

  it("rejects client-selected account identity and unknown lessons", () => {
    const result = validateLearningProgressSyncBody({
      ...validBody,
      accountId: "another-account",
      completedLessonIds: ["invented-lesson"],
    }, now);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain("Unknown field: accountId.");
      expect(result.errors).toContain("completedLessonIds contains an unknown lesson ID.");
    }
  });

  it("rejects duplicate mutation IDs and future timestamps", () => {
    const event = { ...validBody.practiceAttempts[0], occurredAt: "2026-07-17T12:00:00.000Z" };
    const result = validateLearningProgressSyncBody({
      ...validBody,
      practiceAttempts: [event, event],
    }, now);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((error) => error.includes("unique 16-80 character"))).toBe(true);
      expect(result.errors.some((error) => error.includes("five minutes from now"))).toBe(true);
    }
  });
});
