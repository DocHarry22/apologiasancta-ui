import { NextResponse } from "next/server";
import { getAccountIdentityConfiguration } from "@/lib/server/accountIdentity";
import { getLearningDatabaseConfiguration } from "@/lib/server/learning/database";

export const dynamic = "force-dynamic";

export async function GET() {
  const identity = getAccountIdentityConfiguration();
  const learningDatabase = getLearningDatabaseConfiguration();
  return NextResponse.json({
    ok: true,
    service: "apologiasancta-ui",
    revision: process.env.APP_BUILD_REVISION || "unknown",
    features: {
      accountIdentity: identity.enabled,
    },
    readiness: {
      accountIdentity: identity.ready,
      accountIdentitySecretPresent: identity.secretPresent,
      accountIdentitySecret: identity.secretConfigured,
      engineInternalUrl: identity.engineUrlConfigured,
      learningDatabase: learningDatabase.ready,
      learningDatabaseUrlPresent: learningDatabase.urlPresent,
      learningDatabaseUrlSupported: learningDatabase.urlSupported,
      learningDatabaseSslMode: learningDatabase.sslModeSupported,
    },
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
