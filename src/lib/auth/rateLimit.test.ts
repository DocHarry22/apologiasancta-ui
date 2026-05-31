import { describe, expect, it, vi } from "vitest";
import { checkAdminMutationRateLimit, checkLoginRateLimit, clearLoginRateLimit } from "./rateLimit";

describe("rate limiters", () => {
  it("allows login requests within limit and blocks after limit", () => {
    const key = "login-limit-test";
    clearLoginRateLimit(key);

    for (let i = 0; i < 10; i++) {
      expect(checkLoginRateLimit(key).allowed).toBe(true);
    }

    const blocked = checkLoginRateLimit(key);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets login limit after window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const key = "login-reset-test";
    clearLoginRateLimit(key);

    for (let i = 0; i < 10; i++) checkLoginRateLimit(key);
    expect(checkLoginRateLimit(key).allowed).toBe(false);

    vi.setSystemTime(new Date("2026-01-01T00:16:00Z"));
    expect(checkLoginRateLimit(key).allowed).toBe(true);
  });

  it("allows admin mutations within limit and returns retry-after when blocked", () => {
    const key = "admin-limit-test";

    for (let i = 0; i < 200; i++) {
      expect(checkAdminMutationRateLimit(key).allowed).toBe(true);
    }

    const blocked = checkAdminMutationRateLimit(key);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets admin mutation limit after window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const key = "admin-reset-test";

    for (let i = 0; i < 200; i++) checkAdminMutationRateLimit(key);
    expect(checkAdminMutationRateLimit(key).allowed).toBe(false);

    vi.setSystemTime(new Date("2026-01-01T00:06:00Z"));
    expect(checkAdminMutationRateLimit(key).allowed).toBe(true);
  });
});
