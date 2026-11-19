// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LIVE_SERVICE_REQUEST_TIMEOUT_MS, PUBLIC_ENGINE_READ_TIMEOUT_MS } from "@/lib/fetchWithTimeout";
import { useLatestRelease, useLiveRoom } from "./HomeDashboard";

const engineUrl = "https://quiz.example.test";

vi.mock("@/lib/publicEnv", () => ({
  getEngineUrl: () => engineUrl,
  getResearchGraphUrl: () => null,
}));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Home live quiz refresh", () => {
  it("tracks server phase changes, clears stale data on outage, and recovers", async () => {
    vi.useFakeTimers();
    let networkAvailable = true;
    let phase: "OPEN" | "REVEAL" = "OPEN";
    const fetchMock = vi.fn(async (request: string | URL | Request) => {
      const url = String(request);
      if (!networkAvailable) return { ok: false };
      if (url.endsWith("/rooms")) {
        return {
          ok: true,
          json: async () => ({ rooms: [{ roomId: "global", name: "Global Room", isActive: true, playerCount: 5 }] }),
        };
      }
      if (url.includes("/state?roomId=global")) {
        return {
          ok: true,
          json: async () => ({
            phase,
            endsAtMs: Date.now() + 25_000,
            questionIndex: phase === "OPEN" ? 0 : 1,
            totalQuestions: 10,
            themeTitle: "Catholic formation",
          }),
        };
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result, unmount } = renderHook(() => useLiveRoom());
    try {
      await act(async () => { await vi.advanceTimersByTimeAsync(1); });
      expect(result.current.status).toBe("ready");
      expect(result.current.state?.phase).toBe("OPEN");

      phase = "REVEAL";
      await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
      expect(result.current.state?.phase).toBe("REVEAL");

      networkAvailable = false;
      await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
      expect(result.current.status).toBe("unavailable");
      expect(result.current.state).toBeNull();
      expect(result.current.room).toBeNull();

      networkAvailable = true;
      await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
      expect(result.current.status).toBe("ready");
      expect(result.current.room?.roomId).toBe("global");
      expect(fetchMock).toHaveBeenCalledTimes(7);
    } finally {
      unmount();
    }
  });

  it("refreshes immediately when a backgrounded tab becomes visible", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (request: string | URL | Request) => {
      const url = String(request);
      if (url.endsWith("/rooms")) {
        return { ok: true, json: async () => ({ rooms: [] }) };
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");

    const { unmount } = renderHook(() => useLiveRoom());
    try {
      await act(async () => { await vi.advanceTimersByTimeAsync(1); });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      visibility.mockReturnValue("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
      await act(async () => { await vi.advanceTimersByTimeAsync(45_000); });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      visibility.mockReturnValue("visible");
      document.dispatchEvent(new Event("visibilitychange"));
      await act(async () => { await Promise.resolve(); });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      unmount();
    }
  });

  it("reports a slow cold start and clears it when the room responds", async () => {
    vi.useFakeTimers();
    let finish: (value: { ok: boolean; json: () => Promise<{ rooms: never[] }> }) => void = () => undefined;
    vi.stubGlobal("fetch", vi.fn(() => new Promise((resolve) => { finish = resolve; })));

    const { result, unmount } = renderHook(() => useLiveRoom());
    try {
      await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });
      expect(result.current.status).toBe("loading");
      expect(result.current.slow).toBe(true);

      await act(async () => { finish({ ok: true, json: async () => ({ rooms: [] }) }); await Promise.resolve(); });
      expect(result.current.status).toBe("ready");
      expect(result.current.slow).toBe(false);
    } finally {
      unmount();
    }
  });

  it("ends a hung cold start instead of leaving the live strip busy forever", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_request: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    })));

    const { result, unmount } = renderHook(() => useLiveRoom());
    try {
      await act(async () => { await vi.advanceTimersByTimeAsync(LIVE_SERVICE_REQUEST_TIMEOUT_MS); });
      expect(result.current.status).toBe("unavailable");
      expect(result.current.slow).toBe(false);
      expect(result.current.room).toBeNull();
      expect(result.current.state).toBeNull();
    } finally {
      unmount();
    }
  });
});

describe("Home release lookup", () => {
  it("ends a hung optional release lookup on the public read deadline", async () => {
    vi.useFakeTimers();
    let aborts = 0;
    vi.stubGlobal("fetch", vi.fn((_request: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        aborts += 1;
        reject(new DOMException("Aborted", "AbortError"));
      }, { once: true });
    })));

    const { result, unmount } = renderHook(() => useLatestRelease());
    try {
      await act(async () => { await vi.advanceTimersByTimeAsync(PUBLIC_ENGINE_READ_TIMEOUT_MS); });
      expect(result.current).toBeNull();
      expect(aborts).toBe(1);
    } finally {
      unmount();
    }
  });
});
