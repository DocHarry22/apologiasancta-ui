import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CSRF_COOKIE_NAME } from "@/lib/csrf";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { resetAdminUserStoreForTests } from "@/lib/server/adminUserStore";
import { resetAuthInviteSettingsForTests } from "@/lib/server/authInviteSettings";
import { clearLoginRateLimit, clearSignupRateLimit } from "@/lib/auth/rateLimit";

const cookieGet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: cookieGet })),
}));

import { POST as login } from "./login/route";
import { POST as logout } from "./logout/route";
import { GET as csrf } from "./csrf/route";
import { POST as signup } from "./signup/route";
import { GET as diagnostics } from "./diagnostics/route";

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

describe("auth routes", () => {
  beforeEach(async () => {
    cookieGet.mockReset();
    resetAdminUserStoreForTests();
    clearLoginRateLimit("unknown");
    clearSignupRateLimit("unknown");
    await resetAuthInviteSettingsForTests();
    delete process.env.AUTH_SIGNUP_STAFF_INVITE_CODE;
    delete process.env.AUTH_SIGNUP_STAFF_ROLE;
    delete process.env.AUTH_DIAGNOSTICS_ENABLED;
  });

  it("login fails with missing credentials and wrong password", async () => {
    let response = await login(postLogin({}));
    expect(response.status).toBe(401);

    response = await login(postLogin({ email: "admin@example.test", password: "wrong" }));
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain("wrong");
  });

  it("login and signup return a stable 503 contract when auth is unavailable", async () => {
    delete process.env.AUTHOR_SESSION_SECRET;

    const loginResponse = await login(postLogin({ email: "admin@example.test", password: "test-author-password" }));
    const signupResponse = await signup(postSignup({
      name: "Unavailable User",
      email: "unavailable@example.test",
      password: "test-password",
      confirmPassword: "test-password",
    }));

    for (const response of [loginResponse, signupResponse]) {
      expect(response.status).toBe(503);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("retry-after")).toBe("300");
      expect(await response.json()).toEqual(expect.objectContaining({
        error: "Authentication is temporarily unavailable.",
        code: "auth_unavailable",
        reason: "session_secret_missing",
        diagnosticId: expect.any(String),
      }));
    }
  });

  it("keeps diagnostics disabled by default and reports safe readiness when enabled", async () => {
    let response = await diagnostics();
    expect(response.status).toBe(404);

    process.env.AUTH_DIAGNOSTICS_ENABLED = "true";
    response = await diagnostics();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload).toEqual(expect.objectContaining({
      ok: true,
      reason: "ready",
      diagnosticId: expect.any(String),
      configuration: expect.objectContaining({
        sessionConfigured: true,
        userStoreConfigured: true,
        databaseSource: "memory_store",
        missingVariables: expect.any(Array),
      }),
      driverCode: null,
    }));
    expect(JSON.stringify(payload)).not.toContain("test-author-password");
    expect(JSON.stringify(payload)).not.toContain("test-session-secret");
  });

  it("login succeeds with correct email/password and sets session and CSRF cookies", async () => {
    const response = await login(postLogin({ email: "admin@example.test", password: "test-author-password" }));
    const payload = await response.json();
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(payload.redirectTo).toBe("/admin");
    expect(setCookie).toContain(SESSION_COOKIE_NAME);
    expect(setCookie).toContain(CSRF_COOKIE_NAME);
    expect(setCookie).toContain("HttpOnly");
  });

  it("signup creates a public user by default and redirects to home", async () => {
    const response = await signup(postSignup({
      name: "Public Viewer",
      email: "viewer@example.test",
      password: "viewer-password",
      confirmPassword: "viewer-password",
      phone: "+15551234567",
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.redirectTo).toBe("/");
    expect(payload.user.role).toBe("viewer");
    expect(payload.user.accountType).toBe("public");
    expect(payload.user.phone).toBe("+15551234567");
  });

  it("signup rejects invalid invite code", async () => {
    process.env.AUTH_SIGNUP_STAFF_INVITE_CODE = "valid-invite";

    const response = await signup(postSignup({
      name: "Staff Candidate",
      email: "staffcandidate@example.test",
      password: "staff-password",
      confirmPassword: "staff-password",
      inviteCode: "wrong-invite",
    }));

    expect(response.status).toBe(403);
  });

  it("signup rejects duplicate email", async () => {
    const body = {
      name: "Duplicate User",
      email: "duplicate@example.test",
      password: "duplicate-password",
      confirmPassword: "duplicate-password",
    };

    const first = await signup(postSignup(body));
    const second = await signup(postSignup(body));

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
  });

  it("signup with valid invite creates a staff user and redirects to admin", async () => {
    process.env.AUTH_SIGNUP_STAFF_INVITE_CODE = "valid-invite";
    process.env.AUTH_SIGNUP_STAFF_ROLE = "host";

    const response = await signup(postSignup({
      name: "Staff Host",
      email: "host@example.test",
      password: "staff-password",
      confirmPassword: "staff-password",
      inviteCode: "valid-invite",
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.redirectTo).toBe("/admin");
    expect(payload.user.role).toBe("host");
    expect(payload.user.accountType).toBe("staff");
  });

  it("public user login redirects to home", async () => {
    await signup(postSignup({
      name: "Public Login",
      email: "public-login@example.test",
      password: "public-password",
      confirmPassword: "public-password",
    }));

    const response = await login(postLogin({ email: "public-login@example.test", password: "public-password" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.redirectTo).toBe("/");
    expect(payload.user.role).toBe("viewer");
  });

  it("logout clears author session and CSRF cookies", async () => {
    const response = await logout(new NextRequest("https://ui.test/api/auth/logout", { method: "POST" }));
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(303);
    expect(setCookie).toContain(SESSION_COOKIE_NAME);
    expect(setCookie).toContain(CSRF_COOKIE_NAME);
    expect(setCookie).toContain("Max-Age=0");
  });

  it("logout redirects to the configured public origin instead of an internal host", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://ui.example.test";
    try {
      const response = await logout(new NextRequest(
        "http://0.0.0.0:3000/api/auth/logout?next=/author/login",
        { method: "POST" }
      ));

      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe("https://ui.example.test/author/login");
      expect(response.headers.get("cache-control")).toBe("no-store");
    } finally {
      delete process.env.NEXT_PUBLIC_APP_URL;
    }
  });

  it("/api/auth/csrf returns 401 when logged out", async () => {
    cookieGet.mockReturnValue(undefined);

    const response = await csrf();

    expect(response.status).toBe(401);
  });

  it("/api/auth/csrf returns a token when logged in", async () => {
    const loginResponse = await login(postLogin({ email: "admin@example.test", password: "test-author-password" }));
    const session = (loginResponse.headers.get("set-cookie") ?? "").match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))?.[1];
    cookieGet.mockReturnValue({ value: session });

    const response = await csrf();
    const body = await response.json();
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(body.csrfToken).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(setCookie).toContain(CSRF_COOKIE_NAME);
  });
});
