import { NextResponse } from "next/server";
import { runAuthDiagnostic } from "@/lib/server/authDiagnostics";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.AUTH_DIAGNOSTICS_ENABLED !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const diagnostic = await runAuthDiagnostic();
  return NextResponse.json(
    {
      ok: diagnostic.ok,
      reason: diagnostic.reason,
      diagnosticId: diagnostic.diagnosticId,
      configuration: {
        sessionConfigured: diagnostic.configuration.sessionConfigured,
        userStoreConfigured: diagnostic.configuration.userStoreConfigured,
        databaseDialect: diagnostic.configuration.databaseDialect,
        databaseSource: diagnostic.configuration.databaseSource,
        databaseUrlPresent: diagnostic.configuration.databaseUrlPresent,
        databaseUrlSupported: diagnostic.configuration.databaseUrlSupported,
        missingVariables: diagnostic.configuration.missingVariables,
        bootstrapEmailConfigured: diagnostic.configuration.bootstrapEmailConfigured,
        bootstrapPasswordConfigured: diagnostic.configuration.bootstrapPasswordConfigured,
      },
      driverCode: diagnostic.driverCode,
    },
    {
      status: diagnostic.ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

