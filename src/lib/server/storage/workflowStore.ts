import type { Question } from "../../../types/content";
import { validateQuestion, hasBlockingValidationIssues } from "../../contentValidation";
import { canTransitionStatus, type ReviewStatus } from "../../contentWorkflow";
import type { CurrentUser } from "../currentUser";
import {
  computeEditorialContentHash,
  getEditorialPublishLeaseSeconds,
  isSha256Hash,
  normalizeEditorialSources,
  normalizeReviewerAttestation,
  questionForPublication,
  validateEditorialSources,
  type WorkflowReviewerAttestation,
  type WorkflowRevisionSnapshot,
} from "../editorialWorkflow";
import type {
  WorkflowHistoryEvent,
  WorkflowItem,
  WorkflowPublicationOutboxRecord,
  WorkflowReviewComment,
} from "./types";
import { JsonStore, newId } from "./jsonStore";
import {
  databaseJsonCast,
  ensureWorkflowDatabaseSchema,
  getWorkflowDatabase,
  parseWorkflowDatabaseJson,
  workflowDatabaseEnabled,
  type WorkflowDatabase,
  type WorkflowDatabaseExecutor,
} from "./workflowDatabase";

export interface WorkflowFileState {
  schemaVersion: 1;
  items: WorkflowItem[];
  outbox: WorkflowPublicationOutboxRecord[];
}

interface WorkflowMutation {
  item: WorkflowItem;
  revision?: WorkflowRevisionSnapshot;
  review?: WorkflowReviewComment;
  event: WorkflowHistoryEvent;
}

const EMPTY_FILE_STATE: WorkflowFileState = { schemaVersion: 1, items: [], outbox: [] };
const editorialFileStore = new JsonStore<WorkflowFileState>("editorial-workflow.json", EMPTY_FILE_STATE);
const legacyWorkflowStore = new JsonStore<WorkflowItem[]>("workflow-items.json", []);
let workflowMutationQueue: Promise<void> = Promise.resolve();
let migrationPromise: Promise<void> | null = null;

export class WorkflowConflictError extends Error {}
export class WorkflowValidationError extends Error {}
export class WorkflowPublicationError extends Error {}

export interface WorkflowFilters {
  status?: string;
  topicId?: string;
  authorId?: string;
  reviewerId?: string;
  search?: string;
}

export interface WorkflowPublicationClaim {
  item: WorkflowItem;
  question: Question;
  idempotencyKey: string;
  alreadyCompleted: boolean;
}

function nowIso(): string {
  return new Date().toISOString();
}

function history(actor: CurrentUser, type: string, summary: string, metadata?: Record<string, unknown>): WorkflowHistoryEvent {
  return {
    id: newId("wf_evt"),
    type,
    actorId: actor.id,
    actorName: actor.displayName,
    actorRole: actor.role,
    createdAt: nowIso(),
    summary,
    metadata,
  };
}

function assertString(value: unknown, field: string, maxLength: number, optional = false): string {
  if ((value === undefined || value === null) && optional) return "";
  if (typeof value !== "string") throw new WorkflowValidationError(`${field} must be a string.`);
  if (value.length > maxLength) throw new WorkflowValidationError(`${field} exceeds ${maxLength} characters.`);
  return value.trim();
}

function normalizeStringArray(value: unknown, field: string, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) throw new WorkflowValidationError(`${field} must be an array.`);
  if (value.length > maxItems) throw new WorkflowValidationError(`${field} may contain at most ${maxItems} values.`);
  return value.map((entry, index) => assertString(entry, `${field}.${index}`, maxLength)).filter(Boolean);
}

export function normalizeWorkflowQuestion(input: Partial<Question>): Question {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new WorkflowValidationError("Question payload must be an object.");
  }
  let sources;
  try {
    sources = normalizeEditorialSources(input.sourceReferences);
  } catch (error) {
    throw new WorkflowValidationError(error instanceof Error ? error.message : "Structured source references are invalid.");
  }
  const refs = sources.length > 0
    ? sources.map((source) => source.citation)
    : normalizeStringArray(input.teaching?.refs ?? [], "teaching.refs", 20, 300);
  return {
    id: assertString(input.id ?? "", "id", 191),
    topicId: assertString(input.topicId ?? "", "topicId", 191),
    difficulty: ([1, 2, 3, 4, 5].includes(input.difficulty as number) ? input.difficulty : 3) as 1 | 2 | 3 | 4 | 5,
    question: assertString(input.question ?? "", "question", 1200),
    choices: {
      A: assertString(input.choices?.A ?? "", "choices.A", 600),
      B: assertString(input.choices?.B ?? "", "choices.B", 600),
      C: assertString(input.choices?.C ?? "", "choices.C", 600),
      D: assertString(input.choices?.D ?? "", "choices.D", 600),
    },
    correctId: ["A", "B", "C", "D"].includes(input.correctId || "") ? input.correctId! : "A",
    teaching: {
      title: assertString(input.teaching?.title ?? "", "teaching.title", 300),
      body: assertString(input.teaching?.body ?? "", "teaching.body", 8000),
      refs,
    },
    tags: normalizeStringArray(input.tags ?? [], "tags", 30, 80),
    sourceReferences: sources,
  };
}

function workflowItemQuestion(item: WorkflowItem): Question {
  return {
    id: item.questionId,
    topicId: item.topicId,
    difficulty: item.difficulty,
    question: item.question,
    choices: item.choices,
    correctId: item.correctId,
    teaching: item.teaching,
    tags: item.tags,
    sourceReferences: item.sourceReferences,
  };
}

function assertValidForStatus(item: WorkflowItem, status: ReviewStatus, topicIds: string[], existingIds: string[]): void {
  if (!["submitted", "approved", "published"].includes(status)) return;
  const sourceIssues = validateEditorialSources(item.sourceReferences);
  if (sourceIssues.length > 0) throw new WorkflowValidationError(sourceIssues[0].message);
  const issues = validateQuestion(workflowItemQuestion(item), { topicIds, existingIds });
  if (hasBlockingValidationIssues(issues)) {
    throw new WorkflowValidationError(`Content cannot be marked ${status} while blocking validation issues remain.`);
  }
  if (!item.teaching?.body?.trim() || item.teaching.body.trim().length < 20) {
    throw new WorkflowValidationError("A substantive teaching explanation of at least 20 characters is required.");
  }
}

function createRevision(question: Question, actor: CurrentUser, revisionNumber: number, createdAt = nowIso()): WorkflowRevisionSnapshot {
  const sourceReferences = normalizeEditorialSources(question.sourceReferences);
  const publishableQuestion = questionForPublication(question, sourceReferences);
  return {
    id: newId("wf_rev"),
    revisionNumber,
    contentHash: computeEditorialContentHash(publishableQuestion, sourceReferences),
    createdAt,
    createdBy: actor.id,
    question: publishableQuestion,
    sourceReferences,
  };
}

function latestChangesRequestedReview(reviewComments: WorkflowReviewComment[]): WorkflowReviewComment | undefined {
  return reviewComments.reduce<WorkflowReviewComment | undefined>((latest, review) => {
    if (
      review.decision !== "changes_requested"
      || typeof review.revisionId !== "string"
      || review.revisionId.length === 0
      || !isSha256Hash(review.contentHash)
    ) {
      return latest;
    }
    if (!latest) return review;
    const reviewTime = Date.parse(review.createdAt);
    const latestTime = Date.parse(latest.createdAt);
    const normalizedReviewTime = Number.isFinite(reviewTime) ? reviewTime : 0;
    const normalizedLatestTime = Number.isFinite(latestTime) ? latestTime : 0;
    if (normalizedReviewTime !== normalizedLatestTime) {
      return normalizedReviewTime > normalizedLatestTime ? review : latest;
    }
    return review.id.localeCompare(latest.id) > 0 ? review : latest;
  }, undefined);
}

function latestApprovedReview(reviewComments: WorkflowReviewComment[]): WorkflowReviewComment | undefined {
  return reviewComments.reduce<WorkflowReviewComment | undefined>((latest, review) => {
    if (!review || typeof review !== "object" || review.decision !== "approved") return latest;
    if (!latest) return review;
    const reviewTime = Date.parse(typeof review.createdAt === "string" ? review.createdAt : "");
    const latestTime = Date.parse(typeof latest.createdAt === "string" ? latest.createdAt : "");
    const normalizedReviewTime = Number.isFinite(reviewTime) ? reviewTime : 0;
    const normalizedLatestTime = Number.isFinite(latestTime) ? latestTime : 0;
    if (normalizedReviewTime !== normalizedLatestTime) {
      return normalizedReviewTime > normalizedLatestTime ? review : latest;
    }
    const reviewId = typeof review.id === "string" ? review.id : "";
    const latestId = typeof latest.id === "string" ? latest.id : "";
    return reviewId.localeCompare(latestId) > 0 ? review : latest;
  }, undefined);
}

function normalizedAttestation(value: unknown): WorkflowReviewerAttestation | null {
  try {
    return normalizeReviewerAttestation(value);
  } catch {
    return null;
  }
}

function attestationsMatch(left: unknown, right: unknown): boolean {
  const normalizedLeft = normalizedAttestation(left);
  const normalizedRight = normalizedAttestation(right);
  return Boolean(
    normalizedLeft
    && normalizedRight
    && JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight)
  );
}

function approvalEvidenceConflict(): WorkflowConflictError {
  return new WorkflowConflictError("Publication is blocked because approval audit evidence is missing or inconsistent.");
}

function assertPayloadApprovalEvidence(item: WorkflowItem): WorkflowReviewComment {
  const approval = latestApprovedReview(item.reviewComments);
  if (
    !approval
    || approval.revisionId !== item.approvedRevisionId
    || approval.contentHash !== item.approvedContentHash
    || approval.authorId !== item.reviewerId
    || typeof approval.id !== "string"
    || approval.id.length === 0
    || typeof approval.createdAt !== "string"
    || approval.createdAt.length === 0
    || approval.createdAt !== item.reviewedAt
    || typeof approval.body !== "string"
    || approval.body.trim().length < 10
    || approval.doctrinalFlag === true
    || approval.referenceFlag === true
    || !attestationsMatch(approval.attestation, item.approvalAttestation)
  ) {
    throw approvalEvidenceConflict();
  }
  return approval;
}

function hydrateWorkflowItem(raw: WorkflowItem): WorkflowItem {
  // An explicit empty value is an invalid public ID that authors must fix, not a
  // missing legacy field that may be replaced by the internal workflow row ID.
  const publicQuestionId = typeof raw.questionId === "string" ? raw.questionId : raw.id;
  const question = normalizeWorkflowQuestion({ ...raw, id: publicQuestionId });
  const sourceReferences = normalizeEditorialSources(raw.sourceReferences);
  const revisionNumber = Number.isSafeInteger(raw.revisionNumber) && raw.revisionNumber > 0
    ? raw.revisionNumber
    : Math.max(1, Number(raw.version) || 1);
  const revisions = Array.isArray(raw.revisions) ? raw.revisions.filter((revision) => (
    revision && typeof revision.id === "string" && isSha256Hash(revision.contentHash)
  )) : [];
  const fallbackHash = computeEditorialContentHash(questionForPublication(question, sourceReferences), sourceReferences);
  const contentHash = isSha256Hash(raw.contentHash) ? raw.contentHash : fallbackHash;
  const currentRevisionId = typeof raw.currentRevisionId === "string" && raw.currentRevisionId
    ? raw.currentRevisionId
    : newId("wf_rev_migrated");
  const migratedRevision: WorkflowRevisionSnapshot = {
    id: currentRevisionId,
    revisionNumber,
    contentHash,
    createdAt: raw.updatedAt || raw.createdAt || nowIso(),
    createdBy: raw.authorId,
    question: questionForPublication(question, sourceReferences),
    sourceReferences,
  };
  const legacyApprovalNeedsReview = raw.status === "approved" && (
    !raw.approvedRevisionId
    || !raw.approvedContentHash
    || !raw.approvalAttestation
    || sourceReferences.length === 0
  );
  const reviewComments = Array.isArray(raw.reviewComments) ? raw.reviewComments : [];
  const latestChangesRequest = latestChangesRequestedReview(reviewComments);
  const persistedChangesRequest = typeof raw.changesRequestedRevisionId === "string"
    && raw.changesRequestedRevisionId.length > 0
    && isSha256Hash(raw.changesRequestedContentHash)
    ? {
      revisionId: raw.changesRequestedRevisionId,
      contentHash: raw.changesRequestedContentHash,
    }
    : undefined;
  const changesRequestedEvidenceConflict = raw.changesRequestedEvidenceConflict === true || Boolean(
    latestChangesRequest
    && persistedChangesRequest
    && (
      latestChangesRequest.revisionId !== persistedChangesRequest.revisionId
      || latestChangesRequest.contentHash !== persistedChangesRequest.contentHash
    )
  );
  const changesRequest = legacyApprovalNeedsReview
    ? { revisionId: currentRevisionId, contentHash }
    : latestChangesRequest
      ? { revisionId: latestChangesRequest.revisionId, contentHash: latestChangesRequest.contentHash }
      : persistedChangesRequest
        ?? (raw.status === "changes_requested" ? { revisionId: currentRevisionId, contentHash } : undefined);
  return {
    ...raw,
    ...question,
    id: raw.id,
    questionId: publicQuestionId,
    sourceReferences,
    status: legacyApprovalNeedsReview ? "changes_requested" : raw.status,
    version: Number(raw.version) || 1,
    revisionNumber,
    currentRevisionId,
    contentHash,
    changesRequestedRevisionId: changesRequest?.revisionId,
    changesRequestedContentHash: changesRequest?.contentHash,
    changesRequestedEvidenceConflict: changesRequestedEvidenceConflict || undefined,
    revisions: revisions.length > 0
      ? revisions
      : (["approved", "published"].includes(raw.status) && !legacyApprovalNeedsReview ? [] : [migratedRevision]),
    validationIssues: [
      ...(Array.isArray(raw.validationIssues) ? raw.validationIssues : []),
      ...(legacyApprovalNeedsReview ? ["Legacy approval reopened: structured sources and independent reviewer attestation are required."] : []),
    ],
    reviewComments,
    doctrinalFlags: Array.isArray(raw.doctrinalFlags) ? raw.doctrinalFlags : [],
    referenceFlags: Array.isArray(raw.referenceFlags) ? raw.referenceFlags : [],
    history: Array.isArray(raw.history) ? raw.history : [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isCompleteMigrationProjection(raw: unknown): boolean {
  if (!isRecord(raw)) return false;
  if (
    typeof raw.id !== "string"
    || typeof raw.questionId !== "string"
    || typeof raw.currentRevisionId !== "string"
    || !isSha256Hash(raw.contentHash)
    || !Number.isSafeInteger(raw.version)
    || Number(raw.version) < 1
    || !Number.isSafeInteger(raw.revisionNumber)
    || Number(raw.revisionNumber) < 1
    || !Array.isArray(raw.revisions)
    || !Array.isArray(raw.reviewComments)
    || !Array.isArray(raw.history)
    || !Array.isArray(raw.validationIssues)
    || !Array.isArray(raw.doctrinalFlags)
    || !Array.isArray(raw.referenceFlags)
  ) {
    return false;
  }

  return raw.revisions.some((candidate) => (
    isRecord(candidate)
    && candidate.id === raw.currentRevisionId
    && candidate.contentHash === raw.contentHash
    && candidate.revisionNumber === raw.revisionNumber
  ));
}

function parseMigrationProjection(payload: unknown): { complete: boolean; item: WorkflowItem | null } {
  try {
    const raw = parseWorkflowDatabaseJson<unknown>(payload);
    if (!isRecord(raw)) return { complete: false, item: null };
    return {
      complete: isCompleteMigrationProjection(raw),
      item: hydrateWorkflowItem(raw as unknown as WorkflowItem),
    };
  } catch {
    return { complete: false, item: null };
  }
}

function compareIsoTimestamps(left: string, right: string): number {
  const leftTimestamp = Date.parse(left);
  const rightTimestamp = Date.parse(right);
  const normalizedLeft = Number.isFinite(leftTimestamp) ? leftTimestamp : 0;
  const normalizedRight = Number.isFinite(rightTimestamp) ? rightTimestamp : 0;
  return normalizedLeft - normalizedRight;
}

function chooseMigrationProjectionBase(
  source: WorkflowItem,
  existing: WorkflowItem,
  existingProjectionComplete: boolean
): WorkflowItem {
  // Migration precedence is deliberately monotonic: repair an incomplete projection first,
  // otherwise prefer the higher content revision, then database state for a divergent hash,
  // then the higher workflow version, then the newer timestamp. Exact ties stay in the database.
  if (!existingProjectionComplete) return source;
  if (source.revisionNumber !== existing.revisionNumber) {
    return source.revisionNumber > existing.revisionNumber ? source : existing;
  }

  // A same-number/different-hash revision is divergent rather than provably older.
  // Keep the database copy so a file bootstrap can never replace live authored work.
  if (source.contentHash !== existing.contentHash) return existing;
  if (source.version !== existing.version) return source.version > existing.version ? source : existing;
  return compareIsoTimestamps(source.updatedAt, existing.updatedAt) > 0 ? source : existing;
}

function mergeMigrationRecords<T extends { id: string }>(
  source: T[],
  existing: T[],
  compare: (left: T, right: T) => number
): T[] {
  const merged = new Map<string, T>();
  for (const record of source) {
    if (record?.id) merged.set(record.id, record);
  }
  // Database evidence wins if the same immutable identifier somehow diverged.
  for (const record of existing) {
    if (record?.id) merged.set(record.id, record);
  }
  return [...merged.values()].sort(compare);
}

function mergeMigrationStrings(source: string[], existing: string[]): string[] {
  return [...new Set([...source, ...existing].filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function reconcileMigrationProjection(
  source: WorkflowItem,
  persistedItemId: string,
  existing: WorkflowItem | null,
  existingProjectionComplete: boolean
): WorkflowItem {
  if (!existing) return { ...source, id: persistedItemId };
  const base = chooseMigrationProjectionBase(source, existing, existingProjectionComplete);
  return {
    ...base,
    id: persistedItemId,
    revisions: mergeMigrationRecords(source.revisions, existing.revisions, (left, right) => (
      left.revisionNumber - right.revisionNumber
      || compareIsoTimestamps(left.createdAt, right.createdAt)
      || left.id.localeCompare(right.id)
    )),
    reviewComments: mergeMigrationRecords(source.reviewComments, existing.reviewComments, (left, right) => (
      compareIsoTimestamps(left.createdAt, right.createdAt) || left.id.localeCompare(right.id)
    )),
    history: mergeMigrationRecords(source.history, existing.history, (left, right) => (
      compareIsoTimestamps(right.createdAt, left.createdAt) || left.id.localeCompare(right.id)
    )),
    validationIssues: mergeMigrationStrings(source.validationIssues, existing.validationIssues),
    doctrinalFlags: mergeMigrationStrings(source.doctrinalFlags, existing.doctrinalFlags),
    referenceFlags: mergeMigrationStrings(source.referenceFlags, existing.referenceFlags),
  };
}

function matchesFilters(item: WorkflowItem, filters: WorkflowFilters): boolean {
  if (filters.status && item.status !== filters.status) return false;
  if (filters.topicId && item.topicId !== filters.topicId) return false;
  if (filters.authorId && item.authorId !== filters.authorId) return false;
  if (filters.reviewerId && item.reviewerId !== filters.reviewerId) return false;
  const search = filters.search?.trim().toLowerCase();
  if (search) {
    const haystack = `${item.id} ${item.questionId} ${item.question} ${item.topicId} ${item.tags.join(" ")}`.toLowerCase();
    if (!haystack.includes(search)) return false;
  }
  return true;
}

function databaseItemSql(prefix: "INSERT" | "UPDATE", executor: WorkflowDatabaseExecutor): string {
  const json = databaseJsonCast(executor);
  if (prefix === "INSERT") {
    return `INSERT INTO content_workflow_items
      (id, question_id, question_id_normalized, topic_id, status, author_id, reviewer_id, current_revision_id, content_hash, payload, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ${json}, ?, ?)`;
  }
  return `UPDATE content_workflow_items SET
    question_id = ?, question_id_normalized = ?, topic_id = ?, status = ?, author_id = ?, reviewer_id = ?, current_revision_id = ?,
    content_hash = ?, payload = ${json}, updated_at = ? WHERE id = ?`;
}

async function insertRevision(executor: WorkflowDatabaseExecutor, itemId: string, revision: WorkflowRevisionSnapshot): Promise<void> {
  await executor.query(
    `INSERT INTO content_workflow_revisions
      (id, workflow_item_id, revision_number, content_hash, snapshot, created_by, created_at)
      VALUES (?, ?, ?, ?, ${databaseJsonCast(executor)}, ?, ?)`,
    [revision.id, itemId, revision.revisionNumber, revision.contentHash, JSON.stringify(revision), revision.createdBy, revision.createdAt]
  );
}

async function insertReview(executor: WorkflowDatabaseExecutor, itemId: string, review: WorkflowReviewComment): Promise<void> {
  await executor.query(
    `INSERT INTO content_review_records
      (id, workflow_item_id, revision_id, content_hash, reviewer_id, decision, comment, attestation, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ${databaseJsonCast(executor)}, ?)`,
    [review.id, itemId, review.revisionId, review.contentHash, review.authorId, review.decision, review.body, review.attestation ? JSON.stringify(review.attestation) : null, review.createdAt]
  );
}

async function insertEvent(executor: WorkflowDatabaseExecutor, itemId: string, event: WorkflowHistoryEvent, contentHash?: string): Promise<void> {
  await executor.query(
    `INSERT INTO content_workflow_events
      (id, workflow_item_id, event_type, actor_id, content_hash, event, created_at)
      VALUES (?, ?, ?, ?, ?, ${databaseJsonCast(executor)}, ?)`,
    [event.id, itemId, event.type, event.actorId, contentHash || null, JSON.stringify(event), event.createdAt]
  );
}

function duplicateSafeInsert(sql: string, executor: WorkflowDatabaseExecutor): string {
  return executor.dialect === "postgres"
    ? `${sql} ON CONFLICT DO NOTHING`
    : sql.replace(/^INSERT\s+/i, "INSERT IGNORE ");
}

async function insertMigrationRevision(executor: WorkflowDatabaseExecutor, itemId: string, revision: WorkflowRevisionSnapshot): Promise<void> {
  await executor.query(
    duplicateSafeInsert(
      `INSERT INTO content_workflow_revisions
        (id, workflow_item_id, revision_number, content_hash, snapshot, created_by, created_at)
        VALUES (?, ?, ?, ?, ${databaseJsonCast(executor)}, ?, ?)`,
      executor
    ),
    [revision.id, itemId, revision.revisionNumber, revision.contentHash, JSON.stringify(revision), revision.createdBy, revision.createdAt]
  );
}

async function insertMigrationReview(executor: WorkflowDatabaseExecutor, itemId: string, review: WorkflowReviewComment): Promise<void> {
  if (!["approved", "rejected", "changes_requested"].includes(review.decision) || !review.revisionId || !isSha256Hash(review.contentHash)) return;
  await executor.query(
    duplicateSafeInsert(
      `INSERT INTO content_review_records
        (id, workflow_item_id, revision_id, content_hash, reviewer_id, decision, comment, attestation, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ${databaseJsonCast(executor)}, ?)`,
      executor
    ),
    [review.id, itemId, review.revisionId, review.contentHash, review.authorId, review.decision, review.body, review.attestation ? JSON.stringify(review.attestation) : null, review.createdAt]
  );
}

async function insertMigrationEvent(executor: WorkflowDatabaseExecutor, itemId: string, event: WorkflowHistoryEvent, contentHash: string): Promise<void> {
  if (!event.id || !event.type || !event.actorId || !event.createdAt) return;
  await executor.query(
    duplicateSafeInsert(
      `INSERT INTO content_workflow_events
        (id, workflow_item_id, event_type, actor_id, content_hash, event, created_at)
        VALUES (?, ?, ?, ?, ?, ${databaseJsonCast(executor)}, ?)`,
      executor
    ),
    [event.id, itemId, event.type, event.actorId, contentHash, JSON.stringify(event), event.createdAt]
  );
}

async function insertMigrationOutbox(executor: WorkflowDatabaseExecutor, record: WorkflowPublicationOutboxRecord, targetItemId: string): Promise<void> {
  if (!record.idempotencyKey || !record.revisionId || !isSha256Hash(record.contentHash)) return;
  await executor.query(
    duplicateSafeInsert(
      `INSERT INTO content_publication_outbox
        (idempotency_key, workflow_item_id, revision_id, content_hash, status, attempts, lease_expires_at, last_error,
         engine_result, created_at, updated_at, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${databaseJsonCast(executor)}, ?, ?, ?)`,
      executor
    ),
    [
      record.idempotencyKey,
      targetItemId,
      record.revisionId,
      record.contentHash,
      record.status,
      Math.max(0, Number(record.attempts) || 0),
      record.leaseExpiresAt || null,
      record.lastError || null,
      record.engineResult ? JSON.stringify(record.engineResult) : null,
      record.createdAt,
      record.updatedAt,
      record.completedAt || null,
    ]
  );
}

async function saveNewDatabaseItem(executor: WorkflowDatabaseExecutor, mutation: WorkflowMutation): Promise<void> {
  const item = mutation.item;
  await executor.query(databaseItemSql("INSERT", executor), [
    item.id,
    item.questionId,
    item.questionId.toLowerCase(),
    item.topicId,
    item.status,
    item.authorId,
    item.reviewerId || null,
    item.currentRevisionId,
    item.contentHash,
    JSON.stringify(item),
    item.createdAt,
    item.updatedAt,
  ]);
  if (mutation.revision) await insertRevision(executor, item.id, mutation.revision);
  if (mutation.review) await insertReview(executor, item.id, mutation.review);
  await insertEvent(executor, item.id, mutation.event, item.contentHash);
}

async function updateDatabaseItem(executor: WorkflowDatabaseExecutor, mutation: WorkflowMutation): Promise<void> {
  const item = mutation.item;
  await executor.query(databaseItemSql("UPDATE", executor), [
    item.questionId,
    item.questionId.toLowerCase(),
    item.topicId,
    item.status,
    item.authorId,
    item.reviewerId || null,
    item.currentRevisionId,
    item.contentHash,
    JSON.stringify(item),
    item.updatedAt,
    item.id,
  ]);
  if (mutation.revision) await insertRevision(executor, item.id, mutation.revision);
  if (mutation.review) await insertReview(executor, item.id, mutation.review);
  await insertEvent(executor, item.id, mutation.event, item.contentHash);
}

async function updateMigrationProjection(executor: WorkflowDatabaseExecutor, item: WorkflowItem): Promise<void> {
  await executor.query(databaseItemSql("UPDATE", executor), [
    item.questionId,
    item.questionId.toLowerCase(),
    item.topicId,
    item.status,
    item.authorId,
    item.reviewerId || null,
    item.currentRevisionId,
    item.contentHash,
    JSON.stringify(item),
    item.updatedAt,
    item.id,
  ]);
}

async function verifyDatabaseChangesRequestEvidence(
  executor: WorkflowDatabaseExecutor,
  item: WorkflowItem,
  forUpdate: boolean
): Promise<WorkflowItem> {
  const rows = await executor.query<{
    id: string;
    revision_id: string;
    content_hash: string;
    created_at: string;
  }>(
    `SELECT id, revision_id, content_hash, created_at FROM content_review_records
      WHERE workflow_item_id = ? AND decision = ? ORDER BY created_at DESC, id DESC LIMIT 1${forUpdate ? " FOR UPDATE" : ""}`,
    [item.id, "changes_requested"]
  );
  const databaseReview = rows[0];
  const payloadReview = latestChangesRequestedReview(item.reviewComments);
  const databaseReviewIsValid = Boolean(
    databaseReview
    && typeof databaseReview.revision_id === "string"
    && databaseReview.revision_id.length > 0
    && isSha256Hash(databaseReview.content_hash)
  );
  const databaseReviewMatchesPayload = Boolean(
    databaseReview
    && databaseReviewIsValid
    && payloadReview
    && payloadReview.id === databaseReview.id
    && payloadReview.revisionId === databaseReview.revision_id
    && payloadReview.contentHash === databaseReview.content_hash
    && payloadReview.createdAt === databaseReview.created_at
  );
  const evidenceConflict = item.changesRequestedEvidenceConflict === true
    || Boolean(databaseReview && !databaseReviewMatchesPayload)
    || Boolean(payloadReview && !databaseReview);

  return evidenceConflict ? { ...item, changesRequestedEvidenceConflict: true } : item;
}

async function assertDatabaseApprovalEvidence(
  executor: WorkflowDatabaseExecutor,
  item: WorkflowItem,
  payloadApproval: WorkflowReviewComment
): Promise<void> {
  const rows = await executor.query<{
    id: unknown;
    revision_id: unknown;
    content_hash: unknown;
    reviewer_id: unknown;
    comment: unknown;
    attestation: unknown;
    created_at: unknown;
  }>(
    `SELECT id, revision_id, content_hash, reviewer_id, comment, attestation, created_at FROM content_review_records
      WHERE workflow_item_id = ? AND decision = ? ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE`,
    [item.id, "approved"]
  );
  const databaseApproval = rows[0];
  let databaseAttestation: unknown = null;
  try {
    databaseAttestation = databaseApproval
      ? parseWorkflowDatabaseJson<unknown>(databaseApproval.attestation)
      : null;
  } catch {
    throw approvalEvidenceConflict();
  }
  if (
    !databaseApproval
    || databaseApproval.id !== payloadApproval.id
    || databaseApproval.revision_id !== payloadApproval.revisionId
    || databaseApproval.revision_id !== item.approvedRevisionId
    || databaseApproval.content_hash !== payloadApproval.contentHash
    || databaseApproval.content_hash !== item.approvedContentHash
    || databaseApproval.reviewer_id !== payloadApproval.authorId
    || databaseApproval.reviewer_id !== item.reviewerId
    || databaseApproval.comment !== payloadApproval.body
    || databaseApproval.created_at !== payloadApproval.createdAt
    || !attestationsMatch(databaseAttestation, payloadApproval.attestation)
    || !attestationsMatch(databaseAttestation, item.approvalAttestation)
  ) {
    throw approvalEvidenceConflict();
  }
}

async function loadDatabaseItem(executor: WorkflowDatabaseExecutor, id: string, forUpdate = false): Promise<WorkflowItem | null> {
  const rows = await executor.query<{ payload: unknown }>(
    `SELECT payload FROM content_workflow_items WHERE id = ? OR question_id = ? LIMIT 1${forUpdate ? " FOR UPDATE" : ""}`,
    [id, id]
  );
  if (!rows[0]?.payload) return null;
  const item = hydrateWorkflowItem(parseWorkflowDatabaseJson<WorkflowItem>(rows[0].payload));
  return verifyDatabaseChangesRequestEvidence(executor, item, forUpdate);
}

export async function migrateWorkflowSourcesToDatabase(
  database: WorkflowDatabase,
  editorialState: WorkflowFileState,
  legacyItems: WorkflowItem[]
): Promise<void> {
  const targetItemIds = new Map<string, string>();
  const sourceItems = [
    ...(Array.isArray(editorialState.items) ? editorialState.items : []),
    ...(Array.isArray(legacyItems) ? legacyItems : []),
  ];

  for (const raw of sourceItems) {
    const item = hydrateWorkflowItem(raw);
    const targetItemId = await database.transaction(async (executor) => {
      await executor.query(duplicateSafeInsert(databaseItemSql("INSERT", executor), executor), [
        item.id,
        item.questionId,
        item.questionId.toLowerCase(),
        item.topicId,
        item.status,
        item.authorId,
        item.reviewerId || null,
        item.currentRevisionId,
        item.contentHash,
        JSON.stringify(item),
        item.createdAt,
        item.updatedAt,
      ]);

      let rows = await executor.query<{ id: string; payload: unknown }>(
        "SELECT id, payload FROM content_workflow_items WHERE id = ? LIMIT 1 FOR UPDATE",
        [item.id]
      );
      if (rows.length === 0) {
        rows = await executor.query<{ id: string; payload: unknown }>(
          "SELECT id, payload FROM content_workflow_items WHERE question_id_normalized = ? LIMIT 1 FOR UPDATE",
          [item.questionId.toLowerCase()]
        );
      }
      const persistedRow = rows[0];
      const persistedItemId = persistedRow?.id;
      if (!persistedItemId) throw new Error("Migrated workflow item could not be located after insert.");

      const existingProjection = parseMigrationProjection(persistedRow.payload);
      const reconciled = reconcileMigrationProjection(
        item,
        persistedItemId,
        existingProjection.item,
        existingProjection.complete
      );
      await updateMigrationProjection(executor, reconciled);

      for (const revision of reconciled.revisions) await insertMigrationRevision(executor, persistedItemId, revision);
      for (const review of reconciled.reviewComments) await insertMigrationReview(executor, persistedItemId, review);
      for (const event of reconciled.history) await insertMigrationEvent(executor, persistedItemId, event, reconciled.contentHash);
      return persistedItemId;
    });
    targetItemIds.set(item.id, targetItemId);
  }

  for (const record of Array.isArray(editorialState.outbox) ? editorialState.outbox : []) {
    const targetItemId = targetItemIds.get(record.workflowItemId) ?? record.workflowItemId;
    await database.transaction((executor) => insertMigrationOutbox(executor, record, targetItemId));
  }
}

async function ensureWorkflowMigration(): Promise<void> {
  if (migrationPromise) return migrationPromise;
  const pending = (async () => {
    if (!workflowDatabaseEnabled()) return;
    await ensureWorkflowDatabaseSchema();
    const database = await getWorkflowDatabase();
    const [editorialState, legacyItems] = await Promise.all([
      editorialFileStore.read(),
      legacyWorkflowStore.read(),
    ]);
    await migrateWorkflowSourcesToDatabase(database, editorialState, legacyItems);
  })();
  migrationPromise = pending;
  try {
    await pending;
  } catch (error) {
    if (migrationPromise === pending) migrationPromise = null;
    throw error;
  }
}

async function readFileState(): Promise<WorkflowFileState> {
  const state = await editorialFileStore.read();
  if (state.items.length > 0) return { ...state, items: state.items.map(hydrateWorkflowItem) };
  const legacyItems = await legacyWorkflowStore.read();
  if (legacyItems.length === 0) return state;
  const migrated = { ...EMPTY_FILE_STATE, items: legacyItems.map(hydrateWorkflowItem) };
  await editorialFileStore.write(migrated);
  return migrated;
}

async function mutateFileState<T>(mutation: (state: WorkflowFileState) => Promise<T> | T): Promise<T> {
  let result!: T;
  const operation = workflowMutationQueue.then(async () => {
    const state = await readFileState();
    result = await mutation(state);
    await editorialFileStore.write(state);
  });
  workflowMutationQueue = operation.catch(() => undefined);
  await operation;
  return result;
}

function normalizePersistenceConflict(error: unknown): never {
  const message = error instanceof Error ? error.message : "";
  if (/duplicate|unique constraint|unique entry/i.test(message)) {
    throw new WorkflowConflictError("Question ID already exists in workflow storage.");
  }
  throw error;
}

function assertUniqueQuestionId(items: WorkflowItem[], questionId: string, excludedItemId?: string): void {
  const normalizedId = questionId.trim().toLowerCase();
  if (items.some((item) => item.id !== excludedItemId && item.questionId.trim().toLowerCase() === normalizedId)) {
    throw new WorkflowConflictError(`Question ID ${questionId} already exists in workflow storage.`);
  }
}

export async function listWorkflowItems(filters: WorkflowFilters = {}): Promise<WorkflowItem[]> {
  if (!workflowDatabaseEnabled()) {
    return (await readFileState()).items.filter((item) => matchesFilters(item, filters));
  }
  await ensureWorkflowMigration();
  const database = await getWorkflowDatabase();
  const conditions: string[] = [];
  const values: unknown[] = [];
  for (const [column, value] of [
    ["status", filters.status],
    ["topic_id", filters.topicId],
    ["author_id", filters.authorId],
    ["reviewer_id", filters.reviewerId],
  ] as const) {
    if (value) {
      conditions.push(`${column} = ?`);
      values.push(value);
    }
  }
  const rows = await database.query<{ payload: unknown }>(
    `SELECT payload FROM content_workflow_items${conditions.length ? ` WHERE ${conditions.join(" AND ")}` : ""} ORDER BY updated_at DESC`,
    values
  );
  return rows.map((row) => hydrateWorkflowItem(parseWorkflowDatabaseJson<WorkflowItem>(row.payload))).filter((item) => matchesFilters(item, filters));
}

export async function getWorkflowItem(id: string): Promise<WorkflowItem | null> {
  if (!workflowDatabaseEnabled()) return (await readFileState()).items.find((item) => item.id === id || item.questionId === id) ?? null;
  await ensureWorkflowMigration();
  return loadDatabaseItem(await getWorkflowDatabase(), id);
}

export async function createWorkflowDraft(
  input: Partial<Question>,
  actor: CurrentUser,
  topicIds: string[],
  existingIds: string[],
  submit = false
): Promise<WorkflowItem> {
  const question = normalizeWorkflowQuestion(input);
  const sourceReferences = normalizeEditorialSources(question.sourceReferences);
  const status: ReviewStatus = submit ? "submitted" : "draft";
  const timestamp = nowIso();
  const revision = createRevision(question, actor, 1, timestamp);
  const validationIssues = [
    ...validateQuestion(question, { topicIds, existingIds }).map((issue) => issue.message),
    ...validateEditorialSources(sourceReferences).map((issue) => issue.message),
  ];
  const event = history(actor, submit ? "submitted" : "draft_created", submit ? "Draft created and submitted." : "Draft created.", {
    revisionId: revision.id,
    contentHash: revision.contentHash,
  });
  const item: WorkflowItem = {
    ...questionForPublication(question, sourceReferences),
    id: newId("wf"),
    questionId: question.id,
    sourceReferences,
    status,
    authorId: actor.id,
    authorName: actor.displayName,
    createdAt: timestamp,
    updatedAt: timestamp,
    submittedAt: submit ? timestamp : undefined,
    version: 1,
    revisionNumber: 1,
    currentRevisionId: revision.id,
    contentHash: revision.contentHash,
    revisions: [revision],
    validationIssues,
    reviewComments: [],
    doctrinalFlags: [],
    referenceFlags: [],
    history: [event],
  };
  assertValidForStatus(item, status, topicIds, existingIds);

  if (!workflowDatabaseEnabled()) {
    return mutateFileState((state) => {
      assertUniqueQuestionId(state.items, item.questionId);
      state.items.unshift(item);
      return item;
    });
  }
  await ensureWorkflowMigration();
  const database = await getWorkflowDatabase();
  try {
    await database.transaction((executor) => saveNewDatabaseItem(executor, { item, revision, event }));
    return item;
  } catch (error) {
    return normalizePersistenceConflict(error);
  }
}

export async function updateWorkflowDraft(
  id: string,
  input: Partial<Question>,
  actor: CurrentUser,
  topicIds: string[],
  existingIds: string[]
): Promise<WorkflowItem> {
  const mutate = (item: WorkflowItem, allItems?: WorkflowItem[]): WorkflowMutation => {
    if (!["draft", "changes_requested"].includes(item.status)) {
      throw new WorkflowConflictError("Only a draft or changes-requested revision can be edited.");
    }
    const question = normalizeWorkflowQuestion({ ...item, ...input, id: input.id ?? item.questionId });
    if (allItems) assertUniqueQuestionId(allItems, question.id, item.id);
    const sourceReferences = normalizeEditorialSources(question.sourceReferences);
    const revisionNumber = item.revisionNumber + 1;
    const revision = createRevision(question, actor, revisionNumber);
    const event = history(actor, "draft_updated", "Draft updated as a new immutable revision.", {
      previousRevisionId: item.currentRevisionId,
      revisionId: revision.id,
      contentHash: revision.contentHash,
    });
    const updated: WorkflowItem = {
      ...item,
      ...questionForPublication(question, sourceReferences),
      id: item.id,
      questionId: question.id,
      sourceReferences,
      updatedAt: event.createdAt,
      version: item.version + 1,
      revisionNumber,
      currentRevisionId: revision.id,
      contentHash: revision.contentHash,
      revisions: [...item.revisions, revision],
      reviewerId: undefined,
      reviewerName: undefined,
      reviewedAt: undefined,
      approvedRevisionId: undefined,
      approvedContentHash: undefined,
      approvalAttestation: undefined,
      validationIssues: [
        ...validateQuestion(question, { topicIds, existingIds }).map((issue) => issue.message),
        ...validateEditorialSources(sourceReferences).map((issue) => issue.message),
      ],
      history: [event, ...item.history],
    };
    return { item: updated, revision, event };
  };

  if (!workflowDatabaseEnabled()) {
    return mutateFileState((state) => {
      const index = state.items.findIndex((candidate) => candidate.id === id);
      if (index < 0) throw new Error("Workflow item not found.");
      const mutation = mutate(state.items[index], state.items);
      state.items[index] = mutation.item;
      return mutation.item;
    });
  }
  await ensureWorkflowMigration();
  const database = await getWorkflowDatabase();
  try {
    return await database.transaction(async (executor) => {
      const item = await loadDatabaseItem(executor, id, true);
      if (!item) throw new Error("Workflow item not found.");
      const mutation = mutate(item);
      const duplicates = await executor.query<{ id: string }>(
        "SELECT id FROM content_workflow_items WHERE question_id_normalized = ? AND id <> ? LIMIT 1",
        [mutation.item.questionId.toLowerCase(), mutation.item.id]
      );
      if (duplicates.length > 0) throw new WorkflowConflictError(`Question ID ${mutation.item.questionId} already exists in workflow storage.`);
      await updateDatabaseItem(executor, mutation);
      return mutation.item;
    });
  } catch (error) {
    if (error instanceof WorkflowConflictError || error instanceof WorkflowValidationError) throw error;
    return normalizePersistenceConflict(error);
  }
}

export async function duplicatePublishedQuestion(question: Question, actor: CurrentUser, topicIds: string[], existingIds: string[]): Promise<WorkflowItem> {
  return createWorkflowDraft({ ...question, id: `${question.id}_draft`, sourceReferences: [] }, actor, topicIds, existingIds, false);
}

export async function transitionWorkflowItem(
  id: string,
  nextStatus: ReviewStatus,
  actor: CurrentUser,
  options: {
    comment?: string;
    doctrinalFlag?: boolean;
    referenceFlag?: boolean;
    attestation?: unknown;
    topicIds?: string[];
    existingIds?: string[];
  } = {}
): Promise<WorkflowItem> {
  if (nextStatus === "published") {
    throw new WorkflowPublicationError("Publication must use the guarded outbox workflow.");
  }
  const mutate = (item: WorkflowItem): WorkflowMutation => {
    if (!canTransitionStatus(item.status, nextStatus)) {
      throw new WorkflowConflictError(`Cannot move workflow item from ${item.status} to ${nextStatus}.`);
    }
    if (item.status === "changes_requested" && nextStatus === "submitted") {
      if (item.changesRequestedEvidenceConflict) {
        throw new WorkflowConflictError("Requested-change audit evidence is inconsistent; repair the stored review record before resubmission.");
      }
      const sameRevision = item.currentRevisionId === item.changesRequestedRevisionId;
      const sameContent = item.contentHash === item.changesRequestedContentHash;
      if (sameRevision || sameContent) {
        throw new WorkflowConflictError("Requested changes must be saved as a new immutable revision with changed content before resubmission.");
      }
    }
    assertValidForStatus(item, nextStatus, options.topicIds ?? [], options.existingIds ?? []);
    const isReview = ["approved", "rejected", "changes_requested"].includes(nextStatus);
    const currentRevision = item.revisions.find((revision) => (
      revision.id === item.currentRevisionId && revision.contentHash === item.contentHash
    ));
    if (isReview && !currentRevision) {
      throw new WorkflowConflictError("The current immutable revision snapshot is unavailable or invalid.");
    }
    if (isReview && (actor.id === item.authorId || actor.id === currentRevision?.createdBy)) {
      throw new WorkflowConflictError("An author cannot review or approve their own revision; another reviewer must decide the current immutable revision.");
    }
    const reviewerComment = options.comment?.trim() || "";
    if (isReview && reviewerComment.length < 10) {
      throw new WorkflowValidationError("A reviewer comment of at least 10 characters is required for every decision.");
    }

    let attestation: WorkflowReviewerAttestation | undefined;
    if (nextStatus === "approved") {
      if (options.doctrinalFlag || options.referenceFlag) {
        throw new WorkflowValidationError("A flagged doctrinal or reference issue must be resolved before approval.");
      }
      try {
        attestation = normalizeReviewerAttestation(options.attestation);
      } catch (error) {
        throw new WorkflowValidationError(error instanceof Error ? error.message : "Reviewer attestation is invalid.");
      }
      const recomputedHash = computeEditorialContentHash(workflowItemQuestion(item), item.sourceReferences);
      if (recomputedHash !== item.contentHash) throw new WorkflowConflictError("The submitted revision hash no longer matches its content.");
    }

    const timestamp = nowIso();
    const review: WorkflowReviewComment | undefined = isReview ? {
      id: newId("comment"),
      authorId: actor.id,
      authorName: actor.displayName,
      authorRole: actor.role,
      body: reviewerComment,
      createdAt: timestamp,
      doctrinalFlag: options.doctrinalFlag,
      referenceFlag: options.referenceFlag,
      decision: nextStatus as WorkflowReviewComment["decision"],
      revisionId: item.currentRevisionId,
      contentHash: item.contentHash,
      attestation,
    } : undefined;
    const event = history(actor, nextStatus, `Workflow marked ${nextStatus.replace("_", " ")}.`, {
      revisionId: item.currentRevisionId,
      contentHash: item.contentHash,
      attested: Boolean(attestation),
    });
    const resubmitted = nextStatus === "submitted";
    const updated: WorkflowItem = {
      ...item,
      status: nextStatus,
      updatedAt: timestamp,
      submittedAt: resubmitted ? timestamp : item.submittedAt,
      reviewedAt: isReview ? timestamp : (resubmitted ? undefined : item.reviewedAt),
      archivedAt: nextStatus === "archived" ? timestamp : item.archivedAt,
      reviewerId: isReview ? actor.id : (resubmitted ? undefined : item.reviewerId),
      reviewerName: isReview ? actor.displayName : (resubmitted ? undefined : item.reviewerName),
      changesRequestedRevisionId: nextStatus === "changes_requested" ? item.currentRevisionId : item.changesRequestedRevisionId,
      changesRequestedContentHash: nextStatus === "changes_requested" ? item.contentHash : item.changesRequestedContentHash,
      approvedRevisionId: nextStatus === "approved" ? item.currentRevisionId : (resubmitted || isReview ? undefined : item.approvedRevisionId),
      approvedContentHash: nextStatus === "approved" ? item.contentHash : (resubmitted || isReview ? undefined : item.approvedContentHash),
      approvalAttestation: nextStatus === "approved" ? attestation : (resubmitted || isReview ? undefined : item.approvalAttestation),
      version: item.version + 1,
      reviewComments: review ? [...item.reviewComments, review] : item.reviewComments,
      doctrinalFlags: options.doctrinalFlag ? [...item.doctrinalFlags, actor.id] : item.doctrinalFlags,
      referenceFlags: options.referenceFlag ? [...item.referenceFlags, actor.id] : item.referenceFlags,
      history: [event, ...item.history],
    };
    return { item: updated, review, event };
  };

  if (!workflowDatabaseEnabled()) {
    return mutateFileState((state) => {
      const index = state.items.findIndex((candidate) => candidate.id === id);
      if (index < 0) throw new Error("Workflow item not found.");
      const mutation = mutate(state.items[index]);
      state.items[index] = mutation.item;
      return mutation.item;
    });
  }
  await ensureWorkflowMigration();
  const database = await getWorkflowDatabase();
  return database.transaction(async (executor) => {
    const item = await loadDatabaseItem(executor, id, true);
    if (!item) throw new Error("Workflow item not found.");
    const mutation = mutate(item);
    await updateDatabaseItem(executor, mutation);
    return mutation.item;
  });
}

function publicationKey(item: WorkflowItem): string {
  return `publish:${item.id}:${item.approvedRevisionId}:${item.approvedContentHash}`;
}

function publicationLeaseExpiry(): string {
  const seconds = getEditorialPublishLeaseSeconds();
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function assertApprovedRevisionIntegrity(
  item: WorkflowItem
): { revision: WorkflowRevisionSnapshot; approval: WorkflowReviewComment } {
  if (item.status !== "approved" && item.status !== "published") {
    throw new WorkflowConflictError("Only an approved revision can be published.");
  }
  if (
    typeof item.authorId !== "string"
    || item.authorId.trim().length === 0
    || item.authorId !== item.authorId.trim()
    || typeof item.reviewerId !== "string"
    || item.reviewerId.trim().length === 0
    || item.reviewerId !== item.reviewerId.trim()
    || item.reviewerId === item.authorId
  ) {
    throw new WorkflowConflictError("Publication requires an independent human reviewer.");
  }
  if (!item.approvedRevisionId || !item.approvedContentHash || !item.approvalAttestation) {
    throw new WorkflowConflictError("Publication requires an attested approval for the current revision.");
  }
  normalizeReviewerAttestation(item.approvalAttestation);
  if (item.approvedRevisionId !== item.currentRevisionId || item.approvedContentHash !== item.contentHash) {
    throw new WorkflowConflictError("Approved revision does not match the current immutable revision.");
  }
  let currentProjectionHash = "";
  try {
    currentProjectionHash = computeEditorialContentHash(workflowItemQuestion(item), item.sourceReferences);
  } catch {
    throw new WorkflowConflictError("Current workflow projection no longer matches the approved revision.");
  }
  if (currentProjectionHash !== item.contentHash) {
    throw new WorkflowConflictError("Current workflow projection no longer matches the approved revision.");
  }
  const revision = item.revisions.find((candidate) => candidate.id === item.approvedRevisionId);
  if (!revision || revision.contentHash !== item.approvedContentHash) throw new WorkflowConflictError("Approved revision snapshot is unavailable or invalid.");
  if (item.changesRequestedEvidenceConflict) throw new WorkflowConflictError("Publication is blocked because requested-change audit evidence is inconsistent.");
  if (
    typeof revision.createdBy !== "string"
    || revision.createdBy.trim().length === 0
    || revision.createdBy !== revision.createdBy.trim()
  ) {
    throw new WorkflowConflictError("Publication requires a known author for the approved revision.");
  }
  if (item.reviewerId === revision.createdBy) throw new WorkflowConflictError("Publication requires a reviewer independent from the approved revision's author.");
  const recomputedHash = computeEditorialContentHash(revision.question, revision.sourceReferences);
  if (recomputedHash !== revision.contentHash) throw new WorkflowConflictError("Approved revision content hash verification failed.");
  const approval = assertPayloadApprovalEvidence(item);
  return { revision, approval };
}

function assertPublishableApproval(
  item: WorkflowItem,
  topicIds: string[],
  existingIds: string[]
): { revision: WorkflowRevisionSnapshot; approval: WorkflowReviewComment } {
  assertValidForStatus(item, "published", topicIds, existingIds);
  return assertApprovedRevisionIntegrity(item);
}

function newOutbox(item: WorkflowItem, timestamp: string): WorkflowPublicationOutboxRecord {
  return {
    idempotencyKey: publicationKey(item),
    workflowItemId: item.id,
    revisionId: item.approvedRevisionId!,
    contentHash: item.approvedContentHash!,
    status: "processing",
    attempts: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    leaseExpiresAt: publicationLeaseExpiry(),
  };
}

function assertPublicationOutboxTuple(item: WorkflowItem, outbox: WorkflowPublicationOutboxRecord): void {
  if (
    outbox.idempotencyKey !== publicationKey(item)
    || outbox.workflowItemId !== item.id
    || outbox.revisionId !== item.approvedRevisionId
    || outbox.contentHash !== item.approvedContentHash
  ) {
    throw new WorkflowConflictError("Publication outbox evidence is missing or inconsistent.");
  }
}

function assertCompletedPublicationCoherence(item: WorkflowItem, outbox: WorkflowPublicationOutboxRecord): void {
  assertPublicationOutboxTuple(item, outbox);
  if (
    outbox.status !== "completed"
    || item.status !== "published"
    || item.publishTarget !== "engine"
    || item.publicationIdempotencyKey !== outbox.idempotencyKey
    || typeof item.publishedAt !== "string"
    || item.publishedAt.length === 0
    || typeof outbox.completedAt !== "string"
    || outbox.completedAt.length === 0
    || item.publishedAt !== outbox.completedAt
    || item.updatedAt !== outbox.updatedAt
    || outbox.completedAt !== outbox.updatedAt
  ) {
    throw new WorkflowConflictError("Completed publication evidence is missing or inconsistent.");
  }
}

function assertClaimedPublicationCoherence(
  item: WorkflowItem,
  outbox: WorkflowPublicationOutboxRecord,
  claimIdempotencyKey: string
): void {
  assertPublicationOutboxTuple(item, outbox);
  if (
    claimIdempotencyKey !== outbox.idempotencyKey
    || item.publicationIdempotencyKey !== outbox.idempotencyKey
  ) {
    throw new WorkflowConflictError("Publication claim evidence is missing or inconsistent.");
  }
}

function databaseOutboxRecord(row: Record<string, unknown>): WorkflowPublicationOutboxRecord {
  return {
    idempotencyKey: typeof row.idempotency_key === "string" ? row.idempotency_key : "",
    workflowItemId: typeof row.workflow_item_id === "string" ? row.workflow_item_id : "",
    revisionId: typeof row.revision_id === "string" ? row.revision_id : "",
    contentHash: typeof row.content_hash === "string" ? row.content_hash : "",
    status: row.status as WorkflowPublicationOutboxRecord["status"],
    attempts: Number(row.attempts),
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : "",
    leaseExpiresAt: typeof row.lease_expires_at === "string" ? row.lease_expires_at : undefined,
    completedAt: typeof row.completed_at === "string" ? row.completed_at : undefined,
  };
}

function findFilePublicationOutbox(
  state: WorkflowFileState,
  item: WorkflowItem,
  idempotencyKey: string
): WorkflowPublicationOutboxRecord | undefined {
  const candidates = state.outbox.filter((record) => (
    record.idempotencyKey === idempotencyKey || record.workflowItemId === item.id
  ));
  if (candidates.length > 1) {
    throw new WorkflowConflictError("Publication outbox evidence is missing or inconsistent.");
  }
  return candidates[0];
}

async function loadDatabasePublicationOutbox(
  executor: WorkflowDatabaseExecutor,
  item: WorkflowItem,
  idempotencyKey: string
): Promise<WorkflowPublicationOutboxRecord | undefined> {
  const rows = await executor.query<Record<string, unknown>>(
    "SELECT * FROM content_publication_outbox WHERE idempotency_key = ? OR workflow_item_id = ? ORDER BY created_at DESC FOR UPDATE",
    [idempotencyKey, item.id]
  );
  if (rows.length > 1) {
    throw new WorkflowConflictError("Publication outbox evidence is missing or inconsistent.");
  }
  return rows[0] ? databaseOutboxRecord(rows[0]) : undefined;
}

export async function prepareWorkflowPublication(
  id: string,
  actor: CurrentUser,
  topicIds: string[],
  existingIds: string[]
): Promise<WorkflowPublicationClaim> {
  if (!workflowDatabaseEnabled()) {
    return mutateFileState((state) => {
      const index = state.items.findIndex((candidate) => candidate.id === id);
      if (index < 0) throw new Error("Workflow item not found.");
      const item = state.items[index];
      const { revision } = assertPublishableApproval(item, topicIds, existingIds);
      const idempotencyKey = publicationKey(item);
      const existing = findFilePublicationOutbox(state, item, idempotencyKey);
      if (existing?.status === "completed") {
        assertCompletedPublicationCoherence(item, existing);
        return { item, question: revision.question, idempotencyKey, alreadyCompleted: true };
      }
      if (item.status === "published") {
        throw new WorkflowConflictError("Published content requires a coherent completed publication receipt.");
      }
      if (existing) {
        assertPublicationOutboxTuple(item, existing);
        if (existing.status !== "processing" && existing.status !== "failed") {
          throw new WorkflowConflictError("Publication outbox evidence is missing or inconsistent.");
        }
      }
      if (existing?.status === "processing" && existing.leaseExpiresAt && Date.parse(existing.leaseExpiresAt) > Date.now()) {
        throw new WorkflowConflictError("Publication is already in progress. Retry after the processing lease expires.");
      }
      const timestamp = nowIso();
      if (existing) {
        existing.status = "processing";
        existing.attempts += 1;
        existing.updatedAt = timestamp;
        existing.leaseExpiresAt = publicationLeaseExpiry();
        existing.lastError = undefined;
      } else state.outbox.push(newOutbox(item, timestamp));
      const event = history(actor, "publication_claimed", "Approved revision claimed for idempotent Engine publication.", {
        idempotencyKey,
        revisionId: revision.id,
        contentHash: revision.contentHash,
      });
      item.history.unshift(event);
      item.updatedAt = timestamp;
      item.version += 1;
      item.publicationIdempotencyKey = idempotencyKey;
      return { item, question: revision.question, idempotencyKey, alreadyCompleted: false };
    });
  }

  await ensureWorkflowMigration();
  const database = await getWorkflowDatabase();
  return database.transaction(async (executor) => {
    const item = await loadDatabaseItem(executor, id, true);
    if (!item) throw new Error("Workflow item not found.");
    const { revision, approval } = assertPublishableApproval(item, topicIds, existingIds);
    await assertDatabaseApprovalEvidence(executor, item, approval);
    const idempotencyKey = publicationKey(item);
    const existing = await loadDatabasePublicationOutbox(executor, item, idempotencyKey);
    if (existing?.status === "completed") {
      assertCompletedPublicationCoherence(item, existing);
      return { item, question: revision.question, idempotencyKey, alreadyCompleted: true };
    }
    if (item.status === "published") {
      throw new WorkflowConflictError("Published content requires a coherent completed publication receipt.");
    }
    if (existing) {
      assertPublicationOutboxTuple(item, existing);
      if (existing.status !== "processing" && existing.status !== "failed") {
        throw new WorkflowConflictError("Publication outbox evidence is missing or inconsistent.");
      }
    }
    if (existing?.status === "processing" && existing.leaseExpiresAt && Date.parse(existing.leaseExpiresAt) > Date.now()) {
      throw new WorkflowConflictError("Publication is already in progress. Retry after the processing lease expires.");
    }
    const timestamp = nowIso();
    if (existing) {
      await executor.query(
        "UPDATE content_publication_outbox SET status = ?, attempts = attempts + 1, lease_expires_at = ?, last_error = NULL, updated_at = ? WHERE idempotency_key = ?",
        ["processing", publicationLeaseExpiry(), timestamp, idempotencyKey]
      );
    } else {
      const outbox = newOutbox(item, timestamp);
      await executor.query(
        "INSERT INTO content_publication_outbox (idempotency_key, workflow_item_id, revision_id, content_hash, status, attempts, lease_expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [outbox.idempotencyKey, outbox.workflowItemId, outbox.revisionId, outbox.contentHash, outbox.status, outbox.attempts, outbox.leaseExpiresAt, outbox.createdAt, outbox.updatedAt]
      );
    }
    const event = history(actor, "publication_claimed", "Approved revision claimed for idempotent Engine publication.", {
      idempotencyKey,
      revisionId: revision.id,
      contentHash: revision.contentHash,
    });
    item.history.unshift(event);
    item.updatedAt = timestamp;
    item.version += 1;
    item.publicationIdempotencyKey = idempotencyKey;
    await updateDatabaseItem(executor, { item, event });
    return { item, question: revision.question, idempotencyKey, alreadyCompleted: false };
  });
}

export async function completeWorkflowPublication(
  claim: WorkflowPublicationClaim,
  actor: CurrentUser,
  engineResult: Record<string, unknown>
): Promise<WorkflowItem> {
  const complete = (
    item: WorkflowItem,
    outbox: WorkflowPublicationOutboxRecord,
    claimIdempotencyKey: string
  ): WorkflowMutation => {
    assertApprovedRevisionIntegrity(item);
    assertClaimedPublicationCoherence(item, outbox, claimIdempotencyKey);
    if (outbox.status === "completed") {
      assertCompletedPublicationCoherence(item, outbox);
      return { item, event: item.history[0] };
    }
    if (item.status !== "approved") {
      throw new WorkflowConflictError("Only an approved in-progress publication can be completed.");
    }
    if (outbox.status !== "processing") {
      throw new WorkflowConflictError("Only a processing publication claim can be completed.");
    }
    const timestamp = nowIso();
    outbox.status = "completed";
    outbox.updatedAt = timestamp;
    outbox.completedAt = timestamp;
    outbox.leaseExpiresAt = undefined;
    outbox.lastError = undefined;
    outbox.engineResult = engineResult;
    const event = history(actor, "published", "Approved revision published to the Engine.", {
      idempotencyKey: outbox.idempotencyKey,
      revisionId: outbox.revisionId,
      contentHash: outbox.contentHash,
    });
    return {
      item: {
        ...item,
        status: "published",
        publishedAt: timestamp,
        updatedAt: timestamp,
        version: item.version + 1,
        publishTarget: "engine",
        publicationIdempotencyKey: outbox.idempotencyKey,
        history: [event, ...item.history],
      },
      event,
    };
  };

  if (!workflowDatabaseEnabled()) {
    return mutateFileState((state) => {
      const index = state.items.findIndex((item) => item.id === claim.item.id);
      if (index < 0) throw new WorkflowPublicationError("Publication outbox record is unavailable.");
      const item = state.items[index];
      const outbox = findFilePublicationOutbox(state, item, claim.idempotencyKey);
      if (!outbox) throw new WorkflowPublicationError("Publication outbox record is unavailable.");
      const mutation = complete(item, outbox, claim.idempotencyKey);
      state.items[index] = mutation.item;
      return mutation.item;
    });
  }

  await ensureWorkflowMigration();
  const database = await getWorkflowDatabase();
  return database.transaction(async (executor) => {
    const item = await loadDatabaseItem(executor, claim.item.id, true);
    if (!item) throw new Error("Workflow item not found.");
    const { approval } = assertApprovedRevisionIntegrity(item);
    await assertDatabaseApprovalEvidence(executor, item, approval);
    const outbox = await loadDatabasePublicationOutbox(executor, item, claim.idempotencyKey);
    if (!outbox) throw new WorkflowPublicationError("Publication outbox record is unavailable.");
    if (outbox.status === "completed") {
      return complete(item, outbox, claim.idempotencyKey).item;
    }
    const mutation = complete(item, outbox, claim.idempotencyKey);
    await executor.query(
      `UPDATE content_publication_outbox SET status = 'completed', lease_expires_at = NULL, last_error = NULL,
       engine_result = ${databaseJsonCast(executor)}, completed_at = ?, updated_at = ? WHERE idempotency_key = ?`,
      [JSON.stringify(engineResult), outbox.completedAt, outbox.updatedAt, outbox.idempotencyKey]
    );
    await updateDatabaseItem(executor, mutation);
    return mutation.item;
  });
}

export async function failWorkflowPublication(claim: WorkflowPublicationClaim, actor: CurrentUser, errorMessage: string): Promise<WorkflowItem> {
  const safeError = errorMessage.replace(/[\r\n\t]/g, " ").slice(0, 500) || "Engine publication failed.";
  if (!workflowDatabaseEnabled()) {
    return mutateFileState((state) => {
      const item = state.items.find((candidate) => candidate.id === claim.item.id);
      const outbox = state.outbox.find((record) => record.idempotencyKey === claim.idempotencyKey);
      if (!item || !outbox) throw new WorkflowPublicationError("Publication outbox record is unavailable.");
      if (outbox.status === "completed") return item;
      const timestamp = nowIso();
      outbox.status = "failed";
      outbox.updatedAt = timestamp;
      outbox.leaseExpiresAt = undefined;
      outbox.lastError = safeError;
      const event = history(actor, "publication_failed", "Engine publication failed; approved revision remains retryable.", {
        idempotencyKey: outbox.idempotencyKey,
        contentHash: outbox.contentHash,
      });
      item.history.unshift(event);
      item.updatedAt = timestamp;
      item.version += 1;
      return item;
    });
  }

  await ensureWorkflowMigration();
  const database = await getWorkflowDatabase();
  return database.transaction(async (executor) => {
    const item = await loadDatabaseItem(executor, claim.item.id, true);
    if (!item) throw new Error("Workflow item not found.");
    const rows = await executor.query<{ status: string; content_hash: string }>(
      "SELECT status, content_hash FROM content_publication_outbox WHERE idempotency_key = ? FOR UPDATE",
      [claim.idempotencyKey]
    );
    if (!rows[0]) throw new WorkflowPublicationError("Publication outbox record is unavailable.");
    if (rows[0].status === "completed") return item;
    const timestamp = nowIso();
    await executor.query(
      "UPDATE content_publication_outbox SET status = 'failed', lease_expires_at = NULL, last_error = ?, updated_at = ? WHERE idempotency_key = ?",
      [safeError, timestamp, claim.idempotencyKey]
    );
    const event = history(actor, "publication_failed", "Engine publication failed; approved revision remains retryable.", {
      idempotencyKey: claim.idempotencyKey,
      contentHash: rows[0].content_hash,
    });
    item.history.unshift(event);
    item.updatedAt = timestamp;
    item.version += 1;
    await updateDatabaseItem(executor, { item, event });
    return item;
  });
}
