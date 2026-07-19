import { describe, expect, it } from "vitest";
import {
  LearningValidationError,
  parseLessonProgressInput,
  parseMasteryStartInput,
  parseMasterySubmitInput,
  parsePagination,
} from "./validation";

const QUESTION_ID = "11111111-1111-4111-8111-111111111111";
const OPTION_ID = "22222222-2222-4222-8222-222222222222";
const GROUP_ID = "33333333-3333-4333-8333-333333333333";

describe("learning request validation", () => {
  it("applies bounded pagination defaults", () => {
    expect(parsePagination(new URLSearchParams())).toEqual({ limit: 20, offset: 0 });
    expect(parsePagination(new URLSearchParams("limit=100&offset=40"))).toEqual({ limit: 100, offset: 40 });
    expect(() => parsePagination(new URLSearchParams("limit=101"))).toThrow(LearningValidationError);
  });

  it("requires a stable idempotency key for mastery starts", () => {
    expect(parseMasteryStartInput({ groupId: GROUP_ID, questionLimit: 7 }, "attempt:start:123"))
      .toEqual({ groupId: GROUP_ID, questionLimit: 7, idempotencyKey: "attempt:start:123" });
    expect(() => parseMasteryStartInput({ groupId: GROUP_ID }, "short")).toThrow(LearningValidationError);
  });

  it("normalizes answer input and rejects replay-style duplicate questions", () => {
    expect(parseMasterySubmitInput({
      answers: [{ questionId: QUESTION_ID, optionId: OPTION_ID }],
    }, "attempt:submit:123")).toEqual({
      idempotencyKey: "attempt:submit:123",
      answers: [{ questionId: QUESTION_ID, selectedOptionIds: [OPTION_ID] }],
    });

    expect(() => parseMasterySubmitInput({
      idempotencyKey: "attempt:submit:123",
      answers: [
        { questionId: QUESTION_ID, optionId: OPTION_ID },
        { questionId: QUESTION_ID, optionId: OPTION_ID },
      ],
    })).toThrow(/answered once/i);
  });

  it("normalizes completed lesson progress server-side", () => {
    expect(parseLessonProgressInput({ completed: true, readingProgressPercent: 20 })).toEqual({
      state: "completed",
      readingProgressPercent: 100,
      resumeLocator: null,
    });
  });
});
