import type { NextRequest } from "next/server";
import { transitionWorkflowRoute } from "@/lib/server/workflowApi";
type RouteContext = { params: Promise<{ id: string }> };
export async function POST(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  return transitionWorkflowRoute(request, id, "published", "workflow.publish");
}

