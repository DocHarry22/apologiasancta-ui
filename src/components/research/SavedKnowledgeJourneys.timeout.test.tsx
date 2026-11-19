// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LEARNER_API_READ_TIMEOUT_MS } from "@/lib/fetchWithTimeout";
import SavedKnowledgeJourneys from "./SavedKnowledgeJourneys";

vi.mock("@/lib/publicEnv", () => ({ getResearchGraphUrl: () => null }));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("SavedKnowledgeJourneys deadline", () => {
  it("shows retry instead of loading forever when the journey read hangs", async () => {
    vi.useFakeTimers();
    let aborts = 0;
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        aborts += 1;
        reject(new DOMException("Aborted", "AbortError"));
      }, { once: true });
    })));

    render(<SavedKnowledgeJourneys />);
    expect(screen.getByText("Loading saved journeys…")).toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(LEARNER_API_READ_TIMEOUT_MS); });

    expect(aborts).toBe(1);
    expect(screen.getByText("Saved journeys unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });
});
