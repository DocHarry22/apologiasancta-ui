import type { Question } from "../../../types/content";
import { validateQuestion, hasBlockingValidationIssues } from "../../contentValidation";
import { canTransitionStatus, type ReviewStatus } from "../../contentWorkflow";
import type { CurrentUser } from "../currentUser";
import type { WorkflowHistoryEvent, WorkflowItem, WorkflowReviewComment } from "./types";
import { JsonStore, newId } from "./jsonStore";

const workflowStore = new JsonStore<WorkflowItem[]>("workflow-items.json", []);

export interface WorkflowFilters {
  status?: string;
  topicId?: string;
  authorId?: string;
  reviewerId?: string;
  search?: string;
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
  };
}

export function normalizeWorkflowQuestion(input: Partial<Question>): Question {
  return {
    id: String(input.id || input.topicId ? input.id || "" : "").trim(),
    topicId: String(input.topicId || "").trim(),
    difficulty: ([1, 2, 3, 4, 5].includes(input.difficulty as number) ? input.difficulty : 3) as 1 | 2 | 3 | 4 | 5,
    question: String(input.question || ""),
    choices: {
      A: String(input.choices?.A || ""),
      B: String(input.choices?.B || ""),
      C: String(input.choices?.C || ""),
      D: String(input.choices?.D || ""),
    },
    correctId: ["A", "B", "C", "D"].includes(input.correctId || "") ? input.correctId! : "A",
    teaching: {
      title: String(input.teaching?.title || ""),
      body: String(input.teaching?.body || ""),
      refs: Array.isArray(input.teaching?.refs) ? input.teaching.refs.map(String) : [],
    },
    tags: Array.isArray(input.tags) ? input.tags.map(String) : [],
  };
}

export async function listWorkflowItems(filters: WorkflowFilters = {}): Promise<WorkflowItem[]> {
  const items = await workflowStore.read();
  const search = filters.search?.trim().toLowerCase();
  return items.filter((item) => {
    if (filters.status && item.status !== filters.status) return false;
    if (filters.topicId && item.topicId !== filters.topicId) return false;
    if (filters.authorId && item.authorId !== filters.authorId) return false;
    if (filters.reviewerId && item.reviewerId !== filters.reviewerId) return false;
    if (search) {
      const haystack = `${item.id} ${item.questionId} ${item.question} ${item.topicId} ${item.tags.join(" ")}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

export async function getWorkflowItem(id: string): Promise<WorkflowItem | null> {
  const items = await workflowStore.read();
  return items.find((item) => item.id === id || item.questionId === id) ?? null;
}

export async function createWorkflowDraft(input: Partial<Question>, actor: CurrentUser, topicIds: string[], existingIds: string[], submit = false): Promise<WorkflowItem> {
  const question = normalizeWorkflowQuestion(input);
  const timestamp = nowIso();
  const validationIssues = validateQuestion(question, { topicIds, existingIds }).map((issue) => issue.message);
  const item: WorkflowItem = {
    ...question,
    id: newId("wf"),
    questionId: question.id,
    status: submit ? "submitted" : "draft",
    authorId: actor.id,
    authorName: actor.displayName,
    createdAt: timestamp,
    updatedAt: timestamp,
    submittedAt: submit ? timestamp : undefined,
    version: 1,
    validationIssues,
    reviewComments: [],
    doctrinalFlags: [],
    referenceFlags: [],
    history: [history(actor, submit ? "submitted" : "draft_created", submit ? "Draft created and submitted." : "Draft created.")],
  };
  const items = await workflowStore.read();
  await workflowStore.write([item, ...items]);
  return item;
}

export async function updateWorkflowDraft(id: string, input: Partial<Question>, actor: CurrentUser, topicIds: string[], existingIds: string[]): Promise<WorkflowItem> {
  const items = await workflowStore.read();
  const item = items.find((candidate) => candidate.id === id);
  if (!item) throw new Error("Workflow item not found.");
  const question = normalizeWorkflowQuestion({ ...item, ...input, id: input.id ?? item.questionId });
  const updatedAt = nowIso();
  const updated: WorkflowItem = {
    ...item,
    ...question,
    questionId: question.id,
    updatedAt,
    version: item.version + 1,
    validationIssues: validateQuestion(question, { topicIds, existingIds }).map((issue) => issue.message),
    history: [history(actor, "draft_updated", "Draft updated."), ...item.history],
  };
  await workflowStore.write(items.map((candidate) => candidate.id === id ? updated : candidate));
  return updated;
}

export async function duplicatePublishedQuestion(question: Question, actor: CurrentUser, topicIds: string[], existingIds: string[]): Promise<WorkflowItem> {
  return createWorkflowDraft({ ...question, id: `${question.id}_draft` }, actor, topicIds, existingIds, false);
}

export async function transitionWorkflowItem(id: string, nextStatus: ReviewStatus, actor: CurrentUser, options: { comment?: string; doctrinalFlag?: boolean; referenceFlag?: boolean; topicIds?: string[]; existingIds?: string[] } = {}): Promise<WorkflowItem> {
  const items = await workflowStore.read();
  const item = items.find((candidate) => candidate.id === id);
  if (!item) throw new Error("Workflow item not found.");
  if (!canTransitionStatus(item.status, nextStatus)) {
    throw new Error(`Cannot move workflow item from ${item.status} to ${nextStatus}`);
  }

  if (nextStatus === "published") {
    const issues = validateQuestion(workflowItemQuestion(item), { topicIds: options.topicIds ?? [], existingIds: options.existingIds ?? [] });
    if (hasBlockingValidationIssues(issues)) {
      throw new Error("Invalid content cannot be published.");
    }
  }

  const timestamp = nowIso();
  const comments = [...item.reviewComments];
  if (["approved", "rejected", "changes_requested"].includes(nextStatus)) {
    const body = options.comment?.trim() || "Reviewed without additional comment.";
    const comment: WorkflowReviewComment = {
      id: newId("comment"),
      authorId: actor.id,
      authorName: actor.displayName,
      authorRole: actor.role,
      body,
      createdAt: timestamp,
      doctrinalFlag: options.doctrinalFlag,
      referenceFlag: options.referenceFlag,
    };
    comments.push(comment);
  }

  const updated: WorkflowItem = {
    ...item,
    status: nextStatus,
    updatedAt: timestamp,
    submittedAt: nextStatus === "submitted" ? timestamp : item.submittedAt,
    reviewedAt: ["approved", "rejected", "changes_requested"].includes(nextStatus) ? timestamp : item.reviewedAt,
    publishedAt: nextStatus === "published" ? timestamp : item.publishedAt,
    archivedAt: nextStatus === "archived" ? timestamp : item.archivedAt,
    reviewerId: ["approved", "rejected", "changes_requested"].includes(nextStatus) ? actor.id : item.reviewerId,
    reviewerName: ["approved", "rejected", "changes_requested"].includes(nextStatus) ? actor.displayName : item.reviewerName,
    version: item.version + 1,
    reviewComments: comments,
    doctrinalFlags: options.doctrinalFlag ? [...item.doctrinalFlags, actor.id] : item.doctrinalFlags,
    referenceFlags: options.referenceFlag ? [...item.referenceFlags, actor.id] : item.referenceFlags,
    publishTarget: nextStatus === "published" ? "workflow_store" : item.publishTarget,
    history: [history(actor, nextStatus, `Workflow marked ${nextStatus.replace("_", " ")}.`), ...item.history],
  };

  await workflowStore.write(items.map((candidate) => candidate.id === id ? updated : candidate));
  return updated;
}
