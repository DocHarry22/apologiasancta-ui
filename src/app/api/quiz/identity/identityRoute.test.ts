import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateCsrfToken } from "@/lib/csrf";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { resetAdminUserStoreForTests } from "@/lib/server/adminUserStore";
import { POST as signup } from "@/app/api/auth/signup/route";
import { POST as exchangeIdentity } from "./route";

async function createSession(): Promise<string> {
  const response = await signup(new NextRequest("https://ui.test/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Identity Test",
      email: "identity-route@example.test",
      password: "identity-route-password",
      confirmPassword: "identity-route-password",
    }),
  }));
  expect(response.status).toBe(200);
  const session = (response.headers.get("set-cookie") ?? "")
    .match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))?.[1];
  if (!session) throw new Error("Test session cookie was not created");
  return session;
}

async function identityRequest(session: string, withCsrf = true): Promise<NextRequest> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    cookie: `${SESSION_COOKIE_NAME}=${session}`,
  };
  if (withCsrf) headers["x-csrf-token"] = await generateCsrfToken(session);
  return new NextRequest("https://ui.test/api/quiz/identity", {
    method: "POST",
    headers,
    body: JSON.stringify({ roomId: "global", displayName: "Identity_Test" }),
  });
}

describe("account quiz identity route", () => {
  beforeEach(() => {
    resetAdminUserStoreForTests();
    process.env.ACCOUNT_IDENTITY_ENABLED = "true";
    process.env.ACCOUNT_IDENTITY_SECRET = "test-account-identity-secret-with-more-than-32-bytes";
    process.env.ACCOUNT_IDENTITY_ISSUER = "apologia-ui";
    process.env.ACCOUNT_IDENTITY_ASSERTION_TTL_SECONDS = "120";
  });

  afterEach(() => {
    delete process.env.ACCOUNT_IDENTITY_ENABLED;
    delete process.env.ACCOUNT_IDENTITY_SECRET;
    delete process.env.ACCOUNT_IDENTITY_ISSUER;
    delete process.env.ACCOUNT_IDENTITY_ASSERTION_TTL_SECONDS;
    vi.unstubAllGlobals();
  });

  it("requires an authenticated session", async () => {
    const response = await exchangeIdentity(new NextRequest("https://ui.test/api/quiz/identity", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roomId: "global", displayName: "Identity_Test" }),
    }));
    expect(response.status).toBe(401);
  });

  it("keeps the assertion server-side and returns an ordinary join token", async () => {
    const session = await createSession();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      identityType: "account",
      userId: "acct_durable_identity",
      username: "Identity_Test",
      roomId: "global",
      joinToken: "ordinary-room-join-token",
      identityCreated: true,
      displayNameAdjusted: false,
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await exchangeIdentity(await identityRequest(session));
    const payload = await response.json();
    const upstreamBody = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    const assertionPayload = JSON.parse(Buffer.from(upstreamBody.assertion.split(".")[0], "base64url").toString("utf8"));

    expect(response.status).toBe(200);
    expect(payload).toEqual(expect.objectContaining({
      userId: "acct_durable_identity",
      username: "Identity_Test",
      joinToken: "ordinary-room-join-token",
    }));
    expect(payload).not.toHaveProperty("assertion");
    expect(assertionPayload.subject).toMatch(/^[a-zA-Z0-9:_-]{8,128}$/);
    expect(assertionPayload.subject).not.toContain("@");
    expect(JSON.stringify(payload)).not.toContain(process.env.ACCOUNT_IDENTITY_SECRET!);
  });

  it("fails closed before contacting the Engine when the rollout is disabled", async () => {
    const session = await createSession();
    process.env.ACCOUNT_IDENTITY_ENABLED = "false";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await exchangeIdentity(await identityRequest(session));

    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
