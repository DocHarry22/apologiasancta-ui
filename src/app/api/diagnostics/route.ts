import { NextResponse } from "next/server";
import { getAccountIdentityConfiguration } from "@/lib/server/accountIdentity";

export const dynamic = "force-dynamic";

export async function GET() {
  const identity = getAccountIdentityConfiguration();
  return NextResponse.json({
    ok: true,
    service: "apologiasancta-ui",
    revision: process.env.APP_BUILD_REVISION || "unknown",
    features: {
      accountIdentity: identity.enabled,
    },
    readiness: {
      accountIdentity: identity.ready,
      accountIdentitySecret: identity.secretConfigured,
      engineInternalUrl: identity.engineUrlConfigured,
    },
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
