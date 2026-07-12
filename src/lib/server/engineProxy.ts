import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { verifyAdminSession } from "./adminAuth";
import { getCurrentUser } from "./currentUser";
import { readSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { verifyCsrfToken } from "@/lib/csrf";
import { checkAdminMutationRateLimit, getClientIp } from "@/lib/auth/rateLimit";
import { hasPermission, type Permission } from "@/lib/auth/roles";
import { appendAuditEvent } from "./storage/auditStore";
import type { Role } from "@/lib/auth/roles";

// ---------------------------------------------------------------------------
// Engine config helpers (server-side only)
// ---------------------------------------------------------------------------

function getEngineBaseUrl(): string | null {
  return (
    process.env.ENGINE_INTERNAL_URL?.trim() ||
    process.env.NEXT_PUBLIC_ENGINE_URL?.trim() ||
    null
  );
}

function getAdminToken(): string | null {
  return process.env.ENGINE_ADMIN_TOKEN?.trim() || null;
}

// ---------------------------------------------------------------------------
// Audit logging
// ---------------------------------------------------------------------------
// Emits structured JSON to stdout so the host platform's log aggregator
// (Render, Railway, etc.) can capture and filter admin action events.
// IMPORTANT: Never log session/CSRF token values, request bodies, or secrets.

type AuditOutcome = "allowed" | "blocked_unauthed" | "blocked_forbidden" | "blocked_rate_limit" | "blocked_csrf" | "blocked_allowlist" | "proxy_error";

function auditLog(entry: {
  method: string;
  path: string;
  ip: string;
  outcome: AuditOutcome;
  statusCode: number;
  reason?: string;
  userId?: string;
  role?: string;
}) {
  console.log(
    JSON.stringify({
      t: new Date().toISOString(),
      domain: "admin_proxy",
      ...entry,
    })
  );
  if (entry.userId && entry.role) {
    void appendAuditEvent({
      actor: { id: entry.userId, displayName: entry.userId, role: entry.role as Role },
      eventType: entry.outcome === "allowed" ? "admin.engine_mutation" : "admin.proxy_blocked",
      action: entry.outcome === "allowed" ? "Admin engine request proxied" : "Admin engine request blocked",
      resourceType: "admin_proxy",
      resourceId: entry.path,
      method: entry.method,
      path: `/api/admin/${entry.path}`,
      status: entry.outcome === "allowed" ? "success" : "blocked",
      blockedBy: entry.outcome === "allowed" ? undefined : entry.outcome,
      ip: entry.ip,
      metadata: { statusCode: entry.statusCode, reason: entry.reason },
      severity: entry.outcome === "allowed" ? "info" : "warning",
    }).catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// Route allowlist
// ---------------------------------------------------------------------------

/**
 * Only path segments matching this pattern are accepted.
 * Prevents path traversal (../), encoded slashes, empty segments, and
 * any character outside the safe alphanumeric/hyphen/underscore set.
 */
const SAFE_SEGMENT = /^[a-zA-Z0-9_-]+$/;

type AllowedMethod = "GET" | "POST" | "PATCH";

interface RouteRule {
  /** Tested against path segments joined with "/". */
  pattern: RegExp;
  methods: AllowedMethod[];
}

/**
 * Explicit allowlist of admin routes that may be proxied to the engine.
 *
 * ONLY routes listed here are forwarded — everything else returns 404.
 * Adding new engine admin endpoints requires an explicit entry here.
 */
const ADMIN_ROUTE_ALLOWLIST: RouteRule[] = [
  // ── Global engine controls ────────────────────────────────────────────────
  { pattern: /^status$/,            methods: ["GET"] },
  { pattern: /^start$/,             methods: ["POST"] },
  { pattern: /^resume$/,            methods: ["POST"] },
  { pattern: /^pause$/,             methods: ["POST"] },
  { pattern: /^next$/,              methods: ["POST"] },
  { pattern: /^reset$/,             methods: ["POST"] },
  { pattern: /^persistence\/save$/, methods: ["POST"] },

  // ── Room management ───────────────────────────────────────────────────────
  { pattern: /^rooms$/,                             methods: ["GET", "POST"] },
  { pattern: /^rooms\/[a-zA-Z0-9_-]+\/close$/,      methods: ["POST"] },

  // ── Content management ────────────────────────────────────────────────────
  { pattern: /^content\/status$/,        methods: ["GET"] },
  { pattern: /^content\/import$/,        methods: ["POST"] },
  { pattern: /^content\/clear$/,         methods: ["POST"] },
  { pattern: /^content\/sync$/,          methods: ["POST"] },
  { pattern: /^content\/github\/clear$/, methods: ["POST"] },

  // ── Quiz pool ─────────────────────────────────────────────────────────────
  { pattern: /^quiz\/set$/, methods: ["POST"] },

  // ── Topic / series / countdown ────────────────────────────────────────────
  { pattern: /^topic\/sequence$/,                  methods: ["GET", "POST"] },
  { pattern: /^topic\/next$/,                      methods: ["POST"] },
  { pattern: /^topic\/start\/[a-zA-Z0-9_-]+$/,     methods: ["POST"] },
  { pattern: /^topic\/cancel-auto$/,               methods: ["POST"] },
  { pattern: /^topic\/skip$/,                      methods: ["POST"] },
  { pattern: /^topic\/replay$/,                    methods: ["POST"] },
  { pattern: /^topic\/countdown$/,                 methods: ["POST"] },
  { pattern: /^topic\/loop$/,                      methods: ["POST"] },
  { pattern: /^series\/loop$/,                     methods: ["POST"] },
  { pattern: /^countdown\/set$/,                   methods: ["POST"] },

  // ── Room-scoped engine controls ───────────────────────────────────────────
  { pattern: /^rooms\/[a-zA-Z0-9_-]+\/status$/,          methods: ["GET"] },
  { pattern: /^rooms\/[a-zA-Z0-9_-]+\/start$/,           methods: ["POST"] },
  { pattern: /^rooms\/[a-zA-Z0-9_-]+\/resume$/,          methods: ["POST"] },
  { pattern: /^rooms\/[a-zA-Z0-9_-]+\/pause$/,           methods: ["POST"] },
  { pattern: /^rooms\/[a-zA-Z0-9_-]+\/next$/,            methods: ["POST"] },
  { pattern: /^rooms\/[a-zA-Z0-9_-]+\/reset$/,           methods: ["POST"] },
  { pattern: /^rooms\/[a-zA-Z0-9_-]+\/topic\/sequence$/, methods: ["GET", "POST"] },
  { pattern: /^rooms\/[a-zA-Z0-9_-]+\/topic\/next$/,     methods: ["POST"] },
  { pattern: /^rooms\/[a-zA-Z0-9_-]+\/topic\/start\/[a-zA-Z0-9_-]+$/, methods: ["POST"] },
  { pattern: /^rooms\/[a-zA-Z0-9_-]+\/topic\/cancel-auto$/, methods: ["POST"] },
  { pattern: /^rooms\/[a-zA-Z0-9_-]+\/topic\/skip$/,     methods: ["POST"] },
  { pattern: /^rooms\/[a-zA-Z0-9_-]+\/topic\/replay$/,   methods: ["POST"] },
  { pattern: /^rooms\/[a-zA-Z0-9_-]+\/topic\/countdown$/, methods: ["POST"] },
  { pattern: /^rooms\/[a-zA-Z0-9_-]+\/topic\/loop$/,     methods: ["POST"] },
  { pattern: /^rooms\/[a-zA-Z0-9_-]+\/series\/loop$/,    methods: ["POST"] },
  { pattern: /^rooms\/[a-zA-Z0-9_-]+\/countdown\/set$/,  methods: ["POST"] },
];

type RouteCheckResult =
  | { ok: true; enginePath: string }
  | { ok: false; status: 400 | 404 | 405; error: string };

/**
 * Validates path segments against the allowlist.
 *
 * Returns a safe engine path on success, or a structured error
 * distinguishing bad input (400), unknown route (404), and wrong method (405).
 */
export function checkAllowedRoute(segments: string[], method: string): RouteCheckResult {
  if (segments.length === 0) {
    return { ok: false, status: 404, error: "Admin route not found." };
  }

  // Reject any segment that contains characters outside the safe set.
  // This catches ../  encoded slashes, null bytes, and empty segments
  // before the allowlist is even consulted.
  for (const seg of segments) {
    if (!SAFE_SEGMENT.test(seg)) {
      return { ok: false, status: 400, error: "Invalid path segment." };
    }
  }

  const joinedPath = segments.join("/");

  const rule = ADMIN_ROUTE_ALLOWLIST.find((r) => r.pattern.test(joinedPath));
  if (!rule) {
    return { ok: false, status: 404, error: "Admin route not found." };
  }

  if (!rule.methods.includes(method as AllowedMethod)) {
    return {
      ok: false,
      status: 405,
      error: `Method ${method} is not allowed on this route.`,
    };
  }

  return { ok: true, enginePath: `/admin/${joinedPath}` };
}

function requiredPermissionForRoute(path: string, method: string): Permission {
  if (method === "GET" && path === "status") return "overview:view";
  if (method === "GET" && /^rooms\/[a-zA-Z0-9_-]+\/status$/.test(path)) return "overview:view";
  if (method === "GET" && path === "content/status") return "content:view";
  if (method === "GET" && path === "rooms") return "rooms:manage";
  if (/^releases(?:\/|$)/.test(path)) return "audit:view";
  if (method === "GET" && /(^|\/)topic\/sequence$/.test(path)) return "topic_sequence:manage";

  if (/content\/import$/.test(path)) return "content:import";
  if (/content\/clear$/.test(path) || /content\/github\/clear$/.test(path) || /reset$/.test(path) || path === "persistence/save") return "dangerous:execute";
  if (path === "rooms" || /rooms\/[a-zA-Z0-9_-]+\/close$/.test(path)) return "rooms:manage";
  if (path === "quiz/set" || /(^|\/)topic\/sequence$/.test(path)) return "topic_sequence:manage";
  if (/topic\/(next|start\/[a-zA-Z0-9_-]+|cancel-auto|skip|replay|countdown|loop)$/.test(path)) return "live:control";
  if (/(^|\/)series\/loop$/.test(path) || /(^|\/)countdown\/set$/.test(path)) return "live:control";
  if (/(^|\/)(start|resume|pause|next)$/.test(path)) return "live:control";

  return "dashboard:view";
}

// ---------------------------------------------------------------------------
// Proxy
// ---------------------------------------------------------------------------

/**
 * Proxies an authenticated admin request to the engine.
 *
 * Security contract:
 *  - Author session cookie is verified before any engine call.
 *  - CSRF token is verified for all mutations (non-GET / non-HEAD).
 *  - Only routes on ADMIN_ROUTE_ALLOWLIST are forwarded; all others → 404.
 *  - Dynamic segments (roomId, topicId) must match [a-zA-Z0-9_-]+.
 *  - ENGINE_ADMIN_TOKEN is injected server-side only; never returned to client.
 *  - Internal engine URL is never included in error messages sent to the browser.
 *
 * @param request      - The incoming Next.js request.
 * @param pathSegments - Decoded path segments after /api/admin/
 *                       (e.g. ["status"] or ["rooms","my-room","close"]).
 */
export async function proxyAdminRequest(
  request: NextRequest,
  pathSegments: string[]
): Promise<NextResponse> {
  const ip = getClientIp(request);
  const joinedPath = pathSegments.join("/");

  // 1. Verify author session.
  const isAuthed = await verifyAdminSession();
  if (!isAuthed) {
    auditLog({ method: request.method, path: joinedPath, ip, outcome: "blocked_unauthed", statusCode: 401 });
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  // 2. Rate limit for mutation requests.
  if (request.method !== "GET" && request.method !== "HEAD") {
    const rateLimit = checkAdminMutationRateLimit(ip);
    if (!rateLimit.allowed) {
      auditLog({ method: request.method, path: joinedPath, ip, outcome: "blocked_rate_limit", statusCode: 429, reason: "admin mutation rate limit exceeded" });
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: rateLimit.retryAfterSeconds
            ? { "Retry-After": String(rateLimit.retryAfterSeconds) }
            : undefined,
        }
      );
    }
  }

  // 3. CSRF check for all mutation requests (non-GET / non-HEAD).
  //    The client must echo the as_csrf_token cookie value in the x-csrf-token header.
  if (request.method !== "GET" && request.method !== "HEAD") {
    const sessionValue = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const csrfHeader = request.headers.get("x-csrf-token");

    if (!sessionValue || !csrfHeader || !(await verifyCsrfToken(sessionValue, csrfHeader))) {
      auditLog({ method: request.method, path: joinedPath, ip, outcome: "blocked_csrf", statusCode: 403 });
      return NextResponse.json(
        { success: false, error: "CSRF validation failed" },
        { status: 403 }
      );
    }
  }

  // 4. Allowlist check — rejects unknown routes, wrong methods, and bad segments.
  const routeCheck = checkAllowedRoute(pathSegments, request.method);
  if (!routeCheck.ok) {
    auditLog({ method: request.method, path: joinedPath, ip, outcome: "blocked_allowlist", statusCode: routeCheck.status, reason: routeCheck.error });
    return NextResponse.json(
      { success: false, error: routeCheck.error },
      { status: routeCheck.status }
    );
  }

  const { enginePath } = routeCheck;
  const session = await readSessionCookie(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    auditLog({ method: request.method, path: joinedPath, ip, outcome: "blocked_unauthed", statusCode: 401 });
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const currentUser = await getCurrentUser(session.userId);
  const requiredPermission = requiredPermissionForRoute(joinedPath, request.method);

  if (!hasPermission(currentUser.role, requiredPermission)) {
    auditLog({
      method: request.method,
      path: joinedPath,
      ip,
      outcome: "blocked_forbidden",
      statusCode: 403,
      reason: `missing permission ${requiredPermission}`,
      userId: currentUser.id,
      role: currentUser.role,
    });
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 }
    );
  }

  // 4. Resolve engine config (server-side only — never sent to the client).
  const engineUrl = getEngineBaseUrl();
  const adminToken = getAdminToken();

  if (!engineUrl || !adminToken) {
    return NextResponse.json(
      { success: false, error: "Admin engine proxy is not configured." },
      { status: 503 }
    );
  }

  // 5. Build the engine request URL.
  let urlStr: string;
  try {
    const url = new URL(enginePath, engineUrl);
    // Forward query-string parameters (e.g. includeClosed=true for room listing).
    request.nextUrl.searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });
    urlStr = url.toString();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid engine URL configuration." },
      { status: 503 }
    );
  }

  // 6. Read body for mutation requests.
  let body: string | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    try {
      body = await request.text();
    } catch {
      body = undefined;
    }
  }

  // 7. Forward the request to the engine.
  try {
    const engineResponse = await fetch(urlStr, {
      method: request.method,
      headers: {
        "Content-Type": "application/json",
        // x-admin-token is injected server-side only — never exposed to the browser.
        "x-admin-token": adminToken,
      },
      body: body || undefined,
    });

    const contentType = engineResponse.headers.get("content-type") ?? "";
    if (contentType.toLowerCase().includes("application/json")) {
      const data: unknown = await engineResponse.json();
      auditLog({ method: request.method, path: joinedPath, ip, outcome: "allowed", statusCode: engineResponse.status, userId: currentUser.id, role: currentUser.role });
      return NextResponse.json(data, { status: engineResponse.status });
    }

    // Engine returned non-JSON (e.g. an HTML error page from a proxy/load-balancer).
    // Do not forward raw HTML to the browser — return a safe error instead.
    const safeMessage =
      engineResponse.status >= 500
        ? "Engine returned an unexpected server error."
        : "Engine returned a non-JSON response.";
    auditLog({ method: request.method, path: joinedPath, ip, outcome: "proxy_error", statusCode: engineResponse.status >= 400 ? engineResponse.status : 502, reason: "non-json engine response" });
    return NextResponse.json(
      { success: false, error: safeMessage },
      { status: engineResponse.status >= 400 ? engineResponse.status : 502 }
    );
  } catch (error) {
    // Engine unreachable or network-level failure.
    // Strip any internal URL from the error message before forwarding.
    const raw = error instanceof Error ? error.message : "Proxy error";
    const safeMessage = raw.includes(engineUrl) ? "Engine is unreachable." : raw;
    auditLog({ method: request.method, path: joinedPath, ip, outcome: "proxy_error", statusCode: 502, reason: "engine unreachable" });
    return NextResponse.json({ success: false, error: safeMessage }, { status: 502 });
  }
}
