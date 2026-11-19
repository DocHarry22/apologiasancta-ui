// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PUBLIC_ENGINE_READ_TIMEOUT_MS } from "@/lib/fetchWithTimeout";
import { EngineTopicDetails } from "./EngineTopicDetails";

vi.mock("@/lib/publicEnv", () => ({ getEngineUrl: () => "https://engine.test" }));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("EngineTopicDetails deadline", () => {
  it("leaves the loading state when the live topic request hangs", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    })));

    render(<EngineTopicDetails topicId="trinity" />);
    expect(screen.getByLabelText("Loading collection")).toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(PUBLIC_ENGINE_READ_TIMEOUT_MS); });

    expect(screen.getByRole("alert")).toHaveTextContent("Topic unavailable");
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });
});
