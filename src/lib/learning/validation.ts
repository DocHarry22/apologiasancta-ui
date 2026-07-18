import {
  adminEntityNames,
  DEFAULT_PAGE_SIZE,
  learningProgressStates,
  MAX_PAGE_SIZE,
  prerequisiteKinds,
  workflowActions,
  type AdminEntityName,
  type BookmarkInput,
  type LessonProgressInput,
  type MasteryStartInput,
  type MasterySubmitInput,
  type PageRequest,
  type PrerequisiteKind,
  type WorkflowAction,
} from "./contracts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

export class LearningValidationError extends Error {
  readonly fields?: Record<string, string>;

  constructor(message: string, fields?: Record<string, string>) {
    super(message);
    this.name = "LearningValidationError";
    this.fields = fields;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function requireRecord(value: unknown, field = "body"): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new LearningValidationError("The request body must be a JSON object.", {
      [field]: "Expected an object",
    });
  }
  return value;
}

export function parseUuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new LearningValidationError("One or more identifiers are invalid.", {
      [field]: "Expected a UUID",
    });
  }
  return value.toLowerCase();
}

export function parseOptionalUuid(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  return parseUuid(value, field);
}

export function parseSlug(value: unknown, field = "slug"): string {
  if (typeof value !== "string" || value.length > 160 || !SLUG_PATTERN.test(value)) {
    throw new LearningValidationError("The requested slug is invalid.", {
      [field]: "Use lower-case letters, numbers, and hyphens",
    });
  }
  return value;
}

function parseBoundedInteger(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
  fallback?: number,
): number {
  if ((value === undefined || value === null || value === "") && fallback !== undefined) return fallback;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(numeric) || numeric < minimum || numeric > maximum) {
    throw new LearningValidationError("One or more numeric values are invalid.", {
      [field]: `Expected an integer from ${minimum} to ${maximum}`,
    });
  }
  return numeric;
}

export function parsePagination(searchParams: URLSearchParams): PageRequest {
  return {
    limit: parseBoundedInteger(searchParams.get("limit"), "limit", 1, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE),
    offset: parseBoundedInteger(searchParams.get("offset"), "offset", 0, 100_000, 0),
  };
}

export function parseSearchTerm(value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") {
    throw new LearningValidationError("The search query is invalid.", { q: "Expected text" });
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length > 200) {
    throw new LearningValidationError("The search query is too long.", { q: "Maximum 200 characters" });
  }
  return normalized;
}

export function parseOptionalShortText(
  value: unknown,
  field: string,
  maximum: number,
): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new LearningValidationError("One or more text values are invalid.", { [field]: "Expected text" });
  }
  const normalized = value.trim();
  if (normalized.length > maximum) {
    throw new LearningValidationError("One or more text values are too long.", {
      [field]: `Maximum ${maximum} characters`,
    });
  }
  return normalized || null;
}

export function parseLessonProgressInput(value: unknown): LessonProgressInput {
  const body = requireRecord(value);
  const completed = body.completed;
  const rawState = body.state ?? (completed === true ? "completed" : "in_progress");
  if (typeof rawState !== "string" || !learningProgressStates.includes(rawState as LessonProgressInput["state"])) {
    throw new LearningValidationError("The lesson progress state is invalid.", {
      state: `Expected one of ${learningProgressStates.join(", ")}`,
    });
  }

  const rawProgress = body.readingProgressPercent ?? body.reading_progress_percent
    ?? (rawState === "completed" ? 100 : 0);
  const readingProgressPercent = typeof rawProgress === "number" ? rawProgress : Number(rawProgress);
  if (!Number.isFinite(readingProgressPercent) || readingProgressPercent < 0 || readingProgressPercent > 100) {
    throw new LearningValidationError("The reading progress is invalid.", {
      readingProgressPercent: "Expected a number from 0 to 100",
    });
  }

  const locator = body.resumeLocator ?? body.resume_locator ?? null;
  if (locator !== null && !isRecord(locator)) {
    throw new LearningValidationError("The resume location is invalid.", {
      resumeLocator: "Expected an object or null",
    });
  }

  return {
    state: rawState as LessonProgressInput["state"],
    readingProgressPercent: rawState === "completed" ? 100 : Math.round(readingProgressPercent * 100) / 100,
    resumeLocator: locator as Record<string, unknown> | null,
  };
}

export function parseBookmarkInput(value: unknown): BookmarkInput {
  const body = requireRecord(value);
  return {
    lessonId: parseUuid(body.lessonId ?? body.lesson_id, "lessonId"),
    sectionId: parseOptionalUuid(body.sectionId ?? body.section_id, "sectionId"),
    label: parseOptionalShortText(body.label, "label", 160),
    note: parseOptionalShortText(body.note, "note", 2_000),
  };
}

export function parseIdempotencyKey(value: unknown): string {
  if (typeof value !== "string" || !IDEMPOTENCY_PATTERN.test(value)) {
    throw new LearningValidationError("A valid idempotency key is required.", {
      idempotencyKey: "Use 8-128 letters, numbers, dots, underscores, colons, or hyphens",
    });
  }
  return value;
}

export function parseMasteryStartInput(value: unknown, headerKey?: string | null): MasteryStartInput {
  const body = requireRecord(value);
  return {
    groupId: parseUuid(body.groupId ?? body.group_id, "groupId"),
    idempotencyKey: parseIdempotencyKey(headerKey ?? body.idempotencyKey ?? body.idempotency_key),
    questionLimit: parseBoundedInteger(
      body.questionLimit ?? body.question_limit,
      "questionLimit",
      1,
      100,
      10,
    ),
  };
}

export function parseMasterySubmitInput(value: unknown, headerKey?: string | null): MasterySubmitInput {
  const body = requireRecord(value);
  if (!Array.isArray(body.answers) || body.answers.length < 1 || body.answers.length > 100) {
    throw new LearningValidationError("The answer list is invalid.", {
      answers: "Expected 1-100 answers",
    });
  }

  const seen = new Set<string>();
  const answers = body.answers.map((rawAnswer, index) => {
    const answer = requireRecord(rawAnswer, `answers.${index}`);
    const questionId = parseUuid(answer.questionId ?? answer.question_id, `answers.${index}.questionId`);
    if (seen.has(questionId)) {
      throw new LearningValidationError("Each question may be answered once.", {
        [`answers.${index}.questionId`]: "Duplicate question",
      });
    }
    seen.add(questionId);

    const rawSelections = answer.selectedOptionIds ?? answer.selected_option_ids
      ?? (answer.optionId === undefined ? undefined : [answer.optionId]);
    if (!Array.isArray(rawSelections) || rawSelections.length < 1 || rawSelections.length > 10) {
      throw new LearningValidationError("A selected option is required for each answer.", {
        [`answers.${index}.selectedOptionIds`]: "Expected 1-10 option UUIDs",
      });
    }
    const selectedOptionIds = [...new Set(rawSelections.map((optionId, optionIndex) => (
      parseUuid(optionId, `answers.${index}.selectedOptionIds.${optionIndex}`)
    )))];
    return { questionId, selectedOptionIds };
  });

  return {
    idempotencyKey: parseIdempotencyKey(headerKey ?? body.idempotencyKey ?? body.idempotency_key),
    answers,
  };
}

export function parseAdminEntity(value: string): AdminEntityName {
  if (!adminEntityNames.includes(value as AdminEntityName)) {
    throw new LearningValidationError("The requested learning entity is not supported.", {
      entity: "Unsupported entity",
    });
  }
  return value as AdminEntityName;
}

export function parsePrerequisiteKind(value: unknown): PrerequisiteKind {
  if (typeof value !== "string" || !prerequisiteKinds.includes(value as PrerequisiteKind)) {
    throw new LearningValidationError("A prerequisite kind is required.", {
      kind: `Expected one of ${prerequisiteKinds.join(", ")}`,
    });
  }
  return value as PrerequisiteKind;
}

export function parseWorkflowAction(value: string): WorkflowAction {
  if (!workflowActions.includes(value as WorkflowAction)) {
    throw new LearningValidationError("The requested workflow action is not supported.", {
      action: "Unsupported action",
    });
  }
  return value as WorkflowAction;
}

export function parseIsoTimestamp(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length > 64) {
    throw new LearningValidationError("The supplied date is invalid.", { [field]: "Expected an ISO timestamp" });
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new LearningValidationError("The supplied date is invalid.", { [field]: "Expected an ISO timestamp" });
  }
  return parsed.toISOString();
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}
