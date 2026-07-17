import type { NextRequest } from "next/server";

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_TRACKED_KEYS = 10_000;

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
const signupAttempts = new Map<string, RateEntry>();

function normalizeRateLimitKey(value: string): string {
  return value.trim().slice(0, 128) || "unknown";
}

function pruneExpiredEntries(store: Map<string, RateEntry>, now: number, windowMs: number): void {
  if (store.size < MAX_TRACKED_KEYS) return;
  for (const [key, entry] of store) {
    if (now - entry.windowStartMs >= windowMs) store.delete(key);
  }
  while (store.size >= MAX_TRACKED_KEYS) {
    const oldestKey = store.keys().next().value as string | undefined;
    if (!oldestKey) break;
    store.delete(oldestKey);
  }
}

function checkFixedWindow(store: Map<string, RateEntry>, key: string, maxAttempts: number, windowMs: number) {
  const now = Date.now();
  pruneExpiredEntries(store, now, windowMs);
  const normalizedKey = normalizeRateLimitKey(key);
  const current = store.get(normalizedKey);
  if (!current || now - current.windowStartMs >= windowMs) {
    store.set(normalizedKey, { attempts: 1, windowStartMs: now });
    return { allowed: true };
  }
  if (current.attempts >= maxAttempts) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - current.windowStartMs)) / 1000)) };
  }
  current.attempts += 1;
  return { allowed: true };
}

export function getClientIp(req: NextRequest): string {
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return normalizeRateLimitKey(realIp);

  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const chain = forwardedFor.split(",").map((value) => value.trim()).filter(Boolean);
    return normalizeRateLimitKey(chain.at(-1) || "unknown");
  }

  return "unknown";
}

export function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
  return checkFixedWindow(loginAttempts, ip, MAX_ATTEMPTS, WINDOW_MS);
}

export function clearLoginRateLimit(ip: string): void {
  loginAttempts.delete(normalizeRateLimitKey(ip));
}

export function checkSignupRateLimit(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
  return checkFixedWindow(signupAttempts, ip, 5, 60 * 60 * 1000);
}

export function clearSignupRateLimit(ip: string): void {
  signupAttempts.delete(normalizeRateLimitKey(ip));
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
  return checkFixedWindow(adminMutationAttempts, ip, ADMIN_MUTATION_MAX, ADMIN_MUTATION_WINDOW_MS);
}

// ---------------------------------------------------------------------------
// Account-linked quiz identity rate limiter
// ---------------------------------------------------------------------------
// The Engine sees Hostinger's shared egress IP, so it cannot fairly apply a
// small per-IP limit. Apply a narrower per-account ceiling before minting an
// assertion and keep the Engine's high shared-server ceiling as defence in
// depth.

const ACCOUNT_IDENTITY_MAX = 30;
const ACCOUNT_IDENTITY_WINDOW_MS = 60 * 1000;
const accountIdentityAttempts = new Map<string, RateEntry>();

export function checkAccountIdentityRateLimit(accountId: string): {
  allowed: boolean;
  retryAfterSeconds?: number;
} {
  return checkFixedWindow(
    accountIdentityAttempts,
    `account:${accountId}`,
    ACCOUNT_IDENTITY_MAX,
    ACCOUNT_IDENTITY_WINDOW_MS
  );
}

export function clearAccountIdentityRateLimit(accountId: string): void {
  accountIdentityAttempts.delete(normalizeRateLimitKey(`account:${accountId}`));
}
