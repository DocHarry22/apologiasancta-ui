import type { NextRequest } from "next/server";
import { adminWorkflowRoute } from "@/lib/server/learning/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; action: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { id, action } = await params;
  return adminWorkflowRoute(request, id, action);
}
