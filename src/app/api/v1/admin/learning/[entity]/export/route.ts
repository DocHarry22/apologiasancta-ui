import type { NextRequest } from "next/server";
import { adminExportRoute } from "@/lib/server/learning/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ entity: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  return adminExportRoute(request, (await params).entity);
}
