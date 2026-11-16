// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useVisiblePolling } from "./useVisiblePolling";

describe("useVisiblePolling", () => {
  let visibility: DocumentVisibilityState;

  beforeEach(() => {
    vi.useFakeTimers();
    visibility = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("suppresses hidden ticks and refreshes immediately on foreground", () => {
    const callback = vi.fn();
    const { unmount } = renderHook(() => useVisiblePolling(callback, 1_000));

    expect(callback).toHaveBeenCalledTimes(1);

    visibility = "hidden";
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      vi.advanceTimersByTime(5_000);
    });
    expect(callback).toHaveBeenCalledTimes(1);

    visibility = "visible";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(callback).toHaveBeenCalledTimes(2);

    act(() => vi.advanceTimersByTime(1_000));
    expect(callback).toHaveBeenCalledTimes(3);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not install polling while disabled", () => {
    const callback = vi.fn();
    renderHook(() => useVisiblePolling(callback, 1_000, { enabled: false }));

    act(() => vi.advanceTimersByTime(5_000));
    expect(callback).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
