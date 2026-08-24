import { NextRequest, NextResponse } from "next/server";
import { hasAnyPermission } from "@/lib/auth/roles";
import { checkAdminMutationRateLimit, getClientIp } from "@/lib/auth/rateLimit";
import { readSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { verifyCsrfToken } from "@/lib/csrf";
import { AdvancedKnowledgeAdminError, fetchAdvancedKnowledgeAdmin } from "@/lib/server/advancedKnowledgeAdmin";
import { getCurrentUser } from "@/lib/server/currentUser";
import { isSessionFreshForUser } from "@/lib/server/sessionFreshness";
import { appendAuditEvent } from "@/lib/server/storage/auditStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CANONICAL_ID = /^[a-z][a-z0-9_-]*:[a-z0-9][a-z0-9._:-]*$/;
const PROPOSAL_TYPES = new Set([
  "duplicate_candidate",
  "candidate_claim",
  "candidate_relationship",
  "candidate_citation",
  "argument_decomposition",
  "learning_link",
  "missing_evidence",
]);
const PROPOSAL_STATUSES = new Set(["proposed", "accepted", "rejected", "expired"]);

type SessionContext = Awaited<ReturnType<typeof getSessionContext>>;

async function getSessionContext(request: NextRequest) {
  const rawSession = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await readSessionCookie(rawSession);
  if (!session) return null;
  const user = await getCurrentUser(session.userId);
  if (!isSessionFreshForUser(session, user)) return null;
  return { session, user, rawSession: rawSession || "" };
}

function allowedPath(segments: string[], method: string): "coverage" | "proposals" | `proposals/${string}/decision` | null {
  if (segments.length === 1 && segments[0] === "coverage" && method === "GET") return "coverage";
  if (segments.length === 1 && segments[0] === "proposals" && (method === "GET" || method === "POST")) return "proposals";
  if (segments.length === 3 && segments[0] === "proposals" && segments[2] === "decision" && method === "POST" && CANONICAL_ID.test(segments[1] || "")) {
    return `proposals/${segments[1]}/decision`;
  }
  return null;
}

function permitted(context: NonNullable<SessionContext>, path: string, method: string): boolean {
  if (method === "GET") return hasAnyPermission(context.user.role, ["learning:review", "learning:audit", "learning:manage"]);
  if (path === "proposals") return hasAnyPermission(context.user.role, ["learning:manage", "content:draft:create"]);
  return hasAnyPermission(context.user.role, ["learning:review", "content:review"]);
}

function proposalSearch(request: NextRequest): URLSearchParams {
  const search = new URLSearchParams();
  const status = request.nextUrl.searchParams.get("status") || "";
  const type = request.nextUrl.searchParams.get("type") || "";
  if (PROPOSAL_STATUSES.has(status)) search.set("status", status);
  if (PROPOSAL_TYPES.has(type)) search.set("type", type);
  const limit = Math.max(1, Math.min(100, Number.parseInt(request.nextUrl.searchParams.get("limit") || "50", 10) || 50));
  search.set("limit", String(limit));
  return search;
}

async function handle(request: NextRequest, rawPath: string[] = []) {
  let segments: string[];
  try {
    segments = rawPath.map((segment) => decodeURIComponent(segment));
  } catch {
    return NextResponse.json({ error: "Invalid Knowledge Foundry route." }, { status: 400 });
  }
  const path = allowedPath(segments, request.method);
  if (!path) return NextResponse.json({ error: "Knowledge Foundry route not found." }, { status: 404 });

  const context = await getSessionContext(request);
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!permitted(context, path, request.method)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const mutation = request.method !== "GET" && request.method !== "HEAD";
  if (mutation) {
    const rate = checkAdminMutationRateLimit(getClientIp(request));
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many Knowledge Foundry mutations. Try again shortly." },
        { status: 429, headers: rate.retryAfterSeconds ? { "Retry-After": String(rate.retryAfterSeconds) } : undefined },
      );
    }
    const csrfHeader = request.headers.get("x-csrf-token");
    if (!context.rawSession || !csrfHeader || !(await verifyCsrfToken(context.rawSession, csrfHeader))) {
      return NextResponse.json({ error: "CSRF validation failed" }, { status: 403 });
    }
  }

  let body: Record<string, unknown> | undefined;
  if (mutation) {
    try {
      const parsed = await request.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "A JSON object body is required." }, { status: 400 });
    }
  }

  try {
    const payload = await fetchAdvancedKnowledgeAdmin({
      path,
      method: mutation ? "POST" : "GET",
      search: path === "proposals" && !mutation ? proposalSearch(request) : undefined,
      body,
      editorId: context.user.id,
    });

    if (mutation) {
      const resourceId = payload && typeof payload === "object" && "proposal" in payload
        ? String((payload as { proposal?: { id?: unknown } }).proposal?.id || "")
        : "";
      await appendAuditEvent({
        actor: context.user,
        eventType: path.endsWith("/decision") ? "knowledge.proposal_decision" : "knowledge.proposal_created",
        action: path.endsWith("/decision") ? "Knowledge authoring proposal decided" : "Knowledge authoring proposal created",
        resourceType: "knowledge_authoring_proposal",
        resourceId: resourceId || undefined,
        method: request.method,
        path: `/api/admin/knowledge-advanced/${path}`,
        status: "success",
        ip: getClientIp(request),
        severity: "info",
      }).catch(() => undefined);
    }

    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AdvancedKnowledgeAdminError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: "Knowledge Foundry request failed." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await context.params;
  return handle(request, path);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await context.params;
  return handle(request, path);
}
