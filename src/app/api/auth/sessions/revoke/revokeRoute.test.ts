import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { POST as login } from "../../login/route";
import { GET as me } from "../../me/route";
import { POST as revokeSessions } from "./route";
import { CSRF_COOKIE_NAME } from "@/lib/csrf";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { resetAdminUserStoreForTests } from "@/lib/server/adminUserStore";
import { resetAuthInviteSettingsForTests } from "@/lib/server/authInviteSettings";

function postLogin(body: unknown) {
  return new NextRequest("https://ui.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function cookieValues(setCookie: string) {
  const session = setCookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))?.[1] ?? "";
  const csrf = setCookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`))?.[1] ?? "";
  return { session, csrf };
}

describe("sessions revoke route", () => {
  beforeEach(async () => {
    resetAdminUserStoreForTests();
    await resetAuthInviteSettingsForTests();
  });

  it("revokes older sessions and rotates current session", async () => {
    const loginResponse = await login(postLogin({ email: "admin@example.test", password: "test-author-password" }));
    const initialCookies = cookieValues(loginResponse.headers.get("set-cookie") ?? "");

    const revokeResponse = await revokeSessions(new NextRequest("https://ui.test/api/auth/sessions/revoke", {
      method: "POST",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${initialCookies.session}`,
        "x-csrf-token": initialCookies.csrf,
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    }));

    expect(revokeResponse.status).toBe(200);

    const rotatedCookies = cookieValues(revokeResponse.headers.get("set-cookie") ?? "");
    expect(rotatedCookies.session).not.toBe(initialCookies.session);

    const staleSessionMe = await me(new NextRequest("https://ui.test/api/auth/me", {
      method: "GET",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${initialCookies.session}` },
    }));

    const freshSessionMe = await me(new NextRequest("https://ui.test/api/auth/me", {
      method: "GET",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${rotatedCookies.session}` },
    }));

    expect(staleSessionMe.status).toBe(401);
    expect(freshSessionMe.status).toBe(200);
  });
});
