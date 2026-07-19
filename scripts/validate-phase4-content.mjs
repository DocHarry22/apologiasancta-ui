import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const phase4Root = path.join(root, "curriculum", "phase4");
const lessonRoot = path.join(phase4Root, "lessons", "catholic-foundations");
const load = async (...segments) => JSON.parse(await readFile(path.join(...segments), "utf8"));
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const errors = [];
const warnings = [];
const fail = (condition, message) => {
  if (!condition) errors.push(message);
};

const phase3 = await load(root, "curriculum", "phase3", "curriculum.manifest.json");
const schema = await load(phase4Root, "lesson.schema.json");
const sourceCatalog = await load(phase4Root, "source-catalog.json");
const production = await load(phase4Root, "production.manifest.json");
const reviewQueue = await load(phase4Root, "review-queue.json");
const batch = await load(phase4Root, "batch.manifest.json");
const citationReport = await load(phase4Root, "citation-verification-report.json");
const lessonFiles = (await readdir(lessonRoot)).filter((file) => file.endsWith(".json")).sort();
const lessons = await Promise.all(lessonFiles.map((file) => load(lessonRoot, file)));

const sourceById = new Map(sourceCatalog.sources.map((source) => [source.stableId, source]));
const outlineById = new Map(phase3.lessons.map((lesson) => [lesson.stableId, lesson]));
const groupById = new Map(phase3.groups.map((group) => [group.stableId, group]));
const lessonById = new Map(lessons.map((lesson) => [lesson.phase3LessonId, lesson]));
const knownBlockTypes = new Set([
  "heading",
  "paragraph",
  "scripture_card",
  "catechism_card",
  "quotation",
  "distinction_table",
  "objection_response",
  "timeline",
  "image",
  "footnotes",
  "related_content",
  "graph_references",
]);
const requiredTopLevel = schema.required;
const permittedTopLevel = new Set(Object.keys(schema.properties));
const unsafePattern = /<\s*\/?\s*(script|iframe|object|embed|style|link|meta|form|svg|img|video|audio|a)\b|javascript\s*:|on[a-z]+\s*=/i;
const idPattern = {
  content: /^content\.les\.[a-z0-9.-]+$/,
  lesson: /^les\.[a-z0-9.-]+$/,
  source: /^src\.[a-z0-9.-]+$/,
};

const strings = (value, result = []) => {
  if (typeof value === "string") result.push(value);
  else if (Array.isArray(value)) value.forEach((item) => strings(item, result));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => strings(item, result));
  return result;
};

const citedSourceIds = (value, result = new Set()) => {
  if (Array.isArray(value)) value.forEach((item) => citedSourceIds(item, result));
  else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (key === "sourceId" && typeof item === "string") result.add(item);
      if (key === "sourceIds" && Array.isArray(item)) item.forEach((id) => result.add(id));
      citedSourceIds(item, result);
    }
  }
  return result;
};

const wordCount = (value) =>
  (value.match(/[A-Za-zÀ-ÖØ-öø-ÿ0-9]+(?:['’-][A-Za-zÀ-ÖØ-öø-ÿ0-9]+)*/g) ?? []).length;
const ngrams = (value, size = 5) => {
  const tokens = value.toLowerCase().match(/[a-z0-9]+(?:['’-][a-z0-9]+)*/g) ?? [];
  const result = new Set();
  for (let index = 0; index <= tokens.length - size; index += 1) result.add(tokens.slice(index, index + size).join(" "));
  return result;
};
const jaccard = (left, right) => {
  const intersection = [...left].filter((item) => right.has(item)).length;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
};
const sentenceStats = (paragraphs) => {
  const sentences = paragraphs.flatMap((text) => text.split(/(?<=[.!?])\s+/).filter(Boolean));
  const counts = sentences.map(wordCount).filter(Boolean);
  return {
    sentences: counts.length,
    averageWordsPerSentence: counts.length ? Number((counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(1)) : 0,
    maximumWordsInSentence: counts.length ? Math.max(...counts) : 0,
    maximumWordsInParagraph: paragraphs.length ? Math.max(...paragraphs.map(wordCount)) : 0,
  };
};

fail(schema.$schema === "https://json-schema.org/draft/2020-12/schema", "Lesson schema must declare JSON Schema draft 2020-12.");
fail(schema.additionalProperties === false, "Lesson schema must reject undeclared top-level fields.");
fail(schema.description.includes("Arbitrary HTML"), "Lesson schema must document the arbitrary-HTML prohibition.");
fail(lessonFiles.length === 10, `Expected 10 Catholic Foundations lessons, found ${lessonFiles.length}.`);
fail(new Set(lessons.map((lesson) => lesson.stableId)).size === lessons.length, "Duplicate Phase 4 content stable identifier.");
fail(new Set(lessons.map((lesson) => lesson.slug)).size === lessons.length, "Duplicate Phase 4 lesson slug.");
fail(new Set(sourceCatalog.sources.map((source) => source.stableId)).size === sourceCatalog.sources.length, "Duplicate source-catalog stable identifier.");

for (const source of sourceCatalog.sources) {
  fail(idPattern.source.test(source.stableId), `Invalid source identifier ${source.stableId}.`);
  fail(["official_url_verified", "bibliographically_verified"].includes(source.verificationStatus), `${source.stableId} is not verified.`);
  fail(Boolean(source.verificationMethod), `${source.stableId} lacks a verification method.`);
  fail(Boolean(source.quotationPolicy), `${source.stableId} lacks a quotation policy.`);
  if (source.url) {
    fail(source.url.startsWith("https://"), `${source.stableId} must use HTTPS.`);
    fail(!/[\s<>]/.test(source.url), `${source.stableId} contains an invalid URL.`);
  } else {
    fail(Boolean(source.bibliographicLocator), `${source.stableId} has neither URL nor bibliographic locator.`);
  }
}

const readability = [];
const exactParagraphs = new Map();
const narrativeFingerprints = [];
let quotationBlocks = 0;
let scriptureCards = 0;
let practicePlaceholders = 0;

for (const lesson of lessons) {
  const prefix = lesson.phase3LessonId;
  const outline = outlineById.get(prefix);
  fail(Boolean(outline), `${prefix} has no Phase 3 outline.`);
  for (const field of requiredTopLevel) fail(Object.hasOwn(lesson, field), `${prefix} is missing required field ${field}.`);
  for (const field of Object.keys(lesson)) fail(permittedTopLevel.has(field), `${prefix} has undeclared top-level field ${field}.`);

  fail(idPattern.content.test(lesson.stableId), `${prefix} has an invalid content stable identifier.`);
  fail(idPattern.lesson.test(lesson.phase3LessonId), `${prefix} has an invalid Phase 3 lesson identifier.`);
  fail(lesson.stableId === `content.${prefix}`, `${prefix} content stable identifier is not derived from its outline.`);
  fail(outline && lesson.title === outline.title, `${prefix} title differs from Phase 3.`);
  fail(outline && lesson.slug === outline.slug, `${prefix} slug differs from Phase 3.`);
  fail(outline && lesson.groupId === outline.groupId, `${prefix} group differs from Phase 3.`);
  fail(outline && lesson.subjectId === outline.subjectId, `${prefix} subject differs from Phase 3.`);
  fail(outline && lesson.programmeId === outline.programmeId, `${prefix} programme differs from Phase 3.`);
  fail(lesson.centralQuestion.trim().endsWith("?"), `${prefix} central question must end with a question mark.`);
  fail(lesson.learningObjectives.length >= 3, `${prefix} needs at least three learning objectives.`);
  fail(lesson.fullExplanation.length >= 6, `${prefix} full explanation is too short or structurally thin.`);
  fail(lesson.essentialTerminology.length >= 3, `${prefix} needs at least three terminology entries.`);
  fail(lesson.scriptureEvidence.length >= 3, `${prefix} needs at least three Scripture evidence cards.`);
  fail(lesson.catechismMagisterialEvidence.length >= 3, `${prefix} needs at least three Catechism or Magisterial cards.`);
  fail(lesson.importantDistinctions.length >= 1, `${prefix} needs an important-distinction table.`);
  fail(lesson.commonMistakes.length >= 3, `${prefix} needs at least three common mistakes.`);
  fail(lesson.reviewPrompts.length >= 3, `${prefix} needs at least three review prompts.`);
  fail(lesson.practiceQuestionPlaceholders.length >= 2 && lesson.practiceQuestionPlaceholders.length <= 4, `${prefix} must contain only minimal practice placeholders.`);
  practicePlaceholders += lesson.practiceQuestionPlaceholders.length;
  fail(lesson.references.length >= 5, `${prefix} needs at least five full source references.`);
  fail(lesson.editorial.productionStatus === "drafted", `${prefix} must remain drafted.`);
  fail(lesson.editorial.reviewStatus === "awaiting_assignment", `${prefix} must remain awaiting reviewer assignment.`);
  fail(lesson.editorial.publicationStatus === "unpublished", `${prefix} must remain unpublished.`);
  fail(lesson.editorial.licenceReviewRequired === true, `${prefix} must remain flagged for Scripture licence review.`);
  fail(lesson.editorial.humanApprovalRequired === true, `${prefix} must require human approval.`);
  fail(lesson.editorial.scripturePolicy === "references_and_original_paraphrases_only", `${prefix} violates the provisional Scripture policy.`);
  fail(lesson.relatedGraphReferences.recordIds.length === 0, `${prefix} must not invent Apologia Graph record IDs.`);

  const blockTypes = new Set();
  for (const block of lesson.fullExplanation) {
    fail(knownBlockTypes.has(block.type), `${prefix} contains unsupported block type ${block.type}.`);
    fail(block.type !== "html", `${prefix} contains an unsafe HTML block.`);
    blockTypes.add(block.type);
    if (block.type === "paragraph") {
      fail(Array.isArray(block.sourceIds) && block.sourceIds.length > 0, `${prefix} contains an unsupported full-explanation paragraph without source identifiers.`);
      if (wordCount(block.text) >= 20) {
        const prior = exactParagraphs.get(block.text);
        fail(!prior, `${prefix} duplicates a substantive paragraph from ${prior}.`);
        exactParagraphs.set(block.text, prefix);
      }
    }
    if (block.type === "scripture_card") {
      scriptureCards += 1;
      fail(block.quotationIncluded === false, `${prefix} contains Scripture translation text.`);
    }
    if (block.type === "quotation") {
      quotationBlocks += 1;
      fail(block.wordCount === wordCount(block.text), `${prefix} quotation word-count metadata is incorrect.`);
      fail(block.wordCount <= 25, `${prefix} contains an excessive quotation.`);
      fail(!sourceById.get(block.sourceId)?.sourceType.includes("Scripture"), `${prefix} contains a direct Scripture quotation.`);
    }
  }
  for (const expected of ["heading", "paragraph", "objection_response", "related_content", "graph_references"]) {
    fail(blockTypes.has(expected), `${prefix} does not exercise required safe block type ${expected}.`);
  }

  for (const card of lesson.scriptureEvidence) {
    scriptureCards += 1;
    fail(card.type === "scripture_card" && card.quotationIncluded === false, `${prefix} has an invalid Scripture card.`);
    fail(sourceById.get(card.sourceId)?.sourceType === "Sacred Scripture", `${prefix} Scripture card cites a non-Scripture source.`);
  }
  for (const card of lesson.catechismMagisterialEvidence) {
    fail(card.type === "catechism_card" && card.quotationIncluded === false, `${prefix} has an invalid Magisterial evidence card.`);
    fail(Boolean(card.locator) && Boolean(card.summary), `${prefix} has incomplete Magisterial evidence.`);
  }

  const referenceIds = new Set(lesson.references.map((item) => item.sourceId));
  fail(referenceIds.size === lesson.references.length, `${prefix} contains duplicate source records in its full references.`);
  for (const item of lesson.references) {
    fail(sourceById.has(item.sourceId), `${prefix} references missing source ${item.sourceId}.`);
    fail(Boolean(item.locator) && Boolean(item.use), `${prefix} contains an incomplete reference to ${item.sourceId}.`);
  }
  for (const sourceId of citedSourceIds(lesson)) {
    fail(sourceById.has(sourceId), `${prefix} cites unknown source ${sourceId}.`);
    fail(referenceIds.has(sourceId), `${prefix} cites ${sourceId} without including it in full references.`);
  }
  if (lesson.editorial.comparativeTraditions.length) {
    const comparativeRefs = lesson.references.filter((item) => sourceById.get(item.sourceId)?.sourceType === "Official comparative-tradition source");
    fail(comparativeRefs.length > 0, `${prefix} represents a comparative tradition without its recognized source.`);
    fail(/differ|variation|not all|scope/i.test(`${lesson.opposingPosition} ${sourceById.get(comparativeRefs[0]?.sourceId)?.comparativeScope ?? ""}`), `${prefix} does not acknowledge comparative scope or internal variation.`);
  }

  for (const text of strings(lesson)) fail(!unsafePattern.test(text), `${prefix} contains unsafe markup or a scriptable token.`);
  const paragraphs = lesson.fullExplanation.filter((block) => block.type === "paragraph").map((block) => block.text);
  narrativeFingerprints.push({ lessonId: prefix, ngrams: ngrams([lesson.shortDirectAnswer, ...paragraphs, lesson.catholicResponse, lesson.summary].join(" ")) });
  const stats = sentenceStats(paragraphs);
  readability.push({ lessonId: prefix, ...stats, approximateRecordWordCount: lesson._generation.approximateWordCount });
  fail(stats.averageWordsPerSentence <= 32, `${prefix} average sentence length ${stats.averageWordsPerSentence} exceeds the foundation threshold of 32.`);
  fail(stats.maximumWordsInParagraph <= 140, `${prefix} contains a paragraph longer than 140 words.`);
  fail(lesson._generation.approximateWordCount >= 850, `${prefix} appears too thin for a complete lesson (${lesson._generation.approximateWordCount} words).`);

  const { _generation, ...hashable } = lesson;
  fail(hash(hashable) === _generation.contentHash, `${prefix} content hash does not match the lesson body.`);
  fail(batch.contentHashes[prefix] === _generation.contentHash, `${prefix} content hash differs from the batch manifest.`);

  for (const prerequisite of outline.prerequisites) {
    if (prerequisite.type === "lesson") {
      fail(outlineById.has(prerequisite.stableId), `${prefix} has missing prerequisite outline ${prerequisite.stableId}.`);
      fail(lessonById.has(prerequisite.stableId), `${prefix} was drafted before required lesson content ${prerequisite.stableId}.`);
    } else if (prerequisite.type === "group") {
      const group = groupById.get(prerequisite.stableId);
      fail(Boolean(group), `${prefix} has missing prerequisite group ${prerequisite.stableId}.`);
      if (group) {
        for (const requiredLessonId of group.lessonIds) {
          fail(lessonById.has(requiredLessonId), `${prefix} was drafted before prerequisite-group lesson ${requiredLessonId}.`);
        }
      }
    } else {
      fail(false, `${prefix} has unsupported prerequisite type ${prerequisite.type}.`);
    }
  }
}

const similarityPairs = [];
for (let leftIndex = 0; leftIndex < narrativeFingerprints.length; leftIndex += 1) {
  for (let rightIndex = leftIndex + 1; rightIndex < narrativeFingerprints.length; rightIndex += 1) {
    similarityPairs.push({
      lessons: [narrativeFingerprints[leftIndex].lessonId, narrativeFingerprints[rightIndex].lessonId],
      fiveGramJaccard: Number(jaccard(narrativeFingerprints[leftIndex].ngrams, narrativeFingerprints[rightIndex].ngrams).toFixed(4)),
    });
  }
}
similarityPairs.sort((left, right) => right.fiveGramJaccard - left.fiveGramJaccard);
fail((similarityPairs[0]?.fiveGramJaccard ?? 0) < 0.35, `Cross-lesson five-gram similarity is too high (${similarityPairs[0]?.fiveGramJaccard}).`);

fail(production.status === "in_progress", "Phase 4 production manifest must remain in progress.");
fail(production.publicationStatus === "unpublished", "Phase 4 production manifest must remain unpublished.");
fail(production.policy.phaseMayBeMarkedComplete === false, "Phase 4 must not be marked complete while planned lessons remain.");
fail(production.lessons.length === phase3.lessons.length, "Production manifest silently omits planned Phase 3 lessons.");
fail(production.subjects.length === phase3.subjects.length, "Production manifest silently omits Phase 3 subjects.");
fail(production.counts.totalPlanned === phase3.lessons.length, "Production total differs from Phase 3.");
fail(production.counts.drafted === lessons.length, "Draft count differs from generated lesson count.");
fail(production.counts.planned + production.counts.drafted === phase3.lessons.length, "Planned and drafted counts do not reconcile.");
fail(production.counts.reviewed === 0 && production.counts.approved === 0, "Automated generation must not mark lessons reviewed or approved.");
fail(production.lessons.every((entry) => entry.publicationStatus === "unpublished"), "A production entry is unexpectedly published.");
for (const subject of production.subjects) {
  const entries = production.lessons.filter((entry) => entry.subjectId === subject.subjectId);
  fail(subject.totalPlanned === entries.length, `${subject.subjectId} subject total does not match lesson entries.`);
  fail(subject.planned + subject.drafted + subject.reviewed + subject.approved + subject.blocked === subject.totalPlanned, `${subject.subjectId} production counts do not reconcile.`);
  fail(subject.publicationStatus === "unpublished", `${subject.subjectId} subject status is unexpectedly published.`);
}
fail(reviewQueue.items.length === lessons.length, "Review queue does not contain every drafted lesson.");
fail(reviewQueue.items.every((item) => item.status === "awaiting_assignment" && item.assignedReviewers.length === 0), "Review queue must await named assignments.");
fail(reviewQueue.publicationEffect === "none", "Review queue must have no publication effect.");
fail(batch.lessonIds.length === lessons.length, "Batch manifest count differs from generated lessons.");
fail(batch.status === "drafted_awaiting_review", "Batch must remain drafted and awaiting review.");
fail(["passed", "passed_with_publisher_access_limitations"].includes(citationReport.status), "Citation verification report has not passed.");
fail(citationReport.summary.failed === 0, "Citation verification report contains unresolved source failures.");
fail(citationReport.results.length === sourceCatalog.sources.length, "Citation verification report does not cover the full source catalog.");
fail(citationReport.sourceCatalogSha256 === hash(sourceCatalog), "Citation verification report is stale for the current source catalog.");

const importBatch = await load(phase4Root, "import", "draft-lessons.json");
fail(importBatch.importMode === "draft_only", "Import records must be draft-only.");
fail(importBatch.publicationEffect === "none", "Import records must not publish.");
fail(importBatch.remoteExecutionPerformed === false, "Generator must not report remote execution.");
fail(importBatch.records.length === lessons.length, "Import records do not match lesson count.");
fail(importBatch.records.every((record) => record.importMetadata.publishAllowed === false && record.importMetadata.upsertAllowed === false), "Import metadata permits an unauthorized mutation.");

const report = {
  schemaVersion: "1.0.0",
  generatedOn: "2026-07-19",
  status: errors.length ? "failed" : "passed",
  scope: {
    phase3PlannedLessons: phase3.lessons.length,
    phase4DraftedLessons: lessons.length,
    phase4RemainingPlannedLessons: phase3.lessons.length - lessons.length,
    sources: sourceCatalog.sources.length,
  },
  checks: {
    stableIdsAndSlugsUnique: !errors.some((item) => /Duplicate/.test(item)),
    phase3IdentityPreserved: !errors.some((item) => /differs from Phase 3/.test(item)),
    prerequisitesSatisfiedForDraftedBatch: !errors.some((item) => /prerequisite/.test(item)),
    completeTemplatePresent: !errors.some((item) => /missing required field|needs at least|too short/.test(item)),
    sourceRecordsResolved: !errors.some((item) => /source|reference|cites/i.test(item)),
    scriptureQuotationPolicyObserved: !errors.some((item) => /Scripture translation|direct Scripture quotation/.test(item)),
    excessiveQuotationCheck: quotationBlocks === 0,
    internalDuplicateAndSimilarityCheck: !errors.some((item) => /duplicates a substantive paragraph|five-gram similarity/.test(item)),
    arbitraryHtmlRejected: !errors.some((item) => /unsafe/.test(item)),
    comparativeSourceCheck: !errors.some((item) => /comparative tradition/.test(item)),
    doctrinalStatusSafe: lessons.every((lesson) => lesson.editorial.humanApprovalRequired && lesson.editorial.reviewStatus === "awaiting_assignment"),
    reviewAndPublicationSafe: production.counts.reviewed === 0 && production.counts.approved === 0 && production.publicationStatus === "unpublished",
  },
  metrics: {
    scriptureCards,
    quotationBlocks,
    practicePlaceholders,
    averageDraftWords: Math.round(readability.reduce((sum, item) => sum + item.approximateRecordWordCount, 0) / readability.length),
    internalTextReuseAudit: {
      scope: "Exact substantive-paragraph duplication plus pairwise five-word-sequence similarity across this batch; this is not an external commercial-corpus plagiarism search.",
      highestSimilarityPairs: similarityPairs.slice(0, 5),
    },
    readability,
  },
  warnings,
  errors,
};

await writeFile(path.join(phase4Root, "quality-report.json"), `${JSON.stringify(report, null, 2)}\n`);

if (errors.length) {
  console.error(`Phase 4 validation failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Phase 4 validation passed for ${lessons.length} drafted lessons.`);
  console.log(`Prerequisites resolved; ${sourceCatalog.sources.length} sources; ${quotationBlocks} quotation blocks; ${practicePlaceholders} practice placeholders.`);
  console.log(`Production remains in progress: ${production.counts.planned} planned, ${production.counts.approved} approved, 0 published.`);
}
