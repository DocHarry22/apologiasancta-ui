import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithTimeout, RequestTimeoutError } from "./fetchWithTimeout";

function pendingFetch(_input: RequestInfo | URL, init?: RequestInit) {
  return new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("fetchWithTimeout", () => {
  it("turns a hung request into a stable retryable timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(pendingFetch));

    const request = fetchWithTimeout("https://engine.test/rooms", {}, 1_000);
    const assertion = expect(request).rejects.toBeInstanceOf(RequestTimeoutError);
    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;
  });

  it("preserves caller cancellation instead of reporting it as a timeout", async () => {
    vi.stubGlobal("fetch", vi.fn(pendingFetch));
    const controller = new AbortController();
    const request = fetchWithTimeout("https://engine.test/rooms", { signal: controller.signal }, 1_000);
    controller.abort();
    await expect(request).rejects.toMatchObject({ name: "AbortError" });
  });
});
