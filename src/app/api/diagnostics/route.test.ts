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
      readiness: expect.objectContaining({
        accountIdentity: false,
        accountIdentitySecretPresent: expectedPresent,
        accountIdentitySecret: expectedAccepted,
        engineInternalUrl: true,
      }),
    }));
    if (secret?.trim()) {
      expect(JSON.stringify(payload)).not.toContain(secret.trim());
    }
  });

  it.each([
    ["missing URL", undefined, undefined, false, false, true, false],
    ["unsupported URL", "mysql://learning-user:secret@db.test/learning", undefined, true, false, true, false],
    ["unsupported SSL mode", "postgres://learning-user:secret@db.test/learning", "prefer", true, true, false, false],
    ["valid PostgreSQL configuration", "postgresql://learning-user:secret@db.test/learning", "require", true, true, true, true],
  ] as const)("reports a %s without exposing the database URL", async (
    _case,
    databaseUrl,
    sslMode,
    expectedPresent,
    expectedSupported,
    expectedSslMode,
    expectedReady,
  ) => {
    configureIdentity(undefined);
    if (databaseUrl === undefined) delete process.env.LEARNING_DATABASE_URL;
    else process.env.LEARNING_DATABASE_URL = databaseUrl;
    if (sslMode === undefined) delete process.env.LEARNING_DB_SSL_MODE;
    else process.env.LEARNING_DB_SSL_MODE = sslMode;

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.readiness).toEqual(expect.objectContaining({
      learningDatabase: expectedReady,
      learningDatabaseUrlPresent: expectedPresent,
      learningDatabaseUrlSupported: expectedSupported,
      learningDatabaseSslMode: expectedSslMode,
    }));
    if (databaseUrl) expect(JSON.stringify(payload)).not.toContain(databaseUrl);
  });
});
