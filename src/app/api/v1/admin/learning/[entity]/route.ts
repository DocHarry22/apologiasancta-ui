import type { NextRequest } from "next/server";
import {
  adminCollectionGetRoute,
  adminCollectionPostRoute,
} from "@/lib/server/learning/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ entity: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  return adminCollectionGetRoute(request, (await params).entity);
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  return adminCollectionPostRoute(request, (await params).entity);
}
