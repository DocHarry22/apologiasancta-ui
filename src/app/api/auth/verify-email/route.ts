import type { NextRequest } from "next/server";
import { consumeAccountEmailRoute } from "@/lib/server/accountEmailRoutes";

export async function POST(request: NextRequest) {
  return consumeAccountEmailRoute(request, "verify");
}
