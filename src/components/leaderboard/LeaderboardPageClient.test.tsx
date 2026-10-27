// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LeaderboardPageClient } from "./LeaderboardPageClient";

vi.mock("@/lib/publicEnv", () => ({ getEngineUrl: () => "https://engine.test" }));
const weekly = { topScorers: [{ rank: 1, name: "Ada", score: 1020 }, { rank: 4, name: "Maria", score: 300 }], topStreaks: [{ rank: 1, name: "James", streak: 7 }] };
const daily = { topScorers: [{ rank: 1, name: "Today’s player", score: 50 }], topStreaks: [{ rank: 1, name: "Daily streak", streak: 3 }] };
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("keeps score type and period independent and shows actual returned ranks", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ leaderboard: weekly })).mockResolvedValueOnce(Response.json(daily));
  vi.stubGlobal("fetch", fetcher);
  localStorage.setItem("playerName", "Ada");
  const user = userEvent.setup();
  render(<LeaderboardPageClient />);
  const rankings = screen.getByRole("region", { name: "Rankings" });
  await within(rankings).findByText(/^1\D?020$/);
  expect(within(rankings).getByText("4")).toBeInTheDocument();
  expect(within(rankings).getAllByRole("listitem")).toHaveLength(2);
  await user.click(screen.getByRole("button", { name: "Streaks", exact: true }));
  expect(within(rankings).getByText("James")).toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "Daily", exact: true }));
  await within(rankings).findByText("Daily streak");
  expect(screen.getByRole("button", { name: "Streaks", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(fetcher.mock.calls[1][0]).toBe("https://engine.test/leaderboard?period=daily");
  await user.click(screen.getByText("Your saved quiz name", { exact: true }));
  expect(screen.getByText(/a name match alone does not confirm your identity/)).toBeVisible();
});

it("does not replace the chosen period with an older response", async () => {
  let finishOld: (value: Response) => void = () => {};
  const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { finishOld = resolve; })).mockResolvedValueOnce(Response.json(daily));
  vi.stubGlobal("fetch", fetcher);
  render(<LeaderboardPageClient />);
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  await userEvent.setup().click(screen.getByRole("button", { name: "Daily", exact: true }));
  await screen.findByText("Today’s player");
  expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
  await act(async () => { finishOld(Response.json(weekly)); });
  expect(screen.getByText("Today’s player")).toBeInTheDocument();
  expect(screen.queryByText("Ada")).not.toBeInTheDocument();
});

it("retries a failed request and presents the empty ranking without invented results", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("", { status: 503 })).mockResolvedValueOnce(Response.json({ topScorers: [], topStreaks: [] })));
  render(<LeaderboardPageClient />);
  await userEvent.setup().click(await screen.findByRole("button", { name: "Retry", exact: true }));
  expect(await screen.findByRole("heading", { name: "No scores yet", exact: true })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Join a live room/ })).toHaveAttribute("href", "/mobile");
  expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
});
