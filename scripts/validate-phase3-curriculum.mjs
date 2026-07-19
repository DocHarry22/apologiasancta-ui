import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = resolve(dirname(scriptPath), "..");
const manifestPath = resolve(repositoryRoot, "curriculum", "phase3", "curriculum.manifest.json");
const importRoot = resolve(repositoryRoot, "curriculum", "phase3", "import");

const commonRequiredFields = [
  "stableId", "name", "slug", "description", "audience", "difficulty", "order", "prerequisites", "unlockCondition",
  "estimatedStudyTimeMinutes", "learningOutcomes", "requiredPriorConcepts", "majorDoctrinalClassifications", "requiredSourceTypes",
  "comparativeTraditions", "suggestedLessonCount", "suggestedPracticeQuestionVolume", "suggestedMasteryPoolVolume", "liveQuizEligible",
  "relatedApologiaGraphCategories", "reviewRiskLevel",
];

const lessonRequiredFields = [
  "stableId", "title", "slug", "shortPurpose", "learningObjectives", "prerequisites", "keySourceCategories", "difficulty", "estimatedDurationMinutes",
];

function assert(condition, message, errors) {
  if (!condition) errors.push(message);
}

function hasOwn(record, key) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function duplicateValues(items, key) {
  const counts = new Map();
  for (const item of items) counts.set(item[key], (counts.get(item[key]) || 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value);
}

function detectCycle(nodeIds, edges) {
  const adjacency = new Map([...nodeIds].map((id) => [id, []]));
  for (const edge of edges) adjacency.get(edge.prerequisiteId)?.push(edge.dependentId);
  const state = new Map();
  const stack = [];
  const visit = (id) => {
    const current = state.get(id) || 0;
    if (current === 1) {
      const start = stack.indexOf(id);
      return stack.slice(start).concat(id);
    }
    if (current === 2) return null;
    state.set(id, 1);
    stack.push(id);
    for (const next of adjacency.get(id) || []) {
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    stack.pop();
    state.set(id, 2);
    return null;
  };
  for (const id of nodeIds) {
    const cycle = visit(id);
    if (cycle) return cycle;
  }
  return null;
}

function recalculateManifestHash(manifest) {
  const clone = structuredClone(manifest);
  clone.integrity.manifestSha256 = null;
  return createHash("sha256").update(JSON.stringify(clone, null, 2) + "\n").digest("hex");
}

function validateCommonEntity(entity, entityType, vocabulary, errors) {
  for (const key of commonRequiredFields) assert(hasOwn(entity, key), entityType + " " + entity.stableId + " missing " + key, errors);
  assert(Array.isArray(entity.audience) && entity.audience.length > 0, entityType + " " + entity.stableId + " needs an audience", errors);
  assert(Array.isArray(entity.prerequisites), entityType + " " + entity.stableId + " prerequisites must be an array", errors);
  assert(Array.isArray(entity.learningOutcomes) && entity.learningOutcomes.length > 0, entityType + " " + entity.stableId + " needs learning outcomes", errors);
  assert(Array.isArray(entity.requiredPriorConcepts), entityType + " " + entity.stableId + " prior concepts must be an array", errors);
  assert(Array.isArray(entity.majorDoctrinalClassifications), entityType + " " + entity.stableId + " classifications must be an array", errors);
  assert(Array.isArray(entity.requiredSourceTypes) && entity.requiredSourceTypes.length > 0, entityType + " " + entity.stableId + " needs source types", errors);
  assert(Array.isArray(entity.comparativeTraditions), entityType + " " + entity.stableId + " traditions must be an array", errors);
  assert(Array.isArray(entity.relatedApologiaGraphCategories), entityType + " " + entity.stableId + " graph categories must be an array", errors);
  assert(Number.isInteger(entity.order) && entity.order > 0, entityType + " " + entity.stableId + " order must be positive", errors);
  assert(Number.isInteger(entity.estimatedStudyTimeMinutes) && entity.estimatedStudyTimeMinutes > 0, entityType + " " + entity.stableId + " study time must be positive", errors);
  assert(Number.isInteger(entity.suggestedLessonCount) && entity.suggestedLessonCount > 0, entityType + " " + entity.stableId + " lesson count must be positive", errors);
  assert(Number.isInteger(entity.suggestedPracticeQuestionVolume) && entity.suggestedPracticeQuestionVolume > 0, entityType + " " + entity.stableId + " practice volume must be positive", errors);
  assert(Number.isInteger(entity.suggestedMasteryPoolVolume) && entity.suggestedMasteryPoolVolume > 0, entityType + " " + entity.stableId + " mastery volume must be positive", errors);
  assert(typeof entity.liveQuizEligible === "boolean", entityType + " " + entity.stableId + " live quiz flag must be boolean", errors);
  assert(entity.editorialStatus === "draft", entityType + " " + entity.stableId + " must remain draft", errors);
  assert(entity.publicationStatus === "unpublished", entityType + " " + entity.stableId + " must remain unpublished", errors);
  assert(entity.approvalRequired === true, entityType + " " + entity.stableId + " must require approval", errors);
  assert(vocabulary.difficultyLevels.includes(entity.difficulty), entityType + " " + entity.stableId + " has invalid difficulty " + entity.difficulty, errors);
  assert(vocabulary.reviewRiskLevels.includes(entity.reviewRiskLevel), entityType + " " + entity.stableId + " has invalid risk", errors);
  for (const classification of entity.majorDoctrinalClassifications) assert(vocabulary.doctrinalClassifications.includes(classification), entityType + " " + entity.stableId + " has invalid classification " + classification, errors);
  for (const source of entity.requiredSourceTypes) assert(vocabulary.sourceTypes.includes(source), entityType + " " + entity.stableId + " has invalid source type " + source, errors);
  for (const category of entity.relatedApologiaGraphCategories) assert(vocabulary.graphCategories.includes(category), entityType + " " + entity.stableId + " has invalid graph category " + category, errors);
}

export function validateManifest(manifest) {
  const errors = [];
  assert(manifest && typeof manifest === "object", "Manifest must be an object", errors);
  if (errors.length) return { valid: false, errors };
  assert(manifest.schemaVersion === "1.0.0", "Unexpected schemaVersion", errors);
  assert(manifest.blueprint?.status === "draft", "Blueprint must be draft", errors);
  assert(manifest.blueprint?.publicationStatus === "unpublished", "Blueprint must be unpublished", errors);
  assert(manifest.governance?.noUnsafeHtml === true, "Unsafe HTML must be forbidden", errors);
  for (const key of ["programmes", "subjects", "groups", "lessons", "prerequisiteEdges", "theologicalReviewMatrix"]) assert(Array.isArray(manifest[key]), key + " must be an array", errors);
  if (errors.length) return { valid: false, errors };

  const allEntities = manifest.programmes.concat(manifest.subjects, manifest.groups, manifest.lessons);
  const allIds = new Set(allEntities.map((entity) => entity.stableId));
  assert(allIds.size === allEntities.length, "Stable IDs must be globally unique: " + duplicateValues(allEntities, "stableId").join(", "), errors);
  for (const entity of allEntities) assert(/^(prog|subj|grp|les)\.[a-z0-9][a-z0-9.-]*$/.test(entity.stableId), "Invalid stable ID " + entity.stableId, errors);
  for (const [name, items] of [["programme", manifest.programmes], ["subject", manifest.subjects], ["group", manifest.groups], ["lesson", manifest.lessons]]) {
    const duplicates = duplicateValues(items, "slug");
    assert(duplicates.length === 0, "Duplicate " + name + " slugs: " + duplicates.join(", "), errors);
    for (const item of items) assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug), "Invalid " + name + " slug " + item.slug, errors);
  }

  manifest.programmes.forEach((entity) => validateCommonEntity(entity, "Programme", manifest.controlledVocabulary, errors));
  manifest.subjects.forEach((entity) => validateCommonEntity(entity, "Subject", manifest.controlledVocabulary, errors));
  manifest.groups.forEach((entity) => validateCommonEntity(entity, "Group", manifest.controlledVocabulary, errors));
  for (const lesson of manifest.lessons) {
    for (const key of lessonRequiredFields) assert(hasOwn(lesson, key), "Lesson " + lesson.stableId + " missing " + key, errors);
    assert(Array.isArray(lesson.learningObjectives) && lesson.learningObjectives.length >= 3, "Lesson " + lesson.stableId + " needs at least three objectives", errors);
    assert(Array.isArray(lesson.prerequisites), "Lesson " + lesson.stableId + " prerequisites must be an array", errors);
    assert(Array.isArray(lesson.keySourceCategories) && lesson.keySourceCategories.length > 0, "Lesson " + lesson.stableId + " needs source categories", errors);
    assert(Number.isInteger(lesson.estimatedDurationMinutes) && lesson.estimatedDurationMinutes > 0, "Lesson " + lesson.stableId + " duration must be positive", errors);
    assert(lesson.editorialStatus === "draft" && lesson.productionStatus === "planned" && lesson.publicationStatus === "unpublished", "Lesson " + lesson.stableId + " must be planned/draft/unpublished", errors);
    assert(lesson.approvalRequired === true && lesson.contentBodyIncluded === false, "Lesson " + lesson.stableId + " must contain outline only and require approval", errors);
    for (const source of lesson.keySourceCategories) assert(manifest.controlledVocabulary.sourceTypes.includes(source), "Lesson " + lesson.stableId + " has invalid source " + source, errors);
    assert(!/<\s*(script|iframe|object|embed|style|html)\b/i.test(JSON.stringify(lesson)), "Lesson " + lesson.stableId + " contains unsafe HTML", errors);
  }

  const programmeIds = new Set(manifest.programmes.map((item) => item.stableId));
  const subjectIds = new Set(manifest.subjects.map((item) => item.stableId));
  const groupIds = new Set(manifest.groups.map((item) => item.stableId));
  const lessonIds = new Set(manifest.lessons.map((item) => item.stableId));

  for (const programme of manifest.programmes) {
    for (const subjectId of programme.subjectIds) assert(subjectIds.has(subjectId), "Programme " + programme.stableId + " references unknown subject " + subjectId, errors);
    const actualSubjects = manifest.subjects.filter((subject) => subject.programmeId === programme.stableId);
    assert(actualSubjects.length === programme.subjectIds.length, "Programme " + programme.stableId + " subject count mismatch", errors);
    assert(programme.suggestedLessonCount === actualSubjects.reduce((total, subject) => total + subject.suggestedLessonCount, 0), "Programme " + programme.stableId + " lesson total mismatch", errors);
  }
  for (const subject of manifest.subjects) {
    assert(programmeIds.has(subject.programmeId), "Subject " + subject.stableId + " has unknown programme", errors);
    for (const id of subject.groupIds) assert(groupIds.has(id), "Subject " + subject.stableId + " references unknown group " + id, errors);
    const actualGroups = manifest.groups.filter((group) => group.subjectId === subject.stableId);
    assert(actualGroups.length === 5, "Subject " + subject.stableId + " must have five groups", errors);
    assert(actualGroups.length === subject.groupIds.length, "Subject " + subject.stableId + " group count mismatch", errors);
    assert(subject.suggestedLessonCount === actualGroups.reduce((total, group) => total + group.suggestedLessonCount, 0), "Subject " + subject.stableId + " lesson count mismatch", errors);
  }
  for (const group of manifest.groups) {
    assert(subjectIds.has(group.subjectId), "Group " + group.stableId + " has unknown subject", errors);
    assert(programmeIds.has(group.programmeId), "Group " + group.stableId + " has unknown programme", errors);
    for (const id of group.lessonIds) assert(lessonIds.has(id), "Group " + group.stableId + " references unknown lesson " + id, errors);
    const actualLessons = manifest.lessons.filter((lesson) => lesson.groupId === group.stableId);
    assert(actualLessons.length === group.lessonIds.length, "Group " + group.stableId + " lesson count mismatch", errors);
    assert(group.suggestedLessonCount === actualLessons.length, "Group " + group.stableId + " suggested count mismatch", errors);
  }
  for (const lesson of manifest.lessons) {
    assert(groupIds.has(lesson.groupId), "Lesson " + lesson.stableId + " has unknown group", errors);
    assert(subjectIds.has(lesson.subjectId), "Lesson " + lesson.stableId + " has unknown subject", errors);
    assert(programmeIds.has(lesson.programmeId), "Lesson " + lesson.stableId + " has unknown programme", errors);
  }

  for (const entity of allEntities) {
    for (const prerequisite of entity.prerequisites) assert(allIds.has(prerequisite.stableId), entity.stableId + " has unknown prerequisite " + prerequisite.stableId, errors);
  }
  const edgeIds = new Set();
  const edgePairs = new Set();
  for (const edge of manifest.prerequisiteEdges) {
    assert(!edgeIds.has(edge.stableId), "Duplicate prerequisite edge ID " + edge.stableId, errors);
    edgeIds.add(edge.stableId);
    assert(allIds.has(edge.prerequisiteId), "Edge has unknown prerequisite " + edge.prerequisiteId, errors);
    assert(allIds.has(edge.dependentId), "Edge has unknown dependent " + edge.dependentId, errors);
    assert(edge.prerequisiteId !== edge.dependentId, "Self dependency at " + edge.dependentId, errors);
    const pair = edge.prerequisiteId + "->" + edge.dependentId;
    assert(!edgePairs.has(pair), "Duplicate prerequisite pair " + pair, errors);
    edgePairs.add(pair);
    assert(edge.configurable === true && edge.editorialStatus === "draft", "Edge " + edge.stableId + " must be configurable and draft", errors);
  }
  const cycle = detectCycle(allIds, manifest.prerequisiteEdges);
  assert(!cycle, "Prerequisite cycle detected: " + (cycle || []).join(" -> "), errors);

  const openGroups = manifest.groups.filter((group) => group.prerequisites.length === 0);
  assert(openGroups.length === 1, "Exactly one group must be initially unlocked; found " + openGroups.length, errors);
  assert(openGroups[0]?.stableId === manifest.prerequisiteArchitecture.firstUnlockedGroupId, "Unexpected first unlocked group", errors);
  assert(groupIds.has(manifest.prerequisiteArchitecture.compulsoryCompletionGroupId), "Unknown compulsory completion group", errors);

  for (const subject of manifest.subjects.filter((item) => item.stableId.startsWith("subj.bible."))) {
    for (const group of manifest.groups.filter((item) => item.subjectId === subject.stableId)) {
      for (const prerequisite of group.prerequisites) {
        const isAllowedGateway = prerequisite.stableId === "grp.scripture-canon.distinctions";
        const isOwnBookGroup = prerequisite.stableId.startsWith("grp." + subject.stableId.slice(5) + ".");
        assert(isAllowedGateway || isOwnBookGroup, subject.stableId + " improperly depends on another Bible track: " + prerequisite.stableId, errors);
      }
    }
  }

  assert(manifest.coverage.catechism.length === 4, "Catechism coverage must contain four parts", errors);
  for (const row of manifest.coverage.catechism) assert(row.coverageStatus === "covered" && row.subjectIds.length > 0, "Catechism part " + row.part + " has a gap", errors);
  for (const dispute of manifest.coverage.disputes) for (const id of dispute.subjectIds) assert(subjectIds.has(id), dispute.stableId + " references unknown subject " + id, errors);
  assert(manifest.duplicateAndGapAnalysis.exactDuplicateIds.length === 0, "Manifest reports duplicate IDs", errors);
  assert(manifest.duplicateAndGapAnalysis.duplicateProgrammeSlugs.length === 0, "Manifest reports duplicate programme slugs", errors);
  assert(manifest.duplicateAndGapAnalysis.duplicateSubjectSlugs.length === 0, "Manifest reports duplicate subject slugs", errors);
  assert(manifest.duplicateAndGapAnalysis.duplicateGroupSlugs.length === 0, "Manifest reports duplicate group slugs", errors);
  assert(manifest.duplicateAndGapAnalysis.duplicateLessonSlugs.length === 0, "Manifest reports duplicate lesson slugs", errors);

  const totals = manifest.productionTotals;
  assert(totals.programmeCount === manifest.programmes.length, "Programme total mismatch", errors);
  assert(totals.subjectCount === manifest.subjects.length, "Subject total mismatch", errors);
  assert(totals.groupCount === manifest.groups.length, "Group total mismatch", errors);
  assert(totals.lessonOutlineCount === manifest.lessons.length, "Lesson total mismatch", errors);
  assert(totals.suggestedPracticeQuestionVolume === manifest.programmes.reduce((total, item) => total + item.suggestedPracticeQuestionVolume, 0), "Practice total mismatch", errors);
  assert(totals.suggestedMasteryPoolVolume === manifest.programmes.reduce((total, item) => total + item.suggestedMasteryPoolVolume, 0), "Mastery total mismatch", errors);
  assert(manifest.integrity.manifestSha256 === recalculateManifestHash(manifest), "Manifest SHA-256 mismatch", errors);

  return {
    valid: errors.length === 0,
    errors,
    summary: {
      programmes: manifest.programmes.length,
      subjects: manifest.subjects.length,
      groups: manifest.groups.length,
      lessons: manifest.lessons.length,
      edges: manifest.prerequisiteEdges.length,
      firstUnlockedGroupId: openGroups[0]?.stableId,
      cycleDetected: Boolean(cycle),
    },
  };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function validateFromDisk({ checkImportFiles = true } = {}) {
  const manifest = await readJson(manifestPath);
  const result = validateManifest(manifest);
  if (checkImportFiles) {
    const files = {
      programmes: await readJson(resolve(importRoot, "programmes.json")),
      subjects: await readJson(resolve(importRoot, "subjects.json")),
      groups: await readJson(resolve(importRoot, "groups.json")),
      lessons: await readJson(resolve(importRoot, "lessons.json")),
      prerequisiteEdges: await readJson(resolve(importRoot, "prerequisite-edges.json")),
      batch: await readJson(resolve(importRoot, "draft-batch.json")),
    };
    for (const key of ["programmes", "subjects", "groups", "lessons", "prerequisiteEdges"]) {
      assert(JSON.stringify(files[key]) === JSON.stringify(manifest[key]), "Import file " + key + " does not match manifest", result.errors);
    }
    assert(files.batch.manifestSha256 === manifest.integrity.manifestSha256, "Import batch hash mismatch", result.errors);
    assert(files.batch.mode === "draft-structural-records-only" && files.batch.publish === false, "Import batch must be draft-only and non-publishing", result.errors);
    result.valid = result.errors.length === 0;
  }
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  const result = await validateFromDisk();
  if (!result.valid) {
    process.stderr.write("Phase 3 curriculum validation failed:\n- " + result.errors.join("\n- ") + "\n");
    process.exitCode = 1;
  } else {
    process.stdout.write("Phase 3 curriculum validation passed: " + JSON.stringify(result.summary) + "\n");
  }
}
