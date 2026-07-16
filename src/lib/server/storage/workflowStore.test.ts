import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { REVIEW_ATTESTATION_STATEMENT } from "@/lib/editorialPolicy";
import type { CurrentUser } from "../currentUser";
import type { Question } from "@/types/content";
import type { WorkflowDatabase, WorkflowDatabaseExecutor } from "./workflowDatabase";
import type { WorkflowFileState } from "./workflowStore";
import type { WorkflowHistoryEvent, WorkflowItem } from "./types";

const author: CurrentUser = {
  id: "author-1",
  displayName: "Author One",
  role: "author",
  accountType: "staff",
  source: "transitional_env",
};

const reviewer: CurrentUser = {
  id: "reviewer-1",
  displayName: "Reviewer One",
  role: "reviewer",
  accountType: "staff",
  source: "transitional_env",
};

const publisher: CurrentUser = {
  id: "publisher-1",
  displayName: "Publisher One",
  role: "super_admin",
  accountType: "staff",
  source: "transitional_env",
};

const attestation = {
  doctrinalFidelityConfirmed: true as const,
  sourcesChecked: true as const,
  explanationSupported: true as const,
  charitableLanguageConfirmed: true as const,
  independentReviewConfirmed: true as const,
  statement: REVIEW_ATTESTATION_STATEMENT,
};

const sourcedQuestion: Question = {
  id: "edt_0001",
  topicId: "trinity",
  difficulty: 2,
  question: "Which source is listed for this editorial workflow test?",
  choices: { A: "Matthew 28:19", B: "A blog", C: "No source", D: "An anonymous post" },
  correctId: "A",
  teaching: {
    title: "The exact revision carries its sources",
    body: "The workflow requires a substantive explanation tied to the exact reviewed revision.",
    refs: ["Matthew 28:19"],
  },
  tags: ["editorial-test"],
  sourceReferences: [{ kind: "scripture", citation: "Matthew 28:19", locator: "Gospel of Matthew" }],
};

let dataDirectory = "";

beforeAll(async () => {
  dataDirectory = await mkdtemp(path.join(tmpdir(), "apologia-editorial-"));
  process.env.APP_DATA_DIR = dataDirectory;
  process.env.APP_STORAGE_DRIVER = "file";
  vi.resetModules();
});

afterAll(async () => {
  delete process.env.APP_DATA_DIR;
  delete process.env.APP_STORAGE_DRIVER;
  await rm(dataDirectory, { recursive: true, force: true });
});

async function patchStoredWorkflowItem(id: string, patch: Partial<WorkflowItem>): Promise<void> {
  const filePath = path.join(dataDirectory, "editorial-workflow.json");
  const state = JSON.parse(await readFile(filePath, "utf8")) as WorkflowFileState;
  const index = state.items.findIndex((item) => item.id === id);
  if (index < 0) throw new Error(`Workflow test fixture ${id} was not found.`);
  state.items[index] = { ...state.items[index], ...patch };
  await writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

describe("guarded editorial workflow", () => {
  it("requires structured primary sources before submission", async () => {
    const workflow = await import("./workflowStore");
    await expect(workflow.createWorkflowDraft(
      { ...sourcedQuestion, id: "edt_0002", sourceReferences: [], teaching: { ...sourcedQuestion.teaching, refs: [] } },
      author,
      ["trinity"],
      [],
      true
    )).rejects.toThrow("structured source reference");
  });

  it("keeps invalid public IDs visible on drafts but blocks every submission path", async () => {
    const workflow = await import("./workflowStore");
    const invalidIds = ["", "invalid question id!"];

    for (const [index, questionId] of invalidIds.entries()) {
      const question = { ...sourcedQuestion, id: questionId };
      await expect(workflow.createWorkflowDraft(question, author, ["trinity"], [], true))
        .rejects.toThrow("blocking validation issues");

      const draft = await workflow.createWorkflowDraft(question, author, ["trinity"], [], false);
      expect(draft.status).toBe("draft");
      expect(draft.questionId).toBe(questionId);
      expect(draft.validationIssues).toContain(index === 0
        ? "Question ID is required."
        : "Question ID may only contain letters, numbers, underscores, and hyphens.");

      const storedDraft = await workflow.getWorkflowItem(draft.id);
      expect(storedDraft?.questionId).toBe(questionId);
      await expect(workflow.transitionWorkflowItem(draft.id, "submitted", author, { topicIds: ["trinity"] }))
        .rejects.toThrow("blocking validation issues");
    }
  });

  it("revalidates empty and malformed public IDs at approval and publication", async () => {
    const workflow = await import("./workflowStore");
    const invalidIds = ["", "invalid question id!"];

    for (const [index, questionId] of invalidIds.entries()) {
      const approvalCandidate = await workflow.createWorkflowDraft(
        { ...sourcedQuestion, id: `edt_01${index.toString().padStart(2, "0")}` },
        author,
        ["trinity"],
        [],
        true
      );
      await patchStoredWorkflowItem(approvalCandidate.id, { questionId });
      await expect(workflow.transitionWorkflowItem(approvalCandidate.id, "approved", reviewer, {
        comment: "The exact revision and primary citation were independently checked.",
        attestation,
        topicIds: ["trinity"],
      })).rejects.toThrow("blocking validation issues");

      const publicationCandidate = await workflow.createWorkflowDraft(
        { ...sourcedQuestion, id: `edt_02${index.toString().padStart(2, "0")}` },
        author,
        ["trinity"],
        [],
        true
      );
      const approved = await workflow.transitionWorkflowItem(publicationCandidate.id, "approved", reviewer, {
        comment: "The exact revision and primary citation were independently checked.",
        attestation,
        topicIds: ["trinity"],
      });
      await patchStoredWorkflowItem(approved.id, { questionId });
      await expect(workflow.prepareWorkflowPublication(approved.id, publisher, ["trinity"], []))
        .rejects.toThrow("blocking validation issues");
    }
  });

  it("blocks self-review and requires explicit independent attestation", async () => {
    const workflow = await import("./workflowStore");
    const draft = await workflow.createWorkflowDraft(sourcedQuestion, author, ["trinity"], [], true);

    await expect(workflow.transitionWorkflowItem(draft.id, "approved", author, {
      comment: "I checked this revision.",
      attestation,
      topicIds: ["trinity"],
    })).rejects.toThrow("cannot review or approve their own");

    await expect(workflow.transitionWorkflowItem(draft.id, "approved", reviewer, {
      comment: "Sources and explanation were checked.",
      topicIds: ["trinity"],
    })).rejects.toThrow("attestation is required");

    const approved = await workflow.transitionWorkflowItem(draft.id, "approved", reviewer, {
      comment: "Sources and explanation were checked against the cited passage.",
      attestation,
      topicIds: ["trinity"],
    });

    expect(approved.reviewerId).toBe(reviewer.id);
    expect(approved.reviewerId).not.toBe(approved.authorId);
    expect(approved.approvedRevisionId).toBe(approved.currentRevisionId);
    expect(approved.approvedContentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(approved.approvalAttestation?.independentReviewConfirmed).toBe(true);
  });

  it("retries one immutable publication through an idempotent outbox", async () => {
    const workflow = await import("./workflowStore");
    const draft = await workflow.createWorkflowDraft({ ...sourcedQuestion, id: "edt_0003" }, author, ["trinity"], [], true);
    const approved = await workflow.transitionWorkflowItem(draft.id, "approved", reviewer, {
      comment: "Sources and explanation were checked against the cited passage.",
      attestation,
      topicIds: ["trinity"],
    });

    const firstClaim = await workflow.prepareWorkflowPublication(approved.id, publisher, ["trinity"], []);
    expect(firstClaim.alreadyCompleted).toBe(false);
    expect(firstClaim.idempotencyKey).toContain(firstClaim.item.contentHash);

    await expect(workflow.prepareWorkflowPublication(approved.id, publisher, ["trinity"], []))
      .rejects.toThrow("already in progress");

    const failed = await workflow.failWorkflowPublication(firstClaim, publisher, "temporary engine failure");
    expect(failed.status).toBe("approved");

    const retryClaim = await workflow.prepareWorkflowPublication(approved.id, publisher, ["trinity"], []);
    expect(retryClaim.idempotencyKey).toBe(firstClaim.idempotencyKey);
    expect(retryClaim.question).toEqual(firstClaim.question);

    const published = await workflow.completeWorkflowPublication(retryClaim, publisher, { added: 1, updated: 0, bankSize: 1 });
    expect(published.status).toBe("published");
    expect(published.publishTarget).toBe("engine");

    const replay = await workflow.prepareWorkflowPublication(published.id, publisher, ["trinity"], []);
    expect(replay.alreadyCompleted).toBe(true);
    expect(replay.idempotencyKey).toBe(firstClaim.idempotencyKey);
  });

  it("idempotently reconciles file evidence without replacing newer database workflow state", async () => {
    const workflow = await import("./workflowStore");
    const draft = await workflow.createWorkflowDraft({ ...sourcedQuestion, id: "edt_0004" }, author, ["trinity"], [], false);
    const revised = await workflow.updateWorkflowDraft(draft.id, {
      ...sourcedQuestion,
      id: "edt_0004",
      teaching: { ...sourcedQuestion.teaching, body: "This second immutable revision retains its complete human review evidence." },
    }, author, ["trinity"], []);
    const submitted = await workflow.transitionWorkflowItem(revised.id, "submitted", author, { topicIds: ["trinity"] });
    const approved = await workflow.transitionWorkflowItem(submitted.id, "approved", reviewer, {
      comment: "The revised explanation and primary citation were independently checked.",
      attestation,
      topicIds: ["trinity"],
    });
    const firstClaim = await workflow.prepareWorkflowPublication(approved.id, publisher, ["trinity"], []);
    await workflow.failWorkflowPublication(firstClaim, publisher, "temporary migration-test failure");
    const retryClaim = await workflow.prepareWorkflowPublication(approved.id, publisher, ["trinity"], []);
    const published = await workflow.completeWorkflowPublication(retryClaim, publisher, { added: 1, updated: 0, bankSize: 4 });

    const fileState = JSON.parse(await readFile(path.join(dataDirectory, "editorial-workflow.json"), "utf8")) as WorkflowFileState;
    const sourceState: WorkflowFileState = {
      schemaVersion: 1,
      items: [published],
      outbox: fileState.outbox.filter((record) => record.workflowItemId === published.id),
    };
    expect(sourceState.items[0].revisions).toHaveLength(2);
    expect(sourceState.items[0].reviewComments).toHaveLength(1);
    expect(sourceState.outbox[0]).toMatchObject({ status: "completed", attempts: 2, engineResult: { bankSize: 4 } });

    const partialProjection = { ...published } as Record<string, unknown>;
    partialProjection.status = "approved";
    partialProjection.version = Math.max(1, published.version - 1);
    partialProjection.updatedAt = approved.updatedAt;
    delete partialProjection.publishedAt;
    delete partialProjection.publishTarget;
    delete partialProjection.reviewComments;
    delete partialProjection.history;

    const itemIds = new Map<string, string>([[published.id, published.id], ["already-in-db", "already-in-db"]]);
    const questionIds = new Map<string, string>([[published.questionId.toLowerCase(), published.id]]);
    const itemPayloads = new Map<string, unknown>([[published.id, partialProjection]]);
    const revisions = new Set<string>();
    const reviews = new Set<string>();
    const events = new Set<string>();
    const outbox = new Map<string, unknown[]>();
    const insertStatements: string[] = [];
    const executor: WorkflowDatabaseExecutor = {
      dialect: "postgres",
      async query<Row extends Record<string, unknown>>(sql: string, values: unknown[] = []): Promise<Row[]> {
        if (/^INSERT\s/i.test(sql)) insertStatements.push(sql);
        if (sql.includes("INSERT INTO content_workflow_items")) {
          const id = String(values[0]);
          const normalized = String(values[2]);
          if (!itemIds.has(id) && !questionIds.has(normalized)) {
            itemIds.set(id, id);
            questionIds.set(normalized, id);
            itemPayloads.set(id, JSON.parse(String(values[9])));
          }
          return [];
        }
        if (sql.includes("SELECT id, payload FROM content_workflow_items WHERE id")) {
          const id = itemIds.get(String(values[0]));
          return (id ? [{ id, payload: itemPayloads.get(id) }] : []) as Row[];
        }
        if (sql.includes("SELECT id, payload FROM content_workflow_items WHERE question_id_normalized")) {
          const id = questionIds.get(String(values[0]));
          return (id ? [{ id, payload: itemPayloads.get(id) }] : []) as Row[];
        }
        if (sql.includes("UPDATE content_workflow_items SET")) {
          itemPayloads.set(String(values[10]), JSON.parse(String(values[8])));
          return [];
        }
        if (sql.includes("INSERT INTO content_workflow_revisions")) revisions.add(String(values[0]));
        if (sql.includes("INSERT INTO content_review_records")) reviews.add(String(values[0]));
        if (sql.includes("INSERT INTO content_workflow_events")) events.add(String(values[0]));
        if (sql.includes("INSERT INTO content_publication_outbox")) outbox.set(String(values[0]), values);
        return [];
      },
    };
    const database: WorkflowDatabase = {
      ...executor,
      async transaction<T>(operation: (transactionExecutor: WorkflowDatabaseExecutor) => Promise<T>): Promise<T> {
        return operation(executor);
      },
    };

    await workflow.migrateWorkflowSourcesToDatabase(database, sourceState, []);
    const firstReconciledJson = JSON.stringify(itemPayloads.get(published.id));
    await workflow.migrateWorkflowSourcesToDatabase(database, sourceState, []);

    const reconciled = itemPayloads.get(published.id) as WorkflowItem;
    expect(JSON.stringify(reconciled)).toBe(firstReconciledJson);
    expect(reconciled).toMatchObject({
      status: "published",
      version: published.version,
      revisionNumber: published.revisionNumber,
      currentRevisionId: published.currentRevisionId,
      contentHash: published.contentHash,
      publishTarget: "engine",
    });
    expect(reconciled.revisions.map((revision) => revision.id)).toEqual(published.revisions.map((revision) => revision.id));
    expect(reconciled.reviewComments.map((review) => review.id)).toEqual(published.reviewComments.map((review) => review.id));
    expect(new Set(reconciled.history.map((event) => event.id))).toEqual(new Set(published.history.map((event) => event.id)));

    const newerTimestamp = new Date(Date.parse(published.updatedAt) + 60_000).toISOString();
    const databaseOnlyEvent: WorkflowHistoryEvent = {
      id: "wf_evt_database_only",
      type: "archived",
      actorId: publisher.id,
      actorName: publisher.displayName,
      actorRole: publisher.role,
      createdAt: newerTimestamp,
      summary: "Archived after the source file snapshot was created.",
    };
    const newerDatabaseProjection: WorkflowItem = {
      ...reconciled,
      status: "archived",
      version: published.version + 1,
      updatedAt: newerTimestamp,
      archivedAt: newerTimestamp,
      history: [databaseOnlyEvent, ...reconciled.history],
    };
    itemPayloads.set(published.id, newerDatabaseProjection);

    await workflow.migrateWorkflowSourcesToDatabase(database, sourceState, []);
    const preserved = itemPayloads.get(published.id) as WorkflowItem;
    expect(preserved).toMatchObject({
      status: "archived",
      version: newerDatabaseProjection.version,
      updatedAt: newerTimestamp,
      archivedAt: newerTimestamp,
      contentHash: newerDatabaseProjection.contentHash,
    });
    expect(preserved.history.some((event) => event.id === databaseOnlyEvent.id)).toBe(true);
    expect(published.history.every((event) => preserved.history.some((candidate) => candidate.id === event.id))).toBe(true);

    expect(itemIds.has("already-in-db")).toBe(true);
    expect(revisions.size).toBe(published.revisions.length);
    expect(reviews.size).toBe(published.reviewComments.length);
    expect(events.size).toBe(published.history.length + 1);
    expect(outbox.size).toBe(1);
    expect(insertStatements.length).toBeGreaterThan(0);
    expect(insertStatements.every((sql) => sql.endsWith("ON CONFLICT DO NOTHING"))).toBe(true);
    const migratedOutbox = outbox.get(sourceState.outbox[0].idempotencyKey)!;
    expect(migratedOutbox[4]).toBe("completed");
    expect(migratedOutbox[5]).toBe(2);
    expect(JSON.parse(String(migratedOutbox[8]))).toMatchObject({ bankSize: 4 });
  });
});
