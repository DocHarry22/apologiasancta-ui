import { describe, expect, it } from "vitest";
import { buildEngineFeed } from "./engineFeed";
import { sanitizeMasteryStartPayload, sanitizeMasterySubmitPayload } from "./learnerRepository";
import { normalizePracticeQuestion } from "./publicRepository";

const ATTEMPT_ID = "11111111-1111-4111-8111-111111111111";
const GROUP_ID = "22222222-2222-4222-8222-222222222222";
const SUBJECT_ID = "33333333-3333-4333-8333-333333333333";
const QUESTION_ID = "44444444-4444-4444-8444-444444444444";
const OBJECTIVE_ID = "66666666-6666-4666-8666-666666666666";
const OPTION_IDS = [
  "55555555-5555-4555-8555-555555555551",
  "55555555-5555-4555-8555-555555555552",
  "55555555-5555-4555-8555-555555555553",
  "55555555-5555-4555-8555-555555555554",
];

function option(optionId: string, position: number, correct = false) {
  return {
    option_id: optionId,
    position,
    label: String.fromCharCode(65 + position),
    content: { type: "text", text: `Option ${position + 1}` },
    is_correct: correct,
    explanation: { type: "text", text: `Why ${position + 1}` },
    misconception_code: correct ? null : `MISCONCEPTION_${position + 1}`,
  };
}

describe("learning response contracts", () => {
  it("normalizes structured mastery text and cannot leak initial answer material", () => {
    const result = sanitizeMasteryStartPayload({
      attempt_id: ATTEMPT_ID,
      group_id: GROUP_ID,
      status: "in_progress",
      started_at: "2026-07-17T10:00:00.000Z",
      expires_at: "2026-07-17T12:00:00.000Z",
      question_count: 1,
      correct_option_ids: [OPTION_IDS[1]],
      scoring_snapshot: { secret: true },
      questions: [{
        question_id: QUESTION_ID,
        position: 0,
        version: 1,
        question_type: "single_choice",
        difficulty: 2,
        prompt: { type: "text", text: "A safe prompt" },
        correct_option_id: OPTION_IDS[1],
        explanation: { text: "Not before submit" },
        options: OPTION_IDS.map((id, index) => ({
          option_id: id,
          position: index,
          label: String.fromCharCode(65 + index),
          content: { type: "text", text: `Choice ${index + 1}` },
          is_correct: index === 1,
        })),
      }],
    });

    expect(result.questions).toEqual([expect.objectContaining({
      prompt: "A safe prompt",
      options: [
        expect.objectContaining({ content: "Choice 1" }),
        expect.objectContaining({ content: "Choice 2" }),
        expect.objectContaining({ content: "Choice 3" }),
        expect.objectContaining({ content: "Choice 4" }),
      ],
    })]);
    expect(JSON.stringify(result)).not.toMatch(/correctOption|isCorrect|scoring|explanation/i);
  });

  it("returns structured explanations only after mastery submission", () => {
    const result = sanitizeMasterySubmitPayload({
      attempt_id: ATTEMPT_ID,
      group_id: GROUP_ID,
      status: "submitted",
      submitted_at: "2026-07-17T10:10:00.000Z",
      score_percent: 100,
      correct_count: 1,
      question_count: 1,
      pass_threshold_percent: 100,
      mastered: true,
      answers: [{
        question_id: QUESTION_ID,
        selected_option_ids: [OPTION_IDS[1]],
        is_correct: true,
        correct_option_ids: [OPTION_IDS[1]],
        explanation: { type: "text", text: "Correct explanation" },
        options: OPTION_IDS.map((id, index) => ({
          option_id: id,
          is_correct: index === 1,
          explanation: { type: "text", text: `Feedback ${index + 1}` },
        })),
      }],
      newly_unlocked_group_ids: [],
      private_notes: "must not pass",
    });
    expect((result.answers as Array<Record<string, unknown>>)[0]).toMatchObject({
      explanation: "Correct explanation",
      isCorrect: true,
    });
    expect(JSON.stringify(result)).not.toContain("private_notes");
  });

  it("normalizes safe public practice prompt and option blocks", () => {
    const result = normalizePracticeQuestion({
      id: QUESTION_ID,
      prompt: { type: "text", text: "Practice prompt" },
      options: OPTION_IDS.map((id, index) => ({
        id,
        position: index,
        label: { text: String.fromCharCode(65 + index) },
        content: { type: "text", text: `Practice ${index + 1}` },
      })),
    });
    expect(result.prompt).toBe("Practice prompt");
    expect(result.options).toHaveLength(4);
    expect(result.options[0]).toMatchObject({ label: "A", content: "Practice 1" });
  });

  it("builds the engine's exact four-option contract", () => {
    const feed = buildEngineFeed([{
      question_id: QUESTION_ID,
      stable_key: "fixture_question",
      version: 2,
      subject_id: SUBJECT_ID,
      group_id: GROUP_ID,
      objective_id: OBJECTIVE_ID,
      difficulty: 3,
      difficulty_mode: "hard",
      equivalence_key: "fixture.question.1",
      question_type: "single_choice",
      prompt: { type: "text", text: "Engine prompt" },
      correct_answer_explanation: { type: "text", text: "Engine explanation" },
      denomination_scope: {},
      rights_metadata: { permission_status: "public_domain" },
      quality_flags: {},
      governance_stage: "publication",
      governance_validated: true,
      sources: [{
        authority_category: "catechism",
        locator: "CCC 1",
        citation: "Catechism of the Catholic Church, 1",
        permission_status: "permission_not_required_under_recorded_terms",
      }],
      options: OPTION_IDS.map((id, index) => option(id, index, index === 2)),
      updated_at: "2026-07-17T10:00:00.000Z",
    }]);

    expect(feed).toMatchObject({
      version: expect.stringMatching(/^v1-[0-9a-f]{24}$/),
      updatedAt: "2026-07-17T10:00:00.000Z",
      questions: [{
        id: QUESTION_ID,
        topicId: GROUP_ID,
        prompt: "Engine prompt",
        correctOptionId: OPTION_IDS[2],
        options: OPTION_IDS.map((id, index) => ({ id, label: `Option ${index + 1}` })),
      }],
    });
  });

  it("fails closed on malformed engine option sets", () => {
    expect(() => buildEngineFeed([{
      question_id: QUESTION_ID,
      version: 1,
      subject_id: SUBJECT_ID,
      difficulty: 1,
      prompt: { text: "Prompt" },
      options: OPTION_IDS.slice(0, 3).map((id, index) => option(id, index, index === 0)),
    }])).toThrow(/temporarily unavailable/i);
  });
});
