import type { NextRequest } from "next/server";
import { reviewReportRoute } from "@/lib/server/contentReportApi";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return reviewReportRoute(request, (await context.params).id);
}
