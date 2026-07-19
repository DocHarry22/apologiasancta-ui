import type { NextRequest } from "next/server";
import { adminGovernanceValidationRoute } from "@/lib/server/learning/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  return adminGovernanceValidationRoute(request, id);
}
