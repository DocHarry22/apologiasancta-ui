import type { NextRequest } from "next/server";
import { hasAnyPermission } from "@/lib/auth/roles";
import { checkContentReportRateLimit } from "@/lib/auth/rateLimit";
import { requireAuthorSession, requireCsrf, safeJson } from "./apiAuth";
import { listContentReports, reviewContentReport, submitContentReport, ReportConflictError, ReportInputError } from "./storage/contentReportStore";

function errorResponse(error: unknown) {
  if (error instanceof ReportInputError) return safeJson({ error: error.message }, 400);
  if (error instanceof ReportConflictError) return safeJson({ error: error.message }, 409);
  console.error("Content correction storage failed", error instanceof Error ? error.name : "UnknownError");
  return safeJson({ error: "Reports are temporarily unavailable. Please try again." }, 503);
}

async function body(request: NextRequest): Promise<Record<string, unknown>> {
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 160_000) throw new ReportInputError("Report is too large.");
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new ReportInputError("Invalid report JSON."); }
}

export async function submitReportRoute(request: NextRequest) {
  const auth = await requireAuthorSession(request);
  if (!auth.ok) return auth.response;
  const csrf = await requireCsrf(request, auth.user);
  if (csrf) return csrf;
  const rate = checkContentReportRateLimit(auth.user.id);
  if (!rate.allowed) return safeJson({ error: "Too many reports. Please try again later.", retryAfterSeconds: rate.retryAfterSeconds }, 429);
  try {
    const report = await submitContentReport(await body(request), auth.user.id);
    return safeJson({ ok: true, id: report.id, revisionId: report.target.revisionId }, 201);
  } catch (error) { return errorResponse(error); }
}

export async function listReportsRoute(request: NextRequest) {
  const auth = await requireAuthorSession(request);
  if (!auth.ok) return auth.response;
  if (!hasAnyPermission(auth.user.role, ["content:review", "learning:review"])) return safeJson({ error: "Forbidden" }, 403);
  try {
    const response = safeJson({ reports: await listContentReports(request.nextUrl.searchParams.get("status") || undefined) });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  catch (error) { return errorResponse(error); }
}

export async function reviewReportRoute(request: NextRequest, id: string) {
  const auth = await requireAuthorSession(request);
  if (!auth.ok) return auth.response;
  if (!hasAnyPermission(auth.user.role, ["content:review", "learning:review"])) return safeJson({ error: "Forbidden" }, 403);
  const csrf = await requireCsrf(request, auth.user);
  if (csrf) return csrf;
  try {
    const report = await reviewContentReport(id, await body(request), auth.user.id);
    return report ? safeJson({ report }) : safeJson({ error: "Report not found." }, 404);
  } catch (error) { return errorResponse(error); }
}
