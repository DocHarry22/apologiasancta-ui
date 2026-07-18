import { describe, expect, it } from "vitest";
import {
  LESSON_COMPONENTS,
  hasBlockingFindings,
  validateDoctrinalClaim,
  validateLesson,
  validateQuestion,
  validateSource,
} from "./governance";

const validQuestion = {
  questionType: "single_choice",
  objectiveId: "objective-trinity-1",
  equivalenceKey: "trinity-person-nature",
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
  rightsMetadata: { permissionStatus: "permission_not_required_under_recorded_terms" },
};

describe("Phase 2 governance linter", () => {
  it("accepts a minimally complete four-option question", () => {
    expect(validateQuestion(validQuestion)).toEqual([]);
  });

  it("rejects deceptive and incomplete question structures", () => {
    const findings = validateQuestion({
      ...validQuestion,
      questionType: "true_false",
      objectiveId: "",
      equivalenceKey: "",
      difficultyMode: "trick",
      trickCategory: "grammar_gotcha",
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
    expect(codes).toContain("comparative.generic_scope");
    expect(codes).toContain("question.authoritative_source_required");
    expect(hasBlockingFindings(findings)).toBe(true);
  });

  it("requires all fifteen lesson components", () => {
    expect(validateLesson({ components: LESSON_COMPONENTS })).toEqual([]);
    const findings = validateLesson({ components: ["central_question"] });
    expect(findings).toHaveLength(LESSON_COMPONENTS.length - 1);
    expect(findings.some((item) => item.code === "lesson.component.related_apologia_graph")).toBe(true);
  });

  it("defaults source reuse to blocked until rights are verified", () => {
    expect(validateSource({
      authorityCategory: "sacred_scripture",
      citation: "John 1:1",
      rightsMetadata: { permissionStatus: "unverified", quoteLimitWords: 0 },
    }).some((item) => item.code === "source.permission_unverified")).toBe(true);
  });

  it("requires human review when a doctrinal classification is unresolved", () => {
    expect(validateDoctrinalClaim({
      classification: "disputed_or_unresolved",
      attributionMode: "interpretation",
    }).map((item) => item.code)).toContain("claim.human_review_required");
  });
});
