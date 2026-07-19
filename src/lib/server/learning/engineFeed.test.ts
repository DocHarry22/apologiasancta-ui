import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { buildEngineFeed, engineQuestionsResponse } from "./engineFeed";

const originalToken = process.env.CONTENT_API_TOKEN;

describe("engine feed authentication", () => {
  afterEach(() => {
    if (originalToken === undefined) delete process.env.CONTENT_API_TOKEN;
    else process.env.CONTENT_API_TOKEN = originalToken;
  });

  it("rejects bearer requests when the configured token is shorter than 32 characters", async () => {
    process.env.CONTENT_API_TOKEN = "short-token";
    await expect(engineQuestionsResponse(new NextRequest("http://localhost/api/v1/engine/questions", {
      headers: { authorization: "Bearer short-token" },
    }))).rejects.toMatchObject({ code: "engine_feed_unavailable", status: 503 });
  });

  it("rejects documented placeholder credentials even when they are long enough", async () => {
    process.env.CONTENT_API_TOKEN = "replace-with-at-least-32-random-bytes";
    await expect(engineQuestionsResponse(new NextRequest("http://localhost/api/v1/engine/questions", {
      headers: { authorization: "Bearer replace-with-at-least-32-random-bytes" },
    }))).rejects.toMatchObject({ code: "engine_feed_unavailable", status: 503 });
  });

  it("rejects a wrong bearer token without querying content", async () => {
    process.env.CONTENT_API_TOKEN = "a".repeat(32);
    const response = await engineQuestionsResponse(new NextRequest("http://localhost/api/v1/engine/questions", {
      headers: { authorization: `Bearer ${"b".repeat(32)}` },
    }));
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({ error: { code: "unauthorized" } });
  });
});


function governedRow(overrides: Record<string, unknown> = {}) {
  const optionIds = [
    "10000000-0000-4000-8000-000000000001",
    "10000000-0000-4000-8000-000000000002",
    "10000000-0000-4000-8000-000000000003",
    "10000000-0000-4000-8000-000000000004",
  ];
  return {
    question_id: "20000000-0000-4000-8000-000000000001",
    subject_id: "30000000-0000-4000-8000-000000000001",
    group_id: "40000000-0000-4000-8000-000000000001",
    lesson_id: "50000000-0000-4000-8000-000000000001",
    objective_id: "60000000-0000-4000-8000-000000000001",
    version: 1,
    stable_key: "phase2_minimal",
    difficulty: 2,
    difficulty_mode: "medium",
    trick_category: null,
    equivalence_key: "eucharist.presence.1",
    question_type: "single_choice",
    prompt: { text: "Which answer best states the taught distinction?" },
    correct_answer_explanation: { text: "The first option states the taught distinction precisely." },
    denomination_scope: {},
    rights_metadata: { permissionStatus: "public_domain" },
    quality_flags: {},
    governance_stage: "publication",
    governance_validated: true,
    sources: [{
      authority_category: "catechism",
      locator: "CCC 1374",
      citation: "Catechism of the Catholic Church, 1374",
      permission_status: "permission_not_required_under_recorded_terms",
    }],
    options: optionIds.map((option_id, index) => ({
      option_id,
      position: index + 1,
      label: String.fromCharCode(65 + index),
      content: { text: `Option ${index + 1}` },
      is_correct: index === 0,
      explanation: { text: `Explanation ${index + 1}` },
      misconception_code: index === 0 ? null : `M${index}`,
    })),
    updated_at: "2026-07-19T00:00:00.000Z",
    ...overrides,
  };
}

describe("engine feed Phase 2 governance", () => {
  it("exports only a complete governed single-answer question contract", () => {
    const feed = buildEngineFeed([governedRow()]);
    expect(feed.questions[0]).toMatchObject({
      questionType: "single_choice",
      difficultyMode: "medium",
      equivalenceKey: "eucharist.presence.1",
      governanceValidated: true,
    });
    expect(Object.keys(feed.questions[0].optionExplanations)).toHaveLength(4);
    expect(Object.keys(feed.questions[0].optionMisconceptionCodes)).toHaveLength(3);
  });

  it("fails closed when a prohibited assessment-quality flag remains", () => {
    expect(() => buildEngineFeed([governedRow({ quality_flags: { ambiguous: true } })]))
      .toThrowError(/canonical question feed/i);
  });
});
