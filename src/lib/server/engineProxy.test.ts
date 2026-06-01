import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateCsrfToken } from "@/lib/csrf";
import { createSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { authenticateAdminUser, resetAdminUserStoreForTests } from "./adminUserStore";

vi.mock("./adminAuth", () => ({
  verifyAdminSession: vi.fn(),
}));

import { verifyAdminSession } from "./adminAuth";
import { checkAllowedRoute, proxyAdminRequest } from "./engineProxy";

const mockedVerifyAdminSession = vi.mocked(verifyAdminSession);

function request(path: string, init: RequestInit = {}) {
  return new NextRequest(`https://ui.test/api/admin/${path}`, init);
}

async function authedPost(path: string, body = "{}") {
  const user = await authenticateAdminUser("admin@example.test", "test-author-password");
  const session = await createSessionCookie(user?.id ?? "admin-user-1");
  const csrf = await generateCsrfToken(session);
  return request(path, {
    method: "POST",
    body,
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${session}`,
      "x-csrf-token": csrf,
      "content-type": "application/json",
    },
  });
}

describe("admin route allowlist", () => {
  it("allows known routes and safe room/topic IDs", () => {
    expect(checkAllowedRoute(["status"], "GET")).toEqual({ ok: true, enginePath: "/admin/status" });
    expect(checkAllowedRoute(["rooms", "room_1", "topic", "start", "topic-1"], "POST")).toEqual({
      ok: true,
      enginePath: "/admin/rooms/room_1/topic/start/topic-1",
    });
  });

  it("rejects unknown routes, wrong methods, and invalid segments", () => {
    expect(checkAllowedRoute(["not-real"], "GET")).toMatchObject({ ok: false, status: 404 });
    expect(checkAllowedRoute(["start"], "GET")).toMatchObject({ ok: false, status: 405 });
    expect(checkAllowedRoute(["rooms", "..", "status"], "GET")).toMatchObject({ ok: false, status: 400 });
    expect(checkAllowedRoute(["rooms", "a%2Fb", "status"], "GET")).toMatchObject({ ok: false, status: 400 });
    expect(checkAllowedRoute(["rooms", "a/b", "status"], "GET")).toMatchObject({ ok: false, status: 400 });
    expect(checkAllowedRoute(["rooms", "a\u0000b", "status"], "GET")).toMatchObject({ ok: false, status: 400 });
    expect(checkAllowedRoute([""], "GET")).toMatchObject({ ok: false, status: 400 });
  });
});

describe("engine admin proxy", () => {
  beforeEach(() => {
    resetAdminUserStoreForTests();
    mockedVerifyAdminSession.mockResolvedValue(true);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ ok: true }, { status: 200 }))
    );
  });

  it("does not call engine when unauthenticated", async () => {
    mockedVerifyAdminSession.mockResolvedValue(false);

    const response = await proxyAdminRequest(request("status"), ["status"]);

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not call engine when CSRF is invalid", async () => {
    const user = await authenticateAdminUser("admin@example.test", "test-author-password");
    const session = await createSessionCookie(user?.id ?? "admin-user-1");
    const response = await proxyAdminRequest(
      request("start", {
        method: "POST",
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${session}`,
          "x-csrf-token": "bad-token",
        },
      }),
      ["start"]
    );

    expect(response.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not call engine when route is not allowed", async () => {
    const response = await proxyAdminRequest(request("not-real"), ["not-real"]);

    expect(response.status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("injects x-admin-token only in the server-side engine request", async () => {
    const response = await proxyAdminRequest(await authedPost("start"), ["start"]);

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(
      "https://engine.test/admin/start",
      expect.objectContaining({
        headers: expect.objectContaining({ "x-admin-token": "server-only-admin-token" }),
      })
    );
    expect(await response.text()).not.toContain("server-only-admin-token");
  });

  it("safely handles non-JSON engine responses", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("<html>bad gateway</html>", {
        status: 502,
        headers: { "content-type": "text/html" },
      })
    );

    const response = await proxyAdminRequest(request("status"), ["status"]);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).not.toContain("<html>");
  });

  it("safely handles engine network failure and missing config", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("connect ECONNREFUSED https://engine.test"));
    let response = await proxyAdminRequest(request("status"), ["status"]);
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("https://engine.test");

    delete process.env.ENGINE_ADMIN_TOKEN;
    response = await proxyAdminRequest(request("status"), ["status"]);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("server-only-admin-token");
  });
});
