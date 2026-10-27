import type { NextRequest } from "next/server";
import { requestAccountEmailRoute } from "@/lib/server/accountEmailRoutes";

export async function POST(request: NextRequest) {
  return requestAccountEmailRoute(request, "reset");
}
