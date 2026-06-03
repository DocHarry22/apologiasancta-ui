import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { POST as login } from "../login/route";
import { POST as signup } from "../signup/route";
import { GET as inviteGet, PATCH as invitePatch } from "./route";
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

function postSignup(body: unknown) {
  return new NextRequest("https://ui.test/api/auth/signup", {
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

describe("invite settings route", () => {
  beforeEach(async () => {
    resetAdminUserStoreForTests();
    await resetAuthInviteSettingsForTests();
    process.env.AUTH_SIGNUP_STAFF_INVITE_CODE = "env-invite";
    process.env.AUTH_SIGNUP_STAFF_ROLE = "host";
  });

  it("blocks non-manager from reading invite settings", async () => {
    const signupResponse = await signup(postSignup({
      name: "Public",
      email: "public-invite-settings@example.test",
      password: "public-pass-123",
      confirmPassword: "public-pass-123",
    }));
    const { session } = cookieValues(signupResponse.headers.get("set-cookie") ?? "");

    const response = await inviteGet(new NextRequest("https://ui.test/api/auth/invite-settings", {
      method: "GET",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${session}` },
    }));

    expect(response.status).toBe(403);
  });

  it("returns effective invite settings for manager", async () => {
    const loginResponse = await login(postLogin({ email: "admin@example.test", password: "test-author-password" }));
    const { session } = cookieValues(loginResponse.headers.get("set-cookie") ?? "");

    const response = await inviteGet(new NextRequest("https://ui.test/api/auth/invite-settings", {
      method: "GET",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${session}` },
    }));

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.settings.inviteCode).toBe("env-invite");
    expect(payload.settings.staffRole).toBe("host");
  });

  it("updates invite settings and uses rotated invite for signup", async () => {
    const loginResponse = await login(postLogin({ email: "admin@example.test", password: "test-author-password" }));
    const { session, csrf } = cookieValues(loginResponse.headers.get("set-cookie") ?? "");

    const updateResponse = await invitePatch(new NextRequest("https://ui.test/api/auth/invite-settings", {
      method: "PATCH",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${session}`,
        "x-csrf-token": csrf,
        "content-type": "application/json",
      },
      body: JSON.stringify({ rotate: true, staffRole: "reviewer" }),
    }));

    const updatePayload = await updateResponse.json();
    expect(updateResponse.status).toBe(200);
    expect(typeof updatePayload.settings.inviteCode).toBe("string");
    expect(updatePayload.settings.inviteCode.length).toBeGreaterThan(5);
    expect(updatePayload.settings.staffRole).toBe("reviewer");

    const signupResponse = await signup(postSignup({
      name: "Invite Reviewer",
      email: "invite-reviewer@example.test",
      password: "reviewer-pass-123",
      confirmPassword: "reviewer-pass-123",
      inviteCode: updatePayload.settings.inviteCode,
    }));

    const signupPayload = await signupResponse.json();
    expect(signupResponse.status).toBe(200);
    expect(signupPayload.user.role).toBe("reviewer");
    expect(signupPayload.redirectTo).toBe("/admin");
  });
});
