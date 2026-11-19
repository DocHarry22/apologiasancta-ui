// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PUBLIC_ENGINE_READ_TIMEOUT_MS } from "@/lib/fetchWithTimeout";
import { WhatsNewPopup } from "./WhatsNewPopup";

vi.mock("@/lib/publicEnv", () => ({ getEngineUrl: () => "https://engine.test" }));
vi.mock("@/lib/native", () => ({ isNativePlatform: () => false }));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("WhatsNewPopup deadline", () => {
  it("aborts a hung optional release lookup without opening a dialog", async () => {
    vi.useFakeTimers();
    let aborts = 0;
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        aborts += 1;
        reject(new DOMException("Aborted", "AbortError"));
      }, { once: true });
    })));

    const view = render(<WhatsNewPopup />);
    await act(async () => { await vi.advanceTimersByTimeAsync(PUBLIC_ENGINE_READ_TIMEOUT_MS); });

    expect(aborts).toBe(1);
    expect(view.container).toBeEmptyDOMElement();
  });
});
