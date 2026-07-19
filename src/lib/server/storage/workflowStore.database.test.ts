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
    reviewerId: string;
    decision: string;
    comment: string;
    attestation: unknown;
    createdAt: string;
  }>,
  events: [] as Array<{ id: string; workflowItemId: string }>,
  publicationClaims: [] as Array<{
    idempotencyKey: string;
    workflowItemId: string;
    revisionId: string;
    contentHash: string;
    status: "processing" | "failed" | "completed";
    attempts: number;
    leaseExpiresAt?: string;
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
    lastError?: string;
  }>,
  publicationCompletionUpdates: [] as string[],
  publicationFailureUpdates: [] as string[],
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
        reviewer_id: latest.reviewerId,
        comment: latest.comment,
        attestation: latest.attestation,
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
        reviewerId: String(values[4]),
        decision: String(values[5]),
        comment: String(values[6]),
        attestation: databaseDialect === "postgres" ? JSON.parse(String(values[7])) : values[7],
        createdAt: String(values[8]),
      });
      return [];
    }
    if (sql.includes("INSERT INTO content_publication_outbox")) {
      databaseState.publicationClaims.push({
        idempotencyKey: String(values[0]),
        workflowItemId: String(values[1]),
        revisionId: String(values[2]),
        contentHash: String(values[3]),
        status: values[4] as "processing",
        attempts: Number(values[5]),
        leaseExpiresAt: String(values[6]),
        createdAt: String(values[7]),
        updatedAt: String(values[8]),
      });
      return [];
    }
    if (sql.includes("SELECT * FROM content_publication_outbox")) {
      const claims = databaseState.publicationClaims.filter((record) => (
        record.idempotencyKey === String(values[0]) || record.workflowItemId === String(values[1])
      ));
      return claims.map((claim) => ({
        idempotency_key: claim.idempotencyKey,
        workflow_item_id: claim.workflowItemId,
        revision_id: claim.revisionId,
        content_hash: claim.contentHash,
        status: claim.status,
        attempts: claim.attempts,
        lease_expires_at: claim.leaseExpiresAt,
        created_at: claim.createdAt,
        updated_at: claim.updatedAt,
        completed_at: claim.completedAt,
      })) as Row[];
    }
    if (sql.includes("UPDATE content_publication_outbox SET status = ?")) {
      const claim = databaseState.publicationClaims.find((record) => record.idempotencyKey === String(values[3]));
      if (claim) {
        claim.status = values[0] as "processing";
        claim.attempts += 1;
        claim.leaseExpiresAt = String(values[1]);
        claim.updatedAt = String(values[2]);
      }
      return [];
    }
    if (sql.includes("UPDATE content_publication_outbox SET status = 'completed'")) {
      const idempotencyKey = String(values[3]);
      databaseState.publicationCompletionUpdates.push(idempotencyKey);
      const claim = databaseState.publicationClaims.find((record) => record.idempotencyKey === idempotencyKey);
      if (claim) {
        claim.status = "completed";
        claim.leaseExpiresAt = undefined;
        claim.completedAt = String(values[1]);
        claim.updatedAt = String(values[2]);
      }
      return [];
    }
    if (sql.includes("UPDATE content_publication_outbox SET status = 'failed'")) {
      const idempotencyKey = String(values[2]);
      databaseState.publicationFailureUpdates.push(idempotencyKey);
      const claim = databaseState.publicationClaims.find((record) => record.idempotencyKey === idempotencyKey);
      if (claim) {
        claim.status = "failed";
        claim.leaseExpiresAt = undefined;
        claim.lastError = String(values[0]);
        claim.updatedAt = String(values[1]);
      }
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
  databaseState.publicationClaims.length = 0;
  databaseState.publicationCompletionUpdates.length = 0;
  databaseState.publicationFailureUpdates.length = 0;
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

  it.each(["postgres", "mysql"] as const)(
    "requires exact append-only approval evidence before a %s publication claim",
    async (dialect) => {
      databaseDialect = dialect;
      const submitted = await workflow.createWorkflowDraft(
        { ...sourcedQuestion, id: `edt_${dialect === "postgres" ? "0800" : "0801"}` },
        author,
        ["trinity"],
        [],
        true
      );
      const approved = await workflow.transitionWorkflowItem(submitted.id, "approved", reviewer, {
        comment: "This exact immutable revision and its cited source were independently checked for publication.",
        attestation,
        topicIds: ["trinity"],
      });
      const approvalRow = databaseState.reviews.find((review) => review.decision === "approved")!;
      expect(approvalRow).toMatchObject({
        workflowItemId: approved.id,
        revisionId: approved.approvedRevisionId,
        contentHash: approved.approvedContentHash,
        reviewerId: reviewer.id,
        comment: "This exact immutable revision and its cited source were independently checked for publication.",
      });

      databaseState.items.set(approved.id, {
        ...approved,
        reviewerId: adminEditor.id,
        reviewerName: adminEditor.displayName,
      });
      await expect(workflow.prepareWorkflowPublication(approved.id, adminEditor, ["trinity"], []))
        .rejects.toThrow("approval audit evidence is missing or inconsistent");
      expect(databaseState.publicationClaims).toHaveLength(0);

      databaseState.items.set(approved.id, approved);
      approvalRow.contentHash = "f".repeat(64);
      await expect(workflow.prepareWorkflowPublication(approved.id, adminEditor, ["trinity"], []))
        .rejects.toThrow("approval audit evidence is missing or inconsistent");
      expect(databaseState.publicationClaims).toHaveLength(0);

      approvalRow.contentHash = approved.approvedContentHash!;
      approvalRow.reviewerId = adminEditor.id;
      await expect(workflow.prepareWorkflowPublication(approved.id, adminEditor, ["trinity"], []))
        .rejects.toThrow("approval audit evidence is missing or inconsistent");
      expect(databaseState.publicationClaims).toHaveLength(0);

      approvalRow.reviewerId = reviewer.id;
      approvalRow.comment = "A different database approval comment.";
      await expect(workflow.prepareWorkflowPublication(approved.id, adminEditor, ["trinity"], []))
        .rejects.toThrow("approval audit evidence is missing or inconsistent");
      expect(databaseState.publicationClaims).toHaveLength(0);

      approvalRow.comment = approved.reviewComments.find((review) => review.decision === "approved")!.body;
      const validDatabaseAttestation = approvalRow.attestation;
      approvalRow.attestation = databaseDialect === "postgres"
        ? { ...attestation, sourcesChecked: false }
        : JSON.stringify({ ...attestation, sourcesChecked: false });
      await expect(workflow.prepareWorkflowPublication(approved.id, adminEditor, ["trinity"], []))
        .rejects.toThrow("approval audit evidence is missing or inconsistent");
      expect(databaseState.publicationClaims).toHaveLength(0);

      approvalRow.attestation = validDatabaseAttestation;
      databaseState.reviews.splice(databaseState.reviews.indexOf(approvalRow), 1);
      await expect(workflow.prepareWorkflowPublication(approved.id, adminEditor, ["trinity"], []))
        .rejects.toThrow("approval audit evidence is missing or inconsistent");
      expect(databaseState.publicationClaims).toHaveLength(0);

      databaseState.reviews.push(approvalRow);
      const claim = await workflow.prepareWorkflowPublication(approved.id, adminEditor, ["trinity"], []);
      expect(claim).toMatchObject({
        alreadyCompleted: false,
        idempotencyKey: `publish:${approved.id}:${approved.approvedRevisionId}:${approved.approvedContentHash}`,
      });
      expect(databaseState.publicationClaims).toHaveLength(1);
      expect(databaseState.publicationClaims[0]).toMatchObject({
        idempotencyKey: claim.idempotencyKey,
        workflowItemId: approved.id,
        revisionId: approved.approvedRevisionId,
        contentHash: approved.approvedContentHash,
        status: "processing",
      });

      const claimedProjection = databaseState.items.get(approved.id)!;
      await expect(workflow.completeWorkflowPublication(
        { ...claim, idempotencyKey: "publish:wrong-claim-key" },
        adminEditor,
        { added: 1, updated: 0, bankSize: 1 }
      )).rejects.toThrow("Publication claim evidence is missing or inconsistent");
      expect(databaseState.publicationCompletionUpdates).toHaveLength(0);

      databaseState.items.set(approved.id, { ...claimedProjection, publicationIdempotencyKey: undefined });
      await expect(workflow.completeWorkflowPublication(claim, adminEditor, { added: 1, updated: 0, bankSize: 1 }))
        .rejects.toThrow("Publication claim evidence is missing or inconsistent");
      expect(databaseState.publicationCompletionUpdates).toHaveLength(0);

      databaseState.items.set(approved.id, {
        ...claimedProjection,
        currentRevisionId: "wf_rev_corrupted_after_claim",
      });
      await expect(workflow.completeWorkflowPublication(claim, adminEditor, { added: 1, updated: 0, bankSize: 1 }))
        .rejects.toThrow("Approved revision does not match the current immutable revision");
      expect(databaseState.publicationCompletionUpdates).toHaveLength(0);

      for (const invalidCreator of [undefined, ""] as const) {
        databaseState.items.set(approved.id, {
          ...claimedProjection,
          revisions: claimedProjection.revisions.map((revision) => (
            revision.id === claimedProjection.currentRevisionId
              ? { ...revision, createdBy: invalidCreator as unknown as string }
              : revision
          )),
        });
        await expect(workflow.completeWorkflowPublication(claim, adminEditor, { added: 1, updated: 0, bankSize: 1 }))
          .rejects.toThrow("known author for the approved revision");
        expect(databaseState.publicationCompletionUpdates).toHaveLength(0);
        expect(databaseState.items.get(approved.id)?.status).toBe("approved");
      }

      databaseState.items.set(approved.id, {
        ...claimedProjection,
        contentHash: "e".repeat(64),
      });
      await expect(workflow.completeWorkflowPublication(claim, adminEditor, { added: 1, updated: 0, bankSize: 1 }))
        .rejects.toThrow("Approved revision does not match the current immutable revision");
      expect(databaseState.publicationCompletionUpdates).toHaveLength(0);

      databaseState.items.set(approved.id, {
        ...claimedProjection,
        revisions: claimedProjection.revisions.map((revision) => (
          revision.id === claimedProjection.currentRevisionId ? { ...revision, createdBy: reviewer.id } : revision
        )),
      });
      await expect(workflow.completeWorkflowPublication(claim, adminEditor, { added: 1, updated: 0, bankSize: 1 }))
        .rejects.toThrow("reviewer independent from the approved revision's author");
      expect(databaseState.publicationCompletionUpdates).toHaveLength(0);

      databaseState.items.set(approved.id, {
        ...claimedProjection,
        revisions: claimedProjection.revisions.map((revision) => (
          revision.id === claimedProjection.currentRevisionId
            ? { ...revision, question: { ...revision.question, question: "Corrupted after publication claim." } }
            : revision
        )),
      });
      await expect(workflow.completeWorkflowPublication(claim, adminEditor, { added: 1, updated: 0, bankSize: 1 }))
        .rejects.toThrow("Approved revision content hash verification failed");
      expect(databaseState.publicationCompletionUpdates).toHaveLength(0);
      expect(databaseState.items.get(approved.id)?.status).toBe("approved");

      databaseState.items.set(approved.id, {
        ...claimedProjection,
        question: "Corrupted mutable workflow projection after publication claim.",
      });
      await expect(workflow.completeWorkflowPublication(claim, adminEditor, { added: 1, updated: 0, bankSize: 1 }))
        .rejects.toThrow("Current workflow projection no longer matches the approved revision");
      expect(databaseState.publicationCompletionUpdates).toHaveLength(0);

      databaseState.items.set(approved.id, { ...claimedProjection, revisions: [] });
      await expect(workflow.completeWorkflowPublication(claim, adminEditor, { added: 1, updated: 0, bankSize: 1 }))
        .rejects.toThrow("Approved revision snapshot is unavailable or invalid");
      expect(databaseState.publicationCompletionUpdates).toHaveLength(0);

      databaseState.items.set(approved.id, claimedProjection);
      const claimedOutbox = databaseState.publicationClaims[0];
      claimedOutbox.revisionId = "wf_rev_corrupted_outbox";
      claimedOutbox.contentHash = "d".repeat(64);
      await expect(workflow.completeWorkflowPublication(claim, adminEditor, { added: 1, updated: 0, bankSize: 1 }))
        .rejects.toThrow("Publication outbox evidence is missing or inconsistent");
      expect(databaseState.publicationCompletionUpdates).toHaveLength(0);

      claimedOutbox.revisionId = approved.approvedRevisionId!;
      claimedOutbox.contentHash = approved.approvedContentHash!;
      claimedOutbox.workflowItemId = "wf_corrupted_outbox_owner";
      await expect(workflow.completeWorkflowPublication(claim, adminEditor, { added: 1, updated: 0, bankSize: 1 }))
        .rejects.toThrow("Publication outbox evidence is missing or inconsistent");
      expect(databaseState.publicationCompletionUpdates).toHaveLength(0);

      claimedOutbox.workflowItemId = approved.id;
      claimedOutbox.idempotencyKey = "publish:corrupted-outbox-key";
      await expect(workflow.completeWorkflowPublication(claim, adminEditor, { added: 1, updated: 0, bankSize: 1 }))
        .rejects.toThrow("Publication outbox evidence is missing or inconsistent");
      expect(databaseState.publicationCompletionUpdates).toHaveLength(0);

      claimedOutbox.idempotencyKey = claim.idempotencyKey;
      claimedOutbox.status = "failed";
      await expect(workflow.completeWorkflowPublication(claim, adminEditor, { added: 1, updated: 0, bankSize: 1 }))
        .rejects.toThrow("Only a processing publication claim can be completed");
      expect(databaseState.publicationCompletionUpdates).toHaveLength(0);
      claimedOutbox.status = "processing";

      databaseState.items.set(approved.id, claimedProjection);
      approvalRow.reviewerId = adminEditor.id;
      await expect(workflow.completeWorkflowPublication(claim, adminEditor, { added: 1, updated: 0, bankSize: 1 }))
        .rejects.toThrow("approval audit evidence is missing or inconsistent");
      expect(databaseState.publicationCompletionUpdates).toHaveLength(0);
      expect(databaseState.items.get(approved.id)?.status).toBe("approved");

      approvalRow.reviewerId = reviewer.id;
      const published = await workflow.completeWorkflowPublication(claim, adminEditor, { added: 1, updated: 0, bankSize: 1 });
      expect(published.status).toBe("published");
      expect(databaseState.publicationCompletionUpdates).toEqual([claim.idempotencyKey]);

      const completedProjection = databaseState.items.get(approved.id)!;
      const completedVersion = completedProjection.version;
      const completedHistory = completedProjection.history;
      const replay = await workflow.prepareWorkflowPublication(approved.id, adminEditor, ["trinity"], []);
      expect(replay.alreadyCompleted).toBe(true);
      const duplicateCompletion = await workflow.completeWorkflowPublication(claim, adminEditor, { added: 1, updated: 0, bankSize: 1 });
      expect(duplicateCompletion.status).toBe("published");
      expect(databaseState.publicationCompletionUpdates).toEqual([claim.idempotencyKey]);
      expect(databaseState.items.get(approved.id)?.version).toBe(completedVersion);
      expect(databaseState.items.get(approved.id)?.history).toEqual(completedHistory);

      databaseState.items.set(approved.id, { ...completedProjection, status: "approved" });
      await expect(workflow.prepareWorkflowPublication(approved.id, adminEditor, ["trinity"], []))
        .rejects.toThrow("Completed publication evidence is missing or inconsistent");
      await expect(workflow.completeWorkflowPublication(claim, adminEditor, { added: 1, updated: 0, bankSize: 1 }))
        .rejects.toThrow("Completed publication evidence is missing or inconsistent");
      expect(databaseState.publicationCompletionUpdates).toEqual([claim.idempotencyKey]);

      databaseState.items.set(approved.id, completedProjection);
      claimedOutbox.revisionId = "wf_rev_corrupted_completed_outbox";
      claimedOutbox.contentHash = "c".repeat(64);
      await expect(workflow.prepareWorkflowPublication(approved.id, adminEditor, ["trinity"], []))
        .rejects.toThrow("Publication outbox evidence is missing or inconsistent");
      await expect(workflow.completeWorkflowPublication(claim, adminEditor, { added: 1, updated: 0, bankSize: 1 }))
        .rejects.toThrow("Publication outbox evidence is missing or inconsistent");
      expect(databaseState.publicationCompletionUpdates).toEqual([claim.idempotencyKey]);

      claimedOutbox.revisionId = approved.approvedRevisionId!;
      claimedOutbox.contentHash = approved.approvedContentHash!;
      claimedOutbox.workflowItemId = "wf_corrupted_completed_owner";
      await expect(workflow.prepareWorkflowPublication(approved.id, adminEditor, ["trinity"], []))
        .rejects.toThrow("Publication outbox evidence is missing or inconsistent");
      await expect(workflow.completeWorkflowPublication(claim, adminEditor, { added: 1, updated: 0, bankSize: 1 }))
        .rejects.toThrow("Publication outbox evidence is missing or inconsistent");
      expect(databaseState.publicationCompletionUpdates).toEqual([claim.idempotencyKey]);

      claimedOutbox.workflowItemId = approved.id;
      claimedOutbox.idempotencyKey = "publish:corrupted-completed-key";
      await expect(workflow.prepareWorkflowPublication(approved.id, adminEditor, ["trinity"], []))
        .rejects.toThrow("Publication outbox evidence is missing or inconsistent");
      await expect(workflow.completeWorkflowPublication(claim, adminEditor, { added: 1, updated: 0, bankSize: 1 }))
        .rejects.toThrow("Publication outbox evidence is missing or inconsistent");
      expect(databaseState.publicationCompletionUpdates).toEqual([claim.idempotencyKey]);

      claimedOutbox.idempotencyKey = claim.idempotencyKey;
      const completedAt = claimedOutbox.completedAt;
      claimedOutbox.completedAt = undefined;
      await expect(workflow.prepareWorkflowPublication(approved.id, adminEditor, ["trinity"], []))
        .rejects.toThrow("Completed publication evidence is missing or inconsistent");
      await expect(workflow.completeWorkflowPublication(claim, adminEditor, { added: 1, updated: 0, bankSize: 1 }))
        .rejects.toThrow("Completed publication evidence is missing or inconsistent");
      expect(databaseState.publicationCompletionUpdates).toEqual([claim.idempotencyKey]);

      claimedOutbox.completedAt = completedAt;
      databaseState.items.set(approved.id, { ...completedProjection, publicationIdempotencyKey: undefined });
      await expect(workflow.prepareWorkflowPublication(approved.id, adminEditor, ["trinity"], []))
        .rejects.toThrow("Completed publication evidence is missing or inconsistent");
      await expect(workflow.completeWorkflowPublication(claim, adminEditor, { added: 1, updated: 0, bankSize: 1 }))
        .rejects.toThrow("Publication claim evidence is missing or inconsistent");

      databaseState.items.set(approved.id, completedProjection);
      claimedOutbox.status = "failed";
      await expect(workflow.prepareWorkflowPublication(approved.id, adminEditor, ["trinity"], []))
        .rejects.toThrow("Published content requires a coherent completed publication receipt");
      expect(databaseState.publicationCompletionUpdates).toEqual([claim.idempotencyKey]);

      claimedOutbox.status = "completed";
      databaseState.publicationClaims.splice(0, 1);
      await expect(workflow.prepareWorkflowPublication(approved.id, adminEditor, ["trinity"], []))
        .rejects.toThrow("Published content requires a coherent completed publication receipt");
      expect(databaseState.publicationCompletionUpdates).toEqual([claim.idempotencyKey]);
      databaseState.publicationClaims.push(claimedOutbox);
    }
  );

  it.each(["postgres", "mysql"] as const)(
    "fails a %s publication callback closed before any local mutation",
    async (dialect) => {
      databaseDialect = dialect;
      const submitted = await workflow.createWorkflowDraft(
        { ...sourcedQuestion, id: `edt_${dialect === "postgres" ? "0900" : "0901"}` },
        author,
        ["trinity"],
        [],
        true
      );
      const approved = await workflow.transitionWorkflowItem(submitted.id, "approved", reviewer, {
        comment: "This exact immutable revision was independently checked before failure callback handling.",
        attestation,
        topicIds: ["trinity"],
      });
      const approvalRow = databaseState.reviews.find((review) => review.decision === "approved")!;
      const claim = await workflow.prepareWorkflowPublication(approved.id, adminEditor, ["trinity"], []);
      const activeProjection = structuredClone(databaseState.items.get(approved.id)!);
      const activeOutbox = structuredClone(databaseState.publicationClaims[0]);
      const activeApproval = structuredClone(approvalRow);

      const restoreActiveEvidence = () => {
        databaseState.items.set(approved.id, structuredClone(activeProjection));
        databaseState.publicationClaims.splice(0, databaseState.publicationClaims.length, structuredClone(activeOutbox));
        Object.assign(approvalRow, structuredClone(activeApproval));
        databaseState.publicationFailureUpdates.length = 0;
      };
      const expectRejectedWithoutMutation = async (
        corrupt: () => void,
        message: string,
        candidateClaim = claim
      ) => {
        restoreActiveEvidence();
        corrupt();
        const itemBefore = structuredClone(databaseState.items.get(approved.id));
        const outboxBefore = structuredClone(databaseState.publicationClaims);
        const eventCountBefore = databaseState.events.length;
        await expect(workflow.failWorkflowPublication(candidateClaim, adminEditor, "Engine failure callback"))
          .rejects.toThrow(message);
        expect(databaseState.items.get(approved.id)).toEqual(itemBefore);
        expect(databaseState.publicationClaims).toEqual(outboxBefore);
        expect(databaseState.events).toHaveLength(eventCountBefore);
        expect(databaseState.publicationFailureUpdates).toHaveLength(0);
      };

      await expectRejectedWithoutMutation(() => {
        databaseState.items.set(approved.id, {
          ...activeProjection,
          question: "Corrupted mutable projection before failure callback.",
        });
      }, "Current workflow projection no longer matches the approved revision");
      await expectRejectedWithoutMutation(() => {
        databaseState.items.set(approved.id, { ...activeProjection, revisions: [] });
      }, "Approved revision snapshot is unavailable or invalid");
      await expectRejectedWithoutMutation(() => {
        approvalRow.reviewerId = adminEditor.id;
      }, "approval audit evidence is missing or inconsistent");
      await expectRejectedWithoutMutation(
        () => undefined,
        "Publication claim evidence is missing or inconsistent",
        { ...claim, idempotencyKey: "publish:wrong-database-failure-claim" }
      );
      await expectRejectedWithoutMutation(() => {
        databaseState.items.set(approved.id, { ...activeProjection, publicationIdempotencyKey: undefined });
      }, "Publication claim evidence is missing or inconsistent");
      await expectRejectedWithoutMutation(() => {
        databaseState.publicationClaims[0].revisionId = "wf_rev_stale_database_failure";
        databaseState.publicationClaims[0].contentHash = "f".repeat(64);
      }, "Publication outbox evidence is missing or inconsistent");
      await expectRejectedWithoutMutation(() => {
        databaseState.publicationClaims[0].workflowItemId = "wf_wrong_database_failure_owner";
      }, "Publication outbox evidence is missing or inconsistent");
      await expectRejectedWithoutMutation(() => {
        databaseState.publicationClaims[0].idempotencyKey = "publish:wrong-database-failure-key";
      }, "Publication outbox evidence is missing or inconsistent");
      await expectRejectedWithoutMutation(() => {
        databaseState.publicationClaims[0].status = "failed";
      }, "Only a processing publication claim can record a failure");
      await expectRejectedWithoutMutation(() => {
        databaseState.publicationClaims.push({
          ...structuredClone(activeOutbox),
          idempotencyKey: `${activeOutbox.idempotencyKey}:duplicate`,
        });
      }, "Publication outbox evidence is missing or inconsistent");

      restoreActiveEvidence();
      const failed = await workflow.failWorkflowPublication(claim, adminEditor, "temporary Engine failure\nwith unsafe formatting");
      expect(failed).toMatchObject({ status: "approved", version: activeProjection.version + 1 });
      expect(failed.history[0]).toMatchObject({ type: "publication_failed" });
      expect(databaseState.publicationFailureUpdates).toEqual([claim.idempotencyKey]);
      expect(databaseState.publicationClaims[0]).toMatchObject({
        status: "failed",
        lastError: "temporary Engine failure with unsafe formatting",
      });

      const retry = await workflow.prepareWorkflowPublication(approved.id, adminEditor, ["trinity"], []);
      await workflow.completeWorkflowPublication(retry, adminEditor, { added: 1, updated: 0, bankSize: 1 });
      const completedItem = structuredClone(databaseState.items.get(approved.id));
      const completedOutbox = structuredClone(databaseState.publicationClaims);
      const completedEvents = structuredClone(databaseState.events);
      const completedReplay = await workflow.failWorkflowPublication(retry, adminEditor, "late duplicate failure callback");
      expect(completedReplay.status).toBe("published");
      expect(databaseState.items.get(approved.id)).toEqual(completedItem);
      expect(databaseState.publicationClaims).toEqual(completedOutbox);
      expect(databaseState.events).toEqual(completedEvents);
      expect(databaseState.publicationFailureUpdates).toEqual([claim.idempotencyKey]);

      databaseState.publicationClaims[0].completedAt = undefined;
      const corruptCompletedItem = structuredClone(databaseState.items.get(approved.id));
      const corruptCompletedOutbox = structuredClone(databaseState.publicationClaims);
      const corruptCompletedEventCount = databaseState.events.length;
      await expect(workflow.failWorkflowPublication(retry, adminEditor, "corrupt late callback"))
        .rejects.toThrow("Completed publication evidence is missing or inconsistent");
      expect(databaseState.items.get(approved.id)).toEqual(corruptCompletedItem);
      expect(databaseState.publicationClaims).toEqual(corruptCompletedOutbox);
      expect(databaseState.events).toHaveLength(corruptCompletedEventCount);
      expect(databaseState.publicationFailureUpdates).toEqual([claim.idempotencyKey]);
    }
  );
});
