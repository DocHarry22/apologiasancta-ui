export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export type PageRequest = {
  limit: number;
  offset: number;
};

export type PageMeta = PageRequest & {
  total: number;
  hasMore: boolean;
};

export type ApiErrorPayload = {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
};

export const learningProgressStates = ["not_started", "in_progress", "completed"] as const;
export type LearningProgressState = (typeof learningProgressStates)[number];

export type LessonProgressInput = {
  state: LearningProgressState;
  readingProgressPercent: number;
  resumeLocator: Record<string, unknown> | null;
};

export type BookmarkInput = {
  lessonId: string;
  sectionId: string | null;
  label: string | null;
  note: string | null;
};

export type MasteryStartInput = {
  groupId: string;
  idempotencyKey: string;
  questionLimit: number;
};

export type MasteryAnswerInput = {
  questionId: string;
  selectedOptionIds: string[];
};

export type MasterySubmitInput = {
  idempotencyKey: string;
  answers: MasteryAnswerInput[];
};

export const adminEntityNames = [
  "programmes",
  "subjects",
  "groups",
  "lessons",
  "sections",
  "lesson-requirements",
  "objectives",
  "doctrinal-claims",
  "questions",
  "question-options",
  "question-contexts",
  "sources",
  "content-sources",
  "prerequisites",
  "workflow",
  "audit",
] as const;

export type AdminEntityName = (typeof adminEntityNames)[number];

export const prerequisiteKinds = ["programme", "subject", "group", "lesson"] as const;
export type PrerequisiteKind = (typeof prerequisiteKinds)[number];

export const workflowActions = [
  "submit",
  "request-changes",
  "approve",
  "publish",
  "schedule",
  "archive",
  "restore",
  "duplicate",
  "new-version",
  "analytics-review",
] as const;

export type WorkflowAction = (typeof workflowActions)[number];
