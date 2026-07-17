// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  readStoredPlayerIdentity,
  saveStoredAccountPlayerIdentity,
  saveStoredGuestPlayerIdentity,
  USER_ID_STORAGE_KEY,
} from "@/lib/playerIdentity";
import { useRoomRegistration } from "./useRoomRegistration";

describe("useRoomRegistration account ownership", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("clears an account token when the current signed-in session differs", async () => {
    saveStoredAccountPlayerIdentity(
      "acct_11111111-1111-4111-8111-111111111111",
      "First_User",
      "room-token.signature",
      "first-session-binding"
    );
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      sessionBinding: "second-session-binding",
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useRoomRegistration({
      engineUrl: "https://engine.test",
      roomId: "global",
    }));

    await waitFor(() => expect(result.current.isCheckingRegistration).toBe(false));
    expect(result.current.isRegistered).toBe(false);
    expect(result.current.userId).toBeNull();
    expect(readStoredPlayerIdentity()).toEqual({
      userId: null,
      username: null,
      joinToken: null,
      accountSessionBinding: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/quiz/identity");
  });

  it("resumes an account token only after the one-way session binding matches", async () => {
    saveStoredAccountPlayerIdentity(
      "acct_11111111-1111-4111-8111-111111111111",
      "Current_User",
      "room-token.signature",
      "current-session-binding"
    );
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        sessionBinding: "current-session-binding",
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        userId: "acct_11111111-1111-4111-8111-111111111111",
        username: "Current_User",
        joinToken: "refreshed-token.signature",
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useRoomRegistration({
      engineUrl: "https://engine.test",
      roomId: "global",
    }));

    await waitFor(() => expect(result.current.isRegistered).toBe(true));
    expect(result.current.userId).toBe("acct_11111111-1111-4111-8111-111111111111");
    expect(result.current.joinToken).toBe("refreshed-token.signature");
    expect(fetchMock.mock.calls[1][0]).toBe("https://engine.test/rooms/global/join");

    localStorage.clear();
    window.dispatchEvent(new StorageEvent("storage", {
      key: USER_ID_STORAGE_KEY,
      storageArea: localStorage,
    }));
    await waitFor(() => expect(result.current.isRegistered).toBe(false));
    expect(result.current.userId).toBeNull();
    expect(result.current.joinToken).toBeNull();
  });

  it("keeps guest resume independent from account-session checks", async () => {
    saveStoredGuestPlayerIdentity("guest-player", "Guest_User", "guest-token.signature");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      userId: "guest-player",
      username: "Guest_User",
      joinToken: "guest-token.signature",
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useRoomRegistration({
      engineUrl: "https://engine.test",
      roomId: "global",
    }));

    await waitFor(() => expect(result.current.isRegistered).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://engine.test/rooms/global/join");
  });
});
