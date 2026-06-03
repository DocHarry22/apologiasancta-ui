import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { POST as login } from "../login/route";
import { GET as me } from "../me/route";
import { PATCH as passwordPatch } from "./route";
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

describe("password route", () => {
  beforeEach(async () => {
    resetAdminUserStoreForTests();
    await resetAuthInviteSettingsForTests();
  });

  it("rejects wrong current password", async () => {
    const loginResponse = await login(postLogin({ email: "admin@example.test", password: "test-author-password" }));
    const { session, csrf } = cookieValues(loginResponse.headers.get("set-cookie") ?? "");

    const response = await passwordPatch(new NextRequest("https://ui.test/api/auth/password", {
      method: "PATCH",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${session}`,
        "x-csrf-token": csrf,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        currentPassword: "wrong-password",
        newPassword: "new-password-123",
        confirmPassword: "new-password-123",
      }),
    }));

    expect(response.status).toBe(400);
  });

  it("updates password and invalidates old login credentials", async () => {
    const loginResponse = await login(postLogin({ email: "admin@example.test", password: "test-author-password" }));
    const { session, csrf } = cookieValues(loginResponse.headers.get("set-cookie") ?? "");

    const updateResponse = await passwordPatch(new NextRequest("https://ui.test/api/auth/password", {
      method: "PATCH",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${session}`,
        "x-csrf-token": csrf,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        currentPassword: "test-author-password",
        newPassword: "new-password-123",
        confirmPassword: "new-password-123",
      }),
    }));

    expect(updateResponse.status).toBe(200);

    const oldLogin = await login(postLogin({ email: "admin@example.test", password: "test-author-password" }));
    const newLogin = await login(postLogin({ email: "admin@example.test", password: "new-password-123" }));

    expect(oldLogin.status).toBe(401);
    expect(newLogin.status).toBe(200);
  });

  it("invalidates pre-change session for authenticated routes", async () => {
    const loginResponse = await login(postLogin({ email: "admin@example.test", password: "test-author-password" }));
    const { session, csrf } = cookieValues(loginResponse.headers.get("set-cookie") ?? "");

    const updateResponse = await passwordPatch(new NextRequest("https://ui.test/api/auth/password", {
      method: "PATCH",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${session}`,
        "x-csrf-token": csrf,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        currentPassword: "test-author-password",
        newPassword: "new-password-123",
        confirmPassword: "new-password-123",
      }),
    }));

    expect(updateResponse.status).toBe(200);

    const staleMe = await me(new NextRequest("https://ui.test/api/auth/me", {
      method: "GET",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${session}`,
      },
    }));

    expect(staleMe.status).toBe(401);
  });
});
