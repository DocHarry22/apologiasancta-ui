import type { NextRequest } from "next/server";
import {
  bookmarksDeleteRoute,
  bookmarksGetRoute,
  bookmarksPostRoute,
} from "@/lib/server/learning/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return bookmarksGetRoute(request);
}

export function POST(request: NextRequest) {
  return bookmarksPostRoute(request);
}

export function DELETE(request: NextRequest) {
  return bookmarksDeleteRoute(request);
}
