import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateCsrfToken } from "@/lib/csrf";
import { createSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { authenticateAdminUser, resetAdminUserStoreForTests } from "./adminUserStore";

vi.mock("./adminAuth", () => ({
  verifyAdminSession: vi.fn(),
}));

import { verifyAdminSession } from "./adminAuth";
import { getEditorialEngineTimeoutMs } from "./editorialWorkflow";
import {
  ADMIN_ENGINE_MAX_REQUEST_BYTES,
  ADMIN_ENGINE_MAX_RESPONSE_BYTES,
  ADMIN_ENGINE_REQUEST_TIMEOUT_MS,
  checkAllowedRoute,
  proxyAdminRequest,
  publishQuestionToEngine,
} from "./engineProxy";

const mockedVerifyAdminSession = vi.mocked(verifyAdminSession);

afterEach(() => {
  delete process.env.EDITORIAL_PUBLISH_LEASE_SECONDS;
  delete process.env.EDITORIAL_ENGINE_TIMEOUT_MS;
  delete process.env.EDITORIAL_EMERGENCY_IMPORT_ENABLED;
  delete process.env.ADMIN_ENGINE_TIMEOUT_MS;
  delete process.env.ADMIN_ENGINE_MAX_REQUEST_BYTES;
  delete process.env.ADMIN_ENGINE_MAX_RESPONSE_BYTES;
});

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

async function authedGet(path: string) {
  const user = await authenticateAdminUser("admin@example.test", "test-author-password");
  const session = await createSessionCookie(user?.id ?? "admin-user-1");
  return request(path, {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${session}` },
  });
}

describe("admin route allowlist", () => {
  it("allows known routes and safe room/topic IDs", () => {
    expect(checkAllowedRoute(["status"], "GET")).toEqual({ ok: true, enginePath: "/admin/status" });
    expect(checkAllowedRoute(["releases"], "GET")).toEqual({ ok: true, enginePath: "/admin/releases" });
    expect(checkAllowedRoute(["releases", "release_1", "read"], "PATCH")).toEqual({ ok: true, enginePath: "/admin/releases/release_1/read" });
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

    const response = await proxyAdminRequest(await authedGet("status"), ["status"]);

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

  it("blocks the direct content-import bypass unless the emergency gate is explicitly enabled", async () => {
    delete process.env.EDITORIAL_EMERGENCY_IMPORT_ENABLED;

    const response = await proxyAdminRequest(await authedPost("content/import", JSON.stringify({ questions: [] })), ["content", "import"]);

    expect(response.status).toBe(403);
    expect(await response.text()).toContain("human review workflow");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("bounds Engine publication below the outbox lease and returns a safe timeout", async () => {
    const controller = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    vi.mocked(fetch).mockImplementationOnce((_input, init) => new Promise((_resolve, reject) => {
      const signal = init?.signal;
      signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
    }));
    process.env.EDITORIAL_PUBLISH_LEASE_SECONDS = "30";
    process.env.EDITORIAL_ENGINE_TIMEOUT_MS = "999999";

    const publishing = publishQuestionToEngine({
      id: "timeout_0001",
      topicId: "trinity",
      difficulty: 1,
      question: "Timeout test?",
      choices: { A: "A", B: "B", C: "C", D: "D" },
      correctId: "A",
      teaching: { title: "Timeout", body: "A bounded timeout protects the publication lease.", refs: ["Matthew 28:19"] },
      tags: ["test"],
    }, "publish:test:revision:hash");
    controller.abort(new DOMException("request timed out", "TimeoutError"));
    const result = await publishing;

    expect(AbortSignal.timeout).toHaveBeenCalledWith(25_000);
    expect(getEditorialEngineTimeoutMs({ EDITORIAL_PUBLISH_LEASE_SECONDS: "30", EDITORIAL_ENGINE_TIMEOUT_MS: "999999" })).toBe(25_000);
    expect(result).toEqual({ ok: false, status: 504, error: "Live Engine publishing timed out." });
    expect(JSON.stringify(result)).not.toContain("https://engine.test");
  });

  it("safely handles non-JSON engine responses", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("<html>bad gateway</html>", {
        status: 502,
        headers: { "content-type": "text/html" },
      })
    );

    const response = await proxyAdminRequest(await authedGet("status"), ["status"]);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).not.toContain("<html>");
  });

  it("bounds admin Engine requests and reports an ambiguity-safe timeout", async () => {
    const controller = new AbortController();
    let signalReady: (() => void) | undefined;
    const fetchStarted = new Promise<void>((resolve) => { signalReady = resolve; });
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    vi.mocked(fetch).mockImplementationOnce((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      signalReady?.();
    }));

    const pending = proxyAdminRequest(await authedPost("start"), ["start"]);
    await fetchStarted;
    controller.abort(new DOMException("request timed out", "TimeoutError"));
    const response = await pending;

    expect(AbortSignal.timeout).toHaveBeenCalledWith(ADMIN_ENGINE_REQUEST_TIMEOUT_MS);
    expect(response.status).toBe(504);
    expect(await response.json()).toEqual({
      success: false,
      error: "Engine request timed out. The action may not have completed. Check live status before retrying.",
    });
  });

  it("rejects oversized admin request bodies before contacting the Engine", async () => {
    const response = await proxyAdminRequest(
      await authedPost("start", JSON.stringify({ value: "x".repeat(ADMIN_ENGINE_MAX_REQUEST_BYTES) })),
      ["start"]
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ success: false, error: "Admin request body is too large." });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects oversized Engine responses without buffering or exposing them", async () => {
    const secret = "upstream-sensitive-value";
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ value: `${secret}${"x".repeat(ADMIN_ENGINE_MAX_RESPONSE_BYTES)}` }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    const response = await proxyAdminRequest(await authedGet("status"), ["status"]);

    expect(response.status).toBe(502);
    const text = await response.text();
    expect(text).toContain("Engine returned too much data.");
    expect(text).not.toContain(secret);
  });

  it("safely handles engine network failure and missing config", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("connect ECONNREFUSED 10.0.0.8:5432"));
    let response = await proxyAdminRequest(await authedGet("status"), ["status"]);
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("10.0.0.8");

    delete process.env.ENGINE_ADMIN_TOKEN;
    response = await proxyAdminRequest(await authedGet("status"), ["status"]);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("server-only-admin-token");
  });
});
