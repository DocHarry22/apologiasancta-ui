// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLiveRoom } from "./HomeDashboard";

const engineUrl = "https://quiz.example.test";

vi.mock("@/lib/publicEnv", () => ({
  getEngineUrl: () => engineUrl,
  getResearchGraphUrl: () => null,
}));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Home live quiz refresh", () => {
  it("refreshes the server-owned phase, clears stale data on outage, and recovers", async () => {
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
});
