import { afterEach, describe, expect, it, vi } from "vitest";
import {
  KNOWLEDGE_FOUNDRY_REQUEST_TIMEOUT_MS,
  advancedKnowledgeAdmin,
} from "./advancedKnowledgeAdminClient";

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

describe("advancedKnowledgeAdmin request deadlines", () => {
  it("turns a hung coverage read into a retryable result", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(pendingFetch));

    const request = advancedKnowledgeAdmin.coverage();
    await vi.advanceTimersByTimeAsync(KNOWLEDGE_FOUNDRY_REQUEST_TIMEOUT_MS);

    await expect(request).resolves.toEqual({
      ok: false,
      error: "Knowledge Foundry did not respond in time. Please retry.",
    });
  });

  it("keeps the deadline active while consuming a stalled JSON body", async () => {
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

    const request = advancedKnowledgeAdmin.proposals();
    await vi.advanceTimersByTimeAsync(KNOWLEDGE_FOUNDRY_REQUEST_TIMEOUT_MS);

    await expect(request).resolves.toEqual({
      ok: false,
      error: "Knowledge Foundry did not respond in time. Please retry.",
    });
  });

  it("warns that a timed-out proposal mutation can have an unknown outcome", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(pendingFetch));

    const request = advancedKnowledgeAdmin.createProposal({
      proposalType: "argument",
      input: { title: "A sourced proposal" },
    });
    await vi.advanceTimersByTimeAsync(KNOWLEDGE_FOUNDRY_REQUEST_TIMEOUT_MS);

    await expect(request).resolves.toEqual({
      ok: false,
      error: "The Knowledge Foundry request timed out and may still have completed. Refresh proposals before retrying.",
    });
  });

  it("clears the deadline after a successful response", async () => {
    vi.useFakeTimers();
    const payload = { proposals: [], proposalOnly: true, autoPublish: false, autoMerge: false };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    })));

    await expect(advancedKnowledgeAdmin.proposals()).resolves.toEqual({ ok: true, data: payload });
    expect(vi.getTimerCount()).toBe(0);
  });
});
