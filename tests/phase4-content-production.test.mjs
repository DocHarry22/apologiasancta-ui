import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const phase4 = path.join(root, "curriculum", "phase4");
const load = async (...parts) => JSON.parse(await readFile(path.join(...parts), "utf8"));
const production = await load(phase4, "production.manifest.json");
const sources = await load(phase4, "source-catalog.json");
const citations = await load(phase4, "citation-verification-report.json");
const reviewQueue = await load(phase4, "review-queue.json");
const batchIndex = await load(phase4, "batch.manifest.json");
const lessonRoot = path.join(phase4, "lessons");
const findJsonFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? findJsonFiles(target) : entry.name.endsWith(".json") ? [target] : [];
  }));
  return nested.flat();
};
const lessonFiles = await findJsonFiles(lessonRoot);
const lessons = await Promise.all(lessonFiles.map((file) => load(file)));

test("Phase 4 records every Phase 3 lesson without pretending production is complete", () => {
  assert.equal(production.status, "in_progress_awaiting_human_review");
  assert.equal(production.publicationStatus, "unpublished");
  assert.equal(production.counts.totalPlanned, 815);
  assert.equal(production.counts.drafted, 815);
  assert.equal(production.counts.planned, 0);
  assert.equal(production.counts.reviewed, 0);
  assert.equal(production.counts.approved, 0);
  assert.equal(production.policy.phaseMayBeMarkedComplete, false);
  assert.equal(production.subjects.length, 118);
  assert.equal(production.lessons.length, 815);
  assert.equal(batchIndex.totalBatches, 118);
  assert.equal(batchIndex.totalLessons, 815);
});

test("all 815 lessons are complete, safe, unpublished structured drafts", () => {
  assert.equal(lessons.length, 815);
  const requiredSections = [
    "centralQuestion",
    "learningObjectives",
    "shortDirectAnswer",
    "fullExplanation",
    "essentialTerminology",
    "scriptureEvidence",
    "catechismMagisterialEvidence",
    "patristicHistoricalEvidence",
    "importantDistinctions",
    "strongObjection",
    "opposingPosition",
    "catholicResponse",
    "commonMistakes",
    "practicalSpiritualApplication",
    "summary",
    "reviewPrompts",
    "practiceQuestionPlaceholders",
    "references",
    "relatedLessonIds",
    "relatedGraphReferences",
  ];
  for (const lesson of lessons) {
    for (const section of requiredSections) assert.ok(Object.hasOwn(lesson, section), `${lesson.phase3LessonId}: ${section}`);
    assert.equal(lesson.editorial.productionStatus, "drafted");
    assert.equal(lesson.editorial.reviewStatus, "awaiting_assignment");
    assert.equal(lesson.editorial.publicationStatus, "unpublished");
    assert.equal(lesson.editorial.humanApprovalRequired, true);
    assert.equal(lesson.editorial.licenceReviewRequired, true);
    assert.equal(lesson.practiceQuestionPlaceholders.length, 2);
    assert.equal(lesson.relatedGraphReferences.recordIds.length, 0);
    assert.ok(lesson.fullExplanation.some((block) => block.type === "objection_response"));
    assert.ok(lesson.fullExplanation.every((block) => block.type !== "html"));
    assert.ok(lesson.scriptureEvidence.every((card) => card.quotationIncluded === false));
  }
});

test("every cited source resolves to the verified source catalog", () => {
  const sourceIds = new Set(sources.sources.map((source) => source.stableId));
  assert.equal(sourceIds.size, 47);
  assert.equal(citations.summary.failed, 0);
  assert.ok(["passed", "passed_with_publisher_access_limitations"].includes(citations.status));
  assert.equal(citations.results.length, sources.sources.length);
  for (const lesson of lessons) {
    for (const reference of lesson.references) assert.ok(sourceIds.has(reference.sourceId), reference.sourceId);
  }
});

test("review submission is local, unassigned, and cannot publish", () => {
  assert.equal(reviewQueue.submissionMode, "local_draft_queue");
  assert.equal(reviewQueue.publicationEffect, "none");
  assert.equal(reviewQueue.items.length, 815);
  for (const item of reviewQueue.items) {
    assert.equal(item.status, "awaiting_assignment");
    assert.deepEqual(item.assignedReviewers, []);
    assert.equal(item.gates.finalApproval, "pending_human_review");
  }
});
