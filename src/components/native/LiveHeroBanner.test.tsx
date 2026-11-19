// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PUBLIC_ENGINE_READ_TIMEOUT_MS } from "@/lib/fetchWithTimeout";
import { LiveHeroBanner } from "./LiveHeroBanner";

vi.mock("@/hooks/useQuizEntryGate", () => ({
  useQuizEntryGate: () => ({ requestQuizEntry: vi.fn(), onboardingModals: null }),
}));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("LiveHeroBanner", () => {
  it("shows the offline fallback after a bounded Engine check", async () => {
    vi.useFakeTimers();
    let aborts = 0;
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        aborts += 1;
        reject(new DOMException("Aborted", "AbortError"));
      }, { once: true });
    })));

    render(<LiveHeroBanner engineUrl="https://engine.test" />);
    expect(screen.getByText("Checking…")).toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(PUBLIC_ENGINE_READ_TIMEOUT_MS); });

    expect(screen.getByText("Upcoming")).toBeInTheDocument();
    expect(aborts).toBe(1);
  });

  it("does not overlap foreground refreshes while a request is in flight", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));
    render(<LiveHeroBanner engineUrl="https://engine.test" />);

    act(() => document.dispatchEvent(new Event("visibilitychange")));

    expect(fetch).toHaveBeenCalledOnce();
  });
});
