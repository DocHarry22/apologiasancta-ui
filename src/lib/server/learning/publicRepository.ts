import type { PageRequest } from "@/lib/learning/contracts";
import { learningQuery } from "./database";
import { notFound } from "./errors";
import { extractPageRows, learningDisplayText, serializeLearningRow } from "./serialize";

type PageResult = {
  data: unknown[];
  total: number;
};

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export async function listPublishedProgrammes(page: PageRequest): Promise<PageResult> {
  const result = await learningQuery<Record<string, unknown>>(
    `SELECT p.*, count(*) OVER () AS total_count
       FROM content.published_programmes p
      WHERE p.visibility::text IN ('public', 'locked', 'coming_soon')
      ORDER BY p.display_order, p.title, p.id
      LIMIT $1 OFFSET $2`,
    [page.limit, page.offset],
  );
  return extractPageRows(result.rows);
}

export async function getPublishedProgramme(slug: string) {
  const programmeResult = await learningQuery<Record<string, unknown>>(
    `SELECT * FROM content.published_programmes
      WHERE slug = $1 AND visibility::text IN ('public', 'locked', 'coming_soon') LIMIT 1`,
    [slug],
  );
  const programme = programmeResult.rows[0];
  if (!programme) throw notFound("Programme");

  const subjects = await learningQuery<Record<string, unknown>>(
    `SELECT *
       FROM content.published_subjects
      WHERE programme_id = $1
        AND visibility::text IN ('public', 'locked', 'coming_soon')
      ORDER BY display_order, title, id`,
    [programme.id],
  );
  return {
    ...serializeLearningRow(programme),
    subjects: subjects.rows.map((row) => serializeLearningRow(row)),
  };
}

export async function getPublishedSubject(slug: string) {
  const subjectResult = await learningQuery<Record<string, unknown>>(
    `SELECT s.*, p.slug AS programme_slug, p.title AS programme_title
       FROM content.published_subjects s
       JOIN content.published_programmes p ON p.id = s.programme_id
      WHERE s.slug = $1
        AND s.visibility::text IN ('public', 'locked', 'coming_soon')
        AND p.visibility::text IN ('public', 'locked', 'coming_soon')
      ORDER BY p.display_order, s.display_order
      LIMIT 1`,
    [slug],
  );
  const subject = subjectResult.rows[0];
  if (!subject) throw notFound("Subject");

  const [groups, prerequisites] = await Promise.all([
    learningQuery<Record<string, unknown>>(
      `SELECT *
         FROM content.published_learning_groups
        WHERE subject_id = $1
          AND visibility::text IN ('public', 'locked', 'coming_soon')
        ORDER BY display_order, title, id`,
      [subject.id],
    ),
    learningQuery<Record<string, unknown>>(
      `SELECT sp.requirement, sp.minimum_score_percent,
              required.id AS prerequisite_subject_id,
              required.slug AS prerequisite_subject_slug,
              required.title AS prerequisite_subject_title
         FROM content.subject_prerequisites sp
         JOIN content.published_subjects required ON required.id = sp.prerequisite_subject_id
        WHERE sp.subject_id = $1
        ORDER BY required.display_order, required.title`,
      [subject.id],
    ),
  ]);

  return {
    ...serializeLearningRow(subject),
    prerequisites: prerequisites.rows.map((row) => serializeLearningRow(row)),
    groups: groups.rows.map((row) => serializeLearningRow(row)),
  };
}

export async function getPublishedGroup(slug: string) {
  const groupResult = await learningQuery<Record<string, unknown>>(
    `SELECT g.*, s.slug AS subject_slug, s.title AS subject_title,
            p.slug AS programme_slug, p.title AS programme_title
       FROM content.published_learning_groups g
       JOIN content.published_subjects s ON s.id = g.subject_id
       JOIN content.published_programmes p ON p.id = s.programme_id
      WHERE g.slug = $1
        AND g.visibility::text IN ('public', 'locked', 'coming_soon')
        AND s.visibility::text IN ('public', 'locked', 'coming_soon')
        AND p.visibility::text IN ('public', 'locked', 'coming_soon')
      ORDER BY p.display_order, s.display_order, g.display_order
      LIMIT 1`,
    [slug],
  );
  const group = groupResult.rows[0];
  if (!group) throw notFound("Learning group");

  const [lessons, prerequisites] = await Promise.all([
    learningQuery<Record<string, unknown>>(
      `SELECT *
         FROM content.published_lessons
        WHERE group_id = $1
          AND visibility::text IN ('public', 'locked', 'coming_soon')
        ORDER BY display_order, title, id`,
      [group.id],
    ),
    learningQuery<Record<string, unknown>>(
      `SELECT gp.requirement, gp.minimum_score_percent,
              required.id AS prerequisite_group_id,
              required.slug AS prerequisite_group_slug,
              required.title AS prerequisite_group_title
         FROM content.group_prerequisites gp
         JOIN content.published_learning_groups required ON required.id = gp.prerequisite_group_id
        WHERE gp.group_id = $1
        ORDER BY required.display_order, required.title`,
      [group.id],
    ),
  ]);

  return {
    ...serializeLearningRow(group),
    prerequisites: prerequisites.rows.map((row) => serializeLearningRow(row)),
    lessons: lessons.rows.map((row) => serializeLearningRow(row)),
  };
}

export async function getPublishedLesson(slug: string) {
  const lessonResult = await learningQuery<Record<string, unknown>>(
    `SELECT l.*, g.slug AS group_slug, g.title AS group_title,
            s.id AS subject_id, s.slug AS subject_slug, s.title AS subject_title,
            p.id AS programme_id, p.slug AS programme_slug, p.title AS programme_title
       FROM content.published_lessons l
       JOIN content.published_learning_groups g ON g.id = l.group_id
       JOIN content.published_subjects s ON s.id = g.subject_id
       JOIN content.published_programmes p ON p.id = s.programme_id
      WHERE l.slug = $1
        AND l.visibility::text = 'public'
        AND g.visibility::text = 'public'
        AND s.visibility::text = 'public'
        AND p.visibility::text = 'public'
      ORDER BY p.display_order, s.display_order, g.display_order, l.display_order
      LIMIT 1`,
    [slug],
  );
  const lesson = lessonResult.rows[0];
  if (!lesson) throw notFound("Lesson");

  const [sections, objectives, sourceLinks, neighbours, prerequisites] = await Promise.all([
    learningQuery<Record<string, unknown>>(
      `SELECT *
         FROM content.published_lesson_sections
        WHERE lesson_id = $1
        ORDER BY display_order, id`,
      [lesson.id],
    ),
    learningQuery<Record<string, unknown>>(
      `SELECT *
         FROM content.published_learning_objectives
        WHERE lesson_id = $1
        ORDER BY display_order, id`,
      [lesson.id],
    ),
    learningQuery<Record<string, unknown>>(
      `SELECT pcs.relationship_type, pcs.citation_locator, pcs.rights_metadata,
              pcs.display_order, src.*
         FROM content.published_content_sources pcs
         JOIN content.published_sources src ON src.id = pcs.source_id
         WHERE pcs.entity_kind = 'lesson' AND pcs.entity_id = $1
        ORDER BY pcs.display_order, src.title, src.id`,
      [lesson.id],
    ),
    learningQuery<Record<string, unknown>>(
      `WITH current_lesson AS (
         SELECT group_id, display_order, id
           FROM content.published_lessons
          WHERE id = $1
       )
       SELECT l.*,
              CASE WHEN l.display_order < current_lesson.display_order THEN 'previous' ELSE 'next' END AS direction
         FROM content.published_lessons l
         CROSS JOIN current_lesson
        WHERE l.group_id = current_lesson.group_id
          AND l.id <> current_lesson.id
          AND (
            l.display_order = (SELECT max(p.display_order) FROM content.published_lessons p WHERE p.group_id = current_lesson.group_id AND p.display_order < current_lesson.display_order)
            OR l.display_order = (SELECT min(n.display_order) FROM content.published_lessons n WHERE n.group_id = current_lesson.group_id AND n.display_order > current_lesson.display_order)
          )
        ORDER BY l.display_order`,
      [lesson.id],
    ),
    learningQuery<Record<string, unknown>>(
      `SELECT lp.requirement, lp.minimum_score_percent,
              required.id AS prerequisite_lesson_id,
              required.slug AS prerequisite_lesson_slug,
              required.title AS prerequisite_lesson_title
         FROM content.lesson_prerequisites lp
         JOIN content.published_lessons required ON required.id = lp.prerequisite_lesson_id
        WHERE lp.lesson_id = $1
        ORDER BY required.display_order, required.title`,
      [lesson.id],
    ),
  ]);

  const serializedNeighbours = neighbours.rows.map((row) => serializeLearningRow<Record<string, unknown>>(row));
  return {
    ...serializeLearningRow(lesson),
    sections: sections.rows.map((row) => serializeLearningRow(row)),
    objectives: objectives.rows.map((row) => serializeLearningRow(row)),
    sources: sourceLinks.rows.map((row) => serializeLearningRow(row)),
    prerequisites: prerequisites.rows.map((row) => serializeLearningRow(row)),
    navigation: {
      previous: serializedNeighbours.find((row) => row.direction === "previous") ?? null,
      next: serializedNeighbours.find((row) => row.direction === "next") ?? null,
    },
  };
}

export async function searchPublishedContent(input: {
  query: string;
  contentType: string | null;
  difficulty: string | null;
  page: PageRequest;
}): Promise<PageResult> {
  const pattern = `%${escapeLike(input.query)}%`;
  const result = await learningQuery<Record<string, unknown>>(
    `WITH published_search AS (
       SELECT 'programme'::text AS content_type, id, slug, title, short_description,
              NULL::uuid AS programme_id, NULL::uuid AS subject_id, NULL::uuid AS group_id,
              level, display_order, search_metadata, published_at
         FROM content.published_programmes
        WHERE visibility::text IN ('public', 'locked', 'coming_soon')
       UNION ALL
       SELECT 'subject', id, slug, title, short_description,
              programme_id, id, NULL::uuid, level, display_order, search_metadata, published_at
         FROM content.published_subjects
        WHERE visibility::text IN ('public', 'locked', 'coming_soon')
       UNION ALL
       SELECT 'group', id, slug, title, short_description,
              NULL::uuid, subject_id, id, level, display_order, search_metadata, published_at
         FROM content.published_learning_groups
        WHERE visibility::text IN ('public', 'locked', 'coming_soon')
       UNION ALL
       SELECT 'lesson', id, slug, title, short_description,
              NULL::uuid, NULL::uuid, group_id, level, display_order, search_metadata, published_at
         FROM content.published_lessons
        WHERE visibility::text IN ('public', 'locked', 'coming_soon')
       UNION ALL
       SELECT 'source', id, slug, title, coalesce(citation, ''),
              NULL::uuid, NULL::uuid, NULL::uuid, source_kind, 0, rights_metadata, published_at
         FROM content.published_sources
     )
     SELECT published_search.*, count(*) OVER () AS total_count
       FROM published_search
      WHERE ($1::text = '' OR concat_ws(' ', title, short_description, slug, search_metadata::text) ILIKE $2 ESCAPE '\\')
        AND ($3::text IS NULL OR content_type = $3)
        AND ($4::text IS NULL OR lower(level) = lower($4))
      ORDER BY content_type, display_order, title, id
      LIMIT $5 OFFSET $6`,
    [input.query, pattern, input.contentType, input.difficulty, input.page.limit, input.page.offset],
  );
  return extractPageRows(result.rows);
}

export async function listPracticeQuestions(input: {
  subjectId: string | null;
  groupId: string | null;
  lessonId: string | null;
  difficulty: number | null;
  page: PageRequest;
}): Promise<PageResult> {
  const result = await learningQuery<Record<string, unknown>>(
    `SELECT q.*,
            options.options,
            count(*) OVER () AS total_count
       FROM content.published_questions q
       CROSS JOIN LATERAL (
         SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', o.id,
           'position', o.position,
           'label', o.label,
           'content', o.content
         ) ORDER BY o.position), '[]'::jsonb) AS options
           FROM content.published_question_options o
          WHERE o.question_id = q.id
       ) options
      WHERE EXISTS (
        SELECT 1
          FROM content.published_question_contexts context
         WHERE context.question_id = q.id
           AND context.context::text IN ('lesson_practice', 'group_practice', 'practice')
      )
        AND q.question_type IN ('single_choice', 'true_false')
        AND NOT EXISTS (
          SELECT 1
            FROM content.published_question_contexts mastery_context
           WHERE mastery_context.question_id = q.id
             AND mastery_context.context::text = 'mastery_assessment'
        )
        AND ($1::uuid IS NULL OR q.subject_id = $1)
        AND ($2::uuid IS NULL OR q.group_id = $2)
        AND ($3::uuid IS NULL OR q.lesson_id = $3)
        AND ($4::integer IS NULL OR q.difficulty = $4)
        AND EXISTS (
          SELECT 1 FROM content.published_subjects public_subject
           WHERE public_subject.id = q.subject_id
             AND public_subject.visibility::text = 'public'
        )
      ORDER BY q.published_at DESC, q.id
      LIMIT $5 OFFSET $6`,
    [input.subjectId, input.groupId, input.lessonId, input.difficulty, input.page.limit, input.page.offset],
  );
  const page = extractPageRows(result.rows);
  return {
    ...page,
    data: page.data.map((rawQuestion) => normalizePracticeQuestion(rawQuestion as Record<string, unknown>)),
  };
}

export function normalizePracticeQuestion(question: Record<string, unknown>) {
  const options = Array.isArray(question.options) ? question.options.map((rawOption) => {
    const option = rawOption as Record<string, unknown>;
    return {
      ...option,
      label: learningDisplayText(option.label),
      content: learningDisplayText(option.content),
    };
  }) : [];
  return {
    ...question,
    prompt: learningDisplayText(question.prompt),
    options,
  };
}

function explanationText(value: unknown): string | null {
  return learningDisplayText(value) || null;
}

export async function checkPracticeAnswer(questionId: string, optionId: string) {
  const result = await learningQuery<Record<string, unknown>>(
    `SELECT o.is_correct, o.explanation AS option_explanation,
            q.correct_answer_explanation,
            coalesce(references.items, '[]'::jsonb) AS source_references
       FROM content.published_questions published
       JOIN content.questions q ON q.id = published.id
       JOIN content.question_options o ON o.question_id = q.id AND o.id = $2
       LEFT JOIN LATERAL (
         SELECT jsonb_agg(coalesce(src.citation, src.title) ORDER BY pcs.display_order, src.title) AS items
           FROM content.published_content_sources pcs
           JOIN content.published_sources src ON src.id = pcs.source_id
          WHERE pcs.entity_kind = 'question' AND pcs.entity_id = q.id
       ) references ON true
      WHERE q.id = $1
        AND EXISTS (
          SELECT 1 FROM content.question_contexts context
           WHERE context.question_id = q.id
             AND context.context IN ('lesson_practice', 'group_practice')
             AND context.enabled
             AND (context.valid_from IS NULL OR context.valid_from <= now())
             AND (context.valid_until IS NULL OR context.valid_until > now())
        )
        AND NOT EXISTS (
          SELECT 1 FROM content.question_contexts mastery_context
           WHERE mastery_context.question_id = q.id
             AND mastery_context.context = 'mastery_assessment'
             AND mastery_context.enabled
        )
      LIMIT 1`,
    [questionId, optionId],
  );
  const row = result.rows[0];
  if (!row) throw notFound("Practice question or option");
  const optionExplanation = explanationText(row.option_explanation);
  const correctExplanation = explanationText(row.correct_answer_explanation);
  return {
    correct: row.is_correct === true,
    explanation: optionExplanation ?? correctExplanation,
    references: Array.isArray(row.source_references)
      ? row.source_references.filter((item): item is string => typeof item === "string")
      : [],
  };
}

export async function getPublicProgressPreview() {
  const result = await learningQuery<Record<string, unknown>>(
    `SELECT p.id AS programme_id, p.slug AS programme_slug, p.title AS programme_title,
            p.display_order AS programme_order,
            s.id AS subject_id, s.slug AS subject_slug, s.title AS subject_title,
            s.display_order AS subject_order,
            g.*,
            CASE
              WHEN g.is_initially_unlocked THEN 'unlocked'
              WHEN g.visibility::text = 'coming_soon' THEN 'coming_soon'
              WHEN g.visibility::text = 'hidden' THEN 'hidden'
              ELSE 'visible_locked'
            END AS preview_state,
            coalesce(prerequisites.items, '[]'::jsonb) AS prerequisites
       FROM content.published_learning_groups g
       JOIN content.published_subjects s ON s.id = g.subject_id
      JOIN content.published_programmes p ON p.id = s.programme_id
      LEFT JOIN LATERAL (
         SELECT jsonb_agg(jsonb_build_object(
           'groupId', required.id,
           'slug', required.slug,
           'title', required.title,
           'requirement', gp.requirement,
           'minimumScorePercent', gp.minimum_score_percent
         ) ORDER BY required.display_order, required.title) AS items
           FROM content.group_prerequisites gp
           JOIN content.published_learning_groups required ON required.id = gp.prerequisite_group_id
          WHERE gp.group_id = g.id
       ) prerequisites ON true
      WHERE p.visibility::text IN ('public', 'locked', 'coming_soon')
        AND s.visibility::text IN ('public', 'locked', 'coming_soon')
        AND g.visibility::text IN ('public', 'locked', 'coming_soon')
      ORDER BY p.display_order, s.display_order, g.display_order, g.id`,
  );
  return result.rows.map((row) => serializeLearningRow(row));
}
