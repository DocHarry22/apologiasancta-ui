export const LESSON_COMPONENTS = [
  "central_question",
  "learning_objectives",
  "concise_answer",
  "full_explanation",
  "scripture",
  "catholic_doctrinal_evidence",
  "historical_or_patristic_evidence",
  "important_distinctions",
  "serious_objection",
  "catholic_response",
  "common_misunderstandings",
  "summary",
  "practice_questions",
  "references",
  "related_apologia_graph",
] as const;

export const DOCTRINAL_CLASSIFICATIONS = [
  "dogma",
  "definitively_held",
  "authoritative_doctrine",
  "discipline",
  "prudential_application",
  "permitted_opinion",
  "historical_claim",
  "comparative_religion_claim",
  "disputed_or_unresolved",
] as const;

export const DIFFICULTY_LEVELS = [
  "foundations",
  "distinctions",
  "evidence",
  "objections",
  "synthesis",
] as const;

export const DIFFICULTY_MODES = ["easy", "medium", "hard", "expert", "trick"] as const;

export const TRICK_CATEGORIES = [
  "nature_vs_person",
  "infallibility_vs_impeccability",
  "veneration_vs_worship",
  "sign_vs_merely_symbolic",
  "dogma_vs_discipline",
  "development_vs_contradiction",
  "necessary_vs_sufficient",
  "premise_vs_conclusion",
  "initial_justification_vs_growth_in_grace",
  "material_vs_formal_rejection",
  "correct_doctrine_wrong_subject",
] as const;

export const AUTHORITATIVE_SOURCE_CATEGORIES = [
  "sacred_scripture",
  "sacred_tradition",
  "ecumenical_council",
  "papal_magisterium",
  "dicastery_magisterium",
  "catechism",
  "canon_law",
  "church_father",
  "church_doctor",
  "official_comparative_source",
  "primary_historical_source",
  "academic_secondary_source",
] as const;

export type GovernanceEntity = "lesson" | "question" | "source" | "doctrinal_claim";
export type FindingSeverity = "info" | "warning" | "error";
export type GovernanceFinding = {
  code: string;
  severity: FindingSeverity;
  field: string;
  message: string;
  reviewStage: "author_review" | "doctrinal_review" | "assessment_review" | "source_licence_review";
};

type UnknownRecord = Record<string, unknown>;

const PUBLISHABLE_PERMISSION = new Set([
  "public_domain",
  "licensed",
  "permission_not_required_under_recorded_terms",
]);
const FORBIDDEN_OPTIONS = [/^all of the above\.?$/i, /^none of the above\.?$/i];
const GENERIC_TRADITIONS = /^(?:protestants?|muslims?)$/i;

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function first(value: UnknownRecord, ...keys: string[]): unknown {
  for (const key of keys) {
    if (value[key] !== undefined) return value[key];
  }
  return undefined;
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  const object = record(value);
  if (!object) return "";
  for (const key of ["text", "content", "body", "label", "prompt", "value"]) {
    const candidate = text(object[key]);
    if (candidate) return candidate;
  }
  return "";
}

function finding(
  code: string,
  severity: FindingSeverity,
  field: string,
  message: string,
  reviewStage: GovernanceFinding["reviewStage"],
): GovernanceFinding {
  return { code, severity, field, message, reviewStage };
}

function asOptions(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.map(record).filter((item): item is UnknownRecord => item !== null) : [];
}

function authorityCategory(source: UnknownRecord): string {
  return text(first(source, "authorityCategory", "authority_category", "sourceAuthority", "source_authority"));
}

function rightsRecord(value: UnknownRecord): UnknownRecord {
  return record(first(value, "rightsMetadata", "rights_metadata")) ?? {};
}

export function validateQuestion(value: unknown): GovernanceFinding[] {
  const question = record(value);
  if (!question) return [finding("question.object_required", "error", "$", "Question must be an object.", "author_review")];
  const findings: GovernanceFinding[] = [];
  const type = text(first(question, "questionType", "question_type", "type"));
  if (type !== "single_choice") {
    findings.push(finding("question.type_multiple_choice_only", "error", "questionType", "Only single-choice multiple-choice questions may be published.", "assessment_review"));
  }

  const prompt = text(first(question, "prompt", "question"));
  if (!prompt) findings.push(finding("question.prompt_required", "error", "prompt", "A self-contained question stem is required.", "assessment_review"));
  if (/\b(?:not\s+un|never\s+not|not\s+without)\b/i.test(prompt)) {
    findings.push(finding("question.double_negative", "warning", "prompt", "Review the stem for an unnecessary double negative.", "assessment_review"));
  }

  if (!text(first(question, "objectiveId", "objective_id", "learningObjectiveId", "learning_objective_id"))) {
    findings.push(finding("question.objective_required", "error", "objectiveId", "Link the assessed learning objective.", "assessment_review"));
  }
  if (!text(first(question, "equivalenceKey", "equivalence_key"))) {
    findings.push(finding("question.equivalence_key_required", "error", "equivalenceKey", "An equivalence key is required for retake selection.", "assessment_review"));
  }

  const difficulty = Number(first(question, "difficulty", "difficultyLevelValue", "difficulty_level_value"));
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) {
    findings.push(finding("question.difficulty_level_invalid", "error", "difficulty", "Difficulty level must be an integer from 1 to 5.", "assessment_review"));
  }
  const mode = text(first(question, "difficultyMode", "difficulty_mode"));
  if (!DIFFICULTY_MODES.includes(mode as typeof DIFFICULTY_MODES[number])) {
    findings.push(finding("question.difficulty_mode_invalid", "error", "difficultyMode", "Difficulty mode must be easy, medium, hard, expert or trick.", "assessment_review"));
  }
  const trickCategory = text(first(question, "trickCategory", "trick_category"));
  if (mode === "trick" && !TRICK_CATEGORIES.includes(trickCategory as typeof TRICK_CATEGORIES[number])) {
    findings.push(finding("question.trick_category_required", "error", "trickCategory", "Trick mode requires one approved category.", "assessment_review"));
  }
  if (mode !== "trick" && trickCategory) {
    findings.push(finding("question.trick_category_unexpected", "error", "trickCategory", "A trick category is valid only in Trick mode.", "assessment_review"));
  }

  const explanation = text(first(question, "correctAnswerExplanation", "correct_answer_explanation", "explanation"));
  if (!explanation) findings.push(finding("question.correct_explanation_required", "error", "correctAnswerExplanation", "Explain why the best answer is correct.", "assessment_review"));

  const options = asOptions(first(question, "options", "answerOptions", "answer_options", "choices"));
  if (options.length !== 4) findings.push(finding("question.option_count", "error", "options", "Exactly four enabled options are required.", "assessment_review"));
  const correct = options.filter((option) => first(option, "isCorrect", "is_correct") === true);
  if (correct.length !== 1) findings.push(finding("question.one_best_answer", "error", "options", "Exactly one option must be marked correct.", "assessment_review"));

  for (const [index, option] of options.entries()) {
    const optionText = text(first(option, "content", "text", "label", "value"));
    if (!optionText) findings.push(finding("question.option_text_required", "error", `options.${index}`, "Option text is required.", "assessment_review"));
    if (FORBIDDEN_OPTIONS.some((pattern) => pattern.test(optionText))) {
      findings.push(finding("question.forbidden_option", "error", `options.${index}`, "All/None of the above is prohibited.", "assessment_review"));
    }
    if (!text(option.explanation)) {
      findings.push(finding("question.option_explanation_required", "error", `options.${index}.explanation`, "Every option requires an explanation.", "assessment_review"));
    }
    if (first(option, "isCorrect", "is_correct") !== true && !text(first(option, "misconceptionCode", "misconception_code", "misconceptionId", "misconception_id"))) {
      findings.push(finding("question.distractor_misconception_required", "error", `options.${index}.misconceptionCode`, "Every distractor requires a misconception code.", "assessment_review"));
    }
  }

  if (correct.length === 1 && options.length === 4) {
    const correctLength = text(first(correct[0]!, "content", "text", "label", "value")).length;
    const distractorLengths = options.filter((option) => option !== correct[0]).map((option) => text(first(option, "content", "text", "label", "value")).length);
    const longestDistractor = Math.max(1, ...distractorLengths);
    if (correctLength > 20 && correctLength > longestDistractor * 1.55) {
      findings.push(finding("question.correct_length_clue", "warning", "options", "The correct option is conspicuously longer than every distractor.", "assessment_review"));
    }
  }

  const sources = Array.isArray(question.sources) ? question.sources.map(record).filter((item): item is UnknownRecord => item !== null) : [];
  if (!sources.some((source) => AUTHORITATIVE_SOURCE_CATEGORIES.includes(authorityCategory(source) as typeof AUTHORITATIVE_SOURCE_CATEGORIES[number]))) {
    findings.push(finding("question.authoritative_source_required", "error", "sources", "At least one authoritative source with a locator is required.", "source_licence_review"));
  }
  if (sources.some((source) => !text(first(source, "locator", "citationLocator", "citation_locator")))) {
    findings.push(finding("question.source_locator_required", "error", "sources", "Every attached source requires a precise locator.", "source_licence_review"));
  }

  const scope = record(first(question, "denominationScope", "denomination_scope", "comparativeScope", "comparative_scope")) ?? {};
  const tradition = text(first(scope, "tradition", "namedTradition", "named_tradition"));
  const comparative = scope.comparative === true || Boolean(tradition);
  if (tradition && GENERIC_TRADITIONS.test(tradition)) {
    findings.push(finding("comparative.generic_scope", "error", "denominationScope.tradition", "Name the relevant tradition rather than using a generic family label.", "doctrinal_review"));
  }
  if (comparative && !tradition) {
    findings.push(finding("comparative.named_tradition_required", "error", "denominationScope.tradition", "Comparative content requires a named tradition or argument.", "doctrinal_review"));
  }
  if (comparative && (difficulty >= 4 || mode === "expert" || mode === "trick") && !text(scope.steelman)) {
    findings.push(finding("comparative.steelman_required", "error", "denominationScope.steelman", "Advanced comparative questions require a steelman.", "doctrinal_review"));
  }

  const rights = rightsRecord(question);
  if (!PUBLISHABLE_PERMISSION.has(text(first(rights, "permissionStatus", "permission_status")))) {
    findings.push(finding("question.permission_unverified", "error", "rightsMetadata.permissionStatus", "Rights/translation permission must be verified for publication.", "source_licence_review"));
  }
  return findings;
}

export function validateLesson(value: unknown): GovernanceFinding[] {
  const lesson = record(value);
  if (!lesson) return [finding("lesson.object_required", "error", "$", "Lesson must be an object.", "author_review")];
  const componentsValue = first(lesson, "components", "lessonComponents", "lesson_components");
  const present = new Set<string>();
  if (Array.isArray(componentsValue)) {
    for (const item of componentsValue) {
      if (typeof item === "string") present.add(item);
      else {
        const component = record(item);
        const key = component ? text(first(component, "requirement", "kind", "code")) : "";
        if (key && first(component!, "satisfied", "complete", "enabled") !== false) present.add(key);
      }
    }
  }
  const findings: GovernanceFinding[] = [];
  for (const component of LESSON_COMPONENTS) {
    if (!present.has(component)) findings.push(finding(`lesson.component.${component}`, "error", "components", `Missing required lesson component: ${component}.`, "author_review"));
  }
  return findings;
}

export function validateSource(value: unknown): GovernanceFinding[] {
  const source = record(value);
  if (!source) return [finding("source.object_required", "error", "$", "Source must be an object.", "source_licence_review")];
  const findings: GovernanceFinding[] = [];
  const category = authorityCategory(source);
  if (!category || category === "unverified") findings.push(finding("source.authority_unverified", "error", "authorityCategory", "Classify source authority before publication.", "source_licence_review"));
  if (!text(first(source, "citation", "canonicalCitation", "canonical_citation"))) findings.push(finding("source.citation_required", "error", "citation", "A canonical citation is required.", "source_licence_review"));
  const rights = rightsRecord(source);
  const permission = text(first(rights, "permissionStatus", "permission_status"));
  if (!PUBLISHABLE_PERMISSION.has(permission)) findings.push(finding("source.permission_unverified", "error", "rightsMetadata.permissionStatus", "Permission is not publishable.", "source_licence_review"));
  const quoteLimit = Number(first(rights, "quoteLimitWords", "quote_limit_words"));
  if (!Number.isInteger(quoteLimit) || quoteLimit < 0) findings.push(finding("source.quote_limit_required", "error", "rightsMetadata.quoteLimitWords", "Record a reviewed non-negative quotation limit.", "source_licence_review"));
  if (!text(first(rights, "attributionText", "attribution_text")) && permission !== "public_domain") {
    findings.push(finding("source.attribution_required", "error", "rightsMetadata.attributionText", "Record required attribution text.", "source_licence_review"));
  }
  return findings;
}

export function validateDoctrinalClaim(value: unknown): GovernanceFinding[] {
  const claim = record(value);
  if (!claim) return [finding("claim.object_required", "error", "$", "Claim must be an object.", "doctrinal_review")];
  const findings: GovernanceFinding[] = [];
  const classification = text(claim.classification);
  if (!DOCTRINAL_CLASSIFICATIONS.includes(classification as typeof DOCTRINAL_CLASSIFICATIONS[number])) {
    findings.push(finding("claim.classification_invalid", "error", "classification", "Use an approved doctrinal classification.", "doctrinal_review"));
  }
  if (classification === "disputed_or_unresolved" && claim.humanReviewRequired !== true && claim.human_review_required !== true) {
    findings.push(finding("claim.human_review_required", "error", "humanReviewRequired", "Disputed or unresolved claims require qualified human review.", "doctrinal_review"));
  }
  if (!text(first(claim, "attributionMode", "attribution_mode"))) {
    findings.push(finding("claim.attribution_mode_required", "error", "attributionMode", "Distinguish quotation, paraphrase, interpretation or inference.", "doctrinal_review"));
  }
  return findings;
}

export function validateGovernedEntity(entity: GovernanceEntity, value: unknown): GovernanceFinding[] {
  switch (entity) {
    case "lesson": return validateLesson(value);
    case "question": return validateQuestion(value);
    case "source": return validateSource(value);
    case "doctrinal_claim": return validateDoctrinalClaim(value);
  }
}

export function hasBlockingFindings(findings: readonly GovernanceFinding[]): boolean {
  return findings.some((item) => item.severity === "error");
}

export function summariseFindings(findings: readonly GovernanceFinding[]) {
  return {
    errors: findings.filter((item) => item.severity === "error").length,
    warnings: findings.filter((item) => item.severity === "warning").length,
    info: findings.filter((item) => item.severity === "info").length,
    publishable: !hasBlockingFindings(findings),
  };
}
