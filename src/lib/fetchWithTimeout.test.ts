import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJsonWithTimeout, RequestTimeoutError } from "./fetchWithTimeout";

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

    const request = fetchJsonWithTimeout("https://engine.test/rooms", {}, 1_000);
    const assertion = expect(request).rejects.toBeInstanceOf(RequestTimeoutError);
    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;
  });

  it("preserves caller cancellation instead of reporting it as a timeout", async () => {
    vi.stubGlobal("fetch", vi.fn(pendingFetch));
    const controller = new AbortController();
    const request = fetchJsonWithTimeout("https://engine.test/rooms", { signal: controller.signal }, 1_000);
    controller.abort();
    await expect(request).rejects.toMatchObject({ name: "AbortError" });
  });

  it("keeps the timeout active while consuming a stalled JSON body", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => Promise.resolve({
      ok: true,
      json: () => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      }),
    } as Response)));

    const request = fetchJsonWithTimeout("https://engine.test/rooms", {}, 1_000);
    const assertion = expect(request).rejects.toBeInstanceOf(RequestTimeoutError);
    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;
  });

  it("forwards caller cancellation while consuming a JSON body", async () => {
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => Promise.resolve({
      ok: true,
      json: () => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      }),
    } as Response)));
    const controller = new AbortController();
    const request = fetchJsonWithTimeout("https://engine.test/rooms", { signal: controller.signal }, 1_000);
    controller.abort();
    await expect(request).rejects.toMatchObject({ name: "AbortError" });
  });

  it("returns unsuccessful responses without trying to parse their body", async () => {
    const json = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503, json } as unknown as Response));

    const result = await fetchJsonWithTimeout("https://engine.test/rooms", {}, 1_000);
    expect(result.ok).toBe(false);
    expect(result.response.status).toBe(503);
    expect(json).not.toHaveBeenCalled();
  });
});
