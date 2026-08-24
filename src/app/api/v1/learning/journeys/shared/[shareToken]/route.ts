import type { NextRequest } from "next/server";
import { sharedJourneyRoute } from "@/lib/server/learning/knowledgeLearnerHandlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ shareToken: string }> }) {
  const { shareToken } = await context.params;
  return sharedJourneyRoute(request, shareToken);
}
