import type { AdminEntityName } from "@/lib/learning/contracts";
import { isUuid, LearningValidationError } from "@/lib/learning/validation";
import { learningQuery } from "./database";
import { LearningApiError } from "./errors";

type GovernedAdminEntity = "lessons" | "sections" | "doctrinal-claims" | "questions" | "sources";

const governedEntities: Record<GovernedAdminEntity, { table: string; kind: string }> = {
  lessons: { table: "lessons", kind: "lesson" },
  sections: { table: "lesson_sections", kind: "lesson_section" },
  "doctrinal-claims": { table: "doctrinal_claims", kind: "doctrinal_claim" },
  questions: { table: "questions", kind: "question" },
  sources: { table: "sources", kind: "source" },
};

export function isGovernedAdminEntity(entity: AdminEntityName): entity is GovernedAdminEntity {
  return Object.prototype.hasOwnProperty.call(governedEntities, entity);
}

export async function getAdminGovernanceValidation(input: {
  entity: AdminEntityName;
  id: string;
  forPublication?: boolean;
}) {
  if (!isGovernedAdminEntity(input.entity)) {
    throw new LearningValidationError("This entity does not use Phase 2 governance.", {
      entity: "Select a lesson, section, doctrinal claim, question or source",
    });
  }
  if (!isUuid(input.id)) {
    throw new LearningValidationError("The record identifier is invalid.", { id: "Expected a UUID" });
  }

  const spec = governedEntities[input.entity];
  const rowResult = await learningQuery<{
    id: string;
    version: number;
    status: string;
    governance_stage: string;
  }>(
    "SELECT id, version, status::text, governance_stage::text " +
      "FROM content." + spec.table + " WHERE id = $1::uuid",
    [input.id],
  );
  const row = rowResult.rows[0];
  if (!row) {
    throw new LearningApiError("not_found", 404, "The governed content record was not found.");
  }

  const [findingResult, reviewResult] = await Promise.all([
    learningQuery<{
      code: string;
      severity: "info" | "warning" | "error";
      review_stage: string;
      message: string;
    }>(
      "SELECT code, severity, review_stage::text, message " +
        "FROM content.governance_findings($1, $2::uuid, $3::integer, $4::boolean) " +
        "ORDER BY CASE severity WHEN 'error' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, code",
      [spec.kind, input.id, row.version, input.forPublication === true],
    ),
    learningQuery<{
      stage: string;
      decision: string;
      reviewer_id: string;
      reviewer_role: string;
      specialism: string | null;
      comment: string | null;
      created_at: string;
    }>(
      "SELECT stage::text, decision::text, reviewer_id, reviewer_role, specialism::text, comment, created_at " +
        "FROM content.governance_reviews " +
        "WHERE entity_kind = $1 AND entity_id = $2::uuid AND entity_version = $3::integer " +
        "ORDER BY created_at, id",
      [spec.kind, input.id, row.version],
    ),
  ]);

  const findings = findingResult.rows.map((finding) => ({
    code: finding.code,
    severity: finding.severity,
    reviewStage: finding.review_stage,
    message: finding.message,
  }));
  const errors = findings.filter((finding) => finding.severity === "error").length;
  const warnings = findings.filter((finding) => finding.severity === "warning").length;

  return {
    entity: input.entity,
    entityKind: spec.kind,
    id: row.id,
    version: row.version,
    status: row.status,
    governanceStage: row.governance_stage,
    findings,
    reviews: reviewResult.rows.map((review) => ({
      stage: review.stage,
      decision: review.decision,
      reviewerId: review.reviewer_id,
      reviewerRole: review.reviewer_role,
      specialism: review.specialism,
      comment: review.comment,
      createdAt: review.created_at,
    })),
    summary: {
      errors,
      warnings,
      publishable: errors === 0,
      machinePassIsSufficient: false,
    },
  };
}
