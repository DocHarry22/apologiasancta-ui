import { createHash } from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { getClientIp } from "@/lib/auth/rateLimit";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { getAdminAuthReadiness } from "@/lib/auth/availability";
import { CSRF_COOKIE_NAME } from "@/lib/csrf";
import { consumeAccountEmailToken, takeAccountEmailLimit, type AccountEmailPurpose } from "./adminUserStore";
import { hasAccountEmailConfiguration, requestAccountEmail } from "./accountEmail";
import { readJsonBody } from "./apiAuth";

function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export function scheduleAccountEmail(email: string, purpose: AccountEmailPurpose): void {
  // Delivery runs after the response, so account existence and provider latency
  // cannot be measured through the public request endpoint.
  after(async () => {
    try { await requestAccountEmail(email, purpose); }
    catch { console.error("Account email could not be delivered."); }
  });
}

async function guard(request: NextRequest, action: "request" | "consume") {
  if (request.headers.get("sec-fetch-site") === "cross-site") return json({ error: "Use the account form on this site." }, 403);
  const origin = request.headers.get("origin");
  const publicOrigin = process.env.AUTH_PUBLIC_URL ? new URL(process.env.AUTH_PUBLIC_URL).origin : request.nextUrl.origin;
  if (origin && origin !== publicOrigin) return json({ error: "Use the account form on this site." }, 403);
  if (!getAdminAuthReadiness().ready || (action === "request" && !hasAccountEmailConfiguration())) {
    return json({ error: "Account email services are temporarily unavailable. Please try again later." }, 503, { "Retry-After": "300" });
  }
  const key = createHash("sha256").update(`${action}:${getClientIp(request)}`).digest("hex");
  const limit = await takeAccountEmailLimit(key, action === "request" ? 20 : 30, action === "request" ? 60 * 60 * 1000 : 15 * 60 * 1000);
  if (!limit.allowed) return json({ error: "Too many attempts. Please try again later." }, 429, { "Retry-After": String(limit.retryAfterSeconds) });
  return null;
}

export async function requestAccountEmailRoute(request: NextRequest, purpose: AccountEmailPurpose) {
  try {
    const failure = await guard(request, "request");
    if (failure) return failure;
    const body = await readJsonBody(request);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email address." }, 400);
    scheduleAccountEmail(email, purpose);
    return json({ ok: true, message: purpose === "reset"
      ? "If an eligible account uses this address, a password reset link will arrive shortly. Check your inbox and spam folder."
      : "If this address needs verification, a verification link will arrive shortly. Check your inbox and spam folder." });
  } catch {
    return json({ error: "Account email services are temporarily unavailable. Please try again later." }, 503, { "Retry-After": "300" });
  }
}

export async function consumeAccountEmailRoute(request: NextRequest, purpose: AccountEmailPurpose) {
  try {
    const failure = await guard(request, "consume");
    if (failure) return failure;
    const body = await readJsonBody(request);
    const token = typeof body.token === "string" ? body.token : "";
    const password = typeof body.newPassword === "string" ? body.newPassword : "";
    if (purpose === "reset" && (password.length < 8 || password.length > 256 || password !== body.confirmPassword)) {
      return json({ error: "Use 8–256 characters and make sure both passwords match." }, 400);
    }
    if (!(await consumeAccountEmailToken(token, purpose, password))) {
      return json({ error: "This link is invalid, expired, or already used. Request a new link.", code: "invalid_link" }, 400);
    }
    const response = json({ ok: true });
    if (purpose === "reset") {
      for (const name of [SESSION_COOKIE_NAME, CSRF_COOKIE_NAME]) {
        response.cookies.set({ name, value: "", httpOnly: name === SESSION_COOKIE_NAME, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
      }
    }
    return response;
  } catch {
    return json({ error: "Your account could not be updated. Please try again later." }, 503, { "Retry-After": "300" });
  }
}
