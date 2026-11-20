import { afterEach, describe, expect, it, vi } from "vitest";
import { RequestTimeoutError } from "./fetchWithTimeout";
import {
  fetchFirstPartyJson,
  fetchFirstPartyResponse,
  FIRST_PARTY_REQUEST_TIMEOUT_MS,
} from "./firstPartyRequest";

function pendingFetch(_input: RequestInfo | URL, init?: RequestInit) {
  return new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("first-party browser request deadline", () => {
  it("aborts a stalled authenticated mutation", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(pendingFetch));

    const request = fetchFirstPartyResponse("/api/auth/logout", { method: "POST" });
    const assertion = expect(request).rejects.toBeInstanceOf(RequestTimeoutError);
    await vi.advanceTimersByTimeAsync(FIRST_PARTY_REQUEST_TIMEOUT_MS);
    await assertion;
  });

  it("keeps the deadline active while an editorial response body stalls", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => Promise.resolve({
      ok: true,
      json: () => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      }),
    } as Response)));

    const request = fetchFirstPartyJson("/api/v1/admin/learning/lessons");
    const assertion = expect(request).rejects.toBeInstanceOf(RequestTimeoutError);
    await vi.advanceTimersByTimeAsync(FIRST_PARTY_REQUEST_TIMEOUT_MS);
    await assertion;
  });
});
