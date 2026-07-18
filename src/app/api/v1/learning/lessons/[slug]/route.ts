import type { NextRequest } from "next/server";
import { lessonRoute } from "@/lib/server/learning/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  return lessonRoute(request, (await params).slug);
}
