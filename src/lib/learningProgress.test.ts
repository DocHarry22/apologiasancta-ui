import { describe, expect, it } from "vitest";
import {
  mergeRemoteLearningProgress,
  parseLearningProgress,
  recordPracticeAttempt,
} from "./learningProgress";

describe("learning progress v1 migration", () => {
  it("preserves every legacy aggregate and establishes an attempt floor", () => {
    const progress = parseLearningProgress(JSON.stringify({
      completedLessonIds: ["one", "two", "one"],
      practiceBest: 6,
      practiceAttempts: 4,
      updatedAt: 1_700_000_000_000,
    }));

    expect(progress.completedLessonIds).toEqual(["one", "two"]);
    expect(progress.practiceBest).toBe(6);
    expect(progress.practiceAttempts).toBe(4);
    expect(progress.sync.practiceAttemptsFloor).toBe(4);
    expect(progress.sync.pendingPracticeAttempts).toEqual([]);
  });

  it("queues a stable practice event before changing the local aggregate", () => {
    const progress = recordPracticeAttempt(parseLearningProgress(null), 7, {
      id: "practice_event_00000001",
      occurredAt: "2026-07-16T12:00:00.000Z",
    });

    expect(progress.practiceBest).toBe(7);
    expect(progress.practiceAttempts).toBe(1);
    expect(progress.sync.practiceAttemptsFloor).toBe(0);
    expect(progress.sync.pendingPracticeAttempts).toEqual([{
      id: "practice_event_00000001",
      kind: "practice_attempt",
      score: 7,
      occurredAt: "2026-07-16T12:00:00.000Z",
    }]);
  });

  it("merges monotonically and clears only acknowledged events", () => {
    const first = recordPracticeAttempt(parseLearningProgress(JSON.stringify({
      completedLessonIds: ["local-lesson"],
      practiceBest: 5,
      practiceAttempts: 2,
    })), 6, { id: "practice_event_00000001", occurredAt: "2026-07-16T12:00:00.000Z" });
    const local = recordPracticeAttempt(first, 4, {
      id: "practice_event_00000002",
      occurredAt: "2026-07-16T12:01:00.000Z",
    });

    const merged = mergeRemoteLearningProgress(local, {
      completedLessonIds: ["cloud-lesson"],
      practiceBest: 7,
      practiceAttempts: 10,
      revision: 9,
      updatedAt: "2026-07-16T12:02:00.000Z",
    }, ["practice_event_00000001"], "2026-07-16T12:03:00.000Z");

    expect(merged.completedLessonIds).toEqual(["local-lesson", "cloud-lesson"]);
    expect(merged.practiceBest).toBe(7);
    expect(merged.practiceAttempts).toBe(10);
    expect(merged.sync.revision).toBe(9);
    expect(merged.sync.pendingPracticeAttempts.map((event) => event.id)).toEqual(["practice_event_00000002"]);
  });
});
