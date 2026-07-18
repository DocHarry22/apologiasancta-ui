import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { PageMeta } from "@/lib/learning/contracts";
import { isRecord } from "@/lib/learning/validation";
import { LearningApiError, normalizeLearningError } from "./errors";

const MAX_JSON_BODY_BYTES = 256 * 1024;

export function dataResponse(
  data: unknown,
  options: {
    status?: number;
    meta?: PageMeta | Record<string, unknown>;
    headers?: HeadersInit;
  } = {},
): NextResponse {
  const body = options.meta ? { data, meta: options.meta } : { data };
  return NextResponse.json(body, {
    status: options.status ?? 200,
    headers: options.headers,
  });
}

export function errorResponse(error: LearningApiError, requestId?: string): NextResponse {
  const response = NextResponse.json({
    error: {
      code: error.code,
      message: error.message,
      ...(error.fields ? { fields: error.fields } : {}),
    },
  }, { status: error.status });
  response.headers.set("Cache-Control", "no-store");
  if (requestId) response.headers.set("x-request-id", requestId);
  return response;
}

export async function withLearningApiErrors(
  request: NextRequest,
  operation: () => Promise<NextResponse>,
): Promise<NextResponse> {
  const requestId = request.headers.get("x-request-id")?.slice(0, 128) || randomUUID();
  try {
    const response = await operation();
    if (!response.headers.has("x-request-id")) response.headers.set("x-request-id", requestId);
    return response;
  } catch (error) {
    const safeError = normalizeLearningError(error);
    if (process.env.NODE_ENV !== "test") {
      console.error(JSON.stringify({
        scope: "learning_api",
        requestId,
        path: request.nextUrl.pathname,
        method: request.method,
        code: safeError.code,
        status: safeError.status,
      }));
    }
    return errorResponse(safeError, requestId);
  }
}

export async function readJsonObject(request: NextRequest): Promise<Record<string, unknown>> {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BODY_BYTES) {
    throw new LearningApiError("payload_too_large", 413, "The request body is too large.");
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    throw new LearningApiError("invalid_json", 400, "The request body is not valid JSON.");
  }
  if (Buffer.byteLength(text, "utf8") > MAX_JSON_BODY_BYTES) {
    throw new LearningApiError("payload_too_large", 413, "The request body is too large.");
  }
  try {
    const parsed = text ? JSON.parse(text) : {};
    if (!isRecord(parsed)) throw new Error("not an object");
    return parsed;
  } catch {
    throw new LearningApiError("invalid_json", 400, "The request body must be a JSON object.");
  }
}

export function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  return response;
}
