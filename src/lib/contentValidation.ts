import type { Question } from "@/types/content";

type ChoiceId = "A" | "B" | "C" | "D";

const CHOICE_IDS: ChoiceId[] = ["A", "B", "C", "D"];

export interface ValidationIssue {
  field: string;
  message: string;
  severity: "error" | "warning";
}

export function hasBlockingValidationIssues(issues: ValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === "error");
}

export function validateQuestion(
  question: Partial<Question>,
  options: { topicIds?: string[]; existingIds?: string[] } = {}
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const topicIds = options.topicIds ?? [];
  const existingIds = options.existingIds ?? [];

  if (!question.id?.trim()) {
    issues.push({ field: "id", message: "Question ID is required.", severity: "error" });
  } else if (!/^[a-zA-Z0-9_-]+$/.test(question.id)) {
    issues.push({ field: "id", message: "Question ID may only contain letters, numbers, underscores, and hyphens.", severity: "error" });
  } else {
    if (!/^[a-z0-9]+_\d{4}$/i.test(question.id)) {
      issues.push({ field: "id", message: "Question ID should match prefix_0001.", severity: "warning" });
    }
    if (existingIds.includes(question.id)) {
      issues.push({ field: "id", message: "Question ID already exists in the published bank.", severity: "warning" });
    }
  }

  if (!question.topicId?.trim()) {
    issues.push({ field: "topicId", message: "Topic ID is required.", severity: "error" });
  } else if (topicIds.length > 0 && !topicIds.includes(question.topicId)) {
    issues.push({ field: "topicId", message: "Topic ID must match an existing topic.", severity: "error" });
  }

  if (!question.question?.trim()) {
    issues.push({ field: "question", message: "Question text is required.", severity: "error" });
  }

  if (![1, 2, 3, 4, 5].includes(question.difficulty as number)) {
    issues.push({ field: "difficulty", message: "Difficulty must be from 1 to 5.", severity: "error" });
  }

  for (const choiceId of CHOICE_IDS) {
    if (!question.choices?.[choiceId]?.trim()) {
      issues.push({ field: `choices.${choiceId}`, message: `Choice ${choiceId} is required.`, severity: "error" });
    }
  }

  if (!CHOICE_IDS.includes(question.correctId as ChoiceId)) {
    issues.push({ field: "correctId", message: "Correct answer must be A, B, C, or D.", severity: "error" });
  }

  if (!question.teaching?.title?.trim()) {
    issues.push({ field: "teaching.title", message: "Teaching title is required.", severity: "error" });
  }
  if (!question.teaching?.body?.trim()) {
    issues.push({ field: "teaching.body", message: "Teaching body is required.", severity: "error" });
  }
  if (!Array.isArray(question.teaching?.refs)) {
    issues.push({ field: "teaching.refs", message: "Teaching refs must be an array.", severity: "error" });
  } else if (question.teaching.refs.length === 0) {
    issues.push({ field: "teaching.refs", message: "At least one teaching reference is required.", severity: "error" });
  }
  if (!Array.isArray(question.tags)) {
    issues.push({ field: "tags", message: "Tags must be an array.", severity: "error" });
  }

  return issues;
}
