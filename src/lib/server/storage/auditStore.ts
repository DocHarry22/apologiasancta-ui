import type { AuditEvent, AuditEventType, AuditSeverity } from "./types";
import { JsonStore, newId } from "./jsonStore";
import type { Role } from "../../auth/roles";

interface AuditActor {
  id: string;
  displayName: string;
  role: Role;
}

const SECRET_KEYS = [
  "engine_admin_token",
  "x-admin-token",
  "x-csrf-token",
  "csrf",
  "cookie",
  "authorization",
  "password",
  "token",
  "secret",
  "session",
];

const auditStore = new JsonStore<AuditEvent[]>("audit-events.json", []);
let auditMutationQueue: Promise<void> = Promise.resolve();

export interface AuditFilters {
  eventType?: string;
  actorRole?: string;
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  severity?: string;
  status?: string;
  from?: string;
  to?: string;
  search?: string;
}

export function sanitizeAuditMetadata(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const sanitized: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const lower = key.toLowerCase();
    if (SECRET_KEYS.some((secretKey) => lower.includes(secretKey))) {
      sanitized[key] = "[redacted]";
    } else if (raw && typeof raw === "object") {
      sanitized[key] = sanitizeAuditMetadata(raw) ?? {};
    } else {
      sanitized[key] = raw;
    }
  }
  return sanitized;
}

export async function appendAuditEvent(input: {
  actor: AuditActor;
  eventType: AuditEventType;
  action: string;
  resourceType: string;
  resourceId?: string;
  method?: string;
  path?: string;
  status?: AuditEvent["status"];
  blockedBy?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  severity?: AuditSeverity;
}): Promise<AuditEvent> {
  const event: AuditEvent = {
    id: newId("audit"),
    timestamp: new Date().toISOString(),
    actorId: input.actor.id,
    actorName: input.actor.displayName,
    actorRole: input.actor.role,
    eventType: input.eventType,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    method: input.method,
    path: input.path,
    status: input.status ?? "success",
    blockedBy: input.blockedBy,
    ip: input.ip,
    userAgent: input.userAgent,
    metadata: sanitizeAuditMetadata(input.metadata),
    severity: input.severity ?? "info",
  };
  const operation = auditMutationQueue.then(async () => {
    const events = await auditStore.read();
    events.unshift(event);
    await auditStore.write(events.slice(0, 5000));
  });
  auditMutationQueue = operation.catch(() => undefined);
  await operation;
  return event;
}

export async function listAuditEvents(filters: AuditFilters = {}): Promise<AuditEvent[]> {
  const events = await auditStore.read();
  const from = filters.from ? Date.parse(filters.from) : null;
  const to = filters.to ? Date.parse(filters.to) : null;
  const search = filters.search?.trim().toLowerCase();

  return events.filter((event) => {
    if (filters.eventType && event.eventType !== filters.eventType) return false;
    if (filters.actorRole && event.actorRole !== filters.actorRole) return false;
    if (filters.actorId && event.actorId !== filters.actorId) return false;
    if (filters.resourceType && event.resourceType !== filters.resourceType) return false;
    if (filters.resourceId && event.resourceId !== filters.resourceId) return false;
    if (filters.severity && event.severity !== filters.severity) return false;
    if (filters.status && event.status !== filters.status) return false;
    const timestamp = Date.parse(event.timestamp);
    if (from && timestamp < from) return false;
    if (to && timestamp > to) return false;
    if (search) {
      const haystack = `${event.eventType} ${event.action} ${event.actorName} ${event.resourceType} ${event.resourceId ?? ""}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}
