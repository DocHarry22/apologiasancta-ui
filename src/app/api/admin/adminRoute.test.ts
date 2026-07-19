import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateCsrfToken } from "@/lib/csrf";
import { createSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { authenticateAdminUser, resetAdminUserStoreForTests } from "@/lib/server/adminUserStore";

vi.mock("@/lib/server/adminAuth", () => ({
  verifyAdminSession: vi.fn(),
}));

import { verifyAdminSession } from "@/lib/server/adminAuth";
import { GET, POST } from "./[...path]/route";

const mockedVerifyAdminSession = vi.mocked(verifyAdminSession);

function req(path: string, init: RequestInit = {}) {
  return new NextRequest(`https://ui.test/api/admin/${path}`, init);
}

async function csrfHeaders() {
  const user = await authenticateAdminUser("admin@example.test", "test-author-password");
  const session = await createSessionCookie(user?.id ?? "admin-user-1");
  return {
    cookie: `${SESSION_COOKIE_NAME}=${session}`,
    "x-csrf-token": await generateCsrfToken(session),
    "content-type": "application/json",
  };
}

async function authHeaders() {
  const user = await authenticateAdminUser("admin@example.test", "test-author-password");
  const session = await createSessionCookie(user?.id ?? "admin-user-1");
  return { cookie: `${SESSION_COOKIE_NAME}=${session}` };
}

function ctx(path: string[]) {
  return { params: Promise.resolve({ path }) };
}

describe("admin proxy API route", () => {
  beforeEach(() => {
    resetAdminUserStoreForTests();
    mockedVerifyAdminSession.mockResolvedValue(true);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ ok: true }, { status: 200 }))
    );
  });

  it("returns 401 for unauthenticated GET and POST", async () => {
    mockedVerifyAdminSession.mockResolvedValue(false);

    expect((await GET(req("status"), ctx(["status"]))).status).toBe(401);
    expect((await POST(req("start", { method: "POST" }), ctx(["start"]))).status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects authenticated POST without valid CSRF", async () => {
    expect((await POST(req("start", { method: "POST" }), ctx(["start"]))).status).toBe(403);

    const user = await authenticateAdminUser("admin@example.test", "test-author-password");
    const session = await createSessionCookie(user?.id ?? "admin-user-1");
    const invalid = await POST(
      req("start", {
        method: "POST",
        headers: { cookie: `${SESSION_COOKIE_NAME}=${session}`, "x-csrf-token": "invalid" },
      }),
      ctx(["start"])
    );
    expect(invalid.status).toBe(403);
  });

  it("accepts authenticated POST with valid CSRF", async () => {
    const response = await POST(
      req("start", { method: "POST", headers: await csrfHeaders(), body: "{}" }),
      ctx(["start"])
    );

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalled();
  });

  it("enforces allowlist status codes", async () => {
    expect((await GET(req("not-real"), ctx(["not-real"]))).status).toBe(404);
    expect((await GET(req("start"), ctx(["start"]))).status).toBe(405);
    expect((await GET(req("rooms/%2F/status"), ctx(["rooms", "bad/room", "status"]))).status).toBe(400);
  });

  it("valid known routes pass validation", async () => {
    const response = await GET(
      req("rooms/room-1/status", { headers: await authHeaders() }),
      ctx(["rooms", "room-1", "status"])
    );

    expect(response.status).toBe(200);
  });

  it("allows canonical content status and authenticated refresh only", async () => {
    expect((await GET(
      req("content/canonical/status", { headers: await authHeaders() }),
      ctx(["content", "canonical", "status"])
    )).status).toBe(200);

    expect((await POST(
      req("content/refresh", { method: "POST", headers: await csrfHeaders(), body: "{}" }),
      ctx(["content", "refresh"])
    )).status).toBe(200);
  });

  it("returns safe errors for missing config without leaking secrets", async () => {
    delete process.env.ENGINE_ADMIN_TOKEN;

    const response = await GET(req("status", { headers: await authHeaders() }), ctx(["status"]));
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(text).toContain("Admin engine proxy is not configured");
    expect(text).not.toContain("server-only-admin-token");
    expect(text).not.toContain("test-session-secret");
  });
});
