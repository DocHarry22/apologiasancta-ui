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

export const ATTRIBUTION_MODES = [
  "direct_quotation",
  "paraphrase",
  "interpretation",
  "inference",
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

export const PUBLISHABLE_PERMISSION_STATUSES = [
  "public_domain",
  "licensed",
  "permission_not_required_under_recorded_terms",
] as const;

export type GovernanceEntity = "lesson" | "question" | "source" | "doctrinal_claim";
export type FindingSeverity = "info" | "warning" | "error";
export type ReviewStage =
  | "author_review"
  | "doctrinal_review"
  | "assessment_review"
  | "source_licence_review";

export type GovernanceFinding = {
  code: string;
  severity: FindingSeverity;
  field: string;
  message: string;
  reviewStage: ReviewStage;
};

type UnknownRecord = Record<string, unknown>;

const PUBLISHABLE_PERMISSION = new Set<string>(PUBLISHABLE_PERMISSION_STATUSES);
const FORBIDDEN_OPTIONS = [/^all of the above\.?$/i, /^none of the above\.?$/i];
const GENERIC_TRADITIONS = /^(?:protestants?|muslims?)$/i;
const GENERIC_CLAIMS = /\b(?:protestants|muslims)\s+believe\b/i;
const PUBLICATION_STATUSES = new Set([
  "draft",
  "in_review",
  "changes_requested",
  "approved",
  "scheduled",
  "published",
  "archived",
]);
const QUALITY_FLAGS = [
  "joke_or_absurd_distractor",
  "correct_answer_length_clue",
  "grammatical_clue",
  "unnecessary_double_negative",
  "ambiguous_pronoun",
  "missing_context",
  "multiple_defensible_answers",
  "theological_trivia_without_objective",
  "straw_man",
  "deceptive_wording",
] as const;

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
  reviewStage: ReviewStage,
): GovernanceFinding {
  return { code, severity, field, message, reviewStage };
}

function asRecords(value: unknown): UnknownRecord[] {
  return Array.isArray(value)
    ? value.map(record).filter((item): item is UnknownRecord => item !== null)
    : [];
}

function authorityCategory(source: UnknownRecord): string {
  return text(first(source, "authorityCategory", "authority_category", "sourceAuthority", "source_authority"));
}

function rightsRecord(value: UnknownRecord): UnknownRecord {
  return record(first(value, "rightsMetadata", "rights_metadata")) ?? {};
}

function isPositiveInteger(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function hasTextArray(value: unknown): boolean {
  return Array.isArray(value) && value.some((entry) => text(entry).length > 0);
}

function validateRights(
  value: UnknownRecord,
  fieldPrefix: string,
  stage: ReviewStage = "source_licence_review",
): GovernanceFinding[] {
  const findings: GovernanceFinding[] = [];
  const rights = rightsRecord(value);
  const permission = text(first(rights, "permissionStatus", "permission_status"));
  const copyright = text(first(rights, "copyrightStatus", "copyright_status"));
  const prohibited = first(rights, "prohibitedUse", "prohibited_use", "prohibitedUseFlags", "prohibited_use_flags");

  if (!copyright) {
    findings.push(finding("rights.copyright_status_required", "error", fieldPrefix + ".copyrightStatus", "Record copyright status.", stage));
  }
  if (!PUBLISHABLE_PERMISSION.has(permission)) {
    findings.push(finding("rights.permission_unverified", "error", fieldPrefix + ".permissionStatus", "Permission is not publishable.", stage));
  }
  if (Array.isArray(prohibited) && prohibited.some((flag) => typeof flag === "string" && flag.trim())) {
    findings.push(finding("rights.prohibited_use", "error", fieldPrefix + ".prohibitedUseFlags", "A prohibited-use flag overrides source or domain approval.", stage));
  }
  if (permission === "licensed" && !text(first(rights, "licenceIdentifier", "licenseIdentifier", "licence_identifier", "license_identifier"))) {
    findings.push(finding("rights.licence_identifier_required", "error", fieldPrefix + ".licenceIdentifier", "Licensed material requires a licence identifier or terms record.", stage));
  }
  if (permission !== "public_domain" && !text(first(rights, "attributionText", "attribution_text"))) {
    findings.push(finding("rights.attribution_required", "error", fieldPrefix + ".attributionText", "Record the required attribution.", stage));
  }
  const reviewDate = text(first(rights, "reviewedAt", "reviewed_at"));
  if (!reviewDate) {
    findings.push(finding("rights.review_date_required", "error", fieldPrefix + ".reviewedAt", "Record when reuse terms were reviewed.", stage));
  }
  return findings;
}

export function validateQuestion(value: unknown): GovernanceFinding[] {
  const question = record(value);
  if (!question) {
    return [finding("question.object_required", "error", "$", "Question must be an object.", "author_review")];
  }

  const findings: GovernanceFinding[] = [];
  const type = text(first(question, "questionType", "question_type", "type"));
  if (type !== "single_choice") {
    findings.push(finding("question.type_multiple_choice_only", "error", "questionType", "Only single-choice multiple-choice questions may be published.", "assessment_review"));
  }

  const prompt = text(first(question, "prompt", "question"));
  if (!prompt) {
    findings.push(finding("question.prompt_required", "error", "prompt", "A self-contained question stem is required.", "assessment_review"));
  }
  if (/\b(?:not\s+un|never\s+not|not\s+without)\b/i.test(prompt)) {
    findings.push(finding("question.double_negative", "warning", "prompt", "Review the stem for an unnecessary double negative.", "assessment_review"));
  }
  if (GENERIC_CLAIMS.test(prompt)) {
    findings.push(finding("comparative.generic_claim", "error", "prompt", "Name the relevant tradition instead of using a generic family claim.", "doctrinal_review"));
  }

  if (!text(first(question, "objectiveId", "objective_id", "learningObjectiveId", "learning_objective_id"))) {
    findings.push(finding("question.objective_required", "error", "objectiveId", "Link the assessed learning objective.", "assessment_review"));
  }
  if (!text(first(question, "equivalenceKey", "equivalence_key"))) {
    findings.push(finding("question.equivalence_key_required", "error", "equivalenceKey", "An equivalence key is required for retake selection.", "assessment_review"));
  }
  if (!text(first(question, "authorId", "author_id", "createdBy", "created_by"))) {
    findings.push(finding("question.author_required", "error", "authorId", "Record the question author.", "author_review"));
  }
  if (!isPositiveInteger(first(question, "version"))) {
    findings.push(finding("question.version_invalid", "error", "version", "Version must be a positive integer.", "author_review"));
  }
  const publicationStatus = text(first(question, "publicationStatus", "publication_status", "status"));
  if (!PUBLICATION_STATUSES.has(publicationStatus)) {
    findings.push(finding("question.publication_status_invalid", "error", "publicationStatus", "Record a supported publication status.", "author_review"));
  }
  if (!hasTextArray(first(question, "reviewerIds", "reviewer_ids")) && ["approved", "scheduled", "published"].includes(publicationStatus)) {
    findings.push(finding("question.reviewer_required", "error", "reviewerIds", "Approved or published questions require current-version reviewers.", "assessment_review"));
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
  if (!explanation) {
    findings.push(finding("question.correct_explanation_required", "error", "correctAnswerExplanation", "Explain why the best answer is correct.", "assessment_review"));
  }

  const allOptions = asRecords(first(question, "options", "answerOptions", "answer_options", "choices"));
  const options = allOptions.filter((option) => first(option, "enabled") !== false);
  if (options.length !== 4) {
    findings.push(finding("question.option_count", "error", "options", "Exactly four enabled options are required.", "assessment_review"));
  }
  const correct = options.filter((option) => first(option, "isCorrect", "is_correct") === true);
  if (correct.length !== 1) {
    findings.push(finding("question.one_best_answer", "error", "options", "Exactly one enabled option must be marked correct.", "assessment_review"));
  }

  for (const [index, option] of options.entries()) {
    const optionText = text(first(option, "content", "text", "label", "value"));
    if (!optionText) {
      findings.push(finding("question.option_text_required", "error", "options." + index, "Option text is required.", "assessment_review"));
    }
    if (FORBIDDEN_OPTIONS.some((pattern) => pattern.test(optionText))) {
      findings.push(finding("question.forbidden_option", "error", "options." + index, "All/None of the above is prohibited.", "assessment_review"));
    }
    if (GENERIC_CLAIMS.test(optionText)) {
      findings.push(finding("comparative.generic_claim", "error", "options." + index, "Name the relevant tradition instead of using a generic family claim.", "doctrinal_review"));
    }
    if (!text(first(option, "explanation"))) {
      findings.push(finding("question.option_explanation_required", "error", "options." + index + ".explanation", "Every option requires an explanation.", "assessment_review"));
    }
    if (first(option, "isCorrect", "is_correct") !== true && !text(first(option, "misconceptionCode", "misconception_code", "misconceptionId", "misconception_id"))) {
      findings.push(finding("question.distractor_misconception_required", "error", "options." + index + ".misconceptionCode", "Every distractor requires a misconception code.", "assessment_review"));
    }
  }

  if (correct.length === 1 && options.length === 4) {
    const correctLength = text(first(correct[0]!, "content", "text", "label", "value")).length;
    const distractorLengths = options
      .filter((option) => option !== correct[0])
      .map((option) => text(first(option, "content", "text", "label", "value")).length);
    const longestDistractor = Math.max(1, ...distractorLengths);
    if (correctLength > 20 && correctLength > longestDistractor * 1.55) {
      findings.push(finding("question.correct_length_clue", "warning", "options", "The correct option is conspicuously longer than every distractor.", "assessment_review"));
    }
  }

  const quality = record(first(question, "qualityFlags", "quality_flags")) ?? {};
  for (const flag of QUALITY_FLAGS) {
    if (quality[flag] === true) {
      findings.push(finding("question.quality." + flag, "error", "qualityFlags." + flag, "Resolve the recorded prohibited question-quality condition.", "assessment_review"));
    }
  }

  const sources = asRecords(first(question, "sources"));
  const authoritative = sources.filter((source) =>
    AUTHORITATIVE_SOURCE_CATEGORIES.includes(authorityCategory(source) as typeof AUTHORITATIVE_SOURCE_CATEGORIES[number])
  );
  if (authoritative.length === 0) {
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
  if (comparative && !text(first(scope, "sourceLocator", "source_locator"))) {
    findings.push(finding("comparative.recognised_source_required", "error", "denominationScope.sourceLocator", "Comparative scope requires an official or recognised source locator.", "doctrinal_review"));
  }
  if (comparative && (difficulty >= 4 || mode === "expert" || mode === "trick") && !text(first(scope, "steelman"))) {
    findings.push(finding("comparative.steelman_required", "error", "denominationScope.steelman", "Advanced comparative questions require a steelman.", "doctrinal_review"));
  }

  findings.push(...validateRights(question, "rightsMetadata"));
  return findings;
}

export function validateLesson(value: unknown): GovernanceFinding[] {
  const lesson = record(value);
  if (!lesson) {
    return [finding("lesson.object_required", "error", "$", "Lesson must be an object.", "author_review")];
  }
  const componentsValue = first(lesson, "components", "lessonComponents", "lesson_components");
  const components = Array.isArray(componentsValue) ? componentsValue : [];
  const present = new Set<string>();
  const findings: GovernanceFinding[] = [];

  for (const item of components) {
    if (typeof item === "string") {
      present.add(item);
      continue;
    }
    const component = record(item);
    if (!component) continue;
    const key = text(first(component, "requirement", "kind", "code"));
    const nonApplicable = first(component, "nonApplicable", "non_applicable") === true;
    const satisfied = first(component, "satisfied", "complete", "enabled") !== false;

    if (key && (satisfied || nonApplicable)) present.add(key);
    if (nonApplicable && !text(first(component, "nonApplicableReason", "non_applicable_reason"))) {
      findings.push(finding("lesson.non_applicable_reason_required", "error", "components." + key, "A reviewed reason is required when a lesson component is not applicable.", "author_review"));
    }
    const attribution = text(first(component, "attributionMode", "attribution_mode"));
    if (text(first(component, "sourceId", "source_id", "sourceLocator", "source_locator"))
      && !ATTRIBUTION_MODES.includes(attribution as typeof ATTRIBUTION_MODES[number])) {
      findings.push(finding("lesson.attribution_mode_required", "error", "components." + key + ".attributionMode", "Distinguish quotation, paraphrase, interpretation or inference.", "doctrinal_review"));
    }
  }

  for (const component of LESSON_COMPONENTS) {
    if (!present.has(component)) {
      findings.push(finding("lesson.component." + component, "error", "components", "Missing required lesson component: " + component + ".", "author_review"));
    }
  }
  return findings;
}

export function validateSource(value: unknown): GovernanceFinding[] {
  const source = record(value);
  if (!source) {
    return [finding("source.object_required", "error", "$", "Source must be an object.", "source_licence_review")];
  }
  const findings: GovernanceFinding[] = [];
  const category = authorityCategory(source);
  if (!category || category === "unverified") {
    findings.push(finding("source.authority_unverified", "error", "authorityCategory", "Classify source authority before publication.", "source_licence_review"));
  }
  if (!text(first(source, "citation", "canonicalCitation", "canonical_citation"))) {
    findings.push(finding("source.citation_required", "error", "citation", "A canonical citation is required.", "source_licence_review"));
  }
  if (!text(first(source, "url")) && category !== "sacred_tradition") {
    findings.push(finding("source.locator_required", "warning", "url", "Record a stable public or archival locator when one exists.", "source_licence_review"));
  }

  findings.push(...validateRights(source, "rightsMetadata"));
  const rights = rightsRecord(source);
  const quoteLimit = Number(first(rights, "quoteLimitWords", "quote_limit_words"));
  if (!Number.isInteger(quoteLimit) || quoteLimit < 0) {
    findings.push(finding("source.quote_limit_required", "error", "rightsMetadata.quoteLimitWords", "Record a reviewed non-negative quotation limit.", "source_licence_review"));
  }

  if (category === "sacred_scripture") {
    const translation = record(first(source, "translationMetadata", "translation_metadata")) ?? {};
    for (const [field, keys] of Object.entries({
      translationName: ["translationName", "translation_name"],
      translationAbbreviation: ["translationAbbreviation", "translation_abbreviation"],
      edition: ["edition"],
      language: ["language"],
      rightsholder: ["rightsholder", "rightsHolder", "rights_holder"],
    })) {
      if (!text(first(translation, ...keys))) {
        findings.push(finding("source.bible_" + field + "_required", "error", "translationMetadata." + field, "Complete Bible translation and rights metadata.", "source_licence_review"));
      }
    }
  }
  return findings;
}

export function validateDoctrinalClaim(value: unknown): GovernanceFinding[] {
  const claim = record(value);
  if (!claim) {
    return [finding("claim.object_required", "error", "$", "Claim must be an object.", "doctrinal_review")];
  }
  const findings: GovernanceFinding[] = [];
  const classification = text(first(claim, "classification"));
  if (!DOCTRINAL_CLASSIFICATIONS.includes(classification as typeof DOCTRINAL_CLASSIFICATIONS[number])) {
    findings.push(finding("claim.classification_invalid", "error", "classification", "Use an approved doctrinal classification.", "doctrinal_review"));
  }
  if (classification === "disputed_or_unresolved"
    && first(claim, "humanReviewRequired", "human_review_required") !== true) {
    findings.push(finding("claim.human_review_required", "error", "humanReviewRequired", "Disputed or unresolved claims require qualified human review.", "doctrinal_review"));
  }
  const attribution = text(first(claim, "attributionMode", "attribution_mode"));
  if (!ATTRIBUTION_MODES.includes(attribution as typeof ATTRIBUTION_MODES[number])) {
    findings.push(finding("claim.attribution_mode_required", "error", "attributionMode", "Distinguish quotation, paraphrase, interpretation or inference.", "doctrinal_review"));
  }
  if (!hasTextArray(first(claim, "sourceLocators", "source_locators"))) {
    findings.push(finding("claim.source_required", "error", "sourceLocators", "Every doctrinal claim requires a precise source locator.", "doctrinal_review"));
  }
  if (["dogma", "definitively_held"].includes(classification)
    && !text(first(claim, "qualifiedReviewerId", "qualified_reviewer_id"))) {
    findings.push(finding("claim.qualified_reviewer_required", "error", "qualifiedReviewerId", "High-risk doctrinal classifications require a qualified reviewer.", "doctrinal_review"));
  }
  return findings;
}

export function validateGovernedEntity(entity: GovernanceEntity, value: unknown): GovernanceFinding[] {
  switch (entity) {
    case "lesson":
      return validateLesson(value);
    case "question":
      return validateQuestion(value);
    case "source":
      return validateSource(value);
    case "doctrinal_claim":
      return validateDoctrinalClaim(value);
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
