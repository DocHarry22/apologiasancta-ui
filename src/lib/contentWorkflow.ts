export type ReviewStatus =
  | "draft"
  | "submitted"
  | "changes_requested"
  | "approved"
  | "rejected"
  | "published"
  | "archived";

export type WorkflowEventType =
  | "draft_created"
  | "draft_updated"
  | "submitted"
  | "approved"
  | "rejected"
  | "changes_requested"
  | "published"
  | "archived"
  | "comment_added";

export interface ReviewComment {
  id: string;
  authorId: string;
  authorName?: string;
  authorRole: string;
  body: string;
  createdAt: string;
  doctrinalFlag?: boolean;
  referenceFlag?: boolean;
}

export interface DraftQuestion {
  id: string;
  topicId: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  question: string;
  choices: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctId: "A" | "B" | "C" | "D";
  teaching: {
    title: string;
    body: string;
    refs: string[];
  };
  tags: string[];
  status: ReviewStatus;
  authorId: string;
  authorName?: string;
  reviewerId?: string;
  reviewerName?: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  reviewedAt?: string;
  publishedAt?: string;
  archivedAt?: string;
  reviewComments: ReviewComment[];
  validationIssues: string[];
  version: number;
  questionId?: string;
  doctrinalFlags?: string[];
  referenceFlags?: string[];
  history?: ContentWorkflowEvent[];
  publishTarget?: "workflow_store" | "engine";
}

export interface ReviewSubmission {
  id: string;
  questionId: string;
  status: ReviewStatus;
  authorId: string;
  reviewerId?: string;
  submittedAt: string;
  reviewedAt?: string;
  comments: ReviewComment[];
}

export interface ContentWorkflowEvent {
  id: string;
  questionId: string;
  type: WorkflowEventType;
  actorId: string;
  actorRole: string;
  createdAt: string;
  summary: string;
}

export function getWorkflowQuestionId(item: Pick<DraftQuestion, "id" | "questionId">): string {
  return item.questionId?.trim() || item.id;
}

export function getNextQuestionId(existingIds: string[], prefix: string): string {
  const safePrefix = prefix.replace(/[^a-z0-9]/gi, "").toLowerCase() || "que";
  const pattern = new RegExp(`^${safePrefix}_(\\d+)$`, "i");
  let maxNumber = 0;

  for (const id of existingIds) {
    const match = id.match(pattern);
    if (match) maxNumber = Math.max(maxNumber, Number.parseInt(match[1], 10));
  }

  return `${safePrefix}_${String(maxNumber + 1).padStart(4, "0")}`;
}

export function hasQuestionFormContent(question: Partial<Pick<DraftQuestion, "question" | "choices" | "teaching" | "tags">>): boolean {
  return Boolean(
    question.question?.trim()
    || Object.values(question.choices ?? {}).some((choice) => choice?.trim())
    || question.teaching?.title?.trim()
    || question.teaching?.body?.trim()
    || question.teaching?.refs?.some((reference) => reference.trim())
    || question.tags?.some((tag) => tag.trim())
  );
}

export function requiresReviewComment(status: ReviewStatus): boolean {
  return status === "rejected" || status === "changes_requested";
}

const allowedTransitions: Record<ReviewStatus, readonly ReviewStatus[]> = {
  draft: ["submitted", "archived"],
  submitted: ["changes_requested", "approved", "rejected", "archived"],
  changes_requested: ["submitted", "archived"],
  approved: ["published", "archived"],
  rejected: ["draft", "archived"],
  published: ["archived"],
  archived: [],
};

export function canTransitionStatus(from: ReviewStatus, to: ReviewStatus): boolean {
  return allowedTransitions[from].includes(to);
}

export function transitionStatus(question: DraftQuestion, nextStatus: ReviewStatus, now = new Date()): DraftQuestion {
  if (!canTransitionStatus(question.status, nextStatus)) {
    throw new Error(`Cannot move workflow item from ${question.status} to ${nextStatus}`);
  }

  const timestamp = now.toISOString();

  return {
    ...question,
    status: nextStatus,
    updatedAt: timestamp,
    submittedAt: nextStatus === "submitted" ? timestamp : question.submittedAt,
    reviewedAt: ["changes_requested", "approved", "rejected"].includes(nextStatus)
      ? timestamp
      : question.reviewedAt,
    publishedAt: nextStatus === "published" ? timestamp : question.publishedAt,
    version: question.version + 1,
  };
}
