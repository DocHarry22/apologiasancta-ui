import type { NextRequest } from "next/server";
import { hasPermission, isRole } from "@/lib/auth/roles";
import { forbidden, readJsonBody, requireAuthorSession, requireCsrf, safeJson } from "@/lib/server/apiAuth";
import { appendAuditEvent } from "@/lib/server/storage/auditStore";
import { getClientIp } from "@/lib/auth/rateLimit";
import { generateInviteCode, getAuthInviteSettings, isAllowedStaffInviteRole, setAuthInviteSettings } from "@/lib/server/authInviteSettings";

export async function GET(request: NextRequest) {
  const auth = await requireAuthorSession(request);
  if (!auth.ok) return auth.response;

  if (!hasPermission(auth.user.role, "users:manage")) {
    return forbidden(request, auth.user, "missing users:manage");
  }

  const settings = await getAuthInviteSettings();

  await appendAuditEvent({
    actor: auth.user,
    eventType: "auth.invite_settings_read",
    action: "Read invite settings",
    resourceType: "auth",
    resourceId: "invite-settings",
    method: request.method,
    path: request.nextUrl.pathname,
    status: "success",
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent") ?? undefined,
    severity: "info",
    metadata: {
      source: settings.source,
      hasInviteCode: Boolean(settings.inviteCode),
      staffRole: settings.staffRole,
    },
  });

  return safeJson({
    ok: true,
    settings: {
      inviteCode: settings.inviteCode,
      staffRole: settings.staffRole,
      source: settings.source,
      updatedAt: settings.updatedAt,
    },
  });
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
  const rotate = body.rotate === true;
  const inviteCodeInput = typeof body.inviteCode === "string" ? body.inviteCode.trim() : "";
  const staffRoleInput = typeof body.staffRole === "string" ? body.staffRole : "";

  if (!isRole(staffRoleInput) || !isAllowedStaffInviteRole(staffRoleInput)) {
    return safeJson({ ok: false, error: "Invalid staff role" }, 400);
  }

  const inviteCode = rotate ? generateInviteCode() : inviteCodeInput;
  if (!inviteCode) {
    return safeJson({ ok: false, error: "Invite code is required" }, 400);
  }

  const settings = await setAuthInviteSettings({ inviteCode, staffRole: staffRoleInput });

  await appendAuditEvent({
    actor: auth.user,
    eventType: "auth.invite_settings_update",
    action: rotate ? "Rotate invite settings" : "Update invite settings",
    resourceType: "auth",
    resourceId: "invite-settings",
    method: request.method,
    path: request.nextUrl.pathname,
    status: "success",
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent") ?? undefined,
    severity: "warning",
    metadata: {
      rotate,
      staffRole: settings.staffRole,
    },
  });

  return safeJson({ ok: true, settings });
}
