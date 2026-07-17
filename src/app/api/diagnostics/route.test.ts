import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

const ORIGINAL_ENV = { ...process.env };

function configureIdentity(secret: string | undefined) {
  process.env.ACCOUNT_IDENTITY_ENABLED = "false";
  process.env.ACCOUNT_IDENTITY_ISSUER = "apologia-ui";
  process.env.ENGINE_INTERNAL_URL = "https://engine.test";
  if (secret === undefined) {
    delete process.env.ACCOUNT_IDENTITY_SECRET;
  } else {
    process.env.ACCOUNT_IDENTITY_SECRET = secret;
  }
}

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
});

describe("GET /api/diagnostics", () => {
  it.each([
    ["missing", undefined, false, false],
    ["blank", "   ", false, false],
    ["present but rejected", "present-but-rejected", true, false],
    ["present and accepted", "test-account-identity-secret-with-more-than-32-bytes", true, true],
  ] as const)("reports a %s identity secret without exposing it", async (
    _case,
    secret,
    expectedPresent,
    expectedAccepted
  ) => {
    configureIdentity(secret);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload).toEqual(expect.objectContaining({
      features: { accountIdentity: false },
      readiness: {
        accountIdentity: false,
        accountIdentitySecretPresent: expectedPresent,
        accountIdentitySecret: expectedAccepted,
        engineInternalUrl: true,
      },
    }));
    if (secret?.trim()) {
      expect(JSON.stringify(payload)).not.toContain(secret.trim());
    }
  });
});
