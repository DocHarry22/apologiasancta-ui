// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { isAccountPlayerSessionCurrent, requestAccountPlayerIdentity } from "./accountPlayerIdentity";
import {
  bumpAuthSessionEpoch,
  readStoredPlayerIdentity,
  runWithStoredAccountSessionBoundary,
  saveStoredAccountPlayerIdentity,
} from "./playerIdentity";

describe("account player identity client", () => {
  beforeEach(() => localStorage.clear());

  it("returns only the ordinary room credential for an authenticated account", async () => {
    const sessionBinding = "a".repeat(43);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: "csrf-token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        userId: "acct_123",
        username: "Thomas_A",
        joinToken: "normal-room-token",
        sessionBinding,
      }), { status: 200 }));

    const result = await requestAccountPlayerIdentity(
      { roomId: "global", displayName: "Thomas_A" },
      fetchMock as unknown as typeof fetch
    );

    expect(result).toEqual({
      kind: "joined",
      userId: "acct_123",
      username: "Thomas_A",
      joinToken: "normal-room-token",
      sessionBinding,
    });
    const identityRequest = fetchMock.mock.calls[1][1] as RequestInit;
    expect(identityRequest.body).toBe(JSON.stringify({ roomId: "global", displayName: "Thomas_A" }));
    expect(identityRequest.body).not.toContain("assertion");
    expect(identityRequest.headers).toEqual(expect.objectContaining({ "x-csrf-token": "csrf-token" }));
  });

  it.each([401, 404, 502, 503])("preserves guest registration when identity returns %i", async (status) => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: "csrf-token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "unavailable" }), { status }));

    await expect(requestAccountPlayerIdentity(
      { roomId: "global", displayName: "Thomas_A" },
      fetchMock as unknown as typeof fetch
    )).resolves.toEqual({ kind: "guest_fallback" });
  });

  it("preserves guest registration for signed-out users", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 401 }));
    await expect(requestAccountPlayerIdentity(
      { roomId: "global", displayName: "Thomas_A" },
      fetchMock as unknown as typeof fetch
    )).resolves.toEqual({ kind: "guest_fallback" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces conflicts instead of silently creating a second identity", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: "csrf-token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "That public display name is already in use." }), { status: 409 }));

    await expect(requestAccountPlayerIdentity(
      { roomId: "global", displayName: "Thomas_A" },
      fetchMock as unknown as typeof fetch
    )).resolves.toEqual({ kind: "error", message: "That public display name is already in use." });
  });

  it("falls back for a legacy room ID that the signed Engine contract cannot represent", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: "csrf-token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        code: "account_identity_room_unsupported",
        error: "legacy room",
      }), { status: 422 }));

    await expect(requestAccountPlayerIdentity(
      { roomId: "RCIA_1", displayName: "Thomas_A" },
      fetchMock as unknown as typeof fetch
    )).resolves.toEqual({ kind: "guest_fallback" });
  });

  it("rejects a first account token that resolves after a cross-tab auth transition", async () => {
    const sessionBinding = "b".repeat(43);
    let resolveIdentity!: (response: Response) => void;
    const deferredIdentity = new Promise<Response>((resolve) => { resolveIdentity = resolve; });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: "csrf-token" }), { status: 200 }))
      .mockReturnValueOnce(deferredIdentity);

    const pending = requestAccountPlayerIdentity(
      { roomId: "global", displayName: "Thomas_A" },
      fetchMock as unknown as typeof fetch
    );
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(readStoredPlayerIdentity().userId).toBeNull();

    // Another tab completes logout/account switching while the first account
    // identity response is still in flight. No pre-existing token is needed
    // for the epoch change to invalidate that late response.
    bumpAuthSessionEpoch();
    resolveIdentity(new Response(JSON.stringify({
      ok: true,
      userId: "acct_11111111-1111-4111-8111-111111111111",
      username: "Thomas_A",
      joinToken: "normal-room-token.signature",
      sessionBinding,
    }), { status: 200 }));

    await expect(pending).resolves.toEqual({
      kind: "error",
      message: "Your account session changed while joining. Try again.",
    });
    expect(readStoredPlayerIdentity()).toEqual({
      userId: null,
      username: null,
      joinToken: null,
      accountSessionBinding: null,
    });
  });

  it("does not let a stale response erase a newer credential with the same binding", async () => {
    const sessionBinding = "c".repeat(43);
    let resolveStaleIdentity!: (response: Response) => void;
    const deferredStaleIdentity = new Promise<Response>((resolve) => { resolveStaleIdentity = resolve; });
    const staleFetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: "csrf-token" }), { status: 200 }))
      .mockReturnValueOnce(deferredStaleIdentity);
    const staleRequest = requestAccountPlayerIdentity(
      { roomId: "global", displayName: "Thomas_A" },
      staleFetch as unknown as typeof fetch
    );
    await vi.waitFor(() => expect(staleFetch).toHaveBeenCalledTimes(2));

    bumpAuthSessionEpoch();
    const freshFetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: "fresh-csrf-token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        userId: "acct_11111111-1111-4111-8111-111111111111",
        username: "Thomas_A",
        joinToken: "fresh-room-token.signature",
        sessionBinding,
      }), { status: 200 }));
    const freshResult = await requestAccountPlayerIdentity(
      { roomId: "global", displayName: "Thomas_A" },
      freshFetch as unknown as typeof fetch
    );
    expect(freshResult.kind).toBe("joined");
    if (freshResult.kind !== "joined") throw new Error("Fresh identity fixture did not join");
    saveStoredAccountPlayerIdentity(
      freshResult.userId,
      freshResult.username,
      freshResult.joinToken,
      freshResult.sessionBinding
    );

    resolveStaleIdentity(new Response(JSON.stringify({
      ok: true,
      userId: "acct_11111111-1111-4111-8111-111111111111",
      username: "Thomas_A",
      joinToken: "stale-room-token.signature",
      sessionBinding,
    }), { status: 200 }));

    await expect(staleRequest).resolves.toEqual({
      kind: "error",
      message: "Your account session changed while joining. Try again.",
    });
    expect(readStoredPlayerIdentity()).toEqual({
      userId: "acct_11111111-1111-4111-8111-111111111111",
      username: "Thomas_A",
      joinToken: "fresh-room-token.signature",
      accountSessionBinding: sessionBinding,
    });
  });

  it("rejects an exchange started inside an in-flight auth transition", async () => {
    const sessionBinding = "d".repeat(43);
    let completeAuthTransition!: () => void;
    const authTransition = runWithStoredAccountSessionBoundary(() => new Promise<void>((resolve) => {
      completeAuthTransition = resolve;
    }));

    let resolveIdentity!: (response: Response) => void;
    const deferredIdentity = new Promise<Response>((resolve) => { resolveIdentity = resolve; });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: "csrf-token" }), { status: 200 }))
      .mockReturnValueOnce(deferredIdentity);
    const identityRequest = requestAccountPlayerIdentity(
      { roomId: "global", displayName: "Thomas_A" },
      fetchMock as unknown as typeof fetch
    );
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    // The exchange captured the epoch after the transition's pre-dispatch
    // invalidation. Completion must bump it a second time before this old-cookie
    // response is allowed to reach the persistence boundary.
    completeAuthTransition();
    await authTransition;
    resolveIdentity(new Response(JSON.stringify({
      ok: true,
      userId: "acct_11111111-1111-4111-8111-111111111111",
      username: "Thomas_A",
      joinToken: "transition-window-token.signature",
      sessionBinding,
    }), { status: 200 }));

    await expect(identityRequest).resolves.toEqual({
      kind: "error",
      message: "Your account session changed while joining. Try again.",
    });
    expect(readStoredPlayerIdentity().userId).toBeNull();
  });

  it("validates a stored account credential against the current browser session", async () => {
    const matchingFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      sessionBinding: "current-session-binding",
    }), { status: 200 }));
    const switchedFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      sessionBinding: "different-session-binding",
    }), { status: 200 }));

    await expect(isAccountPlayerSessionCurrent(
      "current-session-binding",
      matchingFetch as unknown as typeof fetch
    )).resolves.toBe(true);
    await expect(isAccountPlayerSessionCurrent(
      "current-session-binding",
      switchedFetch as unknown as typeof fetch
    )).resolves.toBe(false);
    expect(matchingFetch).toHaveBeenCalledWith("/api/quiz/identity", expect.objectContaining({
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    }));
  });
});
