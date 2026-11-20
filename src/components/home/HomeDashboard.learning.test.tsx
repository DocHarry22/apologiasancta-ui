// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeDashboard } from "./HomeDashboard";

vi.mock("@/lib/publicEnv", () => ({
  getEngineUrl: () => null,
  isEngineConfigured: () => false,
  getAndroidApkUrl: () => null,
  getResearchGraphUrl: () => null,
}));

vi.mock("@/hooks/useStreak", () => ({
  useStreak: () => ({ streak: 0, isNewDay: false }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/home/InstallActions", () => ({
  InstallActions: () => null,
}));

const dailyVerse = {
  reference: "Luke 24:45",
  text: "Then he opened their minds so they could understand the Scriptures.",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("Home learning availability", () => {
  it("does not describe an unreachable catalogue as ready or empty", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({ error: { code: "learning_service_unavailable" } }),
    })));

    render(<HomeDashboard userName={null} topics={[{
      id: "christology",
      title: "Christology",
      description: "Study the person of Christ.",
      questionCount: 23,
      tags: ["Jesus"],
    }]} dailyVerse={dailyVerse} />);

    expect(await screen.findAllByText("Learning paths are temporarily unavailable.")).not.toHaveLength(0);
    expect(screen.queryByText("No published learning groups yet.")).not.toBeInTheDocument();
    expect(screen.queryByText("The database-driven catalogue is ready for reviewed content.")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Explore sourced library" }).every(
      (link) => link.getAttribute("href") === "/library",
    )).toBe(true);
    expect(screen.getByRole("link", { name: /Sourced library Christology 23 sourced questions/i })).toHaveAttribute("href", "/library/christology");
  });

  it("reserves the empty-state readiness message for a successful empty response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    })));

    render(<HomeDashboard userName={null} topics={[]} dailyVerse={dailyVerse} />);

    expect(await screen.findByText("No published learning groups yet.")).toBeInTheDocument();
    expect(screen.getByText("The database-driven catalogue is ready for reviewed content.")).toBeInTheDocument();
    expect(screen.queryByText("Learning paths are temporarily unavailable.")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore the sourced library" })).toHaveAttribute("href", "/library");
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });
});
