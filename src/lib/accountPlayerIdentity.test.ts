import { describe, expect, it, vi } from "vitest";
import { isAccountPlayerSessionCurrent, requestAccountPlayerIdentity } from "./accountPlayerIdentity";

describe("account player identity client", () => {
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
