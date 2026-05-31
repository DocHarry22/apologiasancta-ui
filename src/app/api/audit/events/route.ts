import type { NextRequest } from "next/server";
import { hasPermission } from "@/lib/auth/roles";
import { forbidden, requireAuthorSession, safeJson } from "@/lib/server/apiAuth";
import { listAuditEvents } from "@/lib/server/storage/auditStore";

export async function GET(request: NextRequest) {
  const auth = await requireAuthorSession(request);
  if (!auth.ok) return auth.response;
  if (!hasPermission(auth.user.role, "audit:view")) {
    return forbidden(request, auth.user, "missing audit:view");
  }

  const query = request.nextUrl.searchParams;
  const events = await listAuditEvents({
    eventType: query.get("eventType") || undefined,
    actorRole: query.get("actorRole") || undefined,
    actorId: query.get("actorId") || undefined,
    resourceType: query.get("resourceType") || undefined,
    resourceId: query.get("resourceId") || undefined,
    severity: query.get("severity") || undefined,
    from: query.get("from") || undefined,
    to: query.get("to") || undefined,
    status: query.get("status") || undefined,
    search: query.get("search") || undefined,
  });

  const limited = auth.user.role === "super_admin" ? events : events.filter((event) => event.resourceType !== "auth");
  return safeJson({ ok: true, events: limited.slice(0, 500) });
}

