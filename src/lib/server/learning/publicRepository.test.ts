import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ learningQuery: vi.fn() }));

vi.mock("./database", () => ({ learningQuery: mocks.learningQuery }));

import { listPracticeQuestions, listPublishedProgrammes, searchPublishedContent } from "./publicRepository";

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

  it("preserves the published content discriminator for search clients", async () => {
    mocks.learningQuery.mockResolvedValue({ rows: [{
      id: "11111111-1111-4111-8111-111111111111",
      slug: "catechism",
      title: "Catechism of the Catholic Church",
      content_type: "source",
      total_count: "1",
    }] });

    const result = await searchPublishedContent({
      query: "catechism",
      contentType: "source",
      difficulty: null,
      page: { limit: 20, offset: 0 },
    });

    expect(result).toMatchObject({ total: 1, data: [{ contentType: "source" }] });
    expect(mocks.learningQuery.mock.calls[0][1]).toEqual(["catechism", "%catechism%", "source", null, 20, 0]);
  });
});
