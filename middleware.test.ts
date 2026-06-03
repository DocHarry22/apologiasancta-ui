import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifySessionCookie = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  SESSION_COOKIE_NAME: "as_author_session",
  verifySessionCookie,
}));

import { middleware } from "./middleware";

describe("middleware auth routing", () => {
  beforeEach(() => {
    verifySessionCookie.mockReset();
    verifySessionCookie.mockResolvedValue(false);
  });

  it("allows signup route without auth", async () => {
    const response = await middleware(new NextRequest("https://ui.test/signup"));
    expect(response.status).toBe(200);
  });

  it("redirects unauthenticated admin route to admin login with next param", async () => {
    const response = await middleware(new NextRequest("https://ui.test/admin/rooms"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://ui.test/admin/login?next=%2Fadmin%2Frooms");
  });

  it("redirects authenticated login-route access to home", async () => {
    verifySessionCookie.mockResolvedValue(true);

    const response = await middleware(new NextRequest("https://ui.test/admin/login"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://ui.test/");
  });
});
