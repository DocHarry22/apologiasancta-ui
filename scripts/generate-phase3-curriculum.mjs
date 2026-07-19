import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BLUEPRINT_ID,
  BLUEPRINT_VERSION,
  DOCTRINAL_CLASSIFICATIONS,
  GENERATED_ON,
  GRAPH_CATEGORIES,
  SOURCE_TYPES,
  bibleBookDefinitions,
  disputeCoverage,
  explicitGapRegister,
  groupId,
  programmeDefinitions,
  progressionProfiles,
  routeDefinitions,
  subjectDefinitions,
} from "../curriculum/phase3/curriculum.source.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = resolve(dirname(scriptPath), "..");
const outputRoot = resolve(repositoryRoot, "curriculum", "phase3");
const importRoot = resolve(outputRoot, "import");

const riskRank = { low: 0, medium: 1, high: 2, critical: 3 };
const riskByRank = ["low", "medium", "high", "critical"];

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function maxRisk(...levels) {
  return riskByRank[Math.max(...levels.map((level) => riskRank[level] ?? 0))];
}

function difficultyFor(subject, groupIndex) {
  const value = subject.difficulty;
  if (value === "foundation") return groupIndex < 2 ? "foundation" : "intermediate";
  if (value === "intermediate") return groupIndex < 2 ? "intermediate" : "advanced";
  if (value === "advanced") return groupIndex === 0 ? "intermediate" : "advanced";
  if (value === "expert") return groupIndex < 2 ? "advanced" : "expert";
  if (value === "intermediate-to-advanced") return groupIndex < 2 ? "intermediate" : "advanced";
  if (value === "foundation-to-intermediate") return groupIndex < 2 ? "foundation" : "intermediate";
  return value.includes("expert") && groupIndex > 1 ? "expert" : "advanced";
}

function durationFor(profile, groupIndex) {
  const durationMap = {
    standard: [20, 22, 25, 27, 30],
    historical: [25, 30, 35, 35, 35],
    lab: [30, 45, 60, 45, 30],
    bible: [30, 35, 40, 40, 45],
  };
  return durationMap[profile][groupIndex];
}

function sourcesForGroup(subject, groupKey) {
  if (["evidence", "development", "sources", "dossier", "difficult-texts"].includes(groupKey)) {
    return unique(subject.sources);
  }
  if (["objections", "contested", "simulation"].includes(groupKey)) {
    return unique(subject.sources.concat(subject.traditions.length ? [SOURCE_TYPES.comparative] : [SOURCE_TYPES.academic]));
  }
  if (["synthesis", "debrief"].includes(groupKey)) return unique(subject.sources);
  return unique(subject.sources.slice(0, Math.min(subject.sources.length, 5)));
}

function practiceVolume(groupIndex, lessonCount, profile) {
  const perLesson = profile === "bible" ? [6, 8, 10, 10, 8][groupIndex] : [6, 8, 10, 10, 8][groupIndex];
  return perLesson * lessonCount;
}

function masteryVolume(groupIndex, lessonCount, profile) {
  const perLesson = profile === "bible" ? [10, 12, 14, 14, 12][groupIndex] : [10, 12, 15, 15, 12][groupIndex];
  return perLesson * lessonCount;
}

function unlockFor(prerequisites) {
  if (!prerequisites.length) return { type: "always" };
  return {
    type: "all",
    conditions: prerequisites.map((id) => ({ type: "mastery", targetId: id, minimumScorePercent: 80 })),
  };
}

function makePrerequisite(id, allIds) {
  const type = id.startsWith("grp.") ? "group" : id.startsWith("les.") ? "lesson" : id.startsWith("subj.") ? "subject" : "programme";
  if (allIds && !allIds.has(id)) throw new Error("Unknown prerequisite " + id);
  return { type, stableId: id };
}

function riskReason(subject) {
  const reasons = [];
  if (subject.classifications.includes("dogma")) reasons.push("dogmatic precision");
  if (subject.classifications.includes("historical_claim")) reasons.push("primary-source and chronology verification");
  if (subject.classifications.includes("scientific_claim")) reasons.push("current scientific review");
  if (subject.traditions.length) reasons.push("comparative fairness and tradition-specific sourcing");
  if (subject.reviewRisk === "critical") reasons.push("independent specialist review before lesson production");
  return unique(reasons).join("; ") || "ordinary catechetical review";
}

function buildEntities() {
  const allSubjects = subjectDefinitions.concat(bibleBookDefinitions);
  const programmeById = new Map(programmeDefinitions.map((programme) => [programme.id, programme]));
  const rawGroupIds = new Set();

  for (const subject of allSubjects) {
    const profile = progressionProfiles[subject.profile];
    for (const group of profile) rawGroupIds.add(groupId(subject.id, group.key));
  }

  const programmes = programmeDefinitions.map((definition) => {
    const stableId = "prog." + definition.id;
    return {
      stableId,
      name: definition.name,
      slug: definition.slug,
      description: definition.description,
      audience: definition.audience,
      difficulty: definition.difficulty,
      order: definition.order,
      prerequisites: definition.prerequisiteGroupIds.map((id) => ({ type: "group", stableId: id })),
      unlockCondition: definition.unlockCondition || unlockFor(definition.prerequisiteGroupIds),
      estimatedStudyTimeMinutes: 0,
      learningOutcomes: definition.outcomes,
      requiredPriorConcepts: definition.prerequisiteGroupIds.length ? ["mastery of the compulsory Catholic foundation route or specified gateway"] : ["none"],
      majorDoctrinalClassifications: [],
      requiredSourceTypes: [],
      comparativeTraditions: [],
      suggestedLessonCount: 0,
      suggestedPracticeQuestionVolume: 0,
      suggestedMasteryPoolVolume: 0,
      liveQuizEligible: false,
      relatedApologiaGraphCategories: [],
      reviewRiskLevel: "low",
      subjectIds: definition.subjectIds.map((id) => "subj." + id),
      editorialStatus: "draft",
      publicationStatus: "unpublished",
      approvalRequired: true,
    };
  });

  const subjects = [];
  const groups = [];
  const lessons = [];

  for (const definition of allSubjects) {
    const programmeDefinition = programmeById.get(definition.programmeId);
    if (!programmeDefinition) throw new Error("Missing programme " + definition.programmeId + " for " + definition.id);
    const programmePrerequisites = programmeDefinition.prerequisiteGroupIds || [];
    const subjectPrerequisiteIds = unique(programmePrerequisites.concat(definition.prerequisiteGroupIds));
    const profile = progressionProfiles[definition.profile];
    const subjectSlug = definition.id.startsWith("bible.") ? "bible-" + definition.id.slice(6) : slugify(definition.name);
    const subjectStableId = "subj." + definition.id;
    const subjectGroupIds = [];
    const subjectLessonIds = [];

    for (let groupIndex = 0; groupIndex < profile.length; groupIndex += 1) {
      const groupDefinition = profile[groupIndex];
      const stableId = groupId(definition.id, groupDefinition.key);
      const previousGroupId = groupIndex > 0 ? groupId(definition.id, profile[groupIndex - 1].key) : null;
      const prerequisiteIds = previousGroupId ? [previousGroupId] : subjectPrerequisiteIds;
      const topicCount = definition.lessonTopics.length === 5 ? 1 : 2;
      const topicStart = definition.lessonTopics.length === 5 ? groupIndex : groupIndex * 2;
      const topicTitles = definition.lessonTopics.slice(topicStart, topicStart + topicCount);
      const groupLessonIds = [];
      const groupDifficulty = difficultyFor(definition, groupIndex);
      const groupRisk = maxRisk(
        definition.reviewRisk,
        ["objections", "contested", "difficult-texts", "simulation"].includes(groupDefinition.key) ? "high" : "low",
      );
      const sourceTypes = sourcesForGroup(definition, groupDefinition.key);
      const lessonDuration = durationFor(definition.profile, groupIndex);

      for (let lessonIndex = 0; lessonIndex < topicTitles.length; lessonIndex += 1) {
        const number = String(lessonIndex + 1).padStart(2, "0");
        const lessonStableId = "les." + definition.id + "." + groupDefinition.key + "." + number;
        const lessonPrerequisiteIds = lessonIndex === 0 ? prerequisiteIds : [groupLessonIds[groupLessonIds.length - 1]];
        const title = topicTitles[lessonIndex];
        const lesson = {
          stableId: lessonStableId,
          groupId: stableId,
          subjectId: subjectStableId,
          programmeId: "prog." + definition.programmeId,
          order: lessonIndex + 1,
          title,
          slug: subjectSlug + "-" + groupDefinition.key + "-" + number,
          shortPurpose: groupDefinition.purpose + " This lesson focuses on " + title.toLowerCase() + ".",
          learningObjectives: [
            "Explain " + title.toLowerCase() + " accurately in the context of " + definition.name + ".",
            "Distinguish the key terms, authority levels, and claims needed for this topic.",
            "Use the assigned source categories proportionately and identify claims needing reviewer verification.",
          ],
          prerequisites: lessonPrerequisiteIds.map((id) => makePrerequisite(id)),
          keySourceCategories: sourceTypes,
          difficulty: groupDifficulty,
          estimatedDurationMinutes: lessonDuration,
          liveQuizEligible: definition.liveQuizEligible && ["foundations", "evidence", "objections", "synthesis", "theology", "difficult-texts"].includes(groupDefinition.key),
          reviewRiskLevel: groupRisk,
          editorialStatus: "draft",
          productionStatus: "planned",
          publicationStatus: "unpublished",
          approvalRequired: true,
          contentBodyIncluded: false,
        };
        lessons.push(lesson);
        groupLessonIds.push(lessonStableId);
        subjectLessonIds.push(lessonStableId);
      }

      const suggestedPractice = practiceVolume(groupIndex, groupLessonIds.length, definition.profile);
      const suggestedMastery = masteryVolume(groupIndex, groupLessonIds.length, definition.profile);
      const liveEligible = groupLessonIds.some((lessonId) => lessons.find((lesson) => lesson.stableId === lessonId).liveQuizEligible);
      groups.push({
        stableId,
        subjectId: subjectStableId,
        programmeId: "prog." + definition.programmeId,
        name: groupDefinition.name,
        slug: subjectSlug + "-" + groupDefinition.key,
        description: groupDefinition.purpose,
        audience: definition.audience,
        difficulty: groupDifficulty,
        order: groupIndex + 1,
        prerequisites: prerequisiteIds.map((id) => makePrerequisite(id)),
        unlockCondition: unlockFor(prerequisiteIds),
        estimatedStudyTimeMinutes: groupLessonIds.length * lessonDuration + 15,
        learningOutcomes: [
          "Explain the " + groupDefinition.name.toLowerCase() + " of " + definition.name + ".",
          "Use the required vocabulary without category errors.",
          "Evaluate claims using the assigned hierarchy of sources.",
          groupDefinition.key === "objections" || groupDefinition.key === "contested" || groupDefinition.key === "difficult-texts" ? "State serious alternative interpretations fairly before responding." : "Connect this group to the Catholic hierarchy of truths.",
        ],
        requiredPriorConcepts: unique(definition.requiredPriorConcepts.concat(previousGroupId ? [profile[groupIndex - 1].name] : [])),
        majorDoctrinalClassifications: definition.classifications,
        requiredSourceTypes: sourceTypes,
        comparativeTraditions: definition.traditions,
        suggestedLessonCount: groupLessonIds.length,
        suggestedPracticeQuestionVolume: suggestedPractice,
        suggestedMasteryPoolVolume: suggestedMastery,
        liveQuizEligible: liveEligible,
        relatedApologiaGraphCategories: definition.graphCategories,
        reviewRiskLevel: groupRisk,
        lessonIds: groupLessonIds,
        progressionProfile: definition.profile,
        progressionKey: groupDefinition.key,
        adaptationReason: definition.profile === "standard" ? null : definition.profile === "bible" ? "Bible books require canonical-literary progression and remain independent of one another." : definition.profile === "historical" ? "Historical subjects require chronology and primary-source method before apologetic synthesis." : "Performance labs require briefing, dossier, construction, simulation, and debrief stages.",
        editorialStatus: "draft",
        publicationStatus: "unpublished",
        approvalRequired: true,
      });
      subjectGroupIds.push(stableId);
    }

    const subjectGroups = groups.filter((group) => group.subjectId === subjectStableId);
    subjects.push({
      stableId: subjectStableId,
      programmeId: "prog." + definition.programmeId,
      name: definition.name,
      slug: subjectSlug,
      description: definition.description,
      audience: definition.audience,
      difficulty: definition.difficulty,
      order: definition.order,
      prerequisites: subjectPrerequisiteIds.map((id) => makePrerequisite(id)),
      unlockCondition: unlockFor(subjectPrerequisiteIds),
      estimatedStudyTimeMinutes: subjectGroups.reduce((total, group) => total + group.estimatedStudyTimeMinutes, 0),
      learningOutcomes: [
        "Explain " + definition.name + " within the Catholic hierarchy of truths.",
        "Make the controlling distinctions without confusing dogma, doctrine, discipline, opinion, or historical claim.",
        "Integrate the required sources in a cumulative case.",
        "Answer strong objections charitably and with tradition-specific accuracy.",
        "Produce a concise apologetic synthesis ordered to formation and mission.",
      ],
      requiredPriorConcepts: definition.requiredPriorConcepts,
      majorDoctrinalClassifications: definition.classifications,
      requiredSourceTypes: definition.sources,
      comparativeTraditions: definition.traditions,
      suggestedLessonCount: subjectLessonIds.length,
      suggestedPracticeQuestionVolume: subjectGroups.reduce((total, group) => total + group.suggestedPracticeQuestionVolume, 0),
      suggestedMasteryPoolVolume: subjectGroups.reduce((total, group) => total + group.suggestedMasteryPoolVolume, 0),
      liveQuizEligible: subjectGroups.some((group) => group.liveQuizEligible),
      relatedApologiaGraphCategories: definition.graphCategories,
      reviewRiskLevel: definition.reviewRisk,
      reviewRiskReason: riskReason(definition),
      groupIds: subjectGroupIds,
      catechismParts: definition.cccParts,
      optional: definition.optional,
      expertChallenge: definition.expertChallenge,
      canonicalMetadata: definition.profile === "bible" ? { testament: definition.testament, section: definition.canonicalSection, themes: definition.themes } : null,
      editorialStatus: "draft",
      publicationStatus: "unpublished",
      approvalRequired: true,
    });
  }

  for (const programme of programmes) {
    const programmeSubjects = subjects.filter((subject) => subject.programmeId === programme.stableId);
    programme.estimatedStudyTimeMinutes = programmeSubjects.reduce((total, subject) => total + subject.estimatedStudyTimeMinutes, 0);
    programme.majorDoctrinalClassifications = unique(programmeSubjects.flatMap((subject) => subject.majorDoctrinalClassifications));
    programme.requiredSourceTypes = unique(programmeSubjects.flatMap((subject) => subject.requiredSourceTypes));
    programme.comparativeTraditions = unique(programmeSubjects.flatMap((subject) => subject.comparativeTraditions));
    programme.suggestedLessonCount = programmeSubjects.reduce((total, subject) => total + subject.suggestedLessonCount, 0);
    programme.suggestedPracticeQuestionVolume = programmeSubjects.reduce((total, subject) => total + subject.suggestedPracticeQuestionVolume, 0);
    programme.suggestedMasteryPoolVolume = programmeSubjects.reduce((total, subject) => total + subject.suggestedMasteryPoolVolume, 0);
    programme.liveQuizEligible = programmeSubjects.some((subject) => subject.liveQuizEligible);
    programme.relatedApologiaGraphCategories = unique(programmeSubjects.flatMap((subject) => subject.relatedApologiaGraphCategories));
    programme.reviewRiskLevel = maxRisk(...programmeSubjects.map((subject) => subject.reviewRiskLevel));
  }

  return { programmes, subjects, groups, lessons };
}

function buildPrerequisiteEdges(entities) {
  const edges = [];
  const addEdges = (entity) => {
    for (const prerequisite of entity.prerequisites) {
      edges.push({
        stableId: "edge." + prerequisite.stableId.replaceAll(".", "-") + ".to." + entity.stableId.replaceAll(".", "-"),
        prerequisiteId: prerequisite.stableId,
        dependentId: entity.stableId,
        relation: "requires_mastery",
        minimumScorePercent: 80,
        configurable: true,
        editorialStatus: "draft",
      });
    }
  };
  entities.programmes.forEach(addEdges);
  entities.subjects.forEach(addEdges);
  entities.groups.forEach(addEdges);
  entities.lessons.forEach(addEdges);
  const seen = new Set();
  return edges.filter((edge) => {
    const key = edge.prerequisiteId + "->" + edge.dependentId;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildCoverage(entities) {
  const partDefinitions = [
    ["I", "The Profession of Faith (Creed)"],
    ["II", "The Celebration of the Christian Mystery (Sacraments)"],
    ["III", "Life in Christ (Moral Life)"],
    ["IV", "Christian Prayer"],
  ];
  const catechism = partDefinitions.map(([part, name]) => {
    const subjects = entities.subjects.filter((subject) => subject.catechismParts.includes(part));
    return {
      part,
      name,
      subjectIds: subjects.map((subject) => subject.stableId),
      programmeIds: unique(subjects.map((subject) => subject.programmeId)),
      lessonCount: subjects.reduce((total, subject) => total + subject.suggestedLessonCount, 0),
      coverageStatus: subjects.length ? "covered" : "gap",
    };
  });

  const subjectIds = new Set(entities.subjects.map((subject) => subject.stableId));
  const disputes = disputeCoverage.map((dispute) => {
    const mappedSubjectIds = dispute.subjectIds.map((id) => "subj." + id);
    for (const id of mappedSubjectIds) if (!subjectIds.has(id)) throw new Error("Unknown dispute subject " + id);
    return {
      stableId: dispute.id,
      name: dispute.name,
      subjectIds: mappedSubjectIds,
      coverageStatus: mappedSubjectIds.length > 1 ? "multi-subject" : "single-subject",
      requiredReview: "independent theological and comparative-source review",
    };
  });

  return { catechism, disputes };
}

function buildTotals(entities) {
  const minutes = entities.programmes.reduce((total, programme) => total + programme.estimatedStudyTimeMinutes, 0);
  return {
    programmeCount: entities.programmes.length,
    subjectCount: entities.subjects.length,
    nonBibleSubjectCount: entities.subjects.filter((subject) => !subject.stableId.startsWith("subj.bible.")).length,
    bibleBookSubjectCount: entities.subjects.filter((subject) => subject.stableId.startsWith("subj.bible.")).length,
    groupCount: entities.groups.length,
    lessonOutlineCount: entities.lessons.length,
    estimatedStudyMinutes: minutes,
    estimatedStudyHours: Math.round((minutes / 60) * 10) / 10,
    suggestedPracticeQuestionVolume: entities.programmes.reduce((total, programme) => total + programme.suggestedPracticeQuestionVolume, 0),
    suggestedMasteryPoolVolume: entities.programmes.reduce((total, programme) => total + programme.suggestedMasteryPoolVolume, 0),
    liveQuizEligibleLessonCount: entities.lessons.filter((lesson) => lesson.liveQuizEligible).length,
    optionalLessonCount: entities.subjects.filter((subject) => subject.optional).reduce((total, subject) => total + subject.suggestedLessonCount, 0),
    expertChallengeLessonCount: entities.subjects.filter((subject) => subject.expertChallenge).reduce((total, subject) => total + subject.suggestedLessonCount, 0),
  };
}

function buildReviewMatrix(entities) {
  return entities.subjects.map((subject) => ({
    subjectId: subject.stableId,
    subjectName: subject.name,
    riskLevel: subject.reviewRiskLevel,
    reasons: subject.reviewRiskReason,
    requiredReviewers: unique([
      "Catholic theological reviewer",
      subject.majorDoctrinalClassifications.includes("historical_claim") ? "historical/source reviewer" : null,
      subject.majorDoctrinalClassifications.includes("scientific_claim") ? "relevant scientific or clinical reviewer" : null,
      subject.comparativeTraditions.length ? "comparative-tradition reviewer or documented primary-source specialist" : null,
      subject.reviewRiskLevel === "critical" ? "senior doctrinal approver" : null,
    ]),
    approvalGate: subject.reviewRiskLevel === "critical" ? "two-person specialist review plus doctrinal approver" : subject.reviewRiskLevel === "high" ? "specialist review plus doctrinal reviewer" : "ordinary independent editorial review",
  }));
}

function buildDuplicateAnalysis(entities) {
  const duplicateValues = (items, key) => {
    const counts = new Map();
    for (const item of items) counts.set(item[key], (counts.get(item[key]) || 0) + 1);
    return [...counts.entries()].filter(([, count]) => count > 1).map(([value, count]) => ({ value, count }));
  };
  return {
    exactDuplicateIds: duplicateValues(entities.programmes.concat(entities.subjects, entities.groups, entities.lessons), "stableId"),
    duplicateProgrammeSlugs: duplicateValues(entities.programmes, "slug"),
    duplicateSubjectSlugs: duplicateValues(entities.subjects, "slug"),
    duplicateGroupSlugs: duplicateValues(entities.groups, "slug"),
    duplicateLessonSlugs: duplicateValues(entities.lessons, "slug"),
    intentionalOverlaps: [
      { foundationSubjectId: "subj.god-trinity-creation", specialistSubjectIds: ["subj.divine-attributes", "subj.trinity"], rationale: "The compulsory route teaches the creed-level whole; specialist subjects add technical distinctions and objections." },
      { foundationSubjectId: "subj.christ-paschal-mystery", specialistSubjectIds: ["subj.christology", "subj.redemption-resurrection"], rationale: "The compulsory route remains Christ-centred while specialist study separates person and saving work." },
      { foundationSubjectId: "subj.church-grace-sacraments", specialistSubjectIds: ["subj.church-authority", "subj.grace-justification-salvation", "subj.sacraments", "subj.eucharist"], rationale: "Foundational ecclesial-sacramental literacy precedes dispute-specific depth." },
      { foundationSubjectId: "subj.moral-prayer-foundations", specialistSubjectIds: ["subj.moral-theology", "subj.prayer-spiritual-life"], rationale: "All learners receive the moral and prayer pillars before advanced cases or spiritual schools." },
    ],
    gaps: explicitGapRegister,
  };
}

export function buildManifest() {
  const entities = buildEntities();
  const prerequisiteEdges = buildPrerequisiteEdges(entities);
  const coverage = buildCoverage(entities);
  const totals = buildTotals(entities);
  const manifest = {
    schemaVersion: "1.0.0",
    blueprint: {
      stableId: BLUEPRINT_ID,
      version: BLUEPRINT_VERSION,
      name: "Apologia Sancta Complete Curriculum and Prerequisite Blueprint",
      phase: 3,
      status: "draft",
      publicationStatus: "unpublished",
      generatedOn: GENERATED_ON,
      authorityStatement: "A structural curriculum proposal ordered to Catholic teaching; it is not itself a Magisterial document and requires named human approval before lesson production.",
    },
    governance: {
      centre: "Jesus Christ and the mystery of the Trinity",
      hierarchyOfTruths: "The curriculum gives compulsory priority to the Trinity, Incarnation, Paschal Mystery, Church, grace, sacramental life, moral discipleship, and prayer before specialist disputes.",
      sourcesIntegrated: ["Sacred Scripture", "Sacred Tradition", "Magisterium", "reason", "history"],
      catechismStructure: ["I: Creed", "II: Sacraments", "III: Christian Moral Life", "IV: Prayer"],
      defaultSubjectProgression: progressionProfiles.standard.map((group) => group.name),
      approvalPolicy: "All records remain draft and unpublished. Lesson production begins only after structural, theological, licensing, graph-taxonomy, and volume approvals.",
      noUnsafeHtml: true,
    },
    controlledVocabulary: {
      sourceTypes: Object.values(SOURCE_TYPES),
      doctrinalClassifications: DOCTRINAL_CLASSIFICATIONS,
      graphCategories: GRAPH_CATEGORIES,
      difficultyLevels: ["foundation", "intermediate", "advanced", "expert", "foundation-to-intermediate", "foundation-to-advanced", "intermediate-to-advanced", "intermediate-to-expert", "advanced-to-expert"],
      reviewRiskLevels: ["low", "medium", "high", "critical"],
      editorialStatuses: ["draft"],
      publicationStatuses: ["unpublished"],
    },
    prerequisiteArchitecture: {
      firstUnlockedGroupId: "grp.catholic-foundations.foundations",
      compulsoryCompletionGroupId: "grp.moral-prayer-foundations.synthesis",
      masteryThresholdPercent: 80,
      rule: "A group unlocks when every configured prerequisite group has mastery at or above the threshold. Thresholds are data, not hard-coded application logic.",
      parallelProgrammesAfterFoundation: ["prog.dogma-sacraments", "prog.church-tradition", "prog.moral-spiritual", "prog.reason-culture", "prog.comparative-apologetics"],
      optionalAdvancedProgrammeIds: ["prog.apologist-lab"],
      independentBibleProgrammeId: "prog.bible-books",
      noCircularDependenciesRequired: true,
      configurable: true,
    },
    learnerRoutes: routeDefinitions,
    programmes: entities.programmes,
    subjects: entities.subjects,
    groups: entities.groups,
    lessons: entities.lessons,
    prerequisiteEdges,
    productionTotals: totals,
    theologicalReviewMatrix: buildReviewMatrix(entities),
    coverage,
    duplicateAndGapAnalysis: buildDuplicateAnalysis(entities),
    approvalsRequiredBeforeLessonProduction: [
      "Approve programme, subject, group, and prerequisite architecture.",
      "Approve doctrinal classification vocabulary and review-risk assignments.",
      "Approve lesson, practice, mastery, and study-time estimates.",
      "Approve Apologia Graph taxonomy extensions and canonical link format.",
      "Approve Scripture translation, quotation, territory, web, mobile, APK, and offline licensing policy.",
      "Approve structured lesson-block schema and lesson-specific immutable review workflow.",
      "Assign named Catholic, historical, scientific, and comparative-tradition reviewers.",
      "Approve casual-player preview rules and expert-challenge gates.",
      "Approve the database target mapping before executing any import.",
    ],
    integrity: {
      hashAlgorithm: "sha256",
      hashScope: "UTF-8 JSON of the complete manifest with integrity.manifestSha256 set to null",
      manifestSha256: null,
    },
  };
  const hashInput = JSON.stringify(manifest, null, 2) + "\n";
  manifest.integrity.manifestSha256 = createHash("sha256").update(hashInput).digest("hex");
  return manifest;
}

function markdownEscape(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

function minutesLabel(minutes) {
  return Math.round((minutes / 60) * 10) / 10 + " hours";
}

function buildCurriculumMap(manifest) {
  const lines = [
    "# Apologia Sancta Phase 3 Curriculum Map",
    "",
    "> Status: DRAFT / UNPUBLISHED. Structural records only; no full lesson bodies are included.",
    "",
    "Blueprint: " + manifest.blueprint.stableId + " (" + manifest.blueprint.version + ")",
    "",
    "## Architecture",
    "",
    "The compulsory route begins with " + manifest.prerequisiteArchitecture.firstUnlockedGroupId + " and ends at " + manifest.prerequisiteArchitecture.compulsoryCompletionGroupId + ". Specialist programmes then run in parallel. Bible-book tracks unlock independently after Scripture-and-canon distinctions and never depend on another Bible book.",
    "",
    "Totals: " + manifest.productionTotals.programmeCount + " programmes, " + manifest.productionTotals.subjectCount + " subjects (including " + manifest.productionTotals.bibleBookSubjectCount + " Bible books), " + manifest.productionTotals.groupCount + " groups, and " + manifest.productionTotals.lessonOutlineCount + " lesson outlines.",
    "",
  ];

  for (const programme of manifest.programmes) {
    lines.push("## " + programme.order + ". " + programme.name, "", programme.description, "", "Audience: " + programme.audience.join(", "), "", "Difficulty: " + programme.difficulty, "", "Estimated study: " + minutesLabel(programme.estimatedStudyTimeMinutes), "", "Unlock: " + (programme.prerequisites.length ? programme.prerequisites.map((item) => item.stableId).join(", ") : "entry route"), "");
    const programmeSubjects = manifest.subjects.filter((subject) => subject.programmeId === programme.stableId).sort((a, b) => a.order - b.order);
    for (const subject of programmeSubjects) {
      lines.push("### " + subject.order + ". " + subject.name, "", subject.description, "", "- Stable ID: " + subject.stableId, "- Difficulty / risk: " + subject.difficulty + " / " + subject.reviewRiskLevel, "- Prerequisites: " + (subject.prerequisites.length ? subject.prerequisites.map((item) => item.stableId).join(", ") : "none"), "- Sources: " + subject.requiredSourceTypes.join("; "), "- Graph categories: " + (subject.relatedApologiaGraphCategories.join(", ") || "gap pending graph-taxonomy review"), "");
      const subjectGroups = manifest.groups.filter((group) => group.subjectId === subject.stableId).sort((a, b) => a.order - b.order);
      for (const group of subjectGroups) {
        lines.push("#### " + group.order + ". " + group.name, "", group.description, "", "Lessons: " + group.suggestedLessonCount + "; practice: " + group.suggestedPracticeQuestionVolume + "; mastery pool: " + group.suggestedMasteryPoolVolume + "; study: " + group.estimatedStudyTimeMinutes + " minutes; live quiz: " + (group.liveQuizEligible ? "eligible" : "not eligible") + ".", "");
        const groupLessons = manifest.lessons.filter((lesson) => lesson.groupId === group.stableId).sort((a, b) => a.order - b.order);
        for (const lesson of groupLessons) lines.push((lesson.order) + ". **" + lesson.title + "** — " + lesson.shortPurpose);
        lines.push("");
      }
    }
  }
  return lines.join("\n").trimEnd() + "\n";
}

function buildPrerequisiteReport(manifest) {
  const lines = [
    "# Phase 3 Prerequisite Graph",
    "",
    "> DRAFT / UNPUBLISHED",
    "",
    "First unlocked group: " + manifest.prerequisiteArchitecture.firstUnlockedGroupId,
    "",
    "Compulsory completion gateway: " + manifest.prerequisiteArchitecture.compulsoryCompletionGroupId,
    "",
    "Mastery threshold: " + manifest.prerequisiteArchitecture.masteryThresholdPercent + "% (configurable).",
    "",
    "## Programme gateways",
    "",
    "| Programme | Prerequisites |",
    "|---|---|",
  ];
  for (const programme of manifest.programmes) lines.push("| " + markdownEscape(programme.name) + " | " + (programme.prerequisites.map((item) => item.stableId).join(", ") || "none") + " |");
  lines.push("", "## Subject gateways", "", "| Subject | Prerequisites |", "|---|---|");
  for (const subject of manifest.subjects) lines.push("| " + markdownEscape(subject.name) + " | " + (subject.prerequisites.map((item) => item.stableId).join(", ") || "none") + " |");
  lines.push("", "## Validation rules", "", "- Every edge must point to a declared stable ID.", "- The dependency graph must be acyclic.", "- Exactly one group is unlocked without prerequisites.", "- Bible-book subjects may depend on the Scripture-and-canon gateway and their own preceding groups, never another Bible book.", "- Optional expert challenges are excluded from compulsory completion.", "");
  return lines.join("\n");
}

function buildTotalsReport(manifest) {
  const lines = [
    "# Phase 3 Content-Production Totals",
    "",
    "> Estimates for planning only; approval is required before lesson production.",
    "",
    "| Programme | Subjects | Groups | Lessons | Study hours | Practice items | Mastery pool |",
    "|---|---:|---:|---:|---:|---:|---:|",
  ];
  for (const programme of manifest.programmes) {
    const subjects = manifest.subjects.filter((subject) => subject.programmeId === programme.stableId);
    const subjectIds = new Set(subjects.map((subject) => subject.stableId));
    const groups = manifest.groups.filter((group) => subjectIds.has(group.subjectId));
    lines.push("| " + markdownEscape(programme.name) + " | " + subjects.length + " | " + groups.length + " | " + programme.suggestedLessonCount + " | " + (Math.round((programme.estimatedStudyTimeMinutes / 60) * 10) / 10) + " | " + programme.suggestedPracticeQuestionVolume + " | " + programme.suggestedMasteryPoolVolume + " |");
  }
  const totals = manifest.productionTotals;
  lines.push("| **Total** | **" + totals.subjectCount + "** | **" + totals.groupCount + "** | **" + totals.lessonOutlineCount + "** | **" + totals.estimatedStudyHours + "** | **" + totals.suggestedPracticeQuestionVolume + "** | **" + totals.suggestedMasteryPoolVolume + "** |", "", "Bible-book subjects: " + totals.bibleBookSubjectCount + ". Optional lesson outlines: " + totals.optionalLessonCount + ". Live-quiz-eligible lesson outlines: " + totals.liveQuizEligibleLessonCount + ". Expert-challenge outlines: " + totals.expertChallengeLessonCount + ".", "");
  return lines.join("\n");
}

function buildReviewReport(manifest) {
  const lines = ["# Phase 3 Risk and Theological-Review Matrix", "", "> DRAFT / UNPUBLISHED", "", "| Subject | Risk | Required review | Reasons |", "|---|---|---|---|"];
  for (const row of manifest.theologicalReviewMatrix) lines.push("| " + markdownEscape(row.subjectName) + " | " + row.riskLevel + " | " + markdownEscape(row.approvalGate) + " | " + markdownEscape(row.reasons) + " |");
  return lines.join("\n") + "\n";
}

function buildCatechismReport(manifest) {
  const lines = ["# Coverage Matrix: Catechism Four-Part Structure", "", "| Part | Coverage | Programmes | Subjects | Lesson outlines |", "|---|---|---:|---:|---:|"];
  for (const row of manifest.coverage.catechism) lines.push("| " + row.part + ": " + markdownEscape(row.name) + " | " + row.coverageStatus + " | " + row.programmeIds.length + " | " + row.subjectIds.length + " | " + row.lessonCount + " |");
  lines.push("", "All four parts receive compulsory foundation coverage. Specialist counts overlap because a subject may legitimately serve more than one Catechism part.", "");
  return lines.join("\n");
}

function buildDisputeReport(manifest) {
  const lines = ["# Coverage Matrix: Major Apologetics Disputes", "", "| Dispute | Coverage | Subjects | Review gate |", "|---|---|---|---|"];
  for (const row of manifest.coverage.disputes) lines.push("| " + markdownEscape(row.name) + " | " + row.coverageStatus + " | " + row.subjectIds.join(", ") + " | " + row.requiredReview + " |");
  return lines.join("\n") + "\n";
}

function buildGapReport(manifest) {
  const analysis = manifest.duplicateAndGapAnalysis;
  const lines = [
    "# Duplicate and Gap Analysis",
    "",
    "## Exact duplicates",
    "",
    "- Stable IDs: " + analysis.exactDuplicateIds.length,
    "- Programme slugs: " + analysis.duplicateProgrammeSlugs.length,
    "- Subject slugs: " + analysis.duplicateSubjectSlugs.length,
    "- Group slugs: " + analysis.duplicateGroupSlugs.length,
    "- Lesson slugs: " + analysis.duplicateLessonSlugs.length,
    "",
    "## Intentional formation-to-specialisation overlaps",
    "",
  ];
  for (const overlap of analysis.intentionalOverlaps) lines.push("- " + overlap.foundationSubjectId + " → " + overlap.specialistSubjectIds.join(", ") + ": " + overlap.rationale);
  lines.push("", "## Open gaps", "");
  for (const gap of analysis.gaps) lines.push("### " + gap.id + " (" + gap.severity + ")", "", gap.description, "", "Disposition: " + gap.disposition, "");
  return lines.join("\n");
}

function buildApprovalReport(manifest) {
  const lines = [
    "# Phase 3 Approval Report",
    "",
    "> This blueprint is complete as a structural draft but is not approved and has not been published or imported into a remote database.",
    "",
    "## Draft counts",
    "",
    "- Programmes: " + manifest.productionTotals.programmeCount,
    "- Subjects: " + manifest.productionTotals.subjectCount,
    "- Groups: " + manifest.productionTotals.groupCount,
    "- Lesson outlines: " + manifest.productionTotals.lessonOutlineCount,
    "- Practice-volume estimate: " + manifest.productionTotals.suggestedPracticeQuestionVolume,
    "- Mastery-pool estimate: " + manifest.productionTotals.suggestedMasteryPoolVolume,
    "",
    "## User approvals required before Phase 4",
    "",
  ];
  manifest.approvalsRequiredBeforeLessonProduction.forEach((approval, index) => lines.push((index + 1) + ". [ ] " + approval));
  lines.push("", "## Import and publication status", "", "Generated files under curriculum/phase3/import are draft structural records only. No database command, remote API mutation, publication endpoint, or Engine import was invoked.", "", "## Integrity", "", "Manifest SHA-256: " + manifest.integrity.manifestSha256, "");
  return lines.join("\n");
}

function makeImportBatch(manifest) {
  return {
    batchId: "batch." + BLUEPRINT_ID,
    blueprintId: manifest.blueprint.stableId,
    blueprintVersion: manifest.blueprint.version,
    manifestSha256: manifest.integrity.manifestSha256,
    mode: "draft-structural-records-only",
    publish: false,
    generatedOn: manifest.blueprint.generatedOn,
    counts: manifest.productionTotals,
    targetMappingStatus: "requires-user-approval",
    records: {
      programmes: "programmes.json",
      subjects: "subjects.json",
      groups: "groups.json",
      lessons: "lessons.json",
      prerequisiteEdges: "prerequisite-edges.json",
    },
  };
}

async function writeJson(path, value) {
  await writeFile(path, JSON.stringify(value, null, 2) + "\n", "utf8");
}

export async function generateArtifacts() {
  const manifest = buildManifest();
  await mkdir(importRoot, { recursive: true });
  await writeJson(resolve(outputRoot, "curriculum.manifest.json"), manifest);
  await writeFile(resolve(outputRoot, "CURRICULUM_MAP.md"), buildCurriculumMap(manifest), "utf8");
  await writeFile(resolve(outputRoot, "PREREQUISITE_GRAPH.md"), buildPrerequisiteReport(manifest), "utf8");
  await writeFile(resolve(outputRoot, "CONTENT_PRODUCTION_TOTALS.md"), buildTotalsReport(manifest), "utf8");
  await writeFile(resolve(outputRoot, "THEOLOGICAL_REVIEW_MATRIX.md"), buildReviewReport(manifest), "utf8");
  await writeFile(resolve(outputRoot, "CATECHISM_COVERAGE_MATRIX.md"), buildCatechismReport(manifest), "utf8");
  await writeFile(resolve(outputRoot, "APOLOGETICS_DISPUTE_MATRIX.md"), buildDisputeReport(manifest), "utf8");
  await writeFile(resolve(outputRoot, "DUPLICATE_GAP_ANALYSIS.md"), buildGapReport(manifest), "utf8");
  await writeFile(resolve(outputRoot, "APPROVAL_REPORT.md"), buildApprovalReport(manifest), "utf8");
  await writeJson(resolve(importRoot, "draft-batch.json"), makeImportBatch(manifest));
  await writeJson(resolve(importRoot, "programmes.json"), manifest.programmes);
  await writeJson(resolve(importRoot, "subjects.json"), manifest.subjects);
  await writeJson(resolve(importRoot, "groups.json"), manifest.groups);
  await writeJson(resolve(importRoot, "lessons.json"), manifest.lessons);
  await writeJson(resolve(importRoot, "prerequisite-edges.json"), manifest.prerequisiteEdges);
  await writeFile(resolve(importRoot, "README.md"), "# Phase 3 draft import package\n\nThese records are import-ready only after the database target mapping is approved. Every record is draft/unpublished. No remote import or publication is authorised by this package.\n", "utf8");
  const allRecords = [
    ...manifest.programmes.map((record) => ({ entityType: "programme", record })),
    ...manifest.subjects.map((record) => ({ entityType: "subject", record })),
    ...manifest.groups.map((record) => ({ entityType: "group", record })),
    ...manifest.lessons.map((record) => ({ entityType: "lesson", record })),
    ...manifest.prerequisiteEdges.map((record) => ({ entityType: "prerequisite_edge", record })),
  ];
  await writeFile(resolve(importRoot, "draft-records.ndjson"), allRecords.map((entry) => JSON.stringify(entry)).join("\n") + "\n", "utf8");
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  const manifest = await generateArtifacts();
  process.stdout.write("Generated Phase 3 curriculum: " + JSON.stringify(manifest.productionTotals) + "\n");
}
