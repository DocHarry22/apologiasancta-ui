import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ learningQuery: vi.fn() }));

vi.mock("./database", () => ({ learningQuery: mocks.learningQuery }));

import { listPracticeQuestions, listPublishedProgrammes } from "./publicRepository";

describe("published repository boundaries", () => {
  beforeEach(() => {
    mocks.learningQuery.mockReset();
    mocks.learningQuery.mockResolvedValue({ rows: [] });
  });

  it("queries the published programme view, never the draft base table", async () => {
    await listPublishedProgrammes({ limit: 20, offset: 0 });
    const sql = String(mocks.learningQuery.mock.calls[0][0]);
    expect(sql).toContain("content.published_programmes");
    expect(sql).not.toMatch(/FROM content\.programmes\b/);
  });

  it("uses safe question/option views and excludes mastery-context questions", async () => {
    await listPracticeQuestions({
      subjectId: null,
      groupId: null,
      lessonId: null,
      difficulty: null,
      page: { limit: 20, offset: 0 },
    });
    const sql = String(mocks.learningQuery.mock.calls[0][0]);
    expect(sql).toContain("content.published_questions");
    expect(sql).toContain("content.published_question_options");
    expect(sql).toContain("content.published_question_contexts");
    expect(sql).toContain("mastery_assessment");
    expect(sql).toContain("NOT EXISTS");
  });
});
