import { learningQuery } from "./database";
import { serializeLearningRow } from "./serialize";

const CANONICAL_ID = /^[a-z][a-z0-9_-]*:[a-z0-9][a-z0-9._:-]*$/;

export type SavedJourneyInput = {
  title: string;
  rootNodeId: string;
  nodeIds: string[];
  lens: string;
  visibility: "private" | "unlisted" | "public";
  metadata: Record<string, unknown>;
};

export function isCanonicalKnowledgeId(value: unknown): value is string {
  return typeof value === "string" && CANONICAL_ID.test(value);
}

export async function listKnowledgeGapRecommendations(
  learnerId: string,
  options: { limit?: number; masteryBelow?: number } = {},
) {
  const limit = Math.max(1, Math.min(50, Math.trunc(options.limit ?? 12)));
  const masteryBelow = Math.max(1, Math.min(100, Number(options.masteryBelow ?? 80)));

  const result = await learningQuery<Record<string, unknown>>(
    `WITH gaps AS (
       SELECT m.node_id, m.mastery_percent, m.evidence_attempts, m.correct_evidence,
              m.last_question_id, m.last_attempt_id, m.first_evidence_at,
              m.last_evidence_at, m.updated_at
         FROM public.learner_node_mastery m
        WHERE m.learner_id = $1
          AND m.evidence_attempts > 0
          AND m.mastery_percent < $2
        ORDER BY m.mastery_percent ASC, m.evidence_attempts DESC,
                 m.last_evidence_at DESC NULLS LAST, m.node_id
        LIMIT $3
     )
     SELECT g.*,
            lesson.id AS lesson_id,
            lesson.slug AS lesson_slug,
            lesson.title AS lesson_title,
            lesson.role AS lesson_knowledge_role,
            question.id AS review_question_id,
            question.difficulty AS review_question_difficulty
       FROM gaps g
       LEFT JOIN LATERAL (
         SELECT l.id, l.slug, l.title, lkn.role
           FROM content.lesson_knowledge_nodes lkn
           JOIN content.published_lessons l ON l.id = lkn.lesson_id
          WHERE lkn.node_id = g.node_id
          ORDER BY CASE lkn.role
            WHEN 'primary' THEN 0
            WHEN 'prerequisite' THEN 1
            WHEN 'supporting' THEN 2
            WHEN 'response' THEN 3
            WHEN 'objection' THEN 4
            ELSE 5 END,
            lkn.display_order, l.id
          LIMIT 1
       ) lesson ON true
       LEFT JOIN LATERAL (
         SELECT q.id, q.difficulty
           FROM content.question_knowledge_nodes qkn
           JOIN content.published_questions q ON q.id = qkn.question_id
          WHERE qkn.node_id = g.node_id
            AND qkn.role = 'tested'
          ORDER BY q.difficulty ASC, q.id
          LIMIT 1
       ) question ON true
      ORDER BY g.mastery_percent ASC, g.evidence_attempts DESC,
               g.last_evidence_at DESC NULLS LAST, g.node_id`,
    [learnerId, masteryBelow, limit],
  );

  return result.rows.map((row) => ({
    ...serializeLearningRow(row),
    recommendationType: "knowledge_gap",
    evidenceBasis: "stored_server_scored_mastery",
    unseenConceptsExcluded: true,
  }));
}

export async function listSavedKnowledgeJourneys(learnerId: string, limit = 50) {
  const bounded = Math.max(1, Math.min(100, Math.trunc(limit)));
  const result = await learningQuery<Record<string, unknown>>(
    `SELECT id, title, root_node_id, node_ids, lens, visibility, share_token,
            metadata, created_at, updated_at
       FROM public.saved_knowledge_journeys
      WHERE learner_id = $1
      ORDER BY updated_at DESC, id
      LIMIT $2`,
    [learnerId, bounded],
  );
  return result.rows.map((row) => serializeLearningRow(row));
}

export async function createSavedKnowledgeJourney(learnerId: string, input: SavedJourneyInput) {
  const result = await learningQuery<Record<string, unknown>>(
    `INSERT INTO public.saved_knowledge_journeys
       (learner_id, title, root_node_id, node_ids, lens, visibility, metadata)
     VALUES ($1, $2, $3, $4::text[], $5, $6, $7::jsonb)
     RETURNING id, title, root_node_id, node_ids, lens, visibility, share_token,
               metadata, created_at, updated_at`,
    [
      learnerId,
      input.title,
      input.rootNodeId,
      input.nodeIds,
      input.lens,
      input.visibility,
      JSON.stringify(input.metadata),
    ],
  );
  return serializeLearningRow(result.rows[0] ?? {});
}

export async function updateSavedKnowledgeJourney(
  learnerId: string,
  journeyId: string,
  input: SavedJourneyInput,
) {
  const result = await learningQuery<Record<string, unknown>>(
    `UPDATE public.saved_knowledge_journeys
        SET title = $3,
            root_node_id = $4,
            node_ids = $5::text[],
            lens = $6,
            visibility = $7,
            metadata = $8::jsonb,
            updated_at = now()
      WHERE id = $1 AND learner_id = $2
      RETURNING id, title, root_node_id, node_ids, lens, visibility, share_token,
                metadata, created_at, updated_at`,
    [
      journeyId,
      learnerId,
      input.title,
      input.rootNodeId,
      input.nodeIds,
      input.lens,
      input.visibility,
      JSON.stringify(input.metadata),
    ],
  );
  return result.rows[0] ? serializeLearningRow(result.rows[0]) : null;
}

export async function deleteSavedKnowledgeJourney(learnerId: string, journeyId: string) {
  const result = await learningQuery(
    `DELETE FROM public.saved_knowledge_journeys
      WHERE id = $1 AND learner_id = $2
      RETURNING id`,
    [journeyId, learnerId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getSharedKnowledgeJourney(shareToken: string) {
  const result = await learningQuery<Record<string, unknown>>(
    `SELECT id, title, root_node_id, node_ids, lens, visibility, metadata,
            created_at, updated_at
       FROM public.saved_knowledge_journeys
      WHERE share_token = $1
        AND visibility IN ('unlisted','public')
      LIMIT 1`,
    [shareToken],
  );
  return result.rows[0] ? serializeLearningRow(result.rows[0]) : null;
}
