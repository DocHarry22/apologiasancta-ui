import type { NextRequest } from "next/server";

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

interface RateEntry {
  attempts: number;
  windowStartMs: number;
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
