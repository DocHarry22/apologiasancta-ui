import type { NextRequest } from "next/server";
import { isRole, hasPermission } from "@/lib/auth/roles";
import { forbidden, readJsonBody, requireAuthorSession, requireCsrf, safeJson } from "@/lib/server/apiAuth";
import { appendAuditEvent } from "@/lib/server/storage/auditStore";
import { getClientIp } from "@/lib/auth/rateLimit";
import { listAdminUsers, updateAdminUser } from "@/lib/server/adminUserStore";

function isStatus(value: unknown): value is "active" | "inactive" {
  return value === "active" || value === "inactive";
}

export async function GET(request: NextRequest) {
  const auth = await requireAuthorSession(request);
  if (!auth.ok) return auth.response;

  if (!hasPermission(auth.user.role, "users:manage")) {
    return forbidden(request, auth.user, "missing users:manage");
  }

  const users = await listAdminUsers();

  await appendAuditEvent({
    actor: auth.user,
    eventType: "auth.user_list",
    action: "List auth users",
    resourceType: "auth",
    resourceId: "users",
    method: request.method,
    path: request.nextUrl.pathname,
    status: "success",
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent") ?? undefined,
    severity: "info",
    metadata: { count: users.length },
  });

  return safeJson({ ok: true, users });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuthorSession(request);
  if (!auth.ok) return auth.response;

  if (!hasPermission(auth.user.role, "users:manage")) {
    return forbidden(request, auth.user, "missing users:manage");
  }

  const csrfError = await requireCsrf(request, auth.user);
  if (csrfError) return csrfError;

  const body = await readJsonBody(request);
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : undefined;
  const phone = typeof body.phone === "string" ? body.phone : body.phone === null ? null : undefined;
  const role = typeof body.role === "string" && isRole(body.role) ? body.role : undefined;
  const status = isStatus(body.status) ? body.status : undefined;

  if (!userId) {
    return safeJson({ ok: false, error: "userId is required" }, 400);
  }

  if (role === undefined && status === undefined && displayName === undefined && phone === undefined) {
    return safeJson({ ok: false, error: "At least one update field is required" }, 400);
  }

  if (userId === auth.user.id && (role !== undefined || status !== undefined)) {
    await appendAuditEvent({
      actor: auth.user,
      eventType: "auth.user_update",
      action: "Blocked self role/status change",
      resourceType: "auth",
      resourceId: userId,
      method: request.method,
      path: request.nextUrl.pathname,
      status: "blocked",
      blockedBy: "self-mutation-guard",
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
      severity: "warning",
      metadata: {
        role,
        status,
      },
    });
    return safeJson({ ok: false, error: "You cannot change your own role or status while signed in." }, 400);
  }

  const updated = await updateAdminUser({
    id: userId,
    role,
    status,
    displayName,
    phone,
  });

  if (!updated) {
    return safeJson({ ok: false, error: "Unable to update user" }, 400);
  }

  await appendAuditEvent({
    actor: auth.user,
    eventType: "auth.user_update",
    action: "Update auth user",
    resourceType: "auth",
    resourceId: userId,
    method: request.method,
    path: request.nextUrl.pathname,
    status: "success",
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent") ?? undefined,
    severity: "warning",
    metadata: {
      role,
      status,
      displayName: displayName !== undefined,
      phone: phone !== undefined,
    },
  });

  return safeJson({ ok: true, user: updated });
}
