// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LIVE_SERVICE_COLD_START_RETRY_TIMEOUT_MS, LIVE_SERVICE_REQUEST_TIMEOUT_MS } from "@/lib/fetchWithTimeout";
import { RoomSelectionModal } from "./RoomSelectionModal";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("turns a hung room lookup into a clear retry path", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn((_request: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  })));

  render(<RoomSelectionModal engineUrl="https://engine.test" onSelected={vi.fn()} />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading available rooms");
  await act(async () => { await vi.advanceTimersByTimeAsync(LIVE_SERVICE_REQUEST_TIMEOUT_MS + LIVE_SERVICE_COLD_START_RETRY_TIMEOUT_MS); });
  expect(screen.getByText(/did not respond in time/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
});
