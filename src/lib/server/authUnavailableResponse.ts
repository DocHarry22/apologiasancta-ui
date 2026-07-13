import { NextResponse } from "next/server";
import {
  AUTH_RETRY_AFTER_SECONDS,
  AUTH_UNAVAILABLE_CODE,
} from "@/lib/auth/availability";

export function authUnavailableResponse() {
  return NextResponse.json(
    {
      error: "Authentication is temporarily unavailable.",
      code: AUTH_UNAVAILABLE_CODE,
    },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(AUTH_RETRY_AFTER_SECONDS),
      },
    }
  );
}
