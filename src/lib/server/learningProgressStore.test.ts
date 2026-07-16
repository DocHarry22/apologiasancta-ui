import { describe, expect, it } from "vitest";
import type { LearningProgressSyncInput } from "@/lib/learningProgressContract";
import { getLearningProgressMigrationStatements } from "./learningProgressSchema";
import { getLearningProgressAccountScope } from "./learningProgressAccountScope";
import { calculateLearningProgressMerge, isLearningCloudSyncConfigured } from "./learningProgressStore";

const input: LearningProgressSyncInput = {
  baseRevision: 3,
  completedLessonIds: ["real-presence-eucharist"],
  practiceBest: 6,
  practiceAttemptsFloor: 4,
  clientUpdatedAt: "2026-07-16T12:00:00.000Z",
  practiceAttempts: [{
    id: "practice_event_00000001",
    kind: "practice_attempt",
    score: 7,
    occurredAt: "2026-07-16T12:00:00.000Z",
  }],
};

describe("learning progress transactional merge", () => {
  it("derives stable opaque local archive scopes without exposing account IDs", () => {
    const first = getLearningProgressAccountScope("account-a-private-id");
    expect(first).toBe(getLearningProgressAccountScope("account-a-private-id"));
    expect(first).not.toBe(getLearningProgressAccountScope("account-b-private-id"));
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first).not.toContain("account-a-private-id");
  });

  it("adds a new event once, advances one revision, and reports stale merges", () => {
    const merged = calculateLearningProgressMerge({
      revision: 5,
      practiceBest: 5,
      practiceAttempts: 3,
      clientUpdatedAt: null,
      updatedAt: "2026-07-16T11:00:00.000Z",
    }, input, new Set(), true);

    expect(merged.conflictMerged).toBe(true);
    expect(merged.revision).toBe(6);
    expect(merged.practiceBest).toBe(7);
    expect(merged.practiceAttempts).toBe(5);
    expect(merged.newMutationIds).toEqual(["practice_event_00000001"]);
  });

  it("deduplicates a committed retry without inflating attempts", () => {
    const merged = calculateLearningProgressMerge({
      revision: 6,
      practiceBest: 7,
      practiceAttempts: 5,
      clientUpdatedAt: "2026-07-16T12:00:00.000Z",
      updatedAt: "2026-07-16T12:00:01.000Z",
    }, { ...input, baseRevision: 6 }, new Set(["practice_event_00000001"]), false);

    expect(merged.changed).toBe(false);
    expect(merged.revision).toBe(6);
    expect(merged.practiceAttempts).toBe(5);
    expect(merged.newMutationIds).toEqual([]);
  });

  it("ships repeatable, indexed, account-linked, timezone-aware DDL for both databases", () => {
    const postgres = getLearningProgressMigrationStatements("postgres").join("\n");
    const mysql = getLearningProgressMigrationStatements("mysql").join("\n");
    for (const ddl of [postgres, mysql]) {
      expect(ddl).toContain("REFERENCES admin_users(id) ON DELETE CASCADE");
      expect(ddl).toContain("idx_learning_lessons_account_updated");
      expect(ddl).toContain("idx_learning_mutations_account_applied");
      expect(ddl).toContain("2026071601_authenticated_learning_progress");
    }
    expect(postgres).toContain("TIMESTAMPTZ");
    expect(mysql).toContain("UTC_TIMESTAMP(3)");
  });

  it("requires both the explicit flag and a supported database", () => {
    expect(isLearningCloudSyncConfigured({
      LEARNING_CLOUD_SYNC_ENABLED: "true",
      DATABASE_URL: "postgresql://db.example/apologia",
    })).toBe(true);
    expect(isLearningCloudSyncConfigured({
      LEARNING_CLOUD_SYNC_ENABLED: "false",
      DATABASE_URL: "postgresql://db.example/apologia",
    })).toBe(false);
    expect(isLearningCloudSyncConfigured({ LEARNING_CLOUD_SYNC_ENABLED: "true", NODE_ENV: "production" })).toBe(false);
  });
});
