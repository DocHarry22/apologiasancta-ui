// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PLAYER_NAME_KEY } from "@/components/mobile/YourScoreCard";
import { useLocalPlayer } from "./useLocalPlayer";
import type { Leaderboard } from "@/types/quiz";

describe("useLocalPlayer", () => {
  it("restores only player identity from localStorage", () => {
    localStorage.setItem(PLAYER_NAME_KEY, "Ada");
    localStorage.setItem("ENGINE_ADMIN_TOKEN", "must-not-be-read");
    const leaderboard: Leaderboard = {
      topScorers: [{ rank: 1, name: "Ada", score: 50 }],
      topStreaks: [{ rank: 1, name: "Ada", streak: 3 }],
    };

    const { result } = renderHook(() => useLocalPlayer(leaderboard, "OPEN"));

    expect(result.current.playerName).toBe("Ada");
    expect(result.current.totalPoints).toBe(50);
    expect(result.current.streak).toBe(3);
  });
});
