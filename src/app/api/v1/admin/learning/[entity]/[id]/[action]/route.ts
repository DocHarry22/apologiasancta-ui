import type { NextRequest } from "next/server";
import { adminEntityWorkflowRoute } from "@/lib/server/learning/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ entity: string; id: string; action: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { entity, id, action } = await params;
  return adminEntityWorkflowRoute(request, entity, id, action);
}
