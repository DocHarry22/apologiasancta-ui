import type { NextRequest } from "next/server";
import {
  adminItemDeleteRoute,
  adminItemGetRoute,
  adminItemPatchRoute,
} from "@/lib/server/learning/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ entity: string; id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { entity, id } = await params;
  return adminItemGetRoute(request, entity, id);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { entity, id } = await params;
  return adminItemPatchRoute(request, entity, id);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return PATCH(request, context);
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const { entity, id } = await params;
  return adminItemDeleteRoute(request, entity, id);
}
