import { describe, expect, it } from "vitest";
import {
  LESSON_COMPONENTS,
  hasBlockingFindings,
  summariseFindings,
  validateDoctrinalClaim,
  validateLesson,
  validateQuestion,
  validateSource,
} from "./governance";

const validRights = {
  copyrightStatus: "recorded",
  permissionStatus: "permission_not_required_under_recorded_terms",
  attributionText: "Source attribution",
  quoteLimitWords: 0,
  reviewedAt: "2026-07-19T00:00:00.000Z",
};

const validQuestion = {
  questionType: "single_choice",
  objectiveId: "objective-trinity-1",
  equivalenceKey: "trinity-person-nature",
  authorId: "author-1",
  reviewerIds: ["reviewer-1"],
  version: 1,
  publicationStatus: "approved",
  difficulty: 2,
  difficultyMode: "medium",
  prompt: "Which statement correctly distinguishes nature and Person?",
  correctAnswerExplanation: { text: "Nature answers what; Person answers who." },
  options: [
    { content: "Nature answers what; Person answers who.", isCorrect: true, explanation: "This is the relevant distinction." },
    { content: "Nature and Person are synonyms.", isCorrect: false, explanation: "They answer different questions.", misconceptionCode: "TRINITY_CONFLATION" },
    { content: "Person means a part of a nature.", isCorrect: false, explanation: "A person is not a part.", misconceptionCode: "TRINITY_PARTIALISM" },
    { content: "Nature applies only to created beings.", isCorrect: false, explanation: "Nature is not limited that way.", misconceptionCode: "NATURE_CREATED_ONLY" },
  ],
  sources: [{ authorityCategory: "catechism", locator: "CCC 252" }],
  denominationScope: {},
  rightsMetadata: validRights,
};

describe("Phase 2 governance linter", () => {
  it("accepts a minimally complete four-option question", () => {
    expect(validateQuestion(validQuestion)).toEqual([]);
  });

  it("rejects prohibited, ambiguous and incomplete assessment structures", () => {
    const findings = validateQuestion({
      ...validQuestion,
      questionType: "true_false",
      objectiveId: "",
      equivalenceKey: "",
      difficultyMode: "trick",
      trickCategory: "grammar_gotcha",
      qualityFlags: { multiple_defensible_answers: true, deceptive_wording: true },
      options: [
        { content: "All of the above", isCorrect: true },
        { content: "A", isCorrect: true },
      ],
      sources: [],
      denominationScope: { comparative: true, tradition: "Protestants" },
      rightsMetadata: { permissionStatus: "unverified" },
    });

    const codes = findings.map((item) => item.code);
    expect(codes).toContain("question.type_multiple_choice_only");
    expect(codes).toContain("question.option_count");
    expect(codes).toContain("question.one_best_answer");
    expect(codes).toContain("question.forbidden_option");
    expect(codes).toContain("question.trick_category_required");
    expect(codes).toContain("question.quality.multiple_defensible_answers");
    expect(codes).toContain("comparative.generic_scope");
    expect(codes).toContain("question.authoritative_source_required");
    expect(hasBlockingFindings(findings)).toBe(true);
  });

  it("requires a steelman and recognised source for advanced comparative questions", () => {
    const findings = validateQuestion({
      ...validQuestion,
      difficulty: 5,
      difficultyMode: "expert",
      denominationScope: { comparative: true, tradition: "Reformed" },
    });
    expect(findings.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "comparative.recognised_source_required",
        "comparative.steelman_required",
      ]),
    );
  });

  it("requires all fifteen lesson components and reviewed non-applicability", () => {
    expect(validateLesson({ components: LESSON_COMPONENTS })).toEqual([]);
    const findings = validateLesson({
      components: [
        "central_question",
        { kind: "historical_or_patristic_evidence", nonApplicable: true },
      ],
    });
    expect(findings.map((item) => item.code)).toContain("lesson.non_applicable_reason_required");
    expect(findings.map((item) => item.code)).toContain("lesson.component.related_apologia_graph");
  });

  it("defaults source reuse to blocked and requires complete Bible metadata", () => {
    const blocked = validateSource({
      authorityCategory: "sacred_scripture",
      citation: "John 1:1",
      rightsMetadata: { permissionStatus: "unverified", quoteLimitWords: 0 },
    });
    expect(blocked.map((item) => item.code)).toContain("rights.permission_unverified");
    expect(blocked.map((item) => item.code)).toContain("source.bible_translationName_required");

    expect(validateSource({
      authorityCategory: "sacred_scripture",
      citation: "John 1:1",
      url: "https://example.invalid/john/1/1",
      rightsMetadata: {
        copyrightStatus: "public_domain",
        permissionStatus: "public_domain",
        quoteLimitWords: 0,
        reviewedAt: "2026-07-19T00:00:00.000Z",
      },
      translationMetadata: {
        translationName: "Reviewed translation",
        translationAbbreviation: "RT",
        edition: "1",
        language: "English",
        rightsholder: "Public domain",
      },
    })).toEqual([]);
  });

  it("requires qualified review for unresolved and definitive doctrinal claims", () => {
    const unresolved = validateDoctrinalClaim({
      classification: "disputed_or_unresolved",
      attributionMode: "interpretation",
      sourceLocators: ["source:1"],
    });
    expect(unresolved.map((item) => item.code)).toContain("claim.human_review_required");

    const dogma = validateDoctrinalClaim({
      classification: "dogma",
      attributionMode: "direct_quotation",
      sourceLocators: ["council:decree:1"],
    });
    expect(dogma.map((item) => item.code)).toContain("claim.qualified_reviewer_required");
  });

  it("summarises blocking admin warnings", () => {
    const summary = summariseFindings(validateQuestion({}));
    expect(summary.publishable).toBe(false);
    expect(summary.errors).toBeGreaterThan(0);
  });
});
