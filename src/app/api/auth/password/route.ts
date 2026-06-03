import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createSessionCookie, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/session";
import { CSRF_COOKIE_NAME, generateCsrfToken } from "@/lib/csrf";
import { changeAdminUserPassword } from "@/lib/server/adminUserStore";
import { forbidden, readJsonBody, requireAuthorSession, requireCsrf, safeJson } from "@/lib/server/apiAuth";
import { appendAuditEvent } from "@/lib/server/storage/auditStore";
import { getClientIp } from "@/lib/auth/rateLimit";

export async function PATCH(request: NextRequest) {
  const auth = await requireAuthorSession(request);
  if (!auth.ok) return auth.response;

  const csrfError = await requireCsrf(request, auth.user);
  if (csrfError) return csrfError;

  const body = await readJsonBody(request);
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";

  if (!currentPassword || !newPassword || !confirmPassword) {
    return safeJson({ ok: false, error: "currentPassword, newPassword, and confirmPassword are required" }, 400);
  }

  if (newPassword.length < 8) {
    return safeJson({ ok: false, error: "New password must be at least 8 characters." }, 400);
  }

  if (newPassword !== confirmPassword) {
    return safeJson({ ok: false, error: "Passwords do not match." }, 400);
  }

  if (newPassword === currentPassword) {
    return safeJson({ ok: false, error: "New password must be different from current password." }, 400);
  }

  const result = await changeAdminUserPassword(auth.user.id, currentPassword, newPassword);

  if (result === "invalid_current") {
    await appendAuditEvent({
      actor: auth.user,
      eventType: "auth.password_change",
      action: "Password change failed",
      resourceType: "auth",
      resourceId: auth.user.id,
      method: request.method,
      path: request.nextUrl.pathname,
      status: "failure",
      blockedBy: "invalid_current_password",
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
      severity: "warning",
    });
    return safeJson({ ok: false, error: "Current password is incorrect." }, 400);
  }

  if (result === "not_found") {
    return forbidden(request, auth.user, "password-change-user-not-found", "auth.password_change");
  }

  await appendAuditEvent({
    actor: auth.user,
    eventType: "auth.password_change",
    action: "Password changed",
    resourceType: "auth",
    resourceId: auth.user.id,
    method: request.method,
    path: request.nextUrl.pathname,
    status: "success",
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent") ?? undefined,
    severity: "info",
  });

  const sessionValue = await createSessionCookie(auth.user.id);
  const csrfToken = await generateCsrfToken(sessionValue);

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
