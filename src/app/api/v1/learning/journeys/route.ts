import type { NextRequest } from "next/server";
import { savedJourneysGetRoute, savedJourneysPostRoute } from "@/lib/server/learning/knowledgeLearnerHandlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return savedJourneysGetRoute(request);
}

export function POST(request: NextRequest) {
  return savedJourneysPostRoute(request);
}
