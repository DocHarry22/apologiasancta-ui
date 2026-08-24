import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const accountDeletionPath = new URL("./accountDeletion.ts", import.meta.url);
const migrationPath = new URL("../../../supabase/migrations/20260824115000_account_deletion_context.sql", import.meta.url);

describe("Play Store learner account deletion policy", () => {
  it("uses a transaction-scoped account deletion context accepted by the unlock guard", async () => {
    const [implementation, migration] = await Promise.all([
      readFile(accountDeletionPath, "utf8"),
      readFile(migrationPath, "utf8"),
    ]);

    expect(implementation).toContain("set_config('app.maintenance_context', 'account_deletion', true)");
    expect(migration).toContain("'approved_data_repair', 'account_deletion'");
    expect(migration).toContain("private.prevent_ordinary_unlock_relock()");
  });

  it("removes restrictive Phase 2 attempt references before mastery attempts", async () => {
    const implementation = await readFile(accountDeletionPath, "utf8");
    const attemptDelete = implementation.indexOf("DELETE FROM public.mastery_attempts WHERE learner_id = $1");

    expect(attemptDelete).toBeGreaterThan(0);
    for (const table of [
      "question_exposures",
      "corrective_recommendations",
      "learner_node_mastery_evidence",
      "mastery_answers",
      "unlocks",
      "group_progress",
    ]) {
      const deletion = implementation.indexOf(`DELETE FROM public.${table}`);
      expect(deletion, `${table} must be deleted before mastery_attempts`).toBeGreaterThan(0);
      expect(deletion, `${table} must be deleted before mastery_attempts`).toBeLessThan(attemptDelete);
    }
  });
});
