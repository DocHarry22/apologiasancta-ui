import type { NextRequest } from "next/server";
import { createWorkflowRoute, listWorkflowRoute } from "@/lib/server/workflowApi";

export async function GET(request: NextRequest) {
  return listWorkflowRoute(request);
}

export async function POST(request: NextRequest) {
  return createWorkflowRoute(request);
}

