import type { NextRequest } from "next/server";
import { masterySubmitRoute } from "@/lib/server/learning/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  return masterySubmitRoute(request, (await params).id);
}
