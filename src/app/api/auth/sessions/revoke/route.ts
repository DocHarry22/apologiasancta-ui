import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createSessionCookie, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/session";
import { CSRF_COOKIE_NAME, generateCsrfToken } from "@/lib/csrf";
import { revokeAdminUserOtherSessions } from "@/lib/server/adminUserStore";
import { forbidden, requireAuthorSession, requireCsrf, safeJson } from "@/lib/server/apiAuth";
import { appendAuditEvent } from "@/lib/server/storage/auditStore";
import { getClientIp } from "@/lib/auth/rateLimit";

export async function POST(request: NextRequest) {
  const auth = await requireAuthorSession(request);
  if (!auth.ok) return auth.response;

  const csrfError = await requireCsrf(request, auth.user);
  if (csrfError) return csrfError;

  const result = await revokeAdminUserOtherSessions(auth.user.id);
  if (result === "not_found") {
    return forbidden(request, auth.user, "session-revoke-user-not-found", "auth.session_revoke");
  }

  const sessionValue = await createSessionCookie(auth.user.id);
  const csrfToken = await generateCsrfToken(sessionValue);

  await appendAuditEvent({
    actor: auth.user,
    eventType: "auth.session_revoke",
    action: "Revoked other sessions",
    resourceType: "auth",
    resourceId: auth.user.id,
    method: request.method,
    path: request.nextUrl.pathname,
    status: "success",
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent") ?? undefined,
    severity: "info",
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: sessionValue,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  response.cookies.set({
    name: CSRF_COOKIE_NAME,
    value: csrfToken,
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return response;
}
