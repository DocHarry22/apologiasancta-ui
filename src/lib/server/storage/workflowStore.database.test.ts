import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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

const databaseState = {
  items: new Map<string, WorkflowItem>(),
  itemUpdateTargets: [] as string[],
  revisions: [] as Array<{ id: string; workflowItemId: string }>,
  reviews: [] as Array<{ id: string; workflowItemId: string }>,
  events: [] as Array<{ id: string; workflowItemId: string }>,
};

function parsePayload(value: unknown): WorkflowItem {
  return JSON.parse(String(value)) as WorkflowItem;
}

const executor: WorkflowDatabaseExecutor = {
  dialect: "postgres",
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
    if (sql.includes("INSERT INTO content_workflow_revisions")) {
      databaseState.revisions.push({ id: String(values[0]), workflowItemId: String(values[1]) });
      return [];
    }
    if (sql.includes("INSERT INTO content_review_records")) {
      databaseState.reviews.push({ id: String(values[0]), workflowItemId: String(values[1]) });
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
  ...executor,
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
});
