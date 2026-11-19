// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LEARNER_API_READ_TIMEOUT_MS } from "@/lib/fetchWithTimeout";
import KnowledgeGapRecommendations from "./KnowledgeGapRecommendations";

vi.mock("@/lib/publicEnv", () => ({ getResearchGraphUrl: () => null }));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("KnowledgeGapRecommendations deadline", () => {
  it("aborts a hung optional recommendation read", async () => {
    vi.useFakeTimers();
    let aborts = 0;
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        aborts += 1;
        reject(new DOMException("Aborted", "AbortError"));
      }, { once: true });
    })));

    const view = render(<KnowledgeGapRecommendations />);
    await act(async () => { await vi.advanceTimersByTimeAsync(LEARNER_API_READ_TIMEOUT_MS); });

    expect(aborts).toBe(1);
    expect(view.container).toBeEmptyDOMElement();
  });
});
