import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { POST as login } from "../login/route";
import { POST as signup } from "../signup/route";
import { GET as usersGet, PATCH as usersPatch } from "./route";
import { CSRF_COOKIE_NAME } from "@/lib/csrf";
import { SESSION_COOKIE_NAME, readSessionCookie } from "@/lib/auth/session";
import { resetAdminUserStoreForTests, getAdminUserById } from "@/lib/server/adminUserStore";
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

describe("auth users route", () => {
  beforeEach(async () => {
    resetAdminUserStoreForTests();
    await resetAuthInviteSettingsForTests();
    delete process.env.AUTH_SIGNUP_STAFF_INVITE_CODE;
    delete process.env.AUTH_SIGNUP_STAFF_ROLE;
  });

  it("blocks non-manager from listing users", async () => {
    const signupResponse = await signup(postSignup({
      name: "Public",
      email: "public@example.test",
      password: "public-pass-123",
      confirmPassword: "public-pass-123",
    }));

    const { session } = cookieValues(signupResponse.headers.get("set-cookie") ?? "");

    const response = await usersGet(new NextRequest("https://ui.test/api/auth/users", {
      method: "GET",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${session}` },
    }));

    expect(response.status).toBe(403);
  });

  it("allows super admin to list users", async () => {
    await signup(postSignup({
      name: "Public",
      email: "public2@example.test",
      password: "public-pass-123",
      confirmPassword: "public-pass-123",
    }));

    const loginResponse = await login(postLogin({ email: "admin@example.test", password: "test-author-password" }));
    const { session } = cookieValues(loginResponse.headers.get("set-cookie") ?? "");

    const response = await usersGet(new NextRequest("https://ui.test/api/auth/users", {
      method: "GET",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${session}` },
    }));

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(Array.isArray(payload.users)).toBe(true);
    expect(payload.users.length).toBeGreaterThanOrEqual(2);
  });

  it("allows super admin to update user role and status", async () => {
    process.env.AUTH_SIGNUP_STAFF_INVITE_CODE = "valid-invite";
    process.env.AUTH_SIGNUP_STAFF_ROLE = "host";

    const signupResponse = await signup(postSignup({
      name: "Staff",
      email: "staff-update@example.test",
      password: "staff-pass-123",
      confirmPassword: "staff-pass-123",
      inviteCode: "valid-invite",
    }));

    const createdSession = cookieValues(signupResponse.headers.get("set-cookie") ?? "").session;
    const createdSessionPayload = await readSessionCookie(createdSession);

    const loginResponse = await login(postLogin({ email: "admin@example.test", password: "test-author-password" }));
    const { session, csrf } = cookieValues(loginResponse.headers.get("set-cookie") ?? "");

    const patchResponse = await usersPatch(new NextRequest("https://ui.test/api/auth/users", {
      method: "PATCH",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${session}`,
        "x-csrf-token": csrf,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        userId: createdSessionPayload?.userId,
        role: "viewer",
        status: "inactive",
      }),
    }));

    expect(patchResponse.status).toBe(200);

    const updatedUser = await getAdminUserById(createdSessionPayload?.userId ?? "");
    expect(updatedUser?.role).toBe("viewer");
    expect(updatedUser?.status).toBe("inactive");
  });

  it("blocks signed-in user from changing their own role or status", async () => {
    const loginResponse = await login(postLogin({ email: "admin@example.test", password: "test-author-password" }));
    const { session, csrf } = cookieValues(loginResponse.headers.get("set-cookie") ?? "");
    const sessionPayload = await readSessionCookie(session);

    const patchResponse = await usersPatch(new NextRequest("https://ui.test/api/auth/users", {
      method: "PATCH",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${session}`,
        "x-csrf-token": csrf,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        userId: sessionPayload?.userId,
        role: "viewer",
      }),
    }));

    expect(patchResponse.status).toBe(400);
    const payload = await patchResponse.json();
    expect(payload.error).toContain("cannot change your own role or status");
  });
});
