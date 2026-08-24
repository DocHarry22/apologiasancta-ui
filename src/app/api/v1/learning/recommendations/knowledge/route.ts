import type { NextRequest } from "next/server";
import { knowledgeGapRecommendationsRoute } from "@/lib/server/learning/knowledgeLearnerHandlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return knowledgeGapRecommendationsRoute(request);
}
