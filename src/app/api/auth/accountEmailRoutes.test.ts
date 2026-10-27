import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createSessionCookie, readSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { changeAdminUserPassword, consumeAccountEmailToken, createAdminUser, getAdminUserById, issueAccountEmailToken, resetAdminUserStoreForTests, takeAccountEmailLimit, updateAdminUser } from "@/lib/server/adminUserStore";
import { getCurrentUser } from "@/lib/server/currentUser";
import { isSessionFreshForUser } from "@/lib/server/sessionFreshness";
import { requestAccountEmail } from "@/lib/server/accountEmail";
import { POST as forgot } from "./forgot-password/route";
import { POST as reset } from "./reset-password/route";
import { POST as verify } from "./verify-email/route";
import { POST as resend } from "./verify-email/resend/route";
import { POST as login } from "./login/route";
import { GET as me } from "./me/route";

const jobs = vi.hoisted(() => [] as Array<() => Promise<void>>);
vi.mock("next/server", async (original) => ({ ...await original<typeof import("next/server")>(), after: (job: () => Promise<void>) => jobs.push(job) }));

function request(path: string, body: unknown, ip = "203.0.113.1") {
  return new NextRequest(`https://ui.test/api/auth/${path}`, { method: "POST", headers: { "Content-Type": "application/json", "x-real-ip": ip }, body: JSON.stringify(body) });
}
async function drainJobs() { for (const job of jobs.splice(0)) await job(); }

describe("account recovery and verification", () => {
  beforeEach(() => {
    resetAdminUserStoreForTests();
    jobs.length = 0;
    vi.stubEnv("AUTH_PUBLIC_URL", "https://ui.test");
    vi.stubEnv("RESEND_API_KEY", "test-mail-key");
    vi.stubEnv("AUTH_EMAIL_FROM", "accounts@example.test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"id":"mail-id"}', { status: 200 })));
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("returns identical responses for existing and missing emails and never returns tokens", async () => {
    const known = await forgot(request("forgot-password", { email: " ADMIN@example.test " }));
    const missing = await forgot(request("forgot-password", { email: "missing@example.test" }));
    expect(known.status).toBe(200);
    expect(await known.json()).toEqual(await missing.json());
    expect(known.headers.get("cache-control")).toBe("no-store");
    expect(fetch).not.toHaveBeenCalled();
    await drainJobs();
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    const email = JSON.parse(String(options!.body));
    expect(email.to).toEqual(["admin@example.test"]);
    expect(email.text).toMatch(/https:\/\/ui.test\/reset-password#token=[a-f0-9]{64}/);
  });

  it("recovers the account once, revokes every old session, clears cookies, and requires a fresh login", async () => {
    const user = await createAdminUser({ email: "recovery@example.test", password: "old-password", displayName: "Learner", role: "viewer", accountType: "public" });
    const sessions = await Promise.all([createSessionCookie(user!.id), createSessionCookie(user!.id)]);
    const issued = await issueAccountEmailToken(user!.email, "reset");
    const body = { token: issued!.token, newPassword: "new-password", confirmPassword: "new-password" };
    const response = await reset(request("reset-password", body));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    for (const session of sessions) {
      const stale = await me(new NextRequest("https://ui.test/api/auth/me", { headers: { cookie: `${SESSION_COOKIE_NAME}=${session}` } }));
      expect(stale.status).toBe(401);
      expect(isSessionFreshForUser((await readSessionCookie(session))!, await getCurrentUser(user!.id))).toBe(false);
    }
    expect((await reset(request("reset-password", body))).status).toBe(400);
    expect((await login(request("login", { email: user!.email, password: "old-password" }))).status).toBe(401);
    const fresh = await login(request("login", { email: user!.email, password: "new-password" }));
    expect(fresh.status).toBe(200);
    const cookie = fresh.headers.get("set-cookie")!.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))![1];
    expect((await me(new NextRequest("https://ui.test/api/auth/me", { headers: { cookie: `${SESSION_COOKIE_NAME}=${cookie}` } }))).status).toBe(200);
  });

  it("allows only one of two concurrent reset submissions", async () => {
    const issued = await issueAccountEmailToken("admin@example.test", "reset");
    const result = await Promise.all([consumeAccountEmailToken(issued!.token, "reset", "password-one"), consumeAccountEmailToken(issued!.token, "reset", "password-two")]);
    expect(result.filter(Boolean)).toHaveLength(1);
  });

  it("rejects expired, replaced, wrong-purpose, and inactive-account tokens", async () => {
    const first = await issueAccountEmailToken("admin@example.test", "reset");
    const latest = await issueAccountEmailToken("admin@example.test", "reset");
    expect(await consumeAccountEmailToken(first!.token, "reset", "new-password")).toBe(false);
    expect(await consumeAccountEmailToken(latest!.token, "verify")).toBe(false);
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 30 * 60 * 1000);
    expect(await consumeAccountEmailToken(latest!.token, "reset", "new-password")).toBe(false);
    vi.restoreAllMocks();
    const user = await createAdminUser({ email: "inactive@example.test", password: "password", displayName: "Inactive", role: "viewer", accountType: "public" });
    const token = await issueAccountEmailToken(user!.email, "reset");
    await updateAdminUser({ id: user!.id, status: "inactive" });
    expect(await consumeAccountEmailToken(token!.token, "reset", "new-password")).toBe(false);
  });

  it("invalidates outstanding reset links when the password is changed normally", async () => {
    const issued = await issueAccountEmailToken("admin@example.test", "reset");
    const user = await login(request("login", { email: "admin@example.test", password: "test-author-password" }));
    const id = (await user.json()).user.id;
    expect(await changeAdminUserPassword(id, "test-author-password", "changed-password")).toBe("ok");
    expect(await consumeAccountEmailToken(issued!.token, "reset", "new-password")).toBe(false);
  });

  it("does not consume a reset link for an invalid or mismatched password", async () => {
    const issued = await issueAccountEmailToken("admin@example.test", "reset");
    for (const newPassword of ["short", "x".repeat(257), "valid-but-mismatched"]) {
      expect((await reset(request("reset-password", { token: issued!.token, newPassword, confirmPassword: "different" }))).status).toBe(400);
    }
    expect(await consumeAccountEmailToken(issued!.token, "reset", "new-password")).toBe(true);
  });

  it("verifies once, expires at 24 hours, and resends without exposing verification status", async () => {
    const user = await createAdminUser({ email: "verify@example.test", password: "password", displayName: "Verify", role: "viewer", accountType: "public", requireEmailVerification: true });
    const expired = await issueAccountEmailToken(user!.email, "verify");
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 24 * 60 * 60 * 1000);
    expect(await consumeAccountEmailToken(expired!.token, "verify")).toBe(false);
    vi.restoreAllMocks();
    const token = await issueAccountEmailToken(user!.email, "verify");
    expect((await verify(request("verify-email", { token: token!.token }))).status).toBe(200);
    expect((await getAdminUserById(user!.id))!.emailVerifiedAt).toBeTruthy();
    expect((await getAdminUserById(user!.id))!.emailVerificationRequired).toBe(false);
    expect((await verify(request("verify-email", { token: token!.token }))).status).toBe(400);
    const verified = await resend(request("verify-email/resend", { email: user!.email }));
    const unknown = await resend(request("verify-email/resend", { email: "unknown@example.test" }));
    expect(await verified.json()).toEqual(await unknown.json());
    await drainJobs();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("throttles by normalized email across IPs and by IP across addresses", async () => {
    for (let i = 0; i < 6; i++) await requestAccountEmail(i % 2 ? " ADMIN@EXAMPLE.TEST " : "admin@example.test", "reset");
    expect(fetch).toHaveBeenCalledTimes(5);
    for (let i = 0; i < 20; i++) expect((await forgot(request("forgot-password", { email: `${i}@example.test` }))).status).toBe(200);
    const denied = await forgot(request("forgot-password", { email: "extra@example.test" }));
    expect(denied.status).toBe(429);
    expect(Number(denied.headers.get("Retry-After"))).toBeGreaterThan(0);
    for (let i = 0; i < 30; i++) expect((await verify(request("verify-email", { token: "invalid" }))).status).toBe(400);
    expect((await verify(request("verify-email", { token: "invalid" }))).status).toBe(429);
  });

  it("expires fixed-window counters and fails safely without email configuration", async () => {
    expect((await takeAccountEmailLimit("test-key", 1, 1000)).allowed).toBe(true);
    expect((await takeAccountEmailLimit("test-key", 1, 1000)).allowed).toBe(false);
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 1001);
    expect((await takeAccountEmailLimit("test-key", 1, 1000)).allowed).toBe(true);
    vi.stubEnv("RESEND_API_KEY", "");
    expect((await forgot(request("forgot-password", { email: "admin@example.test" }))).status).toBe(503);
  });
});
