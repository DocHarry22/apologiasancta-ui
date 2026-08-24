import { NextRequest, NextResponse } from "next/server";
import {
  fetchKnowledgeEngine,
  getKnowledgeEngineClientStatus,
  KnowledgeEngineError,
} from "@/lib/server/knowledgeEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAFE_CANONICAL = /^[a-z][a-z0-9_-]*:[a-z0-9][a-z0-9._:-]*$/;
const SAFE_SIMPLE = /^[a-z0-9_-]+$/;

function isAllowed(segments: string[]): boolean {
  const path = segments.join("/");
  if (path === "status" || path === "topics" || path === "neighborhood" || path === "compare" || path === "timeline") return true;
  if (segments.length === 2 && ["topics", "paths", "arguments", "nodes"].includes(segments[0] || "")) {
    return SAFE_CANONICAL.test(segments[1] || "");
  }
  if (segments.length === 3 && segments[0] === "arguments" && segments[2] === "coverage") return SAFE_CANONICAL.test(segments[1] || "");
  if (segments.length === 3 && segments[0] === "nodes" && ["evidence", "assessments", "arguments"].includes(segments[2] || "")) return SAFE_CANONICAL.test(segments[1] || "");
  return false;
}

function sanitizedSearch(request: NextRequest, path: string): URLSearchParams {
  const result = new URLSearchParams();
  const source = request.nextUrl.searchParams;
  if (path === "neighborhood") {
    const nodeId = source.get("nodeId") || "";
    if (SAFE_CANONICAL.test(nodeId)) result.set("nodeId", nodeId);
    const depth = Math.max(0, Math.min(3, Number.parseInt(source.get("depth") || "2", 10) || 2));
    result.set("depth", String(depth));
    const lens = source.get("lens") || "catholic";
    if (SAFE_SIMPLE.test(lens) && lens.length <= 80) result.set("lens", lens);
    const limit = Math.max(1, Math.min(120, Number.parseInt(source.get("limit") || "80", 10) || 80));
    result.set("limit", String(limit));
  } else if (path === "compare") {
    for (const key of ["left", "right"] as const) {
      const value = source.get(key) || "";
      if (SAFE_CANONICAL.test(value)) result.set(key, value);
    }
    const lens = source.get("lens");
    if (lens && SAFE_SIMPLE.test(lens) && lens.length <= 80) result.set("lens", lens);
  } else if (path === "timeline") {
    for (const key of ["nodeId", "topicId"] as const) {
      const value = source.get(key) || "";
      if (SAFE_CANONICAL.test(value)) result.set(key, value);
    }
    for (const key of ["from", "to"] as const) {
      const raw = source.get(key);
      if (raw && /^-?\d{1,6}$/.test(raw)) result.set(key, raw);
    }
    const limit = Math.max(1, Math.min(200, Number.parseInt(source.get("limit") || "100", 10) || 100));
    result.set("limit", String(limit));
  } else if (path === "topics") {
    const limit = Math.max(1, Math.min(100, Number.parseInt(source.get("limit") || "50", 10) || 50));
    result.set("limit", String(limit));
  } else if (path.endsWith("/assessments")) {
    const lens = source.get("lens");
    if (lens && SAFE_SIMPLE.test(lens) && lens.length <= 80) result.set("lens", lens);
  }
  return result;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path: rawPath = [] } = await context.params;
  const segments = rawPath.map((segment) => decodeURIComponent(segment));
  if (segments.length === 0) {
    return NextResponse.json({ ...getKnowledgeEngineClientStatus(), service: "ui-knowledge-proxy" });
  }
  if (!isAllowed(segments)) return NextResponse.json({ error: "Knowledge route not found." }, { status: 404 });
  const path = segments.join("/");
  const search = sanitizedSearch(request, path);
  if (path === "neighborhood" && !search.has("nodeId")) return NextResponse.json({ error: "A valid nodeId is required." }, { status: 400 });
  if (path === "compare" && (!search.has("left") || !search.has("right"))) return NextResponse.json({ error: "Valid left and right node IDs are required." }, { status: 400 });
  try {
    const payload = await fetchKnowledgeEngine(`/knowledge/${segments.map(encodeURIComponent).join("/")}`, search);
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" },
    });
  } catch (error) {
    if (error instanceof KnowledgeEngineError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Knowledge Engine request failed." }, { status: 502 });
  }
}
