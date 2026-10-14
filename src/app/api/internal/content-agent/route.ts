import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/server/agent/runner";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;
export function validAgentToken(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 32 || !header?.startsWith("Bearer ")) return false;
  const actual = Buffer.from(header.slice(7)); const expected = Buffer.from(secret);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  if (!validAgentToken(request.headers.get("authorization"), process.env.CONTENT_AGENT_CRON_SECRET)) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  if (process.env.CONTENT_AGENT_PROVIDER === "codex") return NextResponse.json({ status: "external_worker", message: "Subscription processing runs only on the private authenticated Codex worker." }, { headers });
  try {
    const result = await runAgent();
    return NextResponse.json(result, { status: result.status === "failed" ? 502 : 200, headers });
  } catch {
    return NextResponse.json({ error: "Content agent is unavailable. Check the admin agent dashboard and deployment configuration." }, { status: 503, headers });
  }
}
