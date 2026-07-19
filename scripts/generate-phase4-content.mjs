import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { catholicFoundationsLessons } from "../curriculum/phase4/batches/catholic-foundations.batch.mjs";
import { PHASE4_DATE, sourceCatalog } from "../curriculum/phase4/sources.source.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const phase3Path = path.join(root, "curriculum", "phase3", "curriculum.manifest.json");
const outputRoot = path.join(root, "curriculum", "phase4");
const lessonsRoot = path.join(outputRoot, "lessons", "catholic-foundations");
const importRoot = path.join(outputRoot, "import");

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const words = (value) =>
  (JSON.stringify(value).match(/[A-Za-zÀ-ÖØ-öø-ÿ0-9]+(?:['’-][A-Za-zÀ-ÖØ-öø-ÿ0-9]+)*/g) ?? []).length;

const phase3 = JSON.parse(await readFile(phase3Path, "utf8"));
const phase3Lessons = phase3.lessons;
const phase3LessonById = new Map(phase3Lessons.map((lesson) => [lesson.stableId, lesson]));
const sourceIds = new Set(sourceCatalog.sources.map((source) => source.stableId));

await mkdir(lessonsRoot, { recursive: true });
await mkdir(importRoot, { recursive: true });

const contentRecords = catholicFoundationsLessons.map((draft, index) => {
  const outline = phase3LessonById.get(draft.phase3LessonId);
  if (!outline) throw new Error(`Phase 3 lesson not found: ${draft.phase3LessonId}`);

  const practiceQuestionPlaceholders = draft.practiceIntents.map(([format, promptIntent], questionIndex) => ({
    stableId: `placeholder.${outline.stableId}.${String(questionIndex + 1).padStart(2, "0")}`,
    format,
    promptIntent,
    status: "placeholder",
  }));

  const record = {
    schemaVersion: "1.0.0",
    stableId: `content.${outline.stableId}`,
    phase3LessonId: outline.stableId,
    programmeId: outline.programmeId,
    subjectId: outline.subjectId,
    groupId: outline.groupId,
    title: outline.title,
    slug: outline.slug,
    centralQuestion: draft.centralQuestion,
    learningObjectives: draft.learningObjectives,
    shortDirectAnswer: draft.shortDirectAnswer,
    fullExplanation: [
      ...draft.fullExplanation,
      {
        type: "objection_response",
        objection: draft.strongObjection,
        fairRepresentation: draft.opposingPosition,
        response: draft.catholicResponse,
        sourceIds: [...new Set(draft.references.map((item) => item.sourceId))],
      },
      { type: "related_content", lessonIds: draft.relatedLessonIds },
      { type: "graph_references", categoryIds: draft.graphCategoryIds, recordIds: [] },
    ],
    essentialTerminology: draft.essentialTerminology,
    scriptureEvidence: draft.scriptureEvidence,
    catechismMagisterialEvidence: draft.catechismMagisterialEvidence,
    patristicHistoricalEvidence: draft.patristicHistoricalEvidence,
    importantDistinctions: draft.importantDistinctions,
    strongObjection: draft.strongObjection,
    opposingPosition: draft.opposingPosition,
    catholicResponse: draft.catholicResponse,
    commonMistakes: draft.commonMistakes,
    practicalSpiritualApplication: draft.practicalSpiritualApplication,
    summary: draft.summary,
    reviewPrompts: draft.reviewPrompts,
    practiceQuestionPlaceholders,
    references: draft.references,
    relatedLessonIds: draft.relatedLessonIds,
    relatedGraphReferences: { categoryIds: draft.graphCategoryIds, recordIds: [] },
    editorial: {
      productionStatus: "drafted",
      reviewStatus: "awaiting_assignment",
      publicationStatus: "unpublished",
      doctrinalClassifications: draft.doctrinalClassifications,
      comparativeTraditions: draft.comparativeTraditions,
      scripturePolicy: "references_and_original_paraphrases_only",
      licenceReviewRequired: true,
      humanApprovalRequired: true,
      generatedOn: PHASE4_DATE,
    },
  };

  for (const citedSourceId of new Set(draft.references.map((item) => item.sourceId))) {
    if (!sourceIds.has(citedSourceId)) throw new Error(`${outline.stableId} cites unknown source ${citedSourceId}`);
  }

  return {
    ...record,
    _generation: {
      batchId: "batch.phase4.catholic-foundations.01",
      batchOrder: index + 1,
      contentHash: hash(record),
      approximateWordCount: words(record),
    },
  };
});

const productionEntries = phase3Lessons.map((outline) => {
  const record = contentRecords.find((item) => item.phase3LessonId === outline.stableId);
  return {
    lessonId: outline.stableId,
    programmeId: outline.programmeId,
    subjectId: outline.subjectId,
    groupId: outline.groupId,
    title: outline.title,
    prerequisites: outline.prerequisites,
    productionStatus: record ? "drafted" : "planned",
    reviewStatus: record ? "awaiting_assignment" : "not_submitted",
    publicationStatus: "unpublished",
    contentPath: record ? `lessons/catholic-foundations/${outline.slug}.json` : null,
    contentHash: record?._generation.contentHash ?? null,
    missingSources: [],
    licenceIssues: record ? ["scripture_translation_and_quotation_allowance_pending"] : [],
  };
});

const counts = productionEntries.reduce(
  (result, entry) => {
    result.totalPlanned += 1;
    result[entry.productionStatus] += 1;
    result[entry.reviewStatus] += 1;
    if (entry.licenceIssues.length) result.lessonsRequiringLicenceReview += 1;
    return result;
  },
  {
    totalPlanned: 0,
    planned: 0,
    drafted: 0,
    reviewed: 0,
    approved: 0,
    blocked: 0,
    not_submitted: 0,
    awaiting_assignment: 0,
    in_review: 0,
    changes_requested: 0,
    lessonsRequiringLicenceReview: 0,
    missingSourceCount: 0,
  }
);

const subjectProduction = phase3.subjects.map((subject) => {
  const entries = productionEntries.filter((entry) => entry.subjectId === subject.stableId);
  const count = (field, value) => entries.filter((entry) => entry[field] === value).length;
  return {
    subjectId: subject.stableId,
    programmeId: subject.programmeId,
    name: subject.name,
    totalPlanned: entries.length,
    planned: count("productionStatus", "planned"),
    drafted: count("productionStatus", "drafted"),
    awaitingAssignment: count("reviewStatus", "awaiting_assignment"),
    reviewed: count("productionStatus", "reviewed"),
    approved: count("productionStatus", "approved"),
    blocked: count("productionStatus", "blocked"),
    publicationStatus: "unpublished",
  };
});

const productionManifest = {
  schemaVersion: "1.0.0",
  stableId: "as.phase4.production.2026-07",
  name: "Apologia Sancta Complete Lesson-Content Production Manifest",
  phase: 4,
  status: "in_progress",
  publicationStatus: "unpublished",
  generatedOn: PHASE4_DATE,
  basedOnPhase3Manifest: {
    stableId: phase3.blueprint.stableId,
    version: phase3.blueprint.version,
    sha256: hash(phase3),
  },
  activeBatch: {
    stableId: "batch.phase4.catholic-foundations.01",
    subjectId: "subj.catholic-foundations",
    expectedLessonCount: 10,
    draftedLessonCount: contentRecords.length,
    reviewSubmissionMode: "local_draft_queue",
    reviewWorkflowLimitation: "The implemented editorial workflow is question-specific. Lesson drafts are queued locally until a lesson-review persistence model is approved.",
  },
  counts,
  policy: {
    phaseMayBeMarkedComplete: false,
    completionRule: "Every Phase 3 lesson must exist, pass all automated validators, complete named human review, and be approved without being auto-published.",
    reviewRule: "Automated validation never changes a lesson to reviewed or approved.",
    publishingRule: "No generator or import record invokes a remote API, changes a database, or publishes content.",
    scriptureRule: sourceCatalog.policy.scriptureHandling,
  },
  unresolvedIssues: [
    "A named Scripture translation and quotation allowance have not been approved; all drafted lessons therefore require licence review.",
    "The platform has no approved lesson-specific review persistence model; the generated queue is local and awaiting reviewer assignment.",
    "Apologia Graph category identifiers are mapped, but graph record identifiers remain empty until the graph taxonomy contract is approved.",
    "Patristic works are bibliographically verified at work and locator level; a house edition and translation must be selected before any direct quotation is introduced.",
  ],
  subjects: subjectProduction,
  lessons: productionEntries,
};

const reviewQueue = {
  schemaVersion: "1.0.0",
  stableId: "as.phase4.review-queue.catholic-foundations.01",
  status: "active",
  generatedOn: PHASE4_DATE,
  submissionMode: "local_draft_queue",
  publicationEffect: "none",
  workflowLimitation: productionManifest.activeBatch.reviewWorkflowLimitation,
  items: contentRecords.map((record) => ({
    stableId: `review.${record.phase3LessonId}.r1`,
    lessonId: record.phase3LessonId,
    contentHash: record._generation.contentHash,
    revision: 1,
    status: "awaiting_assignment",
    requiredReviewRoles: ["doctrinal_reviewer", "source_editor", "instructional_editor", "licensing_reviewer"],
    assignedReviewers: [],
    gates: {
      automatedStructure: "pending_validation",
      citationResolution: "pending_validation",
      doctrinalClassification: "pending_human_review",
      comparativeFairness: record.editorial.comparativeTraditions.length ? "pending_human_review" : "not_applicable",
      scriptureLicence: "pending_policy_approval",
      finalApproval: "pending_human_review",
    },
  })),
};

const batchManifest = {
  schemaVersion: "1.0.0",
  stableId: "batch.phase4.catholic-foundations.01",
  subjectId: "subj.catholic-foundations",
  status: "drafted_awaiting_review",
  publicationStatus: "unpublished",
  generatedOn: PHASE4_DATE,
  lessonIds: contentRecords.map((record) => record.phase3LessonId),
  contentHashes: Object.fromEntries(contentRecords.map((record) => [record.phase3LessonId, record._generation.contentHash])),
  sourceCatalogHash: hash(sourceCatalog),
  qualityPolicy: {
    fullLessonTemplateRequired: true,
    noArbitraryHtml: true,
    noDirectScriptureQuotations: true,
    completeQuestionBankDeferred: true,
    automatedApprovalForbidden: true,
  },
};

const statusMarkdown = `# Apologia Sancta Phase 4 Production Status

Generated: ${PHASE4_DATE}

Status: **in progress; unpublished**

## Outcome

The first complete subject batch contains ${contentRecords.length} drafted Catholic Foundations lessons. The approved Phase 3 blueprint contains ${counts.totalPlanned} planned lessons, so ${counts.planned} lessons remain to be drafted. No lesson is marked reviewed, approved, or published.

## Counts

| Measure | Count |
|---|---:|
| Phase 3 planned lessons | ${counts.totalPlanned} |
| Drafted | ${counts.drafted} |
| Awaiting draft | ${counts.planned} |
| Awaiting reviewer assignment | ${counts.awaiting_assignment} |
| Reviewed | ${counts.reviewed} |
| Approved | ${counts.approved} |
| Blocked lesson drafts | ${counts.blocked} |
| Drafts requiring Scripture licence review | ${counts.lessonsRequiringLicenceReview} |
| Missing source records in drafted lessons | ${counts.missingSourceCount} |

## Active batch

- Subject: Catholic Foundations
- Groups: Foundations, Distinctions, Evidence, Objections, Synthesis
- Lessons: 10 of 10 drafted
- Practice content: two structural placeholders per lesson; no bulk question bank
- Scripture text: references and original paraphrases only
- Review submission: local draft queue, awaiting named human assignment

| Group | Planned | Drafted | Awaiting review | Approved | Published |
|---|---:|---:|---:|---:|---:|
| Foundations | 2 | 2 | 2 | 0 | 0 |
| Distinctions | 2 | 2 | 2 | 0 | 0 |
| Evidence | 2 | 2 | 2 | 0 | 0 |
| Objections | 2 | 2 | 2 | 0 | 0 |
| Synthesis | 2 | 2 | 2 | 0 | 0 |

## Quality and issue status

| Check | Result |
|---|---|
| Missing source records | 0 |
| Direct Scripture quotations stored | 0 |
| Other direct quotation blocks | 0 |
| Blocked lesson drafts | 0 |
| Scripture licence review | Required for all 10 drafts |
| Named theological review | Awaiting assignment for all 10 drafts |
| Desktop/mobile and dark/light rendering of new drafts | Pending approved persistence and rendering adapter |
| Remaining curriculum gap | 805 approved outlines have no lesson draft yet |

## Completion statement

Phase 4 is not complete. The manifest deliberately retains every undrafted lesson as planned, and the generator cannot approve or publish content.
`;

const subjectStatusMarkdown = `# Phase 4 Subject Production Status

Generated: ${PHASE4_DATE}

Status: **in progress; unpublished**

The table covers every approved Phase 3 subject. A zero in the drafted column is an explicit production gap, not an omitted subject.

| Subject | Planned | Drafted | Awaiting assignment | Reviewed | Approved | Blocked |
|---|---:|---:|---:|---:|---:|---:|
${subjectProduction
  .map((subject) => `| ${subject.name} | ${subject.totalPlanned} | ${subject.drafted} | ${subject.awaitingAssignment} | ${subject.reviewed} | ${subject.approved} | ${subject.blocked} |`)
  .join("\n")}
`;

const issuesMarkdown = `# Phase 4 Unresolved Issues

1. **Scripture licensing:** select the permitted translation or translations, platform territories, storage rules, and quotation limits. Every current draft uses references and original paraphrases only.
2. **Lesson review persistence:** approve a lesson-specific review schema and role permissions. The current application workflow is question-specific, so this batch is submitted only to a local non-publishing queue.
3. **Theological approval:** assign named doctrinal reviewers before any lesson changes from drafted to reviewed.
4. **Comparative review:** assign a reviewer competent in confessional Reformed sources for the authority lesson; later comparative subjects require tradition-specific reviewers.
5. **Patristic editions:** approve house editions and translations before direct quotations are added. Current content paraphrases bibliographically verified works.
6. **Graph mapping:** approve stable Apologia Graph record identifiers. Category links are present, but record links remain empty.
7. **Database mapping:** approve how the safe structured block model maps to persistent records before any database import is attempted.
8. **Rendering and API integration:** the new lessons are safe structured draft records, but no persistence adapter or lesson API has been approved. Desktop/mobile and dark/light rendering checks for these records must follow that integration.
9. **External text reuse review:** the automated gate checks internal duplication, five-word-sequence similarity, and quotation limits; approve an editorial or licensed external-corpus review policy before publication.
10. **Remaining production:** ${counts.planned} approved outlines remain planned and may not be silently skipped.
`;

await writeFile(path.join(outputRoot, "source-catalog.json"), json(sourceCatalog));
await writeFile(path.join(outputRoot, "production.manifest.json"), json(productionManifest));
await writeFile(path.join(outputRoot, "review-queue.json"), json(reviewQueue));
await writeFile(path.join(outputRoot, "batch.manifest.json"), json(batchManifest));
await writeFile(path.join(outputRoot, "PHASE4_STATUS.md"), statusMarkdown);
await writeFile(path.join(outputRoot, "SUBJECT_PRODUCTION_STATUS.md"), subjectStatusMarkdown);
await writeFile(path.join(outputRoot, "UNRESOLVED_ISSUES.md"), issuesMarkdown);

for (const record of contentRecords) {
  await writeFile(path.join(lessonsRoot, `${record.slug}.json`), json(record));
}

const importLessons = contentRecords.map(({ _generation, ...record }) => ({
  ...record,
  editorial: { ...record.editorial, reviewStatus: "awaiting_assignment" },
  importMetadata: {
    contentHash: _generation.contentHash,
    mode: "draft_only",
    upsertAllowed: false,
    publishAllowed: false,
  },
}));

await writeFile(
  path.join(importRoot, "draft-lessons.json"),
  json({
    schemaVersion: "1.0.0",
    importMode: "draft_only",
    publicationEffect: "none",
    remoteExecutionPerformed: false,
    records: importLessons,
  })
);
await writeFile(
  path.join(importRoot, "draft-lessons.ndjson"),
  `${importLessons.map((record) => JSON.stringify(record)).join("\n")}\n`
);
await writeFile(
  path.join(importRoot, "README.md"),
  `# Phase 4 draft import records\n\nThese files are import-ready structural drafts only. They do not contain credentials, executable SQL, remote hooks, approval changes, or publication commands. A database mapping and lesson-review model must be approved before import.\n`
);

console.log(`Generated ${contentRecords.length} complete lesson drafts from ${phase3Lessons.length} approved outlines.`);
console.log(`Production status: ${counts.drafted} drafted, ${counts.planned} planned, 0 approved, 0 published.`);
