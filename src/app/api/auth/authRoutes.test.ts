import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CSRF_COOKIE_NAME } from "@/lib/csrf";
import { createSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/session";

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
  });

  it("login fails with missing password and wrong password", async () => {
    let response = await login(postLogin({}));
    expect(response.status).toBe(401);

    response = await login(postLogin({ password: "wrong" }));
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain("wrong");
  });

  it("login succeeds with correct password and sets session and CSRF cookies", async () => {
    const response = await login(postLogin({ password: "test-author-password" }));
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
    const session = await createSessionCookie();
    cookieGet.mockReturnValue({ value: session });

    const response = await csrf();
    const body = await response.json();
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(body.csrfToken).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(setCookie).toContain(CSRF_COOKIE_NAME);
  });
});
