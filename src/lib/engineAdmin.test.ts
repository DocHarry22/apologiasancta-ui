import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkHealth,
  ENGINE_HEALTH_REQUEST_TIMEOUT_MS,
  type HealthResponse,
} from "./engineAdmin";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("checkHealth", () => {
  it("aborts a stalled Engine request and returns an actionable timeout", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => (
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        }, { once: true });
      })
    ));

    const request = checkHealth("https://engine.test");
    await vi.advanceTimersByTimeAsync(ENGINE_HEALTH_REQUEST_TIMEOUT_MS);

    await expect(request).resolves.toEqual({
      success: false,
      error: "Engine health check timed out. The live service may be unavailable.",
    });
    expect(fetchMock).toHaveBeenCalledWith("https://engine.test/health", expect.objectContaining({
      cache: "no-store",
      signal: expect.any(AbortSignal),
    }));
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it("preserves a configured Engine error from an unhealthy response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      error: "PostgreSQL persistence is unreachable",
    }), {
      status: 503,
      headers: { "content-type": "application/json" },
    }));

    await expect(checkHealth("https://engine.test")).resolves.toEqual({
      success: false,
      error: "PostgreSQL persistence is unreachable",
    });
  });

  it("returns healthy Engine data without waiting for the deadline", async () => {
    const health: HealthResponse = {
      ok: true,
      time: "2026-11-19T09:00:00.000Z",
      uptime: 42,
      clients: 3,
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(health), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    await expect(checkHealth("https://engine.test")).resolves.toEqual({
      success: true,
      data: health,
    });
  });
});
