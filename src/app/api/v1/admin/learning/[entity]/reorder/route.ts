import type { NextRequest } from "next/server";
import { adminReorderRoute } from "@/lib/server/learning/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ entity: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  return adminReorderRoute(request, (await params).entity);
}
