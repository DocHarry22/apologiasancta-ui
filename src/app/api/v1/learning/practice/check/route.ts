import type { NextRequest } from "next/server";
import { practiceCheckRoute } from "@/lib/server/learning/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: NextRequest) {
  return practiceCheckRoute(request);
}
