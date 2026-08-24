import type { NextRequest } from "next/server";
import { savedJourneyDeleteRoute, savedJourneyPatchRoute } from "@/lib/server/learning/knowledgeLearnerHandlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, context: { params: Promise<{ journeyId: string }> }) {
  const { journeyId } = await context.params;
  return savedJourneyPatchRoute(request, journeyId);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ journeyId: string }> }) {
  const { journeyId } = await context.params;
  return savedJourneyDeleteRoute(request, journeyId);
}
