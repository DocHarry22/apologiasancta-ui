// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  ACCOUNT_SESSION_BINDING_STORAGE_KEY,
  clearStoredAccountPlayerIdentity,
  isStoredAccountPlayerIdentity,
  readStoredPlayerIdentity,
  saveStoredAccountPlayerIdentity,
  saveStoredGuestPlayerIdentity,
  USER_ID_STORAGE_KEY,
  USERNAME_STORAGE_KEY,
  JOIN_TOKEN_STORAGE_KEY,
} from "./playerIdentity";

describe("stored live-player identity ownership", () => {
  beforeEach(() => localStorage.clear());

  it("stores account credentials with only a one-way session binding", () => {
    saveStoredAccountPlayerIdentity(
      "acct_11111111-1111-4111-8111-111111111111",
      "Thomas_A",
      "room-token.signature",
      "one-way-session-binding"
    );

    expect(readStoredPlayerIdentity()).toEqual({
      userId: "acct_11111111-1111-4111-8111-111111111111",
      username: "Thomas_A",
      joinToken: "room-token.signature",
      accountSessionBinding: "one-way-session-binding",
    });
    expect(JSON.stringify(localStorage)).not.toContain("author_session");
  });

  it("removes account metadata when a guest identity replaces it", () => {
    saveStoredAccountPlayerIdentity("acct_old", "Old_Name", "old.token", "old-binding");
    saveStoredGuestPlayerIdentity("guest-player", "Guest_Name", "guest.token");

    expect(readStoredPlayerIdentity()).toEqual({
      userId: "guest-player",
      username: "Guest_Name",
      joinToken: "guest.token",
      accountSessionBinding: null,
    });
  });

  it("migrates an unbound first-release account token as account-scoped", () => {
    localStorage.setItem(USER_ID_STORAGE_KEY, "acct_11111111-1111-4111-8111-111111111111");
    localStorage.setItem(USERNAME_STORAGE_KEY, "Legacy_Account");
    localStorage.setItem(JOIN_TOKEN_STORAGE_KEY, "legacy.token");

    expect(isStoredAccountPlayerIdentity(readStoredPlayerIdentity())).toBe(true);
    expect(clearStoredAccountPlayerIdentity()).toBe(true);
    expect(localStorage.getItem(USER_ID_STORAGE_KEY)).toBeNull();
  });

  it("clears account credentials on logout without deleting a guest identity", () => {
    saveStoredGuestPlayerIdentity("guest-player", "Guest_Name", "guest.token");
    expect(clearStoredAccountPlayerIdentity()).toBe(false);
    expect(localStorage.getItem(USER_ID_STORAGE_KEY)).toBe("guest-player");

    localStorage.setItem(ACCOUNT_SESSION_BINDING_STORAGE_KEY, "account-binding");
    expect(clearStoredAccountPlayerIdentity()).toBe(true);
    expect(localStorage.getItem(USER_ID_STORAGE_KEY)).toBeNull();
  });
});
