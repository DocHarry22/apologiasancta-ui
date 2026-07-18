import type { NextRequest } from "next/server";
import {
  masteryAttemptsGetRoute,
  masteryAttemptsPostRoute,
} from "@/lib/server/learning/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return masteryAttemptsGetRoute(request);
}

export function POST(request: NextRequest) {
  return masteryAttemptsPostRoute(request);
}
