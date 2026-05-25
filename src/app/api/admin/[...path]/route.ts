import type { NextRequest } from "next/server";
import { proxyAdminRequest } from "@/lib/server/engineProxy";

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { path } = await params;
  return proxyAdminRequest(request, path);
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { path } = await params;
  return proxyAdminRequest(request, path);
}
