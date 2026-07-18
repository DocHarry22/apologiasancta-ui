import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { engineQuestionsResponse } from "./engineFeed";

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
