import { learningPath } from "@/lib/learningContent";
import {
  MAX_COMPLETED_LESSONS_PER_SYNC,
  MAX_PRACTICE_EVENTS_PER_SYNC,
  type LearningProgressSyncInput,
} from "@/lib/learningProgressContract";

type ValidationResult =
  | { ok: true; value: LearningProgressSyncInput }
  | { ok: false; errors: string[] };

const TOP_LEVEL_KEYS = new Set([
  "baseRevision",
  "completedLessonIds",
  "practiceBest",
  "practiceAttemptsFloor",
  "clientUpdatedAt",
  "practiceAttempts",
]);
const EVENT_KEYS = new Set(["id", "kind", "score", "occurredAt"]);
const MUTATION_ID_PATTERN = /^[A-Za-z0-9_-]{16,80}$/;
const KNOWN_LESSON_IDS = new Set(learningPath.lessons.map((lesson) => lesson.id));
const EARLIEST_CLIENT_TIMESTAMP = Date.parse("2020-01-01T00:00:00.000Z");
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isBoundedInteger(value: unknown, maximum: number): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= maximum;
}

function parseTimestamp(value: unknown, field: string, errors: string[], now: number): string | null {
  if (value === null) return null;
  if (typeof value !== "string") {
    errors.push(`${field} must be an ISO-8601 timestamp or null.`);
    return null;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || parsed < EARLIEST_CLIENT_TIMESTAMP || parsed > now + MAX_CLOCK_SKEW_MS) {
    errors.push(`${field} must be a valid UTC timestamp between 2020 and five minutes from now.`);
    return null;
  }
  return new Date(parsed).toISOString();
}

export function validateLearningProgressSyncBody(body: unknown, now = Date.now()): ValidationResult {
  if (!isRecord(body)) return { ok: false, errors: ["Request body must be a JSON object."] };

  const errors: string[] = [];
  for (const key of Object.keys(body)) {
    if (!TOP_LEVEL_KEYS.has(key)) errors.push(`Unknown field: ${key}.`);
  }

  const baseRevision = isBoundedInteger(body.baseRevision, Number.MAX_SAFE_INTEGER)
    ? body.baseRevision
    : 0;
  if (!isBoundedInteger(body.baseRevision, Number.MAX_SAFE_INTEGER)) {
    errors.push("baseRevision must be a non-negative safe integer.");
  }

  const practiceBest = isBoundedInteger(body.practiceBest, 10_000) ? body.practiceBest : 0;
  if (!isBoundedInteger(body.practiceBest, 10_000)) {
    errors.push("practiceBest must be an integer from 0 to 10000.");
  }

  const practiceAttemptsFloor = isBoundedInteger(body.practiceAttemptsFloor, 1_000_000)
    ? body.practiceAttemptsFloor
    : 0;
  if (!isBoundedInteger(body.practiceAttemptsFloor, 1_000_000)) {
    errors.push("practiceAttemptsFloor must be an integer from 0 to 1000000.");
  }

  const completedLessonIds: string[] = [];
  if (!Array.isArray(body.completedLessonIds) || body.completedLessonIds.length > MAX_COMPLETED_LESSONS_PER_SYNC) {
    errors.push(`completedLessonIds must be an array of at most ${MAX_COMPLETED_LESSONS_PER_SYNC} lesson IDs.`);
  } else {
    const seen = new Set<string>();
    for (const lessonId of body.completedLessonIds) {
      if (typeof lessonId !== "string" || !KNOWN_LESSON_IDS.has(lessonId)) {
        errors.push("completedLessonIds contains an unknown lesson ID.");
        continue;
      }
      if (!seen.has(lessonId)) completedLessonIds.push(lessonId);
      seen.add(lessonId);
    }
  }

  const practiceAttempts: LearningProgressSyncInput["practiceAttempts"] = [];
  if (!Array.isArray(body.practiceAttempts) || body.practiceAttempts.length > MAX_PRACTICE_EVENTS_PER_SYNC) {
    errors.push(`practiceAttempts must be an array of at most ${MAX_PRACTICE_EVENTS_PER_SYNC} events.`);
  } else {
    const seen = new Set<string>();
    for (const [index, candidate] of body.practiceAttempts.entries()) {
      if (!isRecord(candidate)) {
        errors.push(`practiceAttempts[${index}] must be an object.`);
        continue;
      }
      for (const key of Object.keys(candidate)) {
        if (!EVENT_KEYS.has(key)) errors.push(`Unknown field in practiceAttempts[${index}]: ${key}.`);
      }
      if (candidate.kind !== "practice_attempt") {
        errors.push(`practiceAttempts[${index}].kind must be practice_attempt.`);
      }
      if (typeof candidate.id !== "string" || !MUTATION_ID_PATTERN.test(candidate.id) || seen.has(candidate.id)) {
        errors.push(`practiceAttempts[${index}].id must be a unique 16-80 character mutation ID.`);
      }
      if (!isBoundedInteger(candidate.score, 10_000)) {
        errors.push(`practiceAttempts[${index}].score must be an integer from 0 to 10000.`);
      }
      const occurredAt = parseTimestamp(candidate.occurredAt, `practiceAttempts[${index}].occurredAt`, errors, now);
      if (
        candidate.kind === "practice_attempt" &&
        typeof candidate.id === "string" &&
        MUTATION_ID_PATTERN.test(candidate.id) &&
        !seen.has(candidate.id) &&
        isBoundedInteger(candidate.score, 10_000) &&
        occurredAt
      ) {
        practiceAttempts.push({
          id: candidate.id,
          kind: "practice_attempt",
          score: candidate.score,
          occurredAt,
        });
      }
      if (typeof candidate.id === "string") seen.add(candidate.id);
    }
  }

  const clientUpdatedAt = parseTimestamp(body.clientUpdatedAt, "clientUpdatedAt", errors, now);
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      baseRevision,
      completedLessonIds,
      practiceBest,
      practiceAttemptsFloor,
      clientUpdatedAt,
      practiceAttempts,
    },
  };
}
