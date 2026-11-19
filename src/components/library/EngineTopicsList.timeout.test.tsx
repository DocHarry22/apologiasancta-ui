// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EngineTopicsList,
  LIBRARY_ENGINE_REQUEST_TIMEOUT_MS,
  type LibraryResource,
} from "./EngineTopicsList";

vi.mock("@/lib/publicEnv", () => ({ getEngineUrl: () => "https://engine.test" }));

const resources: LibraryResource[] = [{
  id: "creed",
  title: "The Creed",
  description: "Explore what Catholics believe.",
  href: "/library/creed",
  format: "Question collection",
  category: "Doctrine",
  era: "General",
  tags: ["faith"],
  difficulty: 1,
  questionCount: 8,
  sourceCount: 4,
  durationMinutes: 6,
}];

describe("EngineTopicsList live catalogue timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("abandons a stalled live refresh and confirms the bundled catalogue fallback", async () => {
    let requestSignal: AbortSignal | null = null;
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      requestSignal = init?.signal ?? null;
      return new Promise<Response>((_resolve, reject) => {
        requestSignal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      });
    }));

    render(<EngineTopicsList resources={resources} questionTotal={8} sourceTotal={4} />);

    expect(screen.getByRole("heading", { name: "The Creed" })).toBeInTheDocument();
    expect(screen.getByText(/Checking for updated topic counts/)).toBeInTheDocument();
    expect(requestSignal?.aborted).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(LIBRARY_ENGINE_REQUEST_TIMEOUT_MS);
    });

    expect(requestSignal?.aborted).toBe(true);
    expect(screen.getByText(/Showing bundled topic counts while live updates are unavailable/)).toBeInTheDocument();
  });
});
