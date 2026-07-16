import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { REVIEW_ATTESTATION_STATEMENT } from "@/lib/editorialPolicy";
import type { Question } from "@/types/content";
import type { CurrentUser } from "../currentUser";
import type { WorkflowDatabase, WorkflowDatabaseExecutor } from "./workflowDatabase";
import type { WorkflowItem } from "./types";

const author: CurrentUser = {
  id: "database-author",
  displayName: "Database Author",
  role: "author",
  accountType: "staff",
  source: "transitional_env",
};

const reviewer: CurrentUser = {
  id: "database-reviewer",
  displayName: "Database Reviewer",
  role: "reviewer",
  accountType: "staff",
  source: "transitional_env",
};

const adminEditor: CurrentUser = {
  id: "database-admin-editor",
  displayName: "Database Admin Editor",
  role: "super_admin",
  accountType: "staff",
  source: "transitional_env",
};

const sourcedQuestion: Question = {
  id: "edt_0300",
  topicId: "trinity",
  difficulty: 2,
  question: "Which identifier belongs to the public question?",
  choices: { A: "edt_0300", B: "The workflow row ID", C: "The revision ID", D: "The event ID" },
  correctId: "A",
  teaching: {
    title: "Workflow and question identities are distinct",
    body: "The public question identifier may be edited while the internal workflow row identifier remains immutable.",
    refs: ["Matthew 28:19"],
  },
  tags: ["editorial-test"],
  sourceReferences: [{ kind: "scripture", citation: "Matthew 28:19", locator: "Gospel of Matthew" }],
};

const attestation = {
  doctrinalFidelityConfirmed: true as const,
  sourcesChecked: true as const,
  explanationSupported: true as const,
  charitableLanguageConfirmed: true as const,
  independentReviewConfirmed: true as const,
  statement: REVIEW_ATTESTATION_STATEMENT,
};

const databaseState = {
  items: new Map<string, WorkflowItem>(),
  itemUpdateTargets: [] as string[],
  revisions: [] as Array<{ id: string; workflowItemId: string }>,
  reviews: [] as Array<{
    id: string;
    workflowItemId: string;
    revisionId: string;
    contentHash: string;
    decision: string;
    createdAt: string;
  }>,
  events: [] as Array<{ id: string; workflowItemId: string }>,
};

let databaseDialect: "postgres" | "mysql" = "postgres";

function parsePayload(value: unknown): WorkflowItem {
  return JSON.parse(String(value)) as WorkflowItem;
}

const executor: WorkflowDatabaseExecutor = {
  get dialect(): "postgres" | "mysql" {
    return databaseDialect;
  },
  async query<Row extends Record<string, unknown>>(sql: string, values: unknown[] = []): Promise<Row[]> {
    if (sql.includes("INSERT INTO content_workflow_items")) {
      databaseState.items.set(String(values[0]), parsePayload(values[9]));
      return [];
    }
    if (sql.includes("UPDATE content_workflow_items SET")) {
      const targetId = String(values[10]);
      databaseState.itemUpdateTargets.push(targetId);
      if (databaseState.items.has(targetId)) databaseState.items.set(targetId, parsePayload(values[8]));
      return [];
    }
    if (sql.includes("SELECT payload FROM content_workflow_items WHERE id = ? OR question_id = ?")) {
      const lookup = String(values[0]);
      const direct = databaseState.items.get(lookup);
      const byQuestionId = [...databaseState.items.values()].find((item) => item.questionId === String(values[1]));
      const item = direct ?? byQuestionId;
      return (item ? [{ payload: item }] : []) as Row[];
    }
    if (sql.includes("SELECT id FROM content_workflow_items WHERE question_id_normalized")) {
      const normalizedQuestionId = String(values[0]);
      const excludedId = String(values[1]);
      const duplicate = [...databaseState.items.entries()].find(([id, item]) => (
        id !== excludedId && item.questionId.toLowerCase() === normalizedQuestionId
      ));
      return (duplicate ? [{ id: duplicate[0] }] : []) as Row[];
    }
    if (sql.includes("FROM content_review_records") && sql.includes("decision = ?")) {
      const workflowItemId = String(values[0]);
      const decision = String(values[1]);
      const latest = databaseState.reviews
        .filter((review) => review.workflowItemId === workflowItemId && review.decision === decision)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id))[0];
      return (latest ? [{
        id: latest.id,
        revision_id: latest.revisionId,
        content_hash: latest.contentHash,
        created_at: latest.createdAt,
      }] : []) as Row[];
    }
    if (sql.includes("INSERT INTO content_workflow_revisions")) {
      databaseState.revisions.push({ id: String(values[0]), workflowItemId: String(values[1]) });
      return [];
    }
    if (sql.includes("INSERT INTO content_review_records")) {
      databaseState.reviews.push({
        id: String(values[0]),
        workflowItemId: String(values[1]),
        revisionId: String(values[2]),
        contentHash: String(values[3]),
        decision: String(values[5]),
        createdAt: String(values[8]),
      });
      return [];
    }
    if (sql.includes("INSERT INTO content_workflow_events")) {
      databaseState.events.push({ id: String(values[0]), workflowItemId: String(values[1]) });
      return [];
    }
    return [];
  },
};

const database: WorkflowDatabase = {
  get dialect(): "postgres" | "mysql" {
    return databaseDialect;
  },
  query: executor.query,
  async transaction<T>(operation: (transactionExecutor: WorkflowDatabaseExecutor) => Promise<T>): Promise<T> {
    return operation(executor);
  },
};

let dataDirectory = "";
let workflow: typeof import("./workflowStore");
let previousDataDirectory: string | undefined;
let previousStorageDriver: string | undefined;

beforeAll(async () => {
  dataDirectory = await mkdtemp(path.join(tmpdir(), "apologia-editorial-db-"));
  previousDataDirectory = process.env.APP_DATA_DIR;
  previousStorageDriver = process.env.APP_STORAGE_DRIVER;
  process.env.APP_DATA_DIR = dataDirectory;
  process.env.APP_STORAGE_DRIVER = "file";
  vi.resetModules();
  vi.doMock("./workflowDatabase", () => ({
    databaseJsonCast: () => "?",
    ensureWorkflowDatabaseSchema: async () => undefined,
    getWorkflowDatabase: async () => database,
    parseWorkflowDatabaseJson: <T,>(value: unknown): T => (typeof value === "string" ? JSON.parse(value) : value) as T,
    workflowDatabaseEnabled: () => true,
  }));
  workflow = await import("./workflowStore");
});

beforeEach(() => {
  databaseDialect = "postgres";
  databaseState.items.clear();
  databaseState.itemUpdateTargets.length = 0;
  databaseState.revisions.length = 0;
  databaseState.reviews.length = 0;
  databaseState.events.length = 0;
});

afterAll(async () => {
  vi.doUnmock("./workflowDatabase");
  vi.resetModules();
  if (previousDataDirectory === undefined) delete process.env.APP_DATA_DIR;
  else process.env.APP_DATA_DIR = previousDataDirectory;
  if (previousStorageDriver === undefined) delete process.env.APP_STORAGE_DRIVER;
  else process.env.APP_STORAGE_DRIVER = previousStorageDriver;
  await rm(dataDirectory, { recursive: true, force: true });
});

describe("database-backed workflow edits", () => {
  it("updates a draft under its immutable workflow row ID", async () => {
    const draft = await workflow.createWorkflowDraft(sourcedQuestion, author, ["trinity"], [], false);
    const revisionCount = databaseState.revisions.length;
    const eventCount = databaseState.events.length;

    const updated = await workflow.updateWorkflowDraft(draft.id, {
      ...sourcedQuestion,
      id: "edt_0301",
      question: "Which identifier remains immutable when this public question is edited?",
    }, author, ["trinity"], []);

    expect(updated).toMatchObject({
      id: draft.id,
      questionId: "edt_0301",
      question: "Which identifier remains immutable when this public question is edited?",
      revisionNumber: 2,
    });
    expect(databaseState.itemUpdateTargets.at(-1)).toBe(draft.id);
    expect(databaseState.items.has("edt_0301")).toBe(false);
    expect(databaseState.revisions.slice(revisionCount)).toEqual([
      { id: updated.currentRevisionId, workflowItemId: draft.id },
    ]);
    expect(databaseState.events.slice(eventCount)).toHaveLength(1);
    expect(databaseState.events.at(-1)?.workflowItemId).toBe(draft.id);

    const reloaded = await workflow.getWorkflowItem(draft.id);
    expect(reloaded).toMatchObject({
      id: draft.id,
      questionId: "edt_0301",
      question: "Which identifier remains immutable when this public question is edited?",
      currentRevisionId: updated.currentRevisionId,
    });
  });

  it("keeps the same database row and foreign keys when editing changes-requested content", async () => {
    const submitted = await workflow.createWorkflowDraft(
      { ...sourcedQuestion, id: "edt_0400" },
      author,
      ["trinity"],
      [],
      true
    );
    const changesRequested = await workflow.transitionWorkflowItem(submitted.id, "changes_requested", reviewer, {
      comment: "Please make the distinction between public and internal identifiers clearer.",
      topicIds: ["trinity"],
    });
    expect(changesRequested.status).toBe("changes_requested");
    const revisionCount = databaseState.revisions.length;
    const eventCount = databaseState.events.length;

    const updated = await workflow.updateWorkflowDraft(changesRequested.id, {
      ...sourcedQuestion,
      id: "edt_0401",
      question: "Which identifier is safe for learners and Engine consumers to see?",
    }, author, ["trinity"], []);

    expect(updated).toMatchObject({
      id: submitted.id,
      questionId: "edt_0401",
      status: "changes_requested",
      question: "Which identifier is safe for learners and Engine consumers to see?",
      revisionNumber: 2,
    });
    expect(databaseState.itemUpdateTargets.at(-1)).toBe(submitted.id);
    expect(databaseState.revisions.slice(revisionCount)).toEqual([
      { id: updated.currentRevisionId, workflowItemId: submitted.id },
    ]);
    expect(databaseState.events.slice(eventCount)).toHaveLength(1);
    expect(databaseState.events.at(-1)?.workflowItemId).toBe(submitted.id);

    const reloaded = await workflow.getWorkflowItem(submitted.id);
    expect(reloaded).toMatchObject({
      id: submitted.id,
      questionId: "edt_0401",
      status: "changes_requested",
      question: "Which identifier is safe for learners and Engine consumers to see?",
      currentRevisionId: updated.currentRevisionId,
    });
  });

  it.each(["postgres", "mysql"] as const)(
    "rejects an unchanged changes-requested revision after a %s reload and accepts a changed revision",
    async (dialect) => {
      databaseDialect = dialect;
      const submitted = await workflow.createWorkflowDraft(
        { ...sourcedQuestion, id: `edt_${dialect === "postgres" ? "0500" : "0501"}` },
        author,
        ["trinity"],
        [],
        true
      );
      const changesRequested = await workflow.transitionWorkflowItem(submitted.id, "changes_requested", reviewer, {
        comment: "Please replace the unsupported explanation with one tied to the cited primary source.",
        referenceFlag: true,
        topicIds: ["trinity"],
      });
      const flaggedReview = changesRequested.reviewComments.at(-1)!;
      const reviewRowsBeforeRetry = databaseState.reviews.length;
      const eventRowsBeforeRetry = databaseState.events.length;
      const updateRowsBeforeRetry = databaseState.itemUpdateTargets.length;

      expect(databaseState.reviews.at(-1)).toMatchObject({
        workflowItemId: submitted.id,
        revisionId: submitted.currentRevisionId,
        contentHash: submitted.contentHash,
        decision: "changes_requested",
      });

      const reloadedChangesRequest = await workflow.getWorkflowItem(submitted.id);
      expect(reloadedChangesRequest).toMatchObject({
        id: submitted.id,
        status: "changes_requested",
        changesRequestedRevisionId: submitted.currentRevisionId,
        changesRequestedContentHash: submitted.contentHash,
      });
      await expect(workflow.transitionWorkflowItem(submitted.id, "submitted", author, { topicIds: ["trinity"] }))
        .rejects.toThrow("new immutable revision with changed content");

      expect(databaseState.reviews).toHaveLength(reviewRowsBeforeRetry);
      expect(databaseState.events).toHaveLength(eventRowsBeforeRetry);
      expect(databaseState.itemUpdateTargets).toHaveLength(updateRowsBeforeRetry);
      const stillChangesRequested = await workflow.getWorkflowItem(submitted.id);
      expect(stillChangesRequested?.status).toBe("changes_requested");
      expect(stillChangesRequested?.reviewComments.at(-1)).toEqual(flaggedReview);

      const revised = await workflow.updateWorkflowDraft(submitted.id, {
        ...sourcedQuestion,
        id: `edt_${dialect === "postgres" ? "0500" : "0501"}`,
        teaching: {
          ...sourcedQuestion.teaching,
          body: "The public identifier is stored separately from internal row, revision, and event identifiers, as the cited source supports.",
        },
      }, author, ["trinity"], []);
      expect(revised.currentRevisionId).not.toBe(submitted.currentRevisionId);
      expect(revised.contentHash).not.toBe(submitted.contentHash);
      expect(revised.reviewComments.at(-1)).toEqual(flaggedReview);

      const reloadedRevision = await workflow.getWorkflowItem(submitted.id);
      expect(reloadedRevision).toMatchObject({
        id: submitted.id,
        status: "changes_requested",
        currentRevisionId: revised.currentRevisionId,
        contentHash: revised.contentHash,
        changesRequestedRevisionId: submitted.currentRevisionId,
        changesRequestedContentHash: submitted.contentHash,
      });

      const resubmitted = await workflow.transitionWorkflowItem(submitted.id, "submitted", author, { topicIds: ["trinity"] });
      expect(resubmitted).toMatchObject({
        status: "submitted",
        currentRevisionId: revised.currentRevisionId,
        contentHash: revised.contentHash,
      });
      expect(resubmitted.reviewComments.at(-1)).toEqual(flaggedReview);
      expect(resubmitted.referenceFlags).toContain(reviewer.id);
    }
  );

  it.each(["postgres", "mysql"] as const)(
    "persists the current revision creator and rejects their self-review after a %s reload",
    async (dialect) => {
      databaseDialect = dialect;
      const questionId = `edt_${dialect === "postgres" ? "0600" : "0601"}`;
      const submitted = await workflow.createWorkflowDraft(
        { ...sourcedQuestion, id: questionId },
        author,
        ["trinity"],
        [],
        true
      );
      const changesRequested = await workflow.transitionWorkflowItem(submitted.id, "changes_requested", reviewer, {
        comment: "An administrator may revise this content, but cannot independently review that same revision.",
        topicIds: ["trinity"],
      });
      const adminRevision = await workflow.updateWorkflowDraft(changesRequested.id, {
        ...sourcedQuestion,
        id: questionId,
        teaching: {
          ...sourcedQuestion.teaching,
          body: "This administrator-authored revision must retain its creator identity across the database reload boundary.",
        },
      }, adminEditor, ["trinity"], []);
      await workflow.transitionWorkflowItem(adminRevision.id, "submitted", adminEditor, { topicIds: ["trinity"] });

      const reloaded = await workflow.getWorkflowItem(adminRevision.id);
      expect(reloaded?.revisions.find((revision) => revision.id === adminRevision.currentRevisionId)?.createdBy)
        .toBe(adminEditor.id);
      await expect(workflow.transitionWorkflowItem(adminRevision.id, "approved", adminEditor, {
        comment: "The revision creator must not be able to approve this exact immutable revision.",
        attestation,
        topicIds: ["trinity"],
      })).rejects.toThrow("cannot review or approve their own revision");

      const approved = await workflow.transitionWorkflowItem(adminRevision.id, "approved", reviewer, {
        comment: "A different reviewer independently checked the exact administrator-authored revision.",
        attestation,
        topicIds: ["trinity"],
      });
      expect(approved.reviewerId).toBe(reviewer.id);
      expect((await workflow.getWorkflowItem(approved.id))?.reviewerId).toBe(reviewer.id);
    }
  );

  it.each(["postgres", "mysql"] as const)(
    "fails closed when the %s projection omits its append-only requested-change review",
    async (dialect) => {
      databaseDialect = dialect;
      const submitted = await workflow.createWorkflowDraft(
        { ...sourcedQuestion, id: `edt_${dialect === "postgres" ? "0700" : "0701"}` },
        author,
        ["trinity"],
        [],
        true
      );
      const changesRequested = await workflow.transitionWorkflowItem(submitted.id, "changes_requested", reviewer, {
        comment: "This append-only review must agree with the authoritative workflow projection after reload.",
        topicIds: ["trinity"],
      });
      const persisted = databaseState.items.get(changesRequested.id)!;
      databaseState.items.set(changesRequested.id, { ...persisted, reviewComments: [] });

      const reloaded = await workflow.getWorkflowItem(changesRequested.id);
      expect(reloaded?.changesRequestedEvidenceConflict).toBe(true);
      await expect(workflow.transitionWorkflowItem(changesRequested.id, "submitted", author, { topicIds: ["trinity"] }))
        .rejects.toThrow("audit evidence is inconsistent");
      expect(databaseState.reviews.at(-1)).toMatchObject({
        workflowItemId: changesRequested.id,
        revisionId: submitted.currentRevisionId,
        contentHash: submitted.contentHash,
        decision: "changes_requested",
      });
    }
  );
});
