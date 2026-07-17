import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CurrentUser } from "@/lib/server/currentUser";
import type { WorkflowDatabase } from "@/lib/server/storage/workflowDatabase";
import type { Question } from "@/types/content";

type WorkflowModule = typeof import("@/lib/server/storage/workflowStore");
type WorkflowDatabaseModule = typeof import("@/lib/server/storage/workflowDatabase");

const acceptanceDatabaseUrl = process.env.EDITORIAL_ACCEPTANCE_DATABASE_URL?.trim();

let dataDirectory = "";
let workflowItemId = "";
let workflow: WorkflowModule;
let workflowDatabase: WorkflowDatabaseModule;
let database: WorkflowDatabase;

const author: CurrentUser = {
  id: "acceptance-author",
  displayName: "Acceptance Author",
  role: "author",
  accountType: "staff",
  source: "database",
};

const reviewer: CurrentUser = {
  id: "acceptance-reviewer",
  displayName: "Acceptance Reviewer",
  role: "reviewer",
  accountType: "staff",
  source: "database",
};

const publisher: CurrentUser = {
  id: "acceptance-publisher",
  displayName: "Acceptance Publisher",
  role: "super_admin",
  accountType: "staff",
  source: "database",
};

function assertDisposableDatabaseUrl(rawUrl: string | undefined): asserts rawUrl is string {
  if (!rawUrl) {
    throw new Error(
      "EDITORIAL_ACCEPTANCE_DATABASE_URL is required. Point it to a disposable local database whose name ends in _acceptance."
    );
  }

  const url = new URL(rawUrl);
  if (!["postgres:", "postgresql:", "mysql:"].includes(url.protocol)) {
    throw new Error("Editorial database acceptance supports only PostgreSQL or MySQL URLs.");
  }
  if (!["127.0.0.1", "localhost", "::1"].includes(url.hostname)) {
    throw new Error("Editorial database acceptance refuses non-loopback database hosts.");
  }
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!databaseName.endsWith("_acceptance")) {
    throw new Error("Editorial database acceptance requires a database name ending in _acceptance.");
  }
}

function parseJson<T>(value: unknown): T {
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

async function readApprovalEvidence() {
  return database.query<Record<string, unknown>>(
    `SELECT id, workflow_item_id, revision_id, content_hash, reviewer_id, decision, comment, attestation, created_at
       FROM content_review_records
      WHERE workflow_item_id = ? AND decision = ?
      ORDER BY created_at, id`,
    [workflowItemId, "approved"]
  );
}

async function readRevisionEvidence() {
  return database.query<Record<string, unknown>>(
    `SELECT id, workflow_item_id, revision_number, content_hash, snapshot, created_by, created_at
       FROM content_workflow_revisions
      WHERE workflow_item_id = ?
      ORDER BY revision_number, id`,
    [workflowItemId]
  );
}

async function readPublicationEvidence() {
  const itemRows = await database.query<Record<string, unknown>>(
    "SELECT id, status, author_id, reviewer_id, current_revision_id, content_hash, payload FROM content_workflow_items WHERE id = ?",
    [workflowItemId]
  );
  const outboxRows = await database.query<Record<string, unknown>>(
    `SELECT idempotency_key, workflow_item_id, revision_id, content_hash, status, attempts, lease_expires_at,
            last_error, engine_result, created_at, updated_at, completed_at
       FROM content_publication_outbox
      WHERE workflow_item_id = ?`,
    [workflowItemId]
  );
  const eventRows = await database.query<Record<string, unknown>>(
    `SELECT id, workflow_item_id, event_type, actor_id, content_hash, event, created_at
       FROM content_workflow_events
      WHERE workflow_item_id = ?
      ORDER BY created_at, id`,
    [workflowItemId]
  );
  return { itemRows, outboxRows, eventRows };
}

beforeAll(async () => {
  assertDisposableDatabaseUrl(acceptanceDatabaseUrl);
  dataDirectory = await mkdtemp(path.join(tmpdir(), "apologia-editorial-database-acceptance-"));
  process.env.DATABASE_URL = acceptanceDatabaseUrl;
  process.env.APP_STORAGE_DRIVER = "database";
  process.env.APP_DATA_DIR = dataDirectory;
  delete process.env.MYSQL_HOST;
  delete process.env.MYSQL_PORT;
  delete process.env.MYSQL_DATABASE;
  delete process.env.MYSQL_USER;
  delete process.env.MYSQL_PASSWORD;

  workflowDatabase = await import("@/lib/server/storage/workflowDatabase");
  workflow = await import("@/lib/server/storage/workflowStore");
  await workflowDatabase.ensureWorkflowDatabaseSchema();
  database = await workflowDatabase.getWorkflowDatabase();
});

afterAll(async () => {
  if (database && workflowItemId) {
    await database.transaction(async (executor) => {
      await executor.query("DELETE FROM content_publication_outbox WHERE workflow_item_id = ?", [workflowItemId]);
      await executor.query("DELETE FROM content_workflow_events WHERE workflow_item_id = ?", [workflowItemId]);
      await executor.query("DELETE FROM content_review_records WHERE workflow_item_id = ?", [workflowItemId]);
      await executor.query("DELETE FROM content_workflow_revisions WHERE workflow_item_id = ?", [workflowItemId]);
      await executor.query("DELETE FROM content_workflow_items WHERE id = ?", [workflowItemId]);
    });
  }
  delete process.env.DATABASE_URL;
  delete process.env.APP_STORAGE_DRIVER;
  delete process.env.APP_DATA_DIR;
  if (dataDirectory) await rm(dataDirectory, { recursive: true, force: true });
});

describe("human-reviewed editorial workflow on a real SQL dialect", () => {
  it("preserves exact immutable approval evidence across author, reviewer, and publisher stages", async () => {
    expect(new Set([author.id, reviewer.id, publisher.id]).size).toBe(3);
    const questionId = `edt_acceptance_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
    const question: Question = {
      id: questionId,
      topicId: "trinity",
      difficulty: 2,
      question: "Which source grounds the baptismal formula used in this acceptance test?",
      choices: {
        A: "Matthew 28:19",
        B: "An anonymous post",
        C: "An uncited summary",
        D: "No source",
      },
      correctId: "A",
      teaching: {
        title: "Primary sources remain bound to the reviewed revision",
        body: "Matthew 28:19 supplies the cited baptismal formula; the workflow binds that citation and explanation to one immutable revision.",
        refs: ["Matthew 28:19"],
      },
      tags: ["editorial-acceptance"],
      sourceReferences: [{
        kind: "scripture",
        citation: "Matthew 28:19",
        locator: "Gospel of Matthew",
      }],
    };

    const submitted = await workflow.createWorkflowDraft(question, author, ["trinity"], [], true);
    workflowItemId = submitted.id;
    expect(submitted).toMatchObject({ status: "submitted", authorId: author.id });
    expect(submitted.reviewerId).toBe(undefined);
    expect(submitted.revisions).toHaveLength(1);
    expect(submitted.revisions[0]).toMatchObject({
      id: submitted.currentRevisionId,
      contentHash: submitted.contentHash,
      createdBy: author.id,
    });

    const { REVIEW_ATTESTATION_STATEMENT } = await import("@/lib/editorialPolicy");
    const attestation = {
      doctrinalFidelityConfirmed: true as const,
      sourcesChecked: true as const,
      explanationSupported: true as const,
      charitableLanguageConfirmed: true as const,
      independentReviewConfirmed: true as const,
      statement: REVIEW_ATTESTATION_STATEMENT,
    };

    await expect(workflow.transitionWorkflowItem(submitted.id, "approved", author, {
      comment: "The author must not approve the revision they created.",
      attestation,
      topicIds: ["trinity"],
    })).rejects.toThrow("another reviewer must decide");
    expect(await readApprovalEvidence()).toHaveLength(0);

    const approved = await workflow.transitionWorkflowItem(submitted.id, "approved", reviewer, {
      comment: "I independently checked the exact revision, explanation, and primary Scripture citation.",
      attestation,
      topicIds: ["trinity"],
    });
    const approval = approved.reviewComments.at(-1)!;
    expect(approved).toMatchObject({
      status: "approved",
      authorId: author.id,
      reviewerId: reviewer.id,
      approvedRevisionId: submitted.currentRevisionId,
      approvedContentHash: submitted.contentHash,
    });
    expect(approval).toMatchObject({
      decision: "approved",
      authorId: reviewer.id,
      revisionId: submitted.currentRevisionId,
      contentHash: submitted.contentHash,
      attestation,
    });

    const approvalEvidenceBeforePublication = await readApprovalEvidence();
    const revisionEvidenceBeforePublication = await readRevisionEvidence();
    expect(approvalEvidenceBeforePublication).toHaveLength(1);
    expect(approvalEvidenceBeforePublication[0]).toMatchObject({
      id: approval.id,
      workflow_item_id: submitted.id,
      revision_id: submitted.currentRevisionId,
      content_hash: submitted.contentHash,
      reviewer_id: reviewer.id,
      decision: "approved",
      comment: approval.body,
      created_at: approval.createdAt,
    });
    expect(parseJson(approvalEvidenceBeforePublication[0].attestation)).toEqual(attestation);
    expect(revisionEvidenceBeforePublication).toHaveLength(1);
    expect(revisionEvidenceBeforePublication[0]).toMatchObject({
      id: submitted.currentRevisionId,
      workflow_item_id: submitted.id,
      revision_number: 1,
      content_hash: submitted.contentHash,
      created_by: author.id,
    });
    expect(parseJson<Record<string, unknown>>(revisionEvidenceBeforePublication[0].snapshot)).toMatchObject({
      id: submitted.currentRevisionId,
      contentHash: submitted.contentHash,
      createdBy: author.id,
    });

    const firstClaim = await workflow.prepareWorkflowPublication(approved.id, publisher, ["trinity"], []);
    expect(firstClaim).toMatchObject({ alreadyCompleted: false });
    expect(firstClaim.idempotencyKey).toContain(`${approved.id}:${approved.currentRevisionId}:${approved.contentHash}`);
    let publicationEvidence = await readPublicationEvidence();
    expect(publicationEvidence.outboxRows).toHaveLength(1);
    expect(publicationEvidence.outboxRows[0]).toMatchObject({
      idempotency_key: firstClaim.idempotencyKey,
      workflow_item_id: approved.id,
      revision_id: approved.currentRevisionId,
      content_hash: approved.contentHash,
      status: "processing",
      attempts: 1,
    });

    const failed = await workflow.failWorkflowPublication(
      firstClaim,
      publisher,
      "temporary acceptance failure\nwithout secret details"
    );
    expect(failed.status).toBe("approved");
    publicationEvidence = await readPublicationEvidence();
    expect(publicationEvidence.outboxRows[0]).toMatchObject({
      status: "failed",
      attempts: 1,
      last_error: "temporary acceptance failure without secret details",
    });

    const retryClaim = await workflow.prepareWorkflowPublication(approved.id, publisher, ["trinity"], []);
    expect(retryClaim).toMatchObject({
      idempotencyKey: firstClaim.idempotencyKey,
      alreadyCompleted: false,
    });
    const engineResult = { added: 1, updated: 0, bankSize: 1, acceptance: true };
    const published = await workflow.completeWorkflowPublication(retryClaim, publisher, engineResult);
    expect(published).toMatchObject({
      status: "published",
      publishTarget: "engine",
      publicationIdempotencyKey: firstClaim.idempotencyKey,
    });

    publicationEvidence = await readPublicationEvidence();
    expect(publicationEvidence.itemRows).toHaveLength(1);
    expect(publicationEvidence.itemRows[0]).toMatchObject({
      status: "published",
      author_id: author.id,
      reviewer_id: reviewer.id,
      current_revision_id: approved.currentRevisionId,
      content_hash: approved.contentHash,
    });
    const publishedProjection = parseJson<Record<string, unknown>>(publicationEvidence.itemRows[0].payload);
    expect(publishedProjection).toMatchObject({
      status: "published",
      authorId: author.id,
      reviewerId: reviewer.id,
      currentRevisionId: approved.currentRevisionId,
      contentHash: approved.contentHash,
      publishedAt: published.publishedAt,
    });
    expect(publicationEvidence.outboxRows[0]).toMatchObject({
      idempotency_key: firstClaim.idempotencyKey,
      workflow_item_id: approved.id,
      revision_id: approved.currentRevisionId,
      content_hash: approved.contentHash,
      status: "completed",
      attempts: 2,
      lease_expires_at: null,
      last_error: null,
      completed_at: published.publishedAt,
      updated_at: published.updatedAt,
    });
    expect(parseJson(publicationEvidence.outboxRows[0].engine_result)).toEqual(engineResult);

    const eventActors = publicationEvidence.eventRows.map((row) => ({
      type: row.event_type,
      actorId: row.actor_id,
      actorRole: parseJson<Record<string, unknown>>(row.event).actorRole,
    }));
    expect(eventActors).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "submitted", actorId: author.id, actorRole: author.role }),
      expect.objectContaining({ type: "approved", actorId: reviewer.id, actorRole: reviewer.role }),
      expect.objectContaining({ type: "publication_failed", actorId: publisher.id, actorRole: publisher.role }),
      expect.objectContaining({ type: "published", actorId: publisher.id, actorRole: publisher.role }),
    ]));
    expect(eventActors.filter((entry) => entry.type === "publication_claimed")).toHaveLength(2);
    expect(eventActors.filter((entry) => entry.type === "publication_claimed").every(
      (entry) => entry.actorId === publisher.id
    )).toBe(true);

    const completedEvidenceBeforeReplay = structuredClone(publicationEvidence);
    await database.query("UPDATE content_review_records SET comment = ? WHERE id = ?", [
      "tampered acceptance approval",
      approval.id,
    ]);
    await expect(workflow.prepareWorkflowPublication(published.id, publisher, ["trinity"], []))
      .rejects.toThrow("approval audit evidence is missing or inconsistent");
    expect(await readPublicationEvidence()).toEqual(completedEvidenceBeforeReplay);
    await database.query("UPDATE content_review_records SET comment = ? WHERE id = ?", [approval.body, approval.id]);
    expect(await readApprovalEvidence()).toEqual(approvalEvidenceBeforePublication);

    const replay = await workflow.prepareWorkflowPublication(published.id, publisher, ["trinity"], []);
    expect(replay).toMatchObject({
      idempotencyKey: firstClaim.idempotencyKey,
      alreadyCompleted: true,
    });
    expect(await readPublicationEvidence()).toEqual(completedEvidenceBeforeReplay);
    expect(await readApprovalEvidence()).toEqual(approvalEvidenceBeforePublication);
    expect(await readRevisionEvidence()).toEqual(revisionEvidenceBeforePublication);
  });
});
