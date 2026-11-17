// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JoinGameModal } from "./JoinGameModal";

vi.mock("@/lib/publicEnv", () => ({ getEngineUrl: () => "https://engine.test" }));
vi.mock("@/lib/accountPlayerIdentity", () => ({
  requestAccountPlayerIdentity: vi.fn().mockResolvedValue({ kind: "guest_fallback" }),
}));

describe("JoinGameModal request recovery", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    })));
  });

  it("restores retry controls when guest registration times out", async () => {
    render(<JoinGameModal roomId="parish" onJoined={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Safe display name"), { target: { value: "Aquinas" } });
    fireEvent.submit(screen.getByRole("button", { name: "Join game" }).closest("form")!);

    expect(screen.getByRole("button", { name: "Joining securely…" })).toBeDisabled();
    await act(async () => { await Promise.resolve(); });
    expect(fetch).toHaveBeenCalledOnce();
    await act(async () => vi.advanceTimersByTime(45_000));

    expect(screen.getByRole("alert")).toHaveTextContent("The live service did not respond in time. Please retry.");
    expect(screen.getByRole("button", { name: "Join game" })).toBeEnabled();
  });
});
