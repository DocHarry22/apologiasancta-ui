import type { NextRequest } from "next/server";

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

interface RateEntry {
  attempts: number;
  windowStartMs: number;
}

/**
 * RateLimiter interface.
 *
 * The in-memory implementation below is suitable for single-instance
 * deployments (development, single-server production).
 *
 * For multi-instance/serverless deployments, provide a Redis / KV-backed
 * implementation that satisfies this interface and swap it in at the
 * call-sites in the login route.
 */
export interface RateLimiter {
  check(key: string): { allowed: boolean; retryAfterSeconds?: number };
  clear(key: string): void;
}

const loginAttempts = new Map<string, RateEntry>();

export function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return req.headers.get("x-real-ip") || "unknown";
}

export function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const current = loginAttempts.get(ip);

  if (!current || now - current.windowStartMs >= WINDOW_MS) {
    loginAttempts.set(ip, { attempts: 1, windowStartMs: now });
    return { allowed: true };
  }

  if (current.attempts >= MAX_ATTEMPTS) {
    const retryAfterMs = WINDOW_MS - (now - current.windowStartMs);
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  current.attempts += 1;
  loginAttempts.set(ip, current);
  return { allowed: true };
}

export function clearLoginRateLimit(ip: string): void {
  loginAttempts.delete(ip);
}

// ---------------------------------------------------------------------------
// Admin mutation rate limiter
// ---------------------------------------------------------------------------
// Limits POST requests to /api/admin/* per source IP.
// Protects against credential-theft amplification and engine mutation floods.
// Limits are intentionally generous so normal admin workflows are unaffected.

const ADMIN_MUTATION_MAX = 200;
const ADMIN_MUTATION_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

const adminMutationAttempts = new Map<string, RateEntry>();

export function checkAdminMutationRateLimit(ip: string): {
  allowed: boolean;
  retryAfterSeconds?: number;
} {
  const now = Date.now();
  const current = adminMutationAttempts.get(ip);

  if (!current || now - current.windowStartMs >= ADMIN_MUTATION_WINDOW_MS) {
    adminMutationAttempts.set(ip, { attempts: 1, windowStartMs: now });
    return { allowed: true };
  }

  if (current.attempts >= ADMIN_MUTATION_MAX) {
    const retryAfterMs = ADMIN_MUTATION_WINDOW_MS - (now - current.windowStartMs);
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  current.attempts += 1;
  adminMutationAttempts.set(ip, current);
  return { allowed: true };
}
