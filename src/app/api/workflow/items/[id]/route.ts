import type { NextRequest } from "next/server";
import { getWorkflowRoute, patchWorkflowRoute } from "@/lib/server/workflowApi";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  return getWorkflowRoute(request, id);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  return patchWorkflowRoute(request, id);
}

