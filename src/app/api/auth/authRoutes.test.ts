import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CSRF_COOKIE_NAME } from "@/lib/csrf";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { resetAdminUserStoreForTests } from "@/lib/server/adminUserStore";

const cookieGet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: cookieGet })),
}));

import { POST as login } from "./login/route";
import { POST as logout } from "./logout/route";
import { GET as csrf } from "./csrf/route";

function postLogin(body: unknown) {
  return new NextRequest("https://ui.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("auth routes", () => {
  beforeEach(() => {
    cookieGet.mockReset();
    resetAdminUserStoreForTests();
  });

  it("login fails with missing credentials and wrong password", async () => {
    let response = await login(postLogin({}));
    expect(response.status).toBe(401);

    response = await login(postLogin({ email: "admin@example.test", password: "wrong" }));
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain("wrong");
  });

  it("login succeeds with correct email/password and sets session and CSRF cookies", async () => {
    const response = await login(postLogin({ email: "admin@example.test", password: "test-author-password" }));
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(setCookie).toContain(SESSION_COOKIE_NAME);
    expect(setCookie).toContain(CSRF_COOKIE_NAME);
    expect(setCookie).toContain("HttpOnly");
  });

  it("logout clears author session and CSRF cookies", async () => {
    const response = await logout();
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(setCookie).toContain(SESSION_COOKIE_NAME);
    expect(setCookie).toContain(CSRF_COOKIE_NAME);
    expect(setCookie).toContain("Max-Age=0");
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
