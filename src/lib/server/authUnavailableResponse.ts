import { NextResponse } from "next/server";
import {
  AUTH_RETRY_AFTER_SECONDS,
  AUTH_UNAVAILABLE_CODE,
  type AdminAuthConfigurationReport,
} from "@/lib/auth/availability";
import { recordAuthFailure } from "./authDiagnostics";

interface AuthUnavailableResponseOptions {
  operation: string;
  error?: unknown;
  configuration?: AdminAuthConfigurationReport;
}

export function authUnavailableResponse(options: AuthUnavailableResponseOptions) {
  const diagnostic = recordAuthFailure(options);

  return NextResponse.json(
    {
      error: "Authentication is temporarily unavailable.",
      code: AUTH_UNAVAILABLE_CODE,
      reason: diagnostic.reason,
      diagnosticId: diagnostic.diagnosticId,
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
