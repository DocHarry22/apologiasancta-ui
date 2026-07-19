import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { Role } from "@/lib/auth/roles";
import type { AdminEntityName, PageRequest, PrerequisiteKind, WorkflowAction } from "@/lib/learning/contracts";
import { isRecord, isUuid, LearningValidationError, parseIsoTimestamp, parseSlug, parseUuid } from "@/lib/learning/validation";
import { learningQuery, withLearningTransaction } from "./database";
import { LearningApiError, notFound } from "./errors";
import { extractPageRows, serializeLearningRow } from "./serialize";

type EntitySpec = {
  table: string;
  entityKind: string;
  allowedFields: readonly string[];
  jsonFields?: readonly string[];
  arrayFields?: readonly string[];
  uuidFields?: readonly string[];
  numericFields?: readonly string[];
  booleanFields?: readonly string[];
  timestampFields?: readonly string[];
  parentField?: string;
  searchableFields?: readonly string[];
  archiveable?: boolean;
  versioned?: boolean;
  actorFields?: boolean;
  readOnly?: boolean;
  idKind?: "uuid" | "bigint";
  orderBy?: string;
};

const commonContentFields = [
  "slug",
  "title",
  "short_description",
  "cover_asset_path",
  "display_order",
  "visibility",
  "estimated_minutes",
  "level",
  "apologia_graph_relationship",
  "search_metadata",
  "localisation",
] as const;

const commonJsonFields = ["apologia_graph_relationship", "search_metadata", "localisation"] as const;

const entitySpecs: Record<Exclude<AdminEntityName, "prerequisites">, EntitySpec> = {
  programmes: {
    table: "programmes",
    entityKind: "programme",
    allowedFields: commonContentFields,
    jsonFields: commonJsonFields,
    numericFields: ["display_order", "estimated_minutes"],
    searchableFields: ["slug", "title", "short_description"],
    archiveable: true,
    versioned: true,
    actorFields: true,
  },
  subjects: {
    table: "subjects",
    entityKind: "subject",
    allowedFields: ["programme_id", ...commonContentFields],
    jsonFields: commonJsonFields,
    uuidFields: ["programme_id"],
    numericFields: ["display_order", "estimated_minutes"],
    parentField: "programme_id",
    searchableFields: ["slug", "title", "short_description"],
    archiveable: true,
    versioned: true,
    actorFields: true,
  },
  groups: {
    table: "learning_groups",
    entityKind: "learning_group",
    allowedFields: [
      "subject_id",
      ...commonContentFields,
      "mastery_threshold_percent",
      "mastery_policy",
      "is_initially_unlocked",
      "is_optional_expert_challenge",
    ],
    jsonFields: [...commonJsonFields, "mastery_policy"],
    uuidFields: ["subject_id"],
    numericFields: ["display_order", "estimated_minutes", "mastery_threshold_percent"],
    booleanFields: ["is_initially_unlocked", "is_optional_expert_challenge"],
    parentField: "subject_id",
    searchableFields: ["slug", "title", "short_description"],
    archiveable: true,
    versioned: true,
    actorFields: true,
  },
  lessons: {
    table: "lessons",
    entityKind: "lesson",
    allowedFields: ["group_id", ...commonContentFields],
    jsonFields: commonJsonFields,
    uuidFields: ["group_id"],
    numericFields: ["display_order", "estimated_minutes"],
    parentField: "group_id",
    searchableFields: ["slug", "title", "short_description"],
    archiveable: true,
    versioned: true,
    actorFields: true,
  },
  sections: {
    table: "lesson_sections",
    entityKind: "lesson_section",
    allowedFields: [
      "lesson_id", "parent_section_id", "slug", "title", "block_kind", "content",
      "display_order", "visibility", "attribution_mode",
    ],
    jsonFields: ["content"],
    uuidFields: ["lesson_id", "parent_section_id"],
    numericFields: ["display_order"],
    parentField: "lesson_id",
    searchableFields: ["slug", "title"],
    archiveable: true,
    versioned: true,
    actorFields: true,
  },
  objectives: {
    table: "learning_objectives",
    entityKind: "learning_objective",
    allowedFields: ["lesson_id", "code", "description", "display_order", "mastery_weight"],
    uuidFields: ["lesson_id"],
    numericFields: ["display_order", "mastery_weight"],
    parentField: "lesson_id",
    searchableFields: ["code", "description"],
    archiveable: true,
    versioned: true,
    actorFields: true,
  },
  questions: {
    table: "questions",
    entityKind: "question",
    allowedFields: [
      "stable_key", "subject_id", "group_id", "lesson_id", "objective_id", "difficulty",
      "difficulty_mode", "trick_category", "equivalence_key", "quality_flags",
      "question_type", "prompt", "correct_answer_explanation", "private_notes",
      "misconception_ids", "denomination_scope", "rights_metadata", "answer_policy",
      "retirement_status", "quarantine_reason",
    ],
    jsonFields: [
      "prompt", "correct_answer_explanation", "denomination_scope", "rights_metadata",
      "answer_policy", "quality_flags",
    ],
    arrayFields: ["misconception_ids"],
    uuidFields: ["subject_id", "group_id", "lesson_id", "objective_id"],
    numericFields: ["difficulty"],
    parentField: "subject_id",
    searchableFields: ["stable_key", "private_notes"],
    archiveable: true,
    versioned: true,
    actorFields: true,
  },
  "question-options": {
    table: "question_options",
    entityKind: "question_option",
    allowedFields: [
      "question_id", "position", "label", "content", "is_correct", "explanation", "misconception_id",
    ],
    jsonFields: ["content", "explanation"],
    uuidFields: ["question_id"],
    numericFields: ["position"],
    booleanFields: ["is_correct"],
    parentField: "question_id",
    searchableFields: ["label", "misconception_id"],
  },
  "question-contexts": {
    table: "question_contexts",
    entityKind: "question_context",
    allowedFields: [
      "question_id", "context", "programme_id", "subject_id", "group_id", "lesson_id",
      "enabled", "weight", "settings", "valid_from", "valid_until",
    ],
    jsonFields: ["settings"],
    uuidFields: ["question_id", "programme_id", "subject_id", "group_id", "lesson_id"],
    numericFields: ["weight"],
    booleanFields: ["enabled"],
    timestampFields: ["valid_from", "valid_until"],
    parentField: "question_id",
  },
  sources: {
    table: "sources",
    entityKind: "source",
    allowedFields: [
      "slug", "title", "source_kind", "author", "publisher", "publication_year", "url",
      "citation", "rights_metadata", "visibility", "authority_category", "copyright_status",
      "permission_status", "licence_identifier", "attribution_text", "quote_limit_words",
      "translation_metadata", "prohibited_use_flags", "permission_expires_at",
      "rights_review_due_at", "approved_domain_id",
    ],
    jsonFields: ["rights_metadata", "translation_metadata"],
    arrayFields: ["prohibited_use_flags"],
    uuidFields: ["approved_domain_id"],
    numericFields: ["publication_year", "quote_limit_words"],
    timestampFields: ["permission_expires_at", "rights_review_due_at"],
    searchableFields: ["slug", "title", "source_kind", "author", "publisher", "citation"],
    archiveable: true,
    versioned: true,
    actorFields: true,
  },
  "content-sources": {
    table: "content_sources",
    entityKind: "content_source",
    allowedFields: [
      "entity_kind", "entity_id", "source_id", "relationship_type", "citation_locator",
      "quoted_text", "rights_metadata", "display_order",
    ],
    jsonFields: ["rights_metadata"],
    uuidFields: ["entity_id", "source_id"],
    numericFields: ["display_order"],
    parentField: "entity_id",
    searchableFields: ["relationship_type", "citation_locator"],
    actorFields: true,
  },
  workflow: {
    table: "content_versions",
    entityKind: "content_version",
    allowedFields: ["entity_kind", "entity_id", "version", "snapshot", "change_summary", "status"],
    jsonFields: ["snapshot"],
    uuidFields: ["entity_id"],
    numericFields: ["version"],
    parentField: "entity_id",
    searchableFields: ["change_summary"],
    readOnly: true,
    idKind: "uuid",
    orderBy: "created_at DESC, id",
  },
  audit: {
    table: "audit_log",
    entityKind: "audit",
    allowedFields: [],
    searchableFields: ["action", "entity_kind", "request_id"],
    readOnly: true,
    idKind: "bigint",
    orderBy: "occurred_at DESC, id DESC",
  },
};

type PrerequisiteSpec = {
  table: string;
  dependentField: string;
  prerequisiteField: string;
};

const prerequisiteSpecs: Record<PrerequisiteKind, PrerequisiteSpec> = {
  programme: {
    table: "programme_prerequisites",
    dependentField: "programme_id",
    prerequisiteField: "prerequisite_programme_id",
  },
  subject: {
    table: "subject_prerequisites",
    dependentField: "subject_id",
    prerequisiteField: "prerequisite_subject_id",
  },
  group: {
    table: "group_prerequisites",
    dependentField: "group_id",
    prerequisiteField: "prerequisite_group_id",
  },
  lesson: {
    table: "lesson_prerequisites",
    dependentField: "lesson_id",
    prerequisiteField: "prerequisite_lesson_id",
  },
};

const publicationStatuses = new Set(["draft", "in_review", "changes_requested", "approved", "scheduled", "published", "archived"]);
const visibilityValues = new Set(["public", "authenticated", "hidden", "locked", "coming_soon"]);
const entityKinds = new Set(["programme", "subject", "learning_group", "lesson", "lesson_section", "learning_objective", "question", "source"]);
const questionKinds = new Set(["single_choice"]);
const questionContexts = new Set(["lesson_practice", "group_practice", "mastery_assessment", "expert_challenge", "live_quiz", "daily_challenge", "review_quiz"]);
const retirementStatuses = new Set(["active", "retired", "quarantined"]);
const difficultyModes = new Set(["easy", "medium", "hard", "expert", "trick"]);
const trickCategories = new Set([
  "nature_vs_person", "infallibility_vs_impeccability", "veneration_vs_worship",
  "sign_vs_merely_symbolic", "dogma_vs_discipline", "development_vs_contradiction",
  "necessary_vs_sufficient", "premise_vs_conclusion",
  "initial_justification_vs_growth_in_grace", "material_vs_formal_rejection",
  "correct_doctrine_wrong_subject",
]);
const attributionModes = new Set(["direct_quotation", "paraphrase", "interpretation", "inference"]);
const sourceAuthorityCategories = new Set([
  "sacred_scripture", "sacred_tradition", "ecumenical_council", "papal_magisterium",
  "dicastery_magisterium", "catechism", "canon_law", "church_father", "church_doctor",
  "official_comparative_source", "primary_historical_source", "academic_secondary_source",
  "credible_reference", "unverified",
]);
const permissionStatuses = new Set([
  "unverified", "public_domain", "licensed", "permission_not_required_under_recorded_terms",
  "permission_requested", "denied", "expired",
]);

function snakeKey(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`).replace(/-/g, "_");
}

function ensureText(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new LearningValidationError("One or more fields are invalid.", { [field]: "Expected text" });
  }
  const maximum = field === "private_notes" || field === "quoted_text" ? 100_000 : 10_000;
  if (value.length > maximum) {
    throw new LearningValidationError("One or more fields are too long.", { [field]: `Maximum ${maximum} characters` });
  }
  if (field === "slug") return parseSlug(value, field);
  if (field === "stable_key" && !/^[A-Za-z0-9_-]{1,160}$/.test(value)) {
    throw new LearningValidationError("The stable key is invalid.", { stableKey: "Use letters, numbers, underscores, or hyphens" });
  }
  return value;
}

function normalizeFields(spec: EntitySpec, body: Record<string, unknown>): Record<string, unknown> {
  const allowed = new Set(spec.allowedFields);
  const jsonFields = new Set(spec.jsonFields ?? []);
  const arrayFields = new Set(spec.arrayFields ?? []);
  const uuidFields = new Set(spec.uuidFields ?? []);
  const numericFields = new Set(spec.numericFields ?? []);
  const booleanFields = new Set(spec.booleanFields ?? []);
  const timestampFields = new Set(spec.timestampFields ?? []);
  const output: Record<string, unknown> = {};

  for (const [inputKey, rawValue] of Object.entries(body)) {
    const field = snakeKey(inputKey);
    if (!allowed.has(field)) {
      throw new LearningValidationError("The request includes an unsupported field.", {
        [inputKey]: "Unsupported field",
      });
    }
    if (uuidFields.has(field)) {
      output[field] = rawValue === null || rawValue === "" ? null : parseUuid(rawValue, inputKey);
    } else if (jsonFields.has(field)) {
      if (!isRecord(rawValue)) {
        throw new LearningValidationError("One or more JSON fields are invalid.", { [inputKey]: "Expected an object" });
      }
      output[field] = rawValue;
    } else if (arrayFields.has(field)) {
      if (!Array.isArray(rawValue) || !rawValue.every((item) => typeof item === "string" && item.length <= 160)) {
        throw new LearningValidationError("One or more list fields are invalid.", { [inputKey]: "Expected a text array" });
      }
      output[field] = [...new Set(rawValue)];
    } else if (numericFields.has(field)) {
      if (rawValue === null) {
        output[field] = null;
      } else {
        const number = typeof rawValue === "number" ? rawValue : Number(rawValue);
        if (!Number.isFinite(number)) {
          throw new LearningValidationError("One or more numeric fields are invalid.", { [inputKey]: "Expected a number" });
        }
        output[field] = number;
      }
    } else if (booleanFields.has(field)) {
      if (typeof rawValue !== "boolean") {
        throw new LearningValidationError("One or more boolean fields are invalid.", { [inputKey]: "Expected true or false" });
      }
      output[field] = rawValue;
    } else if (timestampFields.has(field)) {
      output[field] = rawValue === null || rawValue === "" ? null : parseIsoTimestamp(rawValue, inputKey);
    } else {
      const value = ensureText(rawValue, field);
      if (field === "visibility" && value !== null && !visibilityValues.has(value)) {
        throw new LearningValidationError("The visibility is invalid.", { [inputKey]: "Unsupported visibility" });
      }
      if (field === "entity_kind" && value !== null && !entityKinds.has(value)) {
        throw new LearningValidationError("The entity kind is invalid.", { [inputKey]: "Unsupported entity kind" });
      }
      if (field === "question_type" && value !== null && !questionKinds.has(value)) {
        throw new LearningValidationError("The question type is invalid.", { [inputKey]: "Unsupported question type" });
      }
      if (field === "context" && value !== null && !questionContexts.has(value)) {
        throw new LearningValidationError("The question context is invalid.", { [inputKey]: "Unsupported context" });
      }
      if (field === "retirement_status" && value !== null && !retirementStatuses.has(value)) {
        throw new LearningValidationError("The retirement status is invalid.", { [inputKey]: "Unsupported status" });
      }
      if (field === "difficulty_mode" && value !== null && !difficultyModes.has(value)) {
        throw new LearningValidationError("The difficulty mode is invalid.", { [inputKey]: "Use easy, medium, hard, expert, or trick" });
      }
      if (field === "trick_category" && value !== null && !trickCategories.has(value)) {
        throw new LearningValidationError("The trick category is invalid.", { [inputKey]: "Unsupported approved trick category" });
      }
      if (field === "attribution_mode" && value !== null && !attributionModes.has(value)) {
        throw new LearningValidationError("The attribution mode is invalid.", { [inputKey]: "Distinguish quotation, paraphrase, interpretation, or inference" });
      }
      if (field === "authority_category" && value !== null && !sourceAuthorityCategories.has(value)) {
        throw new LearningValidationError("The source authority category is invalid.", { [inputKey]: "Unsupported authority category" });
      }
      if (field === "permission_status" && value !== null && !permissionStatuses.has(value)) {
        throw new LearningValidationError("The permission status is invalid.", { [inputKey]: "Unsupported permission status" });
      }
      if (field === "status" && value !== null && !publicationStatuses.has(value)) {
        throw new LearningValidationError("The publication status is invalid.", { [inputKey]: "Unsupported status" });
      }
      output[field] = value;
    }
  }
  return output;
}

function buildInsert(table: string, fields: Record<string, unknown>) {
  const entries = Object.entries(fields);
  if (!entries.length) throw new LearningValidationError("At least one field is required.");
  return {
    sql: `INSERT INTO content.${table} (${entries.map(([field]) => field).join(", ")}) VALUES (${entries.map((_, index) => `$${index + 1}`).join(", ")}) RETURNING *`,
    values: entries.map(([, value]) => value),
  };
}

function validateEntityId(spec: EntitySpec, id: string): string {
  if (spec.idKind === "bigint") {
    if (!/^[1-9][0-9]{0,18}$/.test(id)) {
      throw new LearningValidationError("The record identifier is invalid.", { id: "Expected a positive integer" });
    }
    return id;
  }
  return parseUuid(id, "id");
}

function getEntitySpec(entity: Exclude<AdminEntityName, "prerequisites">): EntitySpec {
  return entitySpecs[entity];
}

async function setAuditContext(client: PoolClient, actorId: string, requestId: string): Promise<string> {
  if (!isUuid(actorId)) {
    throw new LearningApiError("invalid_staff_identity", 403, "The staff identity cannot authorize database changes.");
  }
  await client.query(`SELECT set_config('app.actor_id', $1, true), set_config('request.header.x-request-id', $2, true)`, [
    actorId,
    requestId.slice(0, 256),
  ]);
  return actorId;
}

async function insertManualAudit(
  client: PoolClient,
  input: {
    actorId: string | null;
    action: string;
    entityKind: string;
    entityId: string | null;
    oldData?: unknown;
    newData?: unknown;
    requestId: string;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO content.audit_log
       (actor_id, action, entity_kind, entity_id, old_data, new_data, metadata, request_id)
     VALUES ($1::uuid, $2, $3, $4::uuid, $5::jsonb, $6::jsonb, '{}'::jsonb, $7)`,
    [
      input.actorId,
      input.action,
      input.entityKind,
      input.entityId,
      input.oldData === undefined ? null : JSON.stringify(input.oldData),
      input.newData === undefined ? null : JSON.stringify(input.newData),
      input.requestId.slice(0, 256),
    ],
  );
}

function isTriggerAudited(spec: EntitySpec): boolean {
  return [
    "programme", "subject", "learning_group", "lesson", "lesson_section", "learning_objective",
    "source", "question", "question_option", "question_context",
  ].includes(spec.entityKind);
}

export async function listAdminEntities(input: {
  entity: AdminEntityName;
  page: PageRequest;
  query: string;
  status: string | null;
  parentId: string | null;
  prerequisiteKind?: PrerequisiteKind;
}) {
  if (input.entity === "workflow") {
    const pattern = `%${input.query.replace(/[\\%_]/g, "\\$&")}%`;
    const result = await learningQuery<Record<string, unknown>>(
      `WITH reviewable AS (
         SELECT id, 'programme'::text AS entity_kind, slug, title,
                short_description AS summary, status::text, review_status::text,
                version, created_by, updated_by, updated_at, scheduled_for, published_at
           FROM content.programmes
         UNION ALL
         SELECT id, 'subject', slug, title, short_description, status::text, review_status::text,
                version, created_by, updated_by, updated_at, scheduled_for, published_at
           FROM content.subjects
         UNION ALL
         SELECT id, 'learning_group', slug, title, short_description, status::text, review_status::text,
                version, created_by, updated_by, updated_at, scheduled_for, published_at
           FROM content.learning_groups
         UNION ALL
         SELECT id, 'lesson', slug, title, short_description, status::text, review_status::text,
                version, created_by, updated_by, updated_at, scheduled_for, published_at
           FROM content.lessons
         UNION ALL
         SELECT id, 'lesson_section', slug, coalesce(title, slug), NULL::text, status::text, review_status::text,
                version, created_by, updated_by, updated_at, scheduled_for, published_at
           FROM content.lesson_sections
         UNION ALL
         SELECT id, 'learning_objective', code, description, NULL::text, status::text, review_status::text,
                version, created_by, updated_by, updated_at, scheduled_for, published_at
           FROM content.learning_objectives
         UNION ALL
         SELECT id, 'question', stable_key, coalesce(prompt ->> 'text', stable_key), NULL::text,
                status::text, review_status::text, version, created_by, updated_by, updated_at, scheduled_for, published_at
           FROM content.questions
         UNION ALL
         SELECT id, 'source', slug, title, citation, status::text, review_status::text,
                version, created_by, updated_by, updated_at, scheduled_for, published_at
           FROM content.sources
       )
       SELECT reviewable.*, count(*) OVER () AS total_count
         FROM reviewable
        WHERE ($1::text = '' OR concat_ws(' ', slug, title, summary, entity_kind) ILIKE $2 ESCAPE '\\')
          AND ($3::text IS NULL OR status = $3)
        ORDER BY updated_at DESC, entity_kind, id
        LIMIT $4 OFFSET $5`,
      [input.query, pattern, input.status, input.page.limit, input.page.offset],
    );
    return extractPageRows(result.rows);
  }

  if (input.entity === "prerequisites") {
    const parentId = input.parentId ? parseUuid(input.parentId, "parentId") : null;
    const result = await learningQuery<Record<string, unknown>>(
      `WITH prerequisite_records AS (
         SELECT 'programme'::text AS kind, programme_id AS dependent_id,
                prerequisite_programme_id AS prerequisite_id, requirement::text,
                minimum_score_percent, created_at, created_by
           FROM content.programme_prerequisites
         UNION ALL
         SELECT 'subject', subject_id, prerequisite_subject_id, requirement::text,
                minimum_score_percent, created_at, created_by
           FROM content.subject_prerequisites
         UNION ALL
         SELECT 'group', group_id, prerequisite_group_id, requirement::text,
                minimum_score_percent, created_at, created_by
           FROM content.group_prerequisites
         UNION ALL
         SELECT 'lesson', lesson_id, prerequisite_lesson_id, requirement::text,
                minimum_score_percent, created_at, created_by
           FROM content.lesson_prerequisites
       )
       SELECT prerequisite_records.*, count(*) OVER () AS total_count
         FROM prerequisite_records
        WHERE ($1::text IS NULL OR kind = $1)
          AND ($2::uuid IS NULL OR dependent_id = $2)
        ORDER BY created_at DESC, kind, dependent_id, prerequisite_id
        LIMIT $3 OFFSET $4`,
      [input.prerequisiteKind ?? null, parentId, input.page.limit, input.page.offset],
    );
    const page = extractPageRows(result.rows);
    return {
      ...page,
      data: page.data.map((value) => {
        const row = value as Record<string, unknown>;
        return { ...row, id: `${row.dependentId}:${row.prerequisiteId}` };
      }),
    };
  }

  const spec = getEntitySpec(input.entity);
  const values: unknown[] = [];
  const conditions: string[] = [];
  if (input.status && spec.archiveable) {
    values.push(input.status);
    conditions.push(`t.status::text = $${values.length}`);
  } else if (input.status && input.entity === "audit") {
    values.push(input.status);
    conditions.push(`t.action = $${values.length}`);
  }
  if (input.parentId && spec.parentField) {
    values.push(parseUuid(input.parentId, "parentId"));
    conditions.push(`t.${spec.parentField} = $${values.length}::uuid`);
  }
  if (input.query && spec.searchableFields?.length) {
    values.push(`%${input.query.replace(/[\\%_]/g, "\\$&")}%`);
    conditions.push(`concat_ws(' ', ${spec.searchableFields.map((field) => `t.${field}::text`).join(", ")}) ILIKE $${values.length} ESCAPE '\\'`);
  }
  values.push(input.page.limit, input.page.offset);
  const result = await learningQuery<Record<string, unknown>>(
    `SELECT t.*, count(*) OVER () AS total_count
       FROM content.${spec.table} t
       ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
      ORDER BY ${spec.orderBy ?? "updated_at DESC, id"}
      LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  return extractPageRows(result.rows);
}

export async function listPublicationCalendar(page: PageRequest) {
  const result = await learningQuery<Record<string, unknown>>(
    `WITH scheduled_content AS (
       SELECT id, 'programme'::text AS entity_kind, slug, title, scheduled_for, status::text, version
         FROM content.programmes WHERE status = 'scheduled'
       UNION ALL
       SELECT id, 'subject', slug, title, scheduled_for, status::text, version
         FROM content.subjects WHERE status = 'scheduled'
       UNION ALL
       SELECT id, 'learning_group', slug, title, scheduled_for, status::text, version
         FROM content.learning_groups WHERE status = 'scheduled'
       UNION ALL
       SELECT id, 'lesson', slug, title, scheduled_for, status::text, version
         FROM content.lessons WHERE status = 'scheduled'
       UNION ALL
       SELECT id, 'lesson_section', slug, coalesce(title, slug), scheduled_for, status::text, version
         FROM content.lesson_sections WHERE status = 'scheduled'
       UNION ALL
       SELECT id, 'learning_objective', code, description, scheduled_for, status::text, version
         FROM content.learning_objectives WHERE status = 'scheduled'
       UNION ALL
       SELECT id, 'question', stable_key, coalesce(prompt ->> 'text', stable_key), scheduled_for, status::text, version
         FROM content.questions WHERE status = 'scheduled'
       UNION ALL
       SELECT id, 'source', slug, title, scheduled_for, status::text, version
         FROM content.sources WHERE status = 'scheduled'
     )
     SELECT scheduled_content.*, count(*) OVER () AS total_count
       FROM scheduled_content
      ORDER BY scheduled_for, entity_kind, id
      LIMIT $1 OFFSET $2`,
    [page.limit, page.offset],
  );
  return extractPageRows(result.rows);
}

export async function getAdminEntity(
  entity: Exclude<AdminEntityName, "prerequisites">,
  id: string,
) {
  const spec = getEntitySpec(entity);
  const validId = validateEntityId(spec, id);
  const result = await learningQuery<Record<string, unknown>>(
    `SELECT * FROM content.${spec.table} WHERE id = $1 LIMIT 1`,
    [validId],
  );
  if (!result.rows[0]) throw notFound("Learning record");
  return serializeLearningRow(result.rows[0]);
}

export async function createAdminEntity(input: {
  entity: Exclude<AdminEntityName, "prerequisites">;
  body: Record<string, unknown>;
  actorId: string;
  requestId: string;
}) {
  const spec = getEntitySpec(input.entity);
  if (spec.readOnly) throw new LearningApiError("method_not_allowed", 405, "This learning resource is read-only.");
  const fields = normalizeFields(spec, input.body);
  return withLearningTransaction(async (client) => {
    const actorId = await setAuditContext(client, input.actorId, input.requestId);
    if (spec.actorFields) {
      fields.created_by = actorId;
      if (spec.versioned) fields.updated_by = actorId;
    }
    const statement = buildInsert(spec.table, fields);
    const result = await client.query<Record<string, unknown>>(statement.sql, statement.values);
    const row = result.rows[0];
    if (!row) throw new LearningApiError("learning_service_unavailable", 503, "The learning service is temporarily unavailable.");
    if (!isTriggerAudited(spec)) {
      await insertManualAudit(client, {
        actorId,
        action: "insert",
        entityKind: spec.entityKind,
        entityId: typeof row.id === "string" ? row.id : null,
        newData: row,
        requestId: input.requestId,
      });
    }
    return serializeLearningRow(row);
  });
}

export async function bulkImportAdminEntities(input: {
  entity: Exclude<AdminEntityName, "prerequisites">;
  records: Record<string, unknown>[];
  actorId: string;
  requestId: string;
}) {
  const spec = getEntitySpec(input.entity);
  if (spec.readOnly) throw new LearningApiError("method_not_allowed", 405, "This learning resource is read-only.");
  const managedImportFields = new Set([
    "id", "status", "publication_status", "review_status", "version", "created_at", "updated_at",
    "published_at", "scheduled_for", "archived_at", "created_by", "updated_by", "reviewed_by", "reviewed_at",
  ]);
  const allowed = new Set(spec.allowedFields);
  const normalizedRecords = input.records.map((record, index) => {
    const editable: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      const field = snakeKey(key);
      if (allowed.has(field)) editable[key] = value;
      else if (!managedImportFields.has(field)) {
        throw new LearningValidationError("The import includes an unsupported field.", {
          [`records.${index}.${key}`]: "Unsupported field",
        });
      }
    }
    const fields = normalizeFields(spec, editable);
    if (record.id !== undefined && record.id !== null && record.id !== "") {
      fields.id = parseUuid(record.id, `records.${index}.id`);
    }
    return fields;
  });
  return withLearningTransaction(async (client) => {
    const actorId = await setAuditContext(client, input.actorId, input.requestId);
    const created: unknown[] = [];
    for (const fields of normalizedRecords) {
      if (spec.actorFields) {
        fields.created_by = actorId;
        if (spec.versioned) fields.updated_by = actorId;
      }
      const statement = buildInsert(spec.table, fields);
      const hasStableId = typeof fields.id === "string";
      const sql = hasStableId
        ? statement.sql.replace(" RETURNING *", " ON CONFLICT (id) DO NOTHING RETURNING *")
        : statement.sql;
      const result = await client.query<Record<string, unknown>>(sql, statement.values);
      let row = result.rows[0];
      const inserted = Boolean(row);
      if (!row && hasStableId) {
        const existing = await client.query<Record<string, unknown>>(
          `SELECT * FROM content.${spec.table} WHERE id = $1`,
          [fields.id],
        );
        row = existing.rows[0];
      }
      if (!row) throw new LearningApiError("learning_service_unavailable", 503, "The learning service is temporarily unavailable.");
      if (inserted && !isTriggerAudited(spec)) {
        await insertManualAudit(client, {
          actorId,
          action: "import",
          entityKind: spec.entityKind,
          entityId: typeof row.id === "string" ? row.id : null,
          newData: row,
          requestId: input.requestId,
        });
      }
      created.push(serializeLearningRow(row));
    }
    return created;
  });
}

export async function reorderAdminEntities(input: {
  entity: Exclude<AdminEntityName, "prerequisites">;
  items: Array<{ id: string; displayOrder: number }>;
  actorId: string;
  requestId: string;
}) {
  const spec = getEntitySpec(input.entity);
  if (spec.readOnly || !spec.allowedFields.includes("display_order")) {
    throw new LearningApiError("method_not_allowed", 405, "This learning resource cannot be reordered.");
  }
  if (!input.items.length || input.items.length > 500) {
    throw new LearningValidationError("A reorder request must contain 1-500 records.");
  }
  const seenIds = new Set<string>();
  const seenOrders = new Set<number>();
  const items = input.items.map((item, index) => {
    const id = parseUuid(item.id, `items.${index}.id`);
    if (!Number.isInteger(item.displayOrder) || item.displayOrder < 0 || item.displayOrder > 100_000) {
      throw new LearningValidationError("A display order is invalid.", {
        [`items.${index}.displayOrder`]: "Expected an integer from 0 to 100000",
      });
    }
    if (seenIds.has(id) || seenOrders.has(item.displayOrder)) {
      throw new LearningValidationError("Reorder identifiers and positions must be unique.");
    }
    seenIds.add(id);
    seenOrders.add(item.displayOrder);
    return { id, displayOrder: item.displayOrder };
  });

  return withLearningTransaction(async (client) => {
    const actorId = await setAuditContext(client, input.actorId, input.requestId);
    const locked = await client.query<Record<string, unknown>>(
      `SELECT * FROM content.${spec.table} WHERE id = ANY($1::uuid[]) FOR UPDATE`,
      [items.map((item) => item.id)],
    );
    if (locked.rows.length !== items.length) throw notFound("One or more learning records");
    const maximum = await client.query<{ maximum: number | string }>(
      `SELECT coalesce(max(display_order), 0) + 1000 AS maximum FROM content.${spec.table}`,
    );
    const temporaryBase = Number(maximum.rows[0]?.maximum ?? 1000);
    for (const [index, item] of items.entries()) {
      await client.query(
        `UPDATE content.${spec.table} SET display_order = $2 WHERE id = $1`,
        [item.id, temporaryBase + index],
      );
    }
    const output: unknown[] = [];
    for (const item of items) {
      const result = await client.query<Record<string, unknown>>(
        `UPDATE content.${spec.table}
            SET display_order = $2${spec.versioned ? ", version = version + 1, updated_by = $3::uuid" : ""}
          WHERE id = $1
          RETURNING *`,
        spec.versioned ? [item.id, item.displayOrder, actorId] : [item.id, item.displayOrder],
      );
      output.push(serializeLearningRow(result.rows[0]));
    }
    return output;
  });
}

export async function updateAdminEntity(input: {
  entity: Exclude<AdminEntityName, "prerequisites">;
  id: string;
  body: Record<string, unknown>;
  actor: { id: string; role: Role };
  requestId: string;
}) {
  const spec = getEntitySpec(input.entity);
  if (spec.readOnly) throw new LearningApiError("method_not_allowed", 405, "This learning resource is read-only.");
  const id = validateEntityId(spec, input.id);
  const fields = normalizeFields(spec, input.body);
  if (!Object.keys(fields).length) throw new LearningValidationError("At least one field is required.");

  return withLearningTransaction(async (client) => {
    const actorId = await setAuditContext(client, input.actor.id, input.requestId);
    const currentResult = await client.query<Record<string, unknown>>(
      `SELECT * FROM content.${spec.table} WHERE id = $1 FOR UPDATE`,
      [id],
    );
    const current = currentResult.rows[0];
    if (!current) throw notFound("Learning record");

    if (["author", "contributor"].includes(input.actor.role)) {
      let ownerId = current.created_by;
      let ownerStatus = current.status;
      if (["question_option", "question_context"].includes(spec.entityKind)) {
        const parent = await client.query<Record<string, unknown>>(
          `SELECT created_by, status FROM content.questions WHERE id = $1`,
          [current.question_id],
        );
        ownerId = parent.rows[0]?.created_by;
        ownerStatus = parent.rows[0]?.status;
      }
      if (ownerId !== actorId || !["draft", "changes_requested"].includes(String(ownerStatus))) {
        throw new LearningApiError("forbidden", 403, "Authors may edit only their own draft content.");
      }
    }

    if (spec.versioned) {
      await client.query(
        `INSERT INTO content.content_versions
           (entity_kind, entity_id, version, snapshot, change_summary, status, created_by)
         VALUES ($1::content.entity_kind, $2::uuid, $3, $4::jsonb, 'Snapshot before edit', $5::content.publication_status, $6::uuid)
         ON CONFLICT (entity_kind, entity_id, version) DO NOTHING`,
        [spec.entityKind, id, current.version, JSON.stringify(current), current.status, actorId],
      );
      fields.updated_by = actorId;
    }

    const entries = Object.entries(fields);
    const values = entries.map(([, value]) => value);
    values.push(id);
    const assignments = entries.map(([field], index) => `${field} = $${index + 1}`);
    if (spec.versioned) assignments.push("version = version + 1");
    const result = await client.query<Record<string, unknown>>(
      `UPDATE content.${spec.table}
          SET ${assignments.join(", ")}
        WHERE id = $${values.length}
        RETURNING *`,
      values,
    );
    const updated = result.rows[0];
    if (!updated) throw notFound("Learning record");
    if (!isTriggerAudited(spec)) {
      await insertManualAudit(client, {
        actorId,
        action: "update",
        entityKind: spec.entityKind,
        entityId: id,
        oldData: current,
        newData: updated,
        requestId: input.requestId,
      });
    }
    return serializeLearningRow(updated);
  });
}

export async function deleteAdminEntity(input: {
  entity: Exclude<AdminEntityName, "prerequisites">;
  id: string;
  actorId: string;
  requestId: string;
}) {
  const spec = getEntitySpec(input.entity);
  if (spec.readOnly) throw new LearningApiError("method_not_allowed", 405, "This learning resource is read-only.");
  const id = validateEntityId(spec, input.id);

  return withLearningTransaction(async (client) => {
    const actorId = await setAuditContext(client, input.actorId, input.requestId);
    const currentResult = await client.query<Record<string, unknown>>(
      `SELECT * FROM content.${spec.table} WHERE id = $1 FOR UPDATE`,
      [id],
    );
    const current = currentResult.rows[0];
    if (!current) throw notFound("Learning record");

    if (spec.archiveable) {
      const result = await client.query<Record<string, unknown>>(
        `UPDATE content.${spec.table}
            SET status = 'archived', archived_at = now(), updated_by = $2::uuid
          WHERE id = $1
          RETURNING *`,
        [id, actorId],
      );
      return { id, archived: true, record: serializeLearningRow(result.rows[0]) };
    }

    await client.query(`DELETE FROM content.${spec.table} WHERE id = $1`, [id]);
    if (!isTriggerAudited(spec)) {
      await insertManualAudit(client, {
        actorId,
        action: "delete",
        entityKind: spec.entityKind,
        entityId: id,
        oldData: current,
        requestId: input.requestId,
      });
    }
    return { id, deleted: true };
  });
}

export async function createPrerequisite(input: {
  kind: PrerequisiteKind;
  body: Record<string, unknown>;
  actorId: string;
  requestId: string;
}) {
  const spec = prerequisiteSpecs[input.kind];
  const normalized = Object.fromEntries(Object.entries(input.body).map(([key, value]) => [snakeKey(key), value]));
  const dependentId = parseUuid(normalized[spec.dependentField] ?? normalized.dependent_id, spec.dependentField);
  const prerequisiteId = parseUuid(normalized[spec.prerequisiteField] ?? normalized.prerequisite_id, spec.prerequisiteField);
  const requirement = normalized.requirement ?? (input.kind === "lesson" ? "completion" : "mastery");
  if (typeof requirement !== "string" || !["completion", "mastery", "unlock"].includes(requirement)) {
    throw new LearningValidationError("The prerequisite requirement is invalid.");
  }
  const minimum = normalized.minimum_score_percent === undefined || normalized.minimum_score_percent === null
    ? null
    : Number(normalized.minimum_score_percent);
  if (minimum !== null && (!Number.isFinite(minimum) || minimum < 0 || minimum > 100)) {
    throw new LearningValidationError("The minimum score must be from 0 to 100.");
  }

  return withLearningTransaction(async (client) => {
    const actorId = await setAuditContext(client, input.actorId, input.requestId);
    const result = await client.query<Record<string, unknown>>(
      `INSERT INTO content.${spec.table}
         (${spec.dependentField}, ${spec.prerequisiteField}, requirement, minimum_score_percent, created_by)
       VALUES ($1, $2, $3, $4, $5::uuid)
       RETURNING *`,
      [dependentId, prerequisiteId, requirement, minimum, actorId],
    );
    const row = result.rows[0];
    await insertManualAudit(client, {
      actorId,
      action: "insert",
      entityKind: `${input.kind}_prerequisite`,
      entityId: dependentId,
      newData: row,
      requestId: input.requestId,
    });
    return {
      ...serializeLearningRow<Record<string, unknown>>(row),
      id: `${dependentId}:${prerequisiteId}`,
      kind: input.kind,
      dependentId,
      prerequisiteId,
    };
  });
}

export async function bulkImportPrerequisites(input: {
  records: Record<string, unknown>[];
  actorId: string;
  requestId: string;
}) {
  const records = input.records.map((record, index) => {
    const normalized = Object.fromEntries(Object.entries(record).map(([key, value]) => [snakeKey(key), value]));
    const kindValue = normalized.kind;
    if (typeof kindValue !== "string" || !Object.prototype.hasOwnProperty.call(prerequisiteSpecs, kindValue)) {
      throw new LearningValidationError("Every prerequisite import record requires a valid kind.", {
        [`records.${index}.kind`]: "Expected programme, subject, group, or lesson",
      });
    }
    const kind = kindValue as PrerequisiteKind;
    const spec = prerequisiteSpecs[kind];
    const dependentId = parseUuid(normalized[spec.dependentField] ?? normalized.dependent_id, `records.${index}.dependentId`);
    const prerequisiteId = parseUuid(normalized[spec.prerequisiteField] ?? normalized.prerequisite_id, `records.${index}.prerequisiteId`);
    const requirement = normalized.requirement ?? (kind === "lesson" ? "completion" : "mastery");
    if (typeof requirement !== "string" || !["completion", "mastery", "unlock"].includes(requirement)) {
      throw new LearningValidationError("A prerequisite import requirement is invalid.", {
        [`records.${index}.requirement`]: "Unsupported requirement",
      });
    }
    const minimum = normalized.minimum_score_percent === undefined || normalized.minimum_score_percent === null
      ? null
      : Number(normalized.minimum_score_percent);
    if (minimum !== null && (!Number.isFinite(minimum) || minimum < 0 || minimum > 100)) {
      throw new LearningValidationError("A prerequisite import score is invalid.", {
        [`records.${index}.minimumScorePercent`]: "Expected 0 to 100",
      });
    }
    return { kind, spec, dependentId, prerequisiteId, requirement, minimum };
  });

  return withLearningTransaction(async (client) => {
    const actorId = await setAuditContext(client, input.actorId, input.requestId);
    const output: unknown[] = [];
    for (const record of records) {
      const result = await client.query<Record<string, unknown>>(
        `INSERT INTO content.${record.spec.table}
           (${record.spec.dependentField}, ${record.spec.prerequisiteField}, requirement, minimum_score_percent, created_by)
         VALUES ($1, $2, $3, $4, $5::uuid)
         ON CONFLICT (${record.spec.dependentField}, ${record.spec.prerequisiteField})
         DO UPDATE SET requirement = EXCLUDED.requirement,
                       minimum_score_percent = EXCLUDED.minimum_score_percent
         RETURNING *`,
        [record.dependentId, record.prerequisiteId, record.requirement, record.minimum, actorId],
      );
      const row = result.rows[0];
      await insertManualAudit(client, {
        actorId,
        action: "import_upsert",
        entityKind: `${record.kind}_prerequisite`,
        entityId: record.dependentId,
        newData: row,
        requestId: input.requestId,
      });
      output.push({
        ...serializeLearningRow<Record<string, unknown>>(row),
        id: `${record.dependentId}:${record.prerequisiteId}`,
        kind: record.kind,
        dependentId: record.dependentId,
        prerequisiteId: record.prerequisiteId,
      });
    }
    return output;
  });
}

function parsePrerequisiteId(id: string): [string, string] {
  const [dependent, prerequisite, ...rest] = id.split(":");
  if (!dependent || !prerequisite || rest.length) {
    throw new LearningValidationError("The prerequisite identifier is invalid.", {
      id: "Expected dependent UUID:prerequisite UUID",
    });
  }
  return [parseUuid(dependent, "dependentId"), parseUuid(prerequisite, "prerequisiteId")];
}

export async function getPrerequisite(kind: PrerequisiteKind, id: string) {
  const spec = prerequisiteSpecs[kind];
  const [dependentId, prerequisiteId] = parsePrerequisiteId(id);
  const result = await learningQuery<Record<string, unknown>>(
    `SELECT * FROM content.${spec.table}
      WHERE ${spec.dependentField} = $1 AND ${spec.prerequisiteField} = $2`,
    [dependentId, prerequisiteId],
  );
  if (!result.rows[0]) throw notFound("Prerequisite");
  return {
    ...serializeLearningRow<Record<string, unknown>>(result.rows[0]),
    id,
    kind,
    dependentId,
    prerequisiteId,
  };
}

export async function updatePrerequisite(input: {
  kind: PrerequisiteKind;
  id: string;
  body: Record<string, unknown>;
  actorId: string;
  requestId: string;
}) {
  const spec = prerequisiteSpecs[input.kind];
  const [dependentId, prerequisiteId] = parsePrerequisiteId(input.id);
  const normalized = Object.fromEntries(Object.entries(input.body).map(([key, value]) => [snakeKey(key), value]));
  delete normalized.kind;
  delete normalized.dependent_id;
  delete normalized.prerequisite_id;
  for (const key of Object.keys(normalized)) {
    if (!["requirement", "minimum_score_percent"].includes(key)) {
      throw new LearningValidationError("The request includes an unsupported field.", { [key]: "Unsupported field" });
    }
  }
  const requirement = normalized.requirement;
  if (requirement !== undefined && (typeof requirement !== "string" || !["completion", "mastery", "unlock"].includes(requirement))) {
    throw new LearningValidationError("The prerequisite requirement is invalid.");
  }
  const minimum = normalized.minimum_score_percent === undefined ? undefined
    : normalized.minimum_score_percent === null ? null : Number(normalized.minimum_score_percent);
  if (minimum !== undefined && minimum !== null && (!Number.isFinite(minimum) || minimum < 0 || minimum > 100)) {
    throw new LearningValidationError("The minimum score must be from 0 to 100.");
  }
  if (requirement === undefined && minimum === undefined) throw new LearningValidationError("At least one field is required.");

  return withLearningTransaction(async (client) => {
    const actorId = await setAuditContext(client, input.actorId, input.requestId);
    const currentResult = await client.query<Record<string, unknown>>(
      `SELECT * FROM content.${spec.table}
        WHERE ${spec.dependentField} = $1 AND ${spec.prerequisiteField} = $2 FOR UPDATE`,
      [dependentId, prerequisiteId],
    );
    const current = currentResult.rows[0];
    if (!current) throw notFound("Prerequisite");
    const result = await client.query<Record<string, unknown>>(
      `UPDATE content.${spec.table}
          SET requirement = coalesce($3, requirement),
              minimum_score_percent = CASE WHEN $4::boolean THEN $5::numeric ELSE minimum_score_percent END
        WHERE ${spec.dependentField} = $1 AND ${spec.prerequisiteField} = $2
        RETURNING *`,
      [dependentId, prerequisiteId, requirement ?? null, minimum !== undefined, minimum ?? null],
    );
    const row = result.rows[0];
    await insertManualAudit(client, {
      actorId,
      action: "update",
      entityKind: `${input.kind}_prerequisite`,
      entityId: dependentId,
      oldData: current,
      newData: row,
      requestId: input.requestId,
    });
    return {
      ...serializeLearningRow<Record<string, unknown>>(row),
      id: input.id,
      kind: input.kind,
      dependentId,
      prerequisiteId,
    };
  });
}

export async function deletePrerequisite(input: {
  kind: PrerequisiteKind;
  id: string;
  actorId: string;
  requestId: string;
}) {
  const spec = prerequisiteSpecs[input.kind];
  const [dependentId, prerequisiteId] = parsePrerequisiteId(input.id);
  return withLearningTransaction(async (client) => {
    const actorId = await setAuditContext(client, input.actorId, input.requestId);
    const result = await client.query<Record<string, unknown>>(
      `DELETE FROM content.${spec.table}
        WHERE ${spec.dependentField} = $1 AND ${spec.prerequisiteField} = $2
        RETURNING *`,
      [dependentId, prerequisiteId],
    );
    const row = result.rows[0];
    if (!row) throw notFound("Prerequisite");
    await insertManualAudit(client, {
      actorId,
      action: "delete",
      entityKind: `${input.kind}_prerequisite`,
      entityId: dependentId,
      oldData: row,
      requestId: input.requestId,
    });
    return { id: input.id, deleted: true };
  });
}

const workflowEntityAliases: Record<string, Exclude<AdminEntityName, "prerequisites" | "workflow" | "audit" | "question-options" | "question-contexts" | "content-sources">> = {
  programme: "programmes",
  programmes: "programmes",
  subject: "subjects",
  subjects: "subjects",
  group: "groups",
  learning_group: "groups",
  groups: "groups",
  lesson: "lessons",
  lessons: "lessons",
  section: "sections",
  lesson_section: "sections",
  sections: "sections",
  objective: "objectives",
  learning_objective: "objectives",
  objectives: "objectives",
  question: "questions",
  questions: "questions",
  source: "sources",
  sources: "sources",
};

function workflowSpec(value: unknown): EntitySpec {
  if (typeof value !== "string" || !workflowEntityAliases[value]) {
    throw new LearningValidationError("A valid workflow entity is required.", { entity: "Unsupported workflow entity" });
  }
  return getEntitySpec(workflowEntityAliases[value]);
}

const governedEntityKinds = new Set(["lesson", "lesson_section", "question", "source"]);
const governedReviewStages = new Set([
  "author_review", "doctrinal_review", "assessment_review",
  "source_licence_review", "approval",
]);
const governedNextStage: Record<string, string> = {
  doctrinal_review: "assessment_review",
  assessment_review: "source_licence_review",
  source_licence_review: "approval",
};
const stageSpecialism: Record<string, string | null> = {
  author_review: null,
  doctrinal_review: "doctrinal",
  assessment_review: "assessment",
  source_licence_review: "source_licence",
  approval: null,
};
const governanceReviewerRoles = new Set(["super_admin", "admin", "editor", "author", "contributor", "reviewer"]);

function governanceStage(value: unknown): string {
  if (typeof value !== "string" || !governedReviewStages.has(value)) {
    throw new LearningApiError("invalid_governance_stage", 409, "The governed record is not at a reviewable stage.");
  }
  return value;
}

async function recordGovernanceReview(
  client: PoolClient,
  input: {
    entityKind: string;
    entityId: string;
    entityVersion: number;
    stage: string;
    decision: "approved" | "changes_requested";
    reviewerId: string;
    reviewerRole: Role;
    comment: string | null;
  },
): Promise<void> {
  if (!governanceReviewerRoles.has(input.reviewerRole)) {
    throw new LearningApiError("forbidden", 403, "This staff role cannot record a governance review.");
  }
  await client.query(
    `INSERT INTO content.governance_reviews
       (entity_kind, entity_id, entity_version, stage, decision, reviewer_id, reviewer_role, specialism, comment)
     VALUES ($1, $2, $3, $4::content.workflow_stage, $5::content.review_decision, $6::uuid, $7, $8::content.review_specialism, $9)
     ON CONFLICT (entity_kind, entity_id, entity_version, stage, reviewer_id)
     DO UPDATE SET decision = EXCLUDED.decision,
                   reviewer_role = EXCLUDED.reviewer_role,
                   specialism = EXCLUDED.specialism,
                   comment = EXCLUDED.comment,
                   created_at = now()`,
    [
      input.entityKind,
      input.entityId,
      input.entityVersion,
      input.stage,
      input.decision,
      input.reviewerId,
      input.reviewerRole,
      stageSpecialism[input.stage],
      input.comment,
    ],
  );
}

function assertWorkflowTransition(action: WorkflowAction, status: unknown): void {
  const allowed: Record<WorkflowAction, string[]> = {
    submit: ["draft", "changes_requested"],
    "request-changes": ["in_review"],
    approve: ["in_review"],
    publish: ["approved", "scheduled"],
    schedule: ["approved"],
    archive: ["draft", "in_review", "changes_requested", "approved", "scheduled", "published"],
    restore: ["archived"],
    duplicate: ["draft", "in_review", "changes_requested", "approved", "scheduled", "published", "archived"],
    "new-version": ["approved", "scheduled", "published", "archived"],
  };
  if (typeof status !== "string" || !allowed[action].includes(status)) {
    throw new LearningApiError("invalid_transition", 409, "The requested workflow transition is not valid for this record.");
  }
}

export function workflowPermission(action: WorkflowAction): "learning:manage" | "learning:review" | "learning:publish" {
  if (["request-changes", "approve"].includes(action)) return "learning:review";
  if (["publish", "schedule", "archive", "restore"].includes(action)) return "learning:publish";
  return "learning:manage";
}

export async function transitionAdminWorkflow(input: {
  id: string;
  action: WorkflowAction;
  body: Record<string, unknown>;
  actor: { id: string; role: Role };
  requestId: string;
}) {
  const id = parseUuid(input.id, "id");
  const spec = workflowSpec(input.body.entity ?? input.body.entityKind ?? input.body.entity_kind);
  if (!spec.versioned) throw new LearningApiError("invalid_request", 400, "This record does not support publication workflow.");
  const governed = governedEntityKinds.has(spec.entityKind);

  return withLearningTransaction(async (client) => {
    const actorId = await setAuditContext(client, input.actor.id, input.requestId);
    const currentResult = await client.query<Record<string, unknown>>(
      `SELECT * FROM content.${spec.table} WHERE id = $1 FOR UPDATE`,
      [id],
    );
    const current = currentResult.rows[0];
    if (!current) throw notFound("Learning record");
    assertWorkflowTransition(input.action, current.status);

    if (["approve", "request-changes"].includes(input.action)
      && current.created_by === actorId) {
      throw new LearningApiError("self_review_forbidden", 403, "The content creator cannot perform an independent governance review.");
    }
    if (["author", "contributor"].includes(input.actor.role)
      && ["submit", "duplicate", "new-version"].includes(input.action)
      && current.created_by !== actorId) {
      throw new LearningApiError("forbidden", 403, "Authors may manage workflow only for their own content.");
    }

    if (input.action === "duplicate") {
      const fields: Record<string, unknown> = {};
      for (const field of spec.allowedFields) {
        if (Object.prototype.hasOwnProperty.call(current, field)) fields[field] = current[field];
      }
      const suffix = randomUUID().slice(0, 8);
      if (typeof fields.slug === "string") fields.slug = `${fields.slug.slice(0, 145)}-copy-${suffix}`;
      if (typeof fields.stable_key === "string") fields.stable_key = `${fields.stable_key.slice(0, 145)}_copy_${suffix}`;
      if (typeof fields.title === "string") fields.title = `${fields.title} (Copy)`.slice(0, 10_000);
      fields.created_by = actorId;
      fields.updated_by = actorId;
      const statement = buildInsert(spec.table, fields);
      const result = await client.query<Record<string, unknown>>(statement.sql, statement.values);
      return serializeLearningRow(result.rows[0]);
    }

    await client.query(
      `INSERT INTO content.content_versions
         (entity_kind, entity_id, version, snapshot, change_summary, status, created_by)
       VALUES ($1::content.entity_kind, $2, $3, $4::jsonb, $5, $6::content.publication_status, $7::uuid)
       ON CONFLICT (entity_kind, entity_id, version) DO NOTHING`,
      [
        spec.entityKind,
        id,
        current.version,
        JSON.stringify(current),
        typeof input.body.changeSummary === "string" ? input.body.changeSummary.slice(0, 2_000) : `Before ${input.action}`,
        current.status,
        actorId,
      ],
    );

    const entityVersion = Number(current.version);
    const reviewComment = typeof input.body.comment === "string" && input.body.comment.trim()
      ? input.body.comment.trim().slice(0, 2_000)
      : null;
    let sql: string;
    const values: unknown[] = [id, actorId];

    switch (input.action) {
      case "submit":
        if (governed) {
          await client.query(
            `DELETE FROM content.governance_reviews
              WHERE entity_kind = $1 AND entity_id = $2 AND entity_version = $3`,
            [spec.entityKind, id, entityVersion],
          );
          await recordGovernanceReview(client, {
            entityKind: spec.entityKind,
            entityId: id,
            entityVersion,
            stage: "author_review",
            decision: "approved",
            reviewerId: actorId,
            reviewerRole: input.actor.role,
            comment: reviewComment,
          });
          sql = "status = 'in_review', review_status = 'pending', governance_stage = 'doctrinal_review', reviewed_by = NULL, reviewed_at = NULL";
        } else {
          sql = "status = 'in_review', review_status = 'pending', reviewed_by = NULL, reviewed_at = NULL";
        }
        break;
      case "request-changes": {
        if (!reviewComment) {
          throw new LearningValidationError("A review comment is required when requesting changes.", { comment: "Explain the required changes" });
        }
        if (governed) {
          const stage = governanceStage(current.governance_stage);
          await recordGovernanceReview(client, {
            entityKind: spec.entityKind,
            entityId: id,
            entityVersion,
            stage,
            decision: "changes_requested",
            reviewerId: actorId,
            reviewerRole: input.actor.role,
            comment: reviewComment,
          });
          sql = "status = 'changes_requested', review_status = 'changes_requested', governance_stage = 'draft', reviewed_by = $2::uuid, reviewed_at = now()";
        } else {
          sql = "status = 'changes_requested', review_status = 'changes_requested', reviewed_by = $2::uuid, reviewed_at = now()";
        }
        break;
      }
      case "approve":
        if (governed) {
          const stage = governanceStage(current.governance_stage);
          if (stage === "author_review") {
            throw new LearningApiError("invalid_governance_stage", 409, "Submit the draft to complete author review.");
          }
          await recordGovernanceReview(client, {
            entityKind: spec.entityKind,
            entityId: id,
            entityVersion,
            stage,
            decision: "approved",
            reviewerId: actorId,
            reviewerRole: input.actor.role,
            comment: reviewComment,
          });
          if (stage === "source_licence_review" && spec.entityKind === "source") {
            await client.query(
              `UPDATE content.sources
                  SET rights_reviewed_by = $2::uuid, rights_reviewed_at = now()
                WHERE id = $1`,
              [id, actorId],
            );
          }
          const nextStage = governedNextStage[stage];
          if (nextStage) {
            values.push(nextStage);
            sql = "status = 'in_review', review_status = 'pending', governance_stage = $3::content.workflow_stage, reviewed_by = $2::uuid, reviewed_at = now()";
          } else if (stage === "approval") {
            sql = "status = 'approved', review_status = 'approved', governance_stage = 'approval', reviewed_by = $2::uuid, reviewed_at = now()";
          } else {
            throw new LearningApiError("invalid_governance_stage", 409, "The review stage cannot be advanced.");
          }
        } else {
          sql = "status = 'approved', review_status = 'approved', reviewed_by = $2::uuid, reviewed_at = now()";
        }
        break;
      case "publish":
        sql = governed
          ? "status = 'published', review_status = 'approved', governance_stage = 'publication', published_at = now(), scheduled_for = NULL, archived_at = NULL"
          : "status = 'published', review_status = 'approved', published_at = now(), scheduled_for = NULL, archived_at = NULL";
        break;
      case "schedule": {
        const scheduledFor = parseIsoTimestamp(input.body.scheduledFor ?? input.body.scheduled_for, "scheduledFor");
        if (new Date(scheduledFor).getTime() <= Date.now()) {
          throw new LearningValidationError("The scheduled publication time must be in the future.");
        }
        values.push(scheduledFor);
        sql = governed
          ? "status = 'scheduled', review_status = 'approved', governance_stage = 'approval', scheduled_for = $3::timestamptz, archived_at = NULL"
          : "status = 'scheduled', review_status = 'approved', scheduled_for = $3::timestamptz, archived_at = NULL";
        break;
      }
      case "archive":
        sql = "status = 'archived', archived_at = now(), scheduled_for = NULL";
        break;
      case "restore":
        sql = governed
          ? "status = 'draft', review_status = 'unreviewed', governance_stage = 'draft', published_at = NULL, scheduled_for = NULL, archived_at = NULL, reviewed_by = NULL, reviewed_at = NULL"
          : "status = 'draft', review_status = 'unreviewed', published_at = NULL, scheduled_for = NULL, archived_at = NULL, reviewed_by = NULL, reviewed_at = NULL";
        break;
      case "new-version":
        sql = governed
          ? "version = version + 1, status = 'draft', review_status = 'unreviewed', governance_stage = 'draft', published_at = NULL, scheduled_for = NULL, archived_at = NULL, reviewed_by = NULL, reviewed_at = NULL"
          : "version = version + 1, status = 'draft', review_status = 'unreviewed', published_at = NULL, scheduled_for = NULL, archived_at = NULL, reviewed_by = NULL, reviewed_at = NULL";
        break;
      default:
        throw new LearningApiError("invalid_transition", 409, "The workflow transition is invalid.");
    }
    const result = await client.query<Record<string, unknown>>(
      `UPDATE content.${spec.table}
          SET ${sql}, updated_by = $2::uuid
        WHERE id = $1
        RETURNING *`,
      values,
    );
    return serializeLearningRow(result.rows[0]);
  });
}
