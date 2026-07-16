// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LEARNING_PROGRESS_KEY, parseLearningProgress, recordPracticeAttempt } from "./learningProgress";
import {
  LEARNING_PROGRESS_ACCOUNT_KEY_PREFIX,
  activateLearningProgressAccountScope,
  detachLearningProgressAccount,
  readLocalLearningProgress,
  syncLocalLearningProgress,
  writeLocalLearningProgress,
} from "./learningProgressSync";

const ACCOUNT_A_SCOPE = "account_scope_A_0001";
const ACCOUNT_B_SCOPE = "account_scope_B_0001";
const SERVER_TIME = "2026-07-16T12:00:00.000Z";

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
        accountScope: ACCOUNT_A_SCOPE,
        serverTime: SERVER_TIME,
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
        accountScope: ACCOUNT_A_SCOPE,
        serverTime: "2026-07-16T12:02:00.000Z",
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
    expect(payload).not.toHaveProperty("accountScope");
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
      accountScope: ACCOUNT_A_SCOPE,
      serverTime: SERVER_TIME,
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
      accountScope: ACCOUNT_A_SCOPE,
      serverTime: SERVER_TIME,
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

  it("archives account A before activating account B, then detaches to anonymous on logout", async () => {
    writeLocalLearningProgress(parseLearningProgress(JSON.stringify({
      completedLessonIds: ["real-presence-eucharist"],
      practiceBest: 0,
      practiceAttempts: 0,
      updatedAt: Date.parse("2026-07-16T11:50:00.000Z"),
    })));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        accountScope: ACCOUNT_A_SCOPE,
        serverTime: SERVER_TIME,
        progress: { completedLessonIds: [], practiceBest: 0, practiceAttempts: 0, revision: 0, updatedAt: null },
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, csrfToken: "csrf-token" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        accountScope: ACCOUNT_A_SCOPE,
        serverTime: "2026-07-16T12:01:00.000Z",
        progress: {
          completedLessonIds: ["real-presence-eucharist"],
          practiceBest: 0,
          practiceAttempts: 0,
          revision: 1,
          updatedAt: "2026-07-16T12:01:00.000Z",
        },
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const accountA = await syncLocalLearningProgress();
    expect(accountA.progress.sync.accountScope).toBe(ACCOUNT_A_SCOPE);
    expect(accountA.progress.completedLessonIds).toContain("real-presence-eucharist");

    const activatedB = activateLearningProgressAccountScope(ACCOUNT_B_SCOPE);
    expect(activatedB.sync.accountScope).toBe(ACCOUNT_B_SCOPE);
    expect(activatedB.completedLessonIds).toEqual([]);

    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      ok: true,
      accountScope: ACCOUNT_B_SCOPE,
      serverTime: "2026-07-16T12:02:00.000Z",
      progress: { completedLessonIds: [], practiceBest: 0, practiceAttempts: 0, revision: 0, updatedAt: null },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const accountB = await syncLocalLearningProgress();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(accountB.progress.sync.accountScope).toBe(ACCOUNT_B_SCOPE);
    expect(accountB.progress.completedLessonIds).toEqual([]);
    const archivedA = parseLearningProgress(window.localStorage.getItem(`${LEARNING_PROGRESS_ACCOUNT_KEY_PREFIX}${ACCOUNT_A_SCOPE}`));
    expect(archivedA.completedLessonIds).toContain("real-presence-eucharist");

    detachLearningProgressAccount();
    expect(readLocalLearningProgress().sync.accountScope).toBeNull();
    expect(readLocalLearningProgress().completedLessonIds).toEqual([]);
    expect(parseLearningProgress(window.localStorage.getItem(`${LEARNING_PROGRESS_ACCOUNT_KEY_PREFIX}${ACCOUNT_B_SCOPE}`)).sync.accountScope).toBe(ACCOUNT_B_SCOPE);
  });

  it("does not let an in-flight account A response overwrite a newly activated account B", async () => {
    activateLearningProgressAccountScope(ACCOUNT_A_SCOPE);
    writeLocalLearningProgress({
      ...readLocalLearningProgress(),
      completedLessonIds: ["real-presence-eucharist"],
      updatedAt: Date.parse("2026-07-16T11:50:00.000Z"),
    });

    let resolveAccountA: ((response: Response) => void) | undefined;
    const accountAResponse = new Promise<Response>((resolve) => {
      resolveAccountA = resolve;
    });
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => accountAResponse)
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        accountScope: ACCOUNT_B_SCOPE,
        serverTime: SERVER_TIME,
        progress: { completedLessonIds: [], practiceBest: 0, practiceAttempts: 0, revision: 0, updatedAt: null },
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const staleAccountASync = syncLocalLearningProgress();
    const accountB = activateLearningProgressAccountScope(ACCOUNT_B_SCOPE);
    expect(accountB.completedLessonIds).toEqual([]);
    const freshAccountBSync = syncLocalLearningProgress();

    resolveAccountA?.(new Response(JSON.stringify({
      ok: true,
      accountScope: ACCOUNT_A_SCOPE,
      serverTime: SERVER_TIME,
      progress: {
        completedLessonIds: ["real-presence-eucharist"],
        practiceBest: 0,
        practiceAttempts: 0,
        revision: 1,
        updatedAt: SERVER_TIME,
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const [staleOutcome, freshOutcome] = await Promise.all([staleAccountASync, freshAccountBSync]);
    expect(staleOutcome.status).toBe("local_only");
    expect(freshOutcome.status).toBe("synced");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(readLocalLearningProgress().sync.accountScope).toBe(ACCOUNT_B_SCOPE);
    expect(readLocalLearningProgress().completedLessonIds).toEqual([]);
    expect(parseLearningProgress(window.localStorage.getItem(`${LEARNING_PROGRESS_ACCOUNT_KEY_PREFIX}${ACCOUNT_A_SCOPE}`)).completedLessonIds)
      .toContain("real-presence-eucharist");
  });

  it("observes a cross-tab account-scope change in localStorage before applying a stale response", async () => {
    activateLearningProgressAccountScope(ACCOUNT_A_SCOPE);
    let resolveAccountA: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn().mockImplementationOnce(() => new Promise<Response>((resolve) => {
      resolveAccountA = resolve;
    }));
    vi.stubGlobal("fetch", fetchMock);

    const staleAccountASync = syncLocalLearningProgress();
    // A second tab has its own module generation, but localStorage is shared.
    // Simulate that tab activating B without touching this tab's generation.
    window.localStorage.setItem(LEARNING_PROGRESS_KEY, JSON.stringify({
      ...parseLearningProgress(null),
      sync: { ...parseLearningProgress(null).sync, accountScope: ACCOUNT_B_SCOPE },
    }));
    resolveAccountA?.(new Response(JSON.stringify({
      ok: true,
      accountScope: ACCOUNT_A_SCOPE,
      serverTime: SERVER_TIME,
      progress: {
        completedLessonIds: ["real-presence-eucharist"],
        practiceBest: 0,
        practiceAttempts: 0,
        revision: 1,
        updatedAt: SERVER_TIME,
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const outcome = await staleAccountASync;
    expect(outcome.status).toBe("local_only");
    expect(readLocalLearningProgress().sync.accountScope).toBe(ACCOUNT_B_SCOPE);
    expect(readLocalLearningProgress().completedLessonIds).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("clamps future browser timestamps for the server and clears the acknowledged event", async () => {
    const future = "2099-01-01T00:00:00.000Z";
    writeLocalLearningProgress({
      ...recordPracticeAttempt(parseLearningProgress(null), 4, {
        id: "practice_event_future_001",
        occurredAt: future,
      }),
      updatedAt: Date.parse(future),
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        accountScope: ACCOUNT_A_SCOPE,
        serverTime: SERVER_TIME,
        progress: { completedLessonIds: [], practiceBest: 0, practiceAttempts: 0, revision: 0, updatedAt: null },
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, csrfToken: "csrf-token" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        accountScope: ACCOUNT_A_SCOPE,
        serverTime: "2026-07-16T12:01:00.000Z",
        progress: {
          completedLessonIds: [],
          practiceBest: 4,
          practiceAttempts: 1,
          revision: 1,
          updatedAt: "2026-07-16T12:01:00.000Z",
        },
        acknowledgedMutationIds: ["practice_event_future_001"],
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await syncLocalLearningProgress();
    const payload = JSON.parse(String((fetchMock.mock.calls[2][1] as RequestInit).body)) as {
      clientUpdatedAt: string;
      practiceAttempts: Array<{ occurredAt: string }>;
    };

    expect(payload.clientUpdatedAt).toBe(SERVER_TIME);
    expect(payload.practiceAttempts[0].occurredAt).toBe(SERVER_TIME);
    expect(outcome.status).toBe("synced");
    expect(outcome.progress.sync.pendingPracticeAttempts).toEqual([]);
    expect(outcome.progress.practiceAttempts).toBe(1);
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
