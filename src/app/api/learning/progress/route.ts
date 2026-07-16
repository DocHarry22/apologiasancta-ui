import { NextRequest, NextResponse } from "next/server";
import { MAX_PROGRESS_SYNC_BODY_BYTES } from "@/lib/learningProgressContract";
import { requireAuthorSession, requireCsrf } from "@/lib/server/apiAuth";
import {
  getLearningProgress,
  isLearningCloudSyncConfigured,
  syncLearningProgress,
} from "@/lib/server/learningProgressStore";
import { validateLearningProgressSyncBody } from "@/lib/server/learningProgressValidation";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: NO_STORE_HEADERS });
}

function unavailable(): NextResponse {
  const disabled = process.env.LEARNING_CLOUD_SYNC_ENABLED !== "true";
  return json({
    ok: false,
    code: disabled ? "learning_sync_disabled" : "learning_sync_unavailable",
    error: "Cloud learning progress is temporarily unavailable. Device progress remains saved.",
    localFallback: true,
  }, 503);
}

function logStorageFailure(operation: "read" | "sync", error: unknown): void {
  // Do not log connection strings, SQL, payloads, cookies, or driver messages.
  console.error("[learning-progress] storage operation failed", {
    operation,
    errorType: error instanceof Error ? error.name : "UnknownError",
  });
}

async function authenticate(request: NextRequest) {
  try {
    return await requireAuthorSession(request);
  } catch (error) {
    logStorageFailure("read", error);
    return null;
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await authenticate(request);
  if (!auth) return unavailable();
  if (!auth.ok) return auth.response;
  if (!isLearningCloudSyncConfigured()) return unavailable();

  try {
    return json({ ok: true, progress: await getLearningProgress(auth.user.id) });
  } catch (error) {
    logStorageFailure("read", error);
    return unavailable();
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await authenticate(request);
  if (!auth) return unavailable();
  if (!auth.ok) return auth.response;

  const csrfError = await requireCsrf(request, auth.user);
  if (csrfError) return csrfError;
  if (!isLearningCloudSyncConfigured()) return unavailable();

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    return json({ ok: false, code: "invalid_content_type", error: "Content-Type must be application/json." }, 415);
  }
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PROGRESS_SYNC_BODY_BYTES) {
    return json({ ok: false, code: "payload_too_large", error: "Learning progress payload is too large." }, 413);
  }

  let raw = "";
  let body: unknown;
  try {
    raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_PROGRESS_SYNC_BODY_BYTES) {
      return json({ ok: false, code: "payload_too_large", error: "Learning progress payload is too large." }, 413);
    }
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, code: "invalid_json", error: "Request body must be valid JSON." }, 400);
  }

  const validated = validateLearningProgressSyncBody(body);
  if (!validated.ok) {
    return json({
      ok: false,
      code: "invalid_learning_progress",
      error: "Learning progress payload failed validation.",
      details: validated.errors,
    }, 400);
  }

  try {
    const result = await syncLearningProgress(auth.user.id, validated.value);
    return json({
      ok: true,
      progress: result.progress,
      conflictMerged: result.conflictMerged,
      acknowledgedMutationIds: result.acknowledgedMutationIds,
    });
  } catch (error) {
    logStorageFailure("sync", error);
    return unavailable();
  }
}
