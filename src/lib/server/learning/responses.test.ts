import { describe, expect, it } from "vitest";
import { LearningApiError } from "./errors";
import { errorResponse } from "./responses";

describe("learning error responses", () => {
  it("marks service outages as non-cacheable and retryable without exposing details", async () => {
    const response = errorResponse(
      new LearningApiError("learning_service_unavailable", 503, "The learning service is temporarily unavailable."),
      "request-123",
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("retry-after")).toBe("60");
    expect(response.headers.get("x-request-id")).toBe("request-123");
    expect(await response.json()).toEqual({
      error: {
        code: "learning_service_unavailable",
        message: "The learning service is temporarily unavailable.",
      },
    });
  });

  it("does not add retry guidance to client errors", () => {
    const response = errorResponse(new LearningApiError("invalid_request", 400, "Invalid request."));

    expect(response.status).toBe(400);
    expect(response.headers.has("retry-after")).toBe(false);
  });
});
