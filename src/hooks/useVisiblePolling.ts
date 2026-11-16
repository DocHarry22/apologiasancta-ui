"use client";

import { useEffect, useRef } from "react";

type PollCallback = () => void | Promise<void>;

interface VisiblePollingOptions {
  enabled?: boolean;
  immediate?: boolean;
  refreshKey?: unknown;
}

/**
 * Runs a polling callback only while the document can be seen. Returning to
 * the foreground triggers an immediate refresh so hidden tabs do not need to
 * wait for the next interval tick.
 */
export function useVisiblePolling(
  callback: PollCallback,
  intervalMs: number,
  options: VisiblePollingOptions = {},
) {
  const callbackRef = useRef(callback);
  const { enabled = true, immediate = true, refreshKey } = options;

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    const pollWhenVisible = () => {
      if (typeof document === "undefined" || document.visibilityState !== "hidden") {
        void callbackRef.current();
      }
    };

    if (immediate) pollWhenVisible();
    const intervalId = window.setInterval(pollWhenVisible, intervalMs);
    document.addEventListener("visibilitychange", pollWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", pollWhenVisible);
    };
  }, [enabled, immediate, intervalMs, refreshKey]);
}
