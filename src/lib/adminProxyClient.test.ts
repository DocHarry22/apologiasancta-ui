import { afterEach, describe, expect, it, vi } from "vitest";
import { ADMIN_PROXY_REQUEST_TIMEOUT_MS, adminProxy, roomProxy } from "./adminProxyClient";

function pendingFetch(_input: RequestInfo | URL, init?: RequestInit) {
  return new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener(
      "abort",
      () => reject(new DOMException("Aborted", "AbortError")),
      { once: true },
    );
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("adminProxyClient request deadlines", () => {
  it("turns a hung admin status read into a retryable result", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(pendingFetch));

    const request = adminProxy.status();
    await vi.advanceTimersByTimeAsync(ADMIN_PROXY_REQUEST_TIMEOUT_MS);

    await expect(request).resolves.toEqual({
      success: false,
      error: "Admin data did not respond in time. Please retry.",
    });
  });

  it("keeps the deadline active while consuming a stalled response body", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => Promise.resolve({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      }),
    } as Response)));

    const request = adminProxy.status();
    await vi.advanceTimersByTimeAsync(ADMIN_PROXY_REQUEST_TIMEOUT_MS);

    await expect(request).resolves.toEqual({
      success: false,
      error: "Admin data did not respond in time. Please retry.",
    });
  });

  it("warns that a timed-out mutation can have an unknown outcome", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(pendingFetch));

    const request = roomProxy.create("Sunday study");
    await vi.advanceTimersByTimeAsync(ADMIN_PROXY_REQUEST_TIMEOUT_MS);

    await expect(request).resolves.toEqual({
      success: false,
      error: "The admin request timed out and may still have completed. Refresh status before retrying.",
    });
  });

  it("clears the request deadline after a successful response", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ running: false }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })));

    await expect(adminProxy.status()).resolves.toEqual({
      success: true,
      data: { running: false },
    });
    expect(vi.getTimerCount()).toBe(0);
  });
});
