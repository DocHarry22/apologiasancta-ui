import type { NextRequest } from "next/server";
import { lessonProgressRoute } from "@/lib/server/learning/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

export async function PUT(request: NextRequest, { params }: RouteContext) {
  return lessonProgressRoute(request, (await params).slug);
}
