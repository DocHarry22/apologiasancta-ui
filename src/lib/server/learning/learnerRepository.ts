import type { PoolClient } from "pg";
import type {
  BookmarkInput,
  LessonProgressInput,
  MasteryStartInput,
  MasterySubmitInput,
  PageRequest,
} from "@/lib/learning/contracts";
import { isRecord, isUuid } from "@/lib/learning/validation";
import { learningQuery, withLearningTransaction } from "./database";
import { LearningApiError, notFound } from "./errors";
import { extractPageRows, learningDisplayText, serializeLearningRow, serializeLearningValue } from "./serialize";

function pageResult(rows: Record<string, unknown>[]) {
  return extractPageRows(rows);
}

function jsonPayload(value: unknown): Record<string, unknown> {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      throw new LearningApiError("learning_service_unavailable", 503, "The learning service is temporarily unavailable.");
    }
  }
  const serialized = serializeLearningValue(parsed);
  if (!isRecord(serialized)) {
    throw new LearningApiError("learning_service_unavailable", 503, "The learning service is temporarily unavailable.");
  }
  return serialized;
}

function requiredOutputString(value: unknown): string {
  const text = learningDisplayText(value);
  if (!text || text.length > 20_000) {
    throw new LearningApiError("learning_service_unavailable", 503, "The learning service returned invalid data.");
  }
  return text;
}

function requiredOutputUuid(value: unknown): string {
  if (!isUuid(value)) {
    throw new LearningApiError("learning_service_unavailable", 503, "The learning service returned invalid data.");
  }
  return value;
}

function requiredOutputNumber(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    throw new LearningApiError("learning_service_unavailable", 503, "The learning service returned invalid data.");
  }
  return numeric;
}

/** Whitelists the start-attempt contract so answer keys and scoring snapshots cannot leak. */
export function sanitizeMasteryStartPayload(value: unknown): Record<string, unknown> {
  const payload = jsonPayload(value);
  const rawQuestions = payload.questions;
  if (!Array.isArray(rawQuestions)) {
    throw new LearningApiError("learning_service_unavailable", 503, "The learning service returned invalid data.");
  }

  const questions = rawQuestions.map((rawQuestion) => {
    if (!isRecord(rawQuestion) || !Array.isArray(rawQuestion.options)) {
      throw new LearningApiError("learning_service_unavailable", 503, "The learning service returned invalid data.");
    }
    const options = rawQuestion.options.map((rawOption) => {
      if (!isRecord(rawOption)) {
        throw new LearningApiError("learning_service_unavailable", 503, "The learning service returned invalid data.");
      }
      return {
        optionId: requiredOutputUuid(rawOption.optionId),
        position: requiredOutputNumber(rawOption.position),
        label: requiredOutputString(rawOption.label),
        content: requiredOutputString(rawOption.content),
      };
    });
    return {
      questionId: requiredOutputUuid(rawQuestion.questionId),
      position: requiredOutputNumber(rawQuestion.position),
      version: requiredOutputNumber(rawQuestion.version),
      questionType: requiredOutputString(rawQuestion.questionType),
      difficulty: requiredOutputNumber(rawQuestion.difficulty),
      prompt: requiredOutputString(rawQuestion.prompt),
      options,
    };
  });

  return {
    attemptId: requiredOutputUuid(payload.attemptId),
    groupId: requiredOutputUuid(payload.groupId),
    status: requiredOutputString(payload.status),
    startedAt: requiredOutputString(payload.startedAt),
    expiresAt: requiredOutputString(payload.expiresAt),
    questionCount: requiredOutputNumber(payload.questionCount),
    questions,
  };
}

/** Whitelists the post-submit result, including only learner-permitted answer feedback. */
export function sanitizeMasterySubmitPayload(value: unknown): Record<string, unknown> {
  const payload = jsonPayload(value);
  if (!Array.isArray(payload.answers) || !Array.isArray(payload.newlyUnlockedGroupIds)) {
    throw new LearningApiError("learning_service_unavailable", 503, "The learning service returned invalid data.");
  }
  const answers = payload.answers.map((rawAnswer) => {
    if (!isRecord(rawAnswer) || !Array.isArray(rawAnswer.selectedOptionIds)
      || !Array.isArray(rawAnswer.correctOptionIds) || !Array.isArray(rawAnswer.options)) {
      throw new LearningApiError("learning_service_unavailable", 503, "The learning service returned invalid data.");
    }
    return {
      questionId: requiredOutputUuid(rawAnswer.questionId),
      selectedOptionIds: rawAnswer.selectedOptionIds.map(requiredOutputUuid),
      isCorrect: rawAnswer.isCorrect === true,
      correctOptionIds: rawAnswer.correctOptionIds.map(requiredOutputUuid),
      explanation: learningDisplayText(rawAnswer.explanation) || null,
      options: rawAnswer.options.map((rawOption) => {
        if (!isRecord(rawOption)) {
          throw new LearningApiError("learning_service_unavailable", 503, "The learning service returned invalid data.");
        }
        return {
          optionId: requiredOutputUuid(rawOption.optionId),
          isCorrect: rawOption.isCorrect === true,
          explanation: learningDisplayText(rawOption.explanation) || null,
        };
      }),
    };
  });

  return {
    attemptId: requiredOutputUuid(payload.attemptId),
    groupId: requiredOutputUuid(payload.groupId),
    status: requiredOutputString(payload.status),
    submittedAt: requiredOutputString(payload.submittedAt),
    scorePercent: requiredOutputNumber(payload.scorePercent),
    correctCount: requiredOutputNumber(payload.correctCount),
    questionCount: requiredOutputNumber(payload.questionCount),
    passThresholdPercent: requiredOutputNumber(payload.passThresholdPercent),
    mastered: payload.mastered === true,
    answers,
    newlyUnlockedGroupIds: payload.newlyUnlockedGroupIds.map(requiredOutputUuid),
  };
}

export async function getLearnerProgress(learnerId: string) {
  const [lessons, groups, unlocks, attemptSummary] = await Promise.all([
    learningQuery<Record<string, unknown>>(
      `SELECT lp.*, l.slug AS lesson_slug, l.title AS lesson_title,
              l.group_id, l.display_order
         FROM public.lesson_progress lp
         JOIN content.published_lessons l ON l.id = lp.lesson_id
        WHERE lp.learner_id = $1
        ORDER BY lp.last_activity_at DESC, l.display_order`,
      [learnerId],
    ),
    learningQuery<Record<string, unknown>>(
      `SELECT gp.*, g.slug AS group_slug, g.title AS group_title,
              g.subject_id, g.display_order
         FROM public.group_progress gp
         JOIN content.published_learning_groups g ON g.id = gp.group_id
        WHERE gp.learner_id = $1
        ORDER BY g.display_order, g.id`,
      [learnerId],
    ),
    learningQuery<Record<string, unknown>>(
      `SELECT u.*, g.slug AS group_slug, g.title AS group_title,
              g.subject_id, g.display_order
         FROM public.unlocks u
         JOIN content.published_learning_groups g ON g.id = u.group_id
        WHERE u.learner_id = $1
        ORDER BY u.unlocked_at DESC, g.display_order`,
      [learnerId],
    ),
    learningQuery<Record<string, unknown>>(
      `SELECT count(*)::integer AS attempt_count,
              count(*) FILTER (WHERE mastered)::integer AS mastered_attempt_count,
              max(submitted_at) AS last_attempt_at
         FROM public.mastery_attempts
        WHERE learner_id = $1`,
      [learnerId],
    ),
  ]);

  return {
    lessons: lessons.rows.map((row) => serializeLearningRow(row)),
    groups: groups.rows.map((row) => serializeLearningRow(row)),
    unlocks: unlocks.rows.map((row) => serializeLearningRow(row)),
    mastery: serializeLearningRow(attemptSummary.rows[0] ?? {}),
  };
}

export async function updateLessonProgress(
  learnerId: string,
  lessonId: string,
  input: LessonProgressInput,
) {
  return withLearningTransaction(async (client) => {
    const lessonResult = await client.query<Record<string, unknown>>(
      `SELECT id, version FROM content.published_lessons WHERE id = $1 FOR SHARE`,
      [lessonId],
    );
    const lesson = lessonResult.rows[0];
    if (!lesson) throw notFound("Lesson");

    const result = await client.query<Record<string, unknown>>(
      `INSERT INTO public.lesson_progress (
         learner_id, lesson_id, state, reading_progress_percent, resume_locator,
         started_at, completed_at, completed_lesson_version, last_activity_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5::jsonb,
         CASE WHEN $3::text = 'not_started' THEN NULL ELSE now() END,
         CASE WHEN $3::text = 'completed' THEN now() ELSE NULL END,
         CASE WHEN $3::text = 'completed' THEN $6 ELSE NULL END,
         now(), now()
       )
       ON CONFLICT (learner_id, lesson_id)
       DO UPDATE SET
         state = CASE
           WHEN lesson_progress.state::text = 'completed' THEN lesson_progress.state
           ELSE EXCLUDED.state
         END,
         reading_progress_percent = greatest(lesson_progress.reading_progress_percent, EXCLUDED.reading_progress_percent),
         resume_locator = coalesce(EXCLUDED.resume_locator, lesson_progress.resume_locator),
         started_at = coalesce(lesson_progress.started_at, EXCLUDED.started_at),
         completed_at = coalesce(lesson_progress.completed_at, EXCLUDED.completed_at),
         completed_lesson_version = coalesce(lesson_progress.completed_lesson_version, EXCLUDED.completed_lesson_version),
         last_activity_at = now(),
         updated_at = now()
       RETURNING *`,
      [
        learnerId,
        lessonId,
        input.state,
        input.readingProgressPercent,
        JSON.stringify(input.resumeLocator ?? {}),
        lesson.version,
      ],
    );
    return serializeLearningRow(result.rows[0]);
  });
}

export async function listBookmarks(learnerId: string, page: PageRequest) {
  const result = await learningQuery<Record<string, unknown>>(
    `SELECT b.*, l.slug AS lesson_slug, l.title AS lesson_title,
            s.slug AS section_slug, s.title AS section_title,
            count(*) OVER () AS total_count
       FROM public.bookmarks b
       JOIN content.published_lessons l ON l.id = b.lesson_id
       LEFT JOIN content.published_lesson_sections s ON s.id = b.section_id
      WHERE b.learner_id = $1
      ORDER BY b.updated_at DESC, b.id
      LIMIT $2 OFFSET $3`,
    [learnerId, page.limit, page.offset],
  );
  return pageResult(result.rows);
}

export async function saveBookmark(learnerId: string, input: BookmarkInput) {
  return withLearningTransaction(async (client) => {
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext($1))`,
      [`bookmark:${learnerId}:${input.lessonId}:${input.sectionId ?? "lesson"}`],
    );
    const published = await client.query(
      `SELECT l.id
         FROM content.published_lessons l
        WHERE l.id = $1
          AND ($2::uuid IS NULL OR EXISTS (
            SELECT 1 FROM content.published_lesson_sections s
             WHERE s.id = $2 AND s.lesson_id = l.id
          ))`,
      [input.lessonId, input.sectionId],
    );
    if (!published.rows[0]) throw notFound("Lesson or section");

    const existing = await client.query<Record<string, unknown>>(
      `SELECT id FROM public.bookmarks
        WHERE learner_id = $1 AND lesson_id = $2 AND section_id IS NOT DISTINCT FROM $3::uuid
        LIMIT 1 FOR UPDATE`,
      [learnerId, input.lessonId, input.sectionId],
    );
    const result = existing.rows[0]
      ? await client.query<Record<string, unknown>>(
        `UPDATE public.bookmarks
            SET label = $2, note = $3, updated_at = now()
          WHERE id = $1
          RETURNING *`,
        [existing.rows[0].id, input.label, input.note],
      )
      : await client.query<Record<string, unknown>>(
        `INSERT INTO public.bookmarks (learner_id, lesson_id, section_id, label, note)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [learnerId, input.lessonId, input.sectionId, input.label, input.note],
      );
    return serializeLearningRow(result.rows[0]);
  });
}

export async function deleteBookmark(
  learnerId: string,
  selector: { bookmarkId?: string; lessonId?: string; sectionId?: string | null },
): Promise<boolean> {
  const result = selector.bookmarkId
    ? await learningQuery(
      `DELETE FROM public.bookmarks WHERE id = $1 AND learner_id = $2 RETURNING id`,
      [selector.bookmarkId, learnerId],
    )
    : await learningQuery(
      `DELETE FROM public.bookmarks
        WHERE learner_id = $1 AND lesson_id = $2
          AND ($3::uuid IS NULL OR section_id = $3)
        RETURNING id`,
      [learnerId, selector.lessonId, selector.sectionId ?? null],
    );
  return result.rowCount !== null && result.rowCount > 0;
}

export async function listMasteryAttempts(
  learnerId: string,
  input: { groupId: string | null; page: PageRequest },
) {
  const result = await learningQuery<Record<string, unknown>>(
    `SELECT a.id, a.group_id, a.status, a.question_count, a.pass_threshold_percent,
            a.score_percent, a.correct_count, a.mastered, a.started_at, a.expires_at,
            a.submitted_at, a.result_payload, a.created_at, a.updated_at,
            g.slug AS group_slug, g.title AS group_title,
            count(*) OVER () AS total_count
       FROM public.mastery_attempts a
       JOIN content.published_learning_groups g ON g.id = a.group_id
      WHERE a.learner_id = $1
        AND ($2::uuid IS NULL OR a.group_id = $2)
      ORDER BY a.started_at DESC, a.id
      LIMIT $3 OFFSET $4`,
    [learnerId, input.groupId, input.page.limit, input.page.offset],
  );
  return pageResult(result.rows);
}

export async function startMasteryAttempt(learnerId: string, input: MasteryStartInput) {
  const result = await learningQuery<{ payload: unknown }>(
    `SELECT public.start_mastery_attempt($1::uuid, $2::uuid, $3::text, $4::integer) AS payload`,
    [learnerId, input.groupId, input.idempotencyKey, input.questionLimit],
  );
  if (!result.rows[0]) {
    throw new LearningApiError("learning_service_unavailable", 503, "The learning service is temporarily unavailable.");
  }
  return sanitizeMasteryStartPayload(result.rows[0].payload);
}

export async function submitMasteryAttempt(
  learnerId: string,
  attemptId: string,
  input: MasterySubmitInput,
) {
  const answers = input.answers.map((answer) => ({
    question_id: answer.questionId,
    selected_option_ids: answer.selectedOptionIds,
  }));
  const result = await learningQuery<{ payload: unknown }>(
    `SELECT public.submit_mastery_attempt($1::uuid, $2::uuid, $3::text, $4::jsonb) AS payload`,
    [learnerId, attemptId, input.idempotencyKey, JSON.stringify(answers)],
  );
  if (!result.rows[0]) {
    throw new LearningApiError("learning_service_unavailable", 503, "The learning service is temporarily unavailable.");
  }
  return sanitizeMasterySubmitPayload(result.rows[0].payload);
}

export async function listUnlocks(learnerId: string) {
  const result = await learningQuery<Record<string, unknown>>(
    `SELECT u.*, g.slug AS group_slug, g.title AS group_title,
            g.subject_id, g.display_order, g.is_optional_expert_challenge
       FROM public.unlocks u
       JOIN content.published_learning_groups g ON g.id = u.group_id
      WHERE u.learner_id = $1
      ORDER BY g.display_order, u.unlocked_at, g.id`,
    [learnerId],
  );
  return result.rows.map((row) => serializeLearningRow(row));
}

export async function listReviewRecommendations(learnerId: string, page: PageRequest) {
  const result = await learningQuery<Record<string, unknown>>(
    `SELECT r.question_id, r.due_at, r.interval_days, r.ease_factor,
            r.repetition_count, r.last_result, r.last_reviewed_at,
            q.stable_key, q.subject_id, q.group_id, q.lesson_id, q.objective_id,
            q.difficulty, q.question_type, q.prompt, q.version,
            count(*) OVER () AS total_count
       FROM public.review_schedule r
       JOIN content.published_questions q ON q.id = r.question_id
      WHERE r.learner_id = $1
      ORDER BY (r.due_at <= now()) DESC, r.due_at, q.id
      LIMIT $2 OFFSET $3`,
    [learnerId, page.limit, page.offset],
  );
  return pageResult(result.rows);
}

export async function lockLearnerProfile(client: PoolClient, learnerId: string): Promise<void> {
  const result = await client.query(`SELECT id FROM public.learner_profiles WHERE id = $1 FOR UPDATE`, [learnerId]);
  if (!result.rows[0]) throw notFound("Learner");
}
