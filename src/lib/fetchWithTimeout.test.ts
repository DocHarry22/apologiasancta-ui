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
    let markBodyStarted!: () => void;
    const bodyStarted = new Promise<void>((resolve) => { markBodyStarted = resolve; });
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => Promise.resolve({
      ok: true,
      json: () => new Promise((_resolve, reject) => {
        markBodyStarted();
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      }),
    } as Response)));
    const controller = new AbortController();
    const request = fetchJsonWithTimeout("https://engine.test/rooms", { signal: controller.signal }, 1_000);
    await bodyStarted;
    controller.abort();
    await expect(request).rejects.toMatchObject({ name: "AbortError" });
  });

  it("returns structured error bodies for status-specific recovery", async () => {
    const json = vi.fn().mockResolvedValue({ reason: "not_registered" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json } as unknown as Response));

    const result = await fetchJsonWithTimeout("https://engine.test/rooms", {}, 1_000);
    expect(result.ok).toBe(false);
    expect(result.response.status).toBe(401);
    expect(result.data).toEqual({ reason: "not_registered" });
    expect(json).toHaveBeenCalledOnce();
  });

  it("keeps the timeout active while consuming an unsuccessful response body", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => Promise.resolve({
      ok: false,
      status: 503,
      json: () => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      }),
    } as Response)));

    const request = fetchJsonWithTimeout("https://engine.test/rooms", {}, 1_000);
    const assertion = expect(request).rejects.toBeInstanceOf(RequestTimeoutError);
    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;
  });

  it("tolerates a non-JSON error body without hiding the response status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: vi.fn().mockRejectedValue(new SyntaxError("Unexpected token")),
    } as unknown as Response));

    const result = await fetchJsonWithTimeout("https://engine.test/rooms", {}, 1_000);
    expect(result).toMatchObject({ ok: false, response: { status: 502 } });
    expect(result.data).toBeUndefined();
  });
});
