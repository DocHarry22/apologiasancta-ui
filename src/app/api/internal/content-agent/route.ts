import { validAgentToken } from "@/lib/server/agent/auth";
import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/server/agent/runner";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;
export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  if (!validAgentToken(request.headers.get("authorization"), process.env.CONTENT_AGENT_CRON_SECRET)) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  if (process.env.CONTENT_AGENT_PROVIDER !== "api") return NextResponse.json({ status: "external_worker", message: "Subscription processing runs only on the private authenticated Codex worker." }, { headers });
  try {
    const result = await runAgent();
    return NextResponse.json(result, { status: result.status === "failed" ? 502 : 200, headers });
  } catch {
    return NextResponse.json({ error: "Content agent is unavailable. Check the admin agent dashboard and deployment configuration." }, { status: 503, headers });
  }
}
