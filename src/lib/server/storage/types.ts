import type { Role } from "../../auth/roles";
import type { Question, QuestionChoiceId } from "../../../types/content";
import type { ReviewStatus } from "../../contentWorkflow";

export type AuditSeverity = "info" | "warning" | "error" | "critical";

export type AuditEventType =
  | "auth.login_success"
  | "auth.login_failure"
  | "auth.logout"
  | "admin.engine_mutation"
  | "admin.proxy_blocked"
  | "workflow.create"
  | "workflow.update"
  | "workflow.submit"
  | "workflow.approve"
  | "workflow.reject"
  | "workflow.request_changes"
  | "workflow.publish"
  | "workflow.archive"
  | "room.create"
  | "room.close"
  | "topic.sequence_update"
  | "content.import"
  | "content.clear"
  | "security.csrf_failed"
  | "security.rate_limited"
  | "security.forbidden";

export interface WorkflowHistoryEvent {
  id: string;
  type: string;
  actorId: string;
  actorName: string;
  actorRole: Role;
  createdAt: string;
  summary: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowReviewComment {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  body: string;
  createdAt: string;
  doctrinalFlag?: boolean;
  referenceFlag?: boolean;
}

export interface WorkflowItem extends Question {
  id: string;
  questionId: string;
  topicId: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  question: string;
  choices: Record<QuestionChoiceId, string>;
  correctId: QuestionChoiceId;
  teaching: Question["teaching"];
  tags: string[];
  status: ReviewStatus;
  authorId: string;
  authorName: string;
  reviewerId?: string;
  reviewerName?: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  reviewedAt?: string;
  publishedAt?: string;
  archivedAt?: string;
  version: number;
  validationIssues: string[];
  reviewComments: WorkflowReviewComment[];
  doctrinalFlags: string[];
  referenceFlags: string[];
  history: WorkflowHistoryEvent[];
  publishTarget?: "workflow_store";
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: Role;
  eventType: AuditEventType;
  action: string;
  resourceType: string;
  resourceId?: string;
  method?: string;
  path?: string;
  status: "success" | "failure" | "blocked";
  blockedBy?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  severity: AuditSeverity;
}

export interface StoredUser {
  id: string;
  displayName: string;
  email?: string;
  role: Role;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}
