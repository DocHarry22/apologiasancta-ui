// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LEARNING_PROGRESS_KEY, parseLearningProgress, recordPracticeAttempt } from "./learningProgress";
import { readLocalLearningProgress, syncLocalLearningProgress } from "./learningProgressSync";

describe("authenticated learning progress browser sync", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("syncs valid lessons and a pending event without sending a stale local lesson", async () => {
    const pending = recordPracticeAttempt(parseLearningProgress(JSON.stringify({
      completedLessonIds: ["retired-lesson", "real-presence-eucharist"],
      practiceBest: 5,
      practiceAttempts: 3,
      updatedAt: Date.parse("2026-07-16T11:00:00.000Z"),
    })), 7, {
      id: "practice_event_00000001",
      occurredAt: "2026-07-16T12:00:00.000Z",
    });
    window.localStorage.setItem(LEARNING_PROGRESS_KEY, JSON.stringify(pending));

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        progress: {
          completedLessonIds: ["peter-and-the-papacy"],
          practiceBest: 6,
          practiceAttempts: 5,
          revision: 4,
          updatedAt: "2026-07-16T12:01:00.000Z",
        },
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, csrfToken: "csrf-token" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        progress: {
          completedLessonIds: ["real-presence-eucharist", "peter-and-the-papacy"],
          practiceBest: 7,
          practiceAttempts: 6,
          revision: 5,
          updatedAt: "2026-07-16T12:02:00.000Z",
        },
        acknowledgedMutationIds: ["practice_event_00000001"],
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await syncLocalLearningProgress();

    expect(outcome.status).toBe("synced");
    expect(outcome.progress.completedLessonIds).toEqual(["retired-lesson", "real-presence-eucharist", "peter-and-the-papacy"]);
    expect(outcome.progress.practiceAttempts).toBe(6);
    expect(outcome.progress.sync.pendingPracticeAttempts).toEqual([]);
    const post = fetchMock.mock.calls[2];
    const payload = JSON.parse(String((post[1] as RequestInit).body)) as Record<string, unknown>;
    expect(payload).not.toHaveProperty("accountId");
    expect(payload).not.toHaveProperty("userId");
    expect(payload.completedLessonIds).toEqual(["real-presence-eucharist", "peter-and-the-papacy"]);
    expect(payload.completedLessonIds).not.toContain("retired-lesson");
    expect(payload.practiceAttemptsFloor).toBe(3);
    expect((post[1] as RequestInit).headers).toMatchObject({ "x-csrf-token": "csrf-token" });
  });

  it("performs only GET when local progress adds nothing to the remote snapshot", async () => {
    window.localStorage.setItem(LEARNING_PROGRESS_KEY, JSON.stringify({
      completedLessonIds: ["real-presence-eucharist"],
      practiceBest: 6,
      practiceAttempts: 5,
      // A newer local timestamp alone must not cause a write or revision bump.
      updatedAt: Date.parse("2026-07-16T12:05:00.000Z"),
      sync: {
        revision: 4,
        practiceAttemptsFloor: 3,
        pendingPracticeAttempts: [],
        lastSyncedAt: "2026-07-16T12:00:00.000Z",
      },
    }));
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      ok: true,
      progress: {
        completedLessonIds: ["real-presence-eucharist"],
        practiceBest: 6,
        practiceAttempts: 5,
        revision: 4,
        updatedAt: "2026-07-16T12:01:00.000Z",
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await syncLocalLearningProgress();

    expect(outcome.status).toBe("synced");
    expect(outcome.progress.practiceAttempts).toBe(5);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/learning/progress", expect.objectContaining({ method: "GET" }));
  });

  it("preserves stale-only local history without fetching CSRF or posting it", async () => {
    window.localStorage.setItem(LEARNING_PROGRESS_KEY, JSON.stringify({
      completedLessonIds: ["retired-lesson"],
      practiceBest: 0,
      practiceAttempts: 0,
      updatedAt: Date.parse("2026-07-16T12:05:00.000Z"),
    }));
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      ok: true,
      progress: {
        completedLessonIds: [],
        practiceBest: 0,
        practiceAttempts: 0,
        revision: 0,
        updatedAt: null,
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await syncLocalLearningProgress();

    expect(outcome.status).toBe("synced");
    expect(outcome.progress.completedLessonIds).toEqual(["retired-lesson"]);
    expect(readLocalLearningProgress().completedLessonIds).toEqual(["retired-lesson"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/learning/progress", expect.objectContaining({ method: "GET" }));
  });

  it("leaves all local data and queued events intact while offline", async () => {
    const local = recordPracticeAttempt(parseLearningProgress(null), 4, {
      id: "practice_event_00000002",
      occurredAt: "2026-07-16T12:00:00.000Z",
    });
    window.localStorage.setItem(LEARNING_PROGRESS_KEY, JSON.stringify(local));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));

    const outcome = await syncLocalLearningProgress();

    expect(outcome.status).toBe("offline");
    expect(readLocalLearningProgress().practiceAttempts).toBe(1);
    expect(readLocalLearningProgress().sync.pendingPracticeAttempts).toHaveLength(1);
  });
});
