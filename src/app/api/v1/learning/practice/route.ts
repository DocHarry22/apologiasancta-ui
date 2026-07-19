import type { NextRequest } from "next/server";
import { practiceRoute } from "@/lib/server/learning/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return practiceRoute(request);
}
