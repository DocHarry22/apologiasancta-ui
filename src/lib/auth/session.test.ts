import { describe, expect, it, vi } from "vitest";
import { createSessionCookie, verifySessionCookie } from "./session";

describe("author session cookies", () => {
  it("creates a valid session cookie value", async () => {
    const cookie = await createSessionCookie("admin-user-1");

    expect(cookie.split(".")).toHaveLength(2);
    await expect(verifySessionCookie(cookie)).resolves.toBe(true);
  });

  it("rejects missing, malformed, and tampered cookies", async () => {
    const cookie = await createSessionCookie("admin-user-1");

    await expect(verifySessionCookie()).resolves.toBe(false);
    await expect(verifySessionCookie("not-a-session")).resolves.toBe(false);
    await expect(verifySessionCookie(`${cookie}extra`)).resolves.toBe(false);
  });

  it("rejects expired sessions", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    const cookie = await createSessionCookie("admin-user-1");
    vi.setSystemTime(new Date("2026-01-09T00:00:00Z"));

    await expect(verifySessionCookie(cookie)).resolves.toBe(false);
  });

  it("accepts valid unexpired sessions", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    const cookie = await createSessionCookie("admin-user-1");
    vi.setSystemTime(new Date("2026-01-02T00:00:00Z"));

    await expect(verifySessionCookie(cookie)).resolves.toBe(true);
  });
});
