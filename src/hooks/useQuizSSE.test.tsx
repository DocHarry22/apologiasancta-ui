// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQuizSSE } from "./useQuizSSE";
import type { QuizState } from "@/types/quiz";

class MockEventSource {
  static instances: MockEventSource[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();

  constructor(public url: string) {
    MockEventSource.instances.push(this);
  }
}

const state: QuizState = {
  phase: "OPEN",
  endsAtMs: Date.now() + 10_000,
  questionIndex: 0,
  totalQuestions: 1,
  themeTitle: "Christology",
  question: {
    text: "Who is Jesus?",
    choices: [
      { id: "A", label: "A", text: "Lord" },
      { id: "B", label: "B", text: "Only a teacher" },
      { id: "C", label: "C", text: "A symbol" },
      { id: "D", label: "D", text: "Unknown" },
    ],
  },
  leaderboard: { topScorers: [], topStreaks: [] },
};

describe("useQuizSSE", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(state)));
  });

  it("renders a waiting/disconnected state when engine is unavailable", () => {
    const { result } = renderHook(() => useQuizSSE(null));

    expect(result.current.connectionStatus).toBe("disconnected");
    expect(result.current.state).toBeNull();
  });

  it("handles normal state messages", async () => {
    const { result } = renderHook(() => useQuizSSE("https://engine.test", { userId: "u1", roomId: "room-1" }));
    const source = MockEventSource.instances[0];

    act(() => source.onopen?.());
    act(() => source.onmessage?.(new MessageEvent("message", { data: JSON.stringify(state) })));

    await waitFor(() => expect(result.current.state?.themeTitle).toBe("Christology"));
    expect(source.url).toContain("userId=u1");
    expect(source.url).toContain("roomId=room-1");
  });

  it("handles topic and answer events", async () => {
    const onTopicComplete = vi.fn();
    const onTopicStart = vi.fn();
    const onTopicCountdown = vi.fn();
    const onCongrats = vi.fn();
    const onAnswerResult = vi.fn();
    const { result } = renderHook(() =>
      useQuizSSE("https://engine.test", {
        userId: "u1",
        onTopicComplete,
        onTopicStart,
        onTopicCountdown,
        onCongrats,
        onAnswerResult,
      })
    );
    const source = MockEventSource.instances[0];

    act(() => {
      source.onmessage?.(new MessageEvent("message", { data: JSON.stringify({ type: "topicComplete", topicId: "t1" }) }));
      source.onmessage?.(new MessageEvent("message", { data: JSON.stringify({ type: "topicStart", topicId: "t2" }) }));
      source.onmessage?.(new MessageEvent("message", { data: JSON.stringify({ type: "topicCountdown", countdownSeconds: 3 }) }));
      source.onmessage?.(new MessageEvent("message", { data: JSON.stringify({ type: "congrats", topicId: "t2" }) }));
      source.onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "answerResult",
            userId: "u1",
            roomId: "room-1",
            questionIndex: 0,
            choiceId: "A",
            correctId: "A",
            isCorrect: true,
            pointsAwarded: 10,
            streak: 1,
            previousRank: null,
            newRank: 1,
            rankDelta: null,
          }),
        })
      );
    });

    expect(onTopicComplete).toHaveBeenCalled();
    expect(onTopicStart).toHaveBeenCalled();
    expect(onTopicCountdown).toHaveBeenCalled();
    expect(onCongrats).toHaveBeenCalled();
    expect(onAnswerResult).toHaveBeenCalled();
    expect(result.current.answerResultEvent?.choiceId).toBe("A");
  });

  it("reconnects after SSE error and falls back to polling after max attempts", async () => {
    vi.useFakeTimers();
    renderHook(() => useQuizSSE("https://engine.test"));

    for (let i = 0; i < 5; i++) {
      const source = MockEventSource.instances.at(-1);
      act(() => source?.onerror?.());
      if (i < 4) {
        await act(async () => {
          vi.runOnlyPendingTimers();
        });
      }
    }

    expect(fetch).toHaveBeenCalledWith("https://engine.test/state");
  });

  it("cleans up EventSource and timers on unmount", () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useQuizSSE("https://engine.test"));
    const source = MockEventSource.instances[0];

    act(() => source.onerror?.());
    unmount();

    expect(source.close).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
