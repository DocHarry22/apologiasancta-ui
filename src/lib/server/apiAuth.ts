import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { readSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { verifyCsrfToken } from "@/lib/csrf";
import { getClientIp } from "@/lib/auth/rateLimit";
import { getCurrentUser, type CurrentUser } from "./currentUser";
import { appendAuditEvent } from "./storage/auditStore";
import type { AuditEventType } from "./storage/types";

export function safeJson(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export async function requireAuthorSession(request: NextRequest): Promise<{ ok: true; user: CurrentUser } | { ok: false; response: NextResponse }> {
  const sessionValue = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await readSessionCookie(sessionValue);
  if (!session) {
    return { ok: false, response: safeJson({ ok: false, error: "Unauthorized" }, 401) };
  }
  const user = await getCurrentUser(session.userId);
  return { ok: true, user };
}

export async function requireCsrf(request: NextRequest, user: CurrentUser): Promise<NextResponse | null> {
  const sessionValue = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const csrfHeader = request.headers.get("x-csrf-token");
  if (!sessionValue || !csrfHeader || !(await verifyCsrfToken(sessionValue, csrfHeader))) {
    await appendAuditEvent({
      actor: user,
      eventType: "security.csrf_failed",
      action: "CSRF validation failed",
      resourceType: "request",
      method: request.method,
      path: request.nextUrl.pathname,
      status: "blocked",
      blockedBy: "csrf",
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
      severity: "warning",
    });
    return safeJson({ ok: false, error: "CSRF validation failed" }, 403);
  }
  return null;
}

export async function forbidden(request: NextRequest, user: CurrentUser, reason: string, eventType: AuditEventType = "security.forbidden"): Promise<NextResponse> {
  await appendAuditEvent({
    actor: user,
    eventType,
    action: "Forbidden request",
    resourceType: "request",
    method: request.method,
    path: request.nextUrl.pathname,
    status: "blocked",
    blockedBy: reason,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent") ?? undefined,
    severity: "warning",
  });
  return safeJson({ ok: false, error: "Forbidden" }, 403);
}

export async function readJsonBody(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

