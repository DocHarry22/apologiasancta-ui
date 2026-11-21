import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearLearningDatabaseReadinessCacheForTests,
  probeLearningDatabaseReadiness,
} from "./readiness";

const ORIGINAL_ENV = { ...process.env };

function configureDatabase(url = "postgresql://learning-user:secret@db.test/learning") {
  process.env.LEARNING_DATABASE_URL = url;
  process.env.LEARNING_DB_SSL_MODE = "require";
}

afterEach(() => {
  clearLearningDatabaseReadinessCacheForTests();
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
});

describe("learning database readiness", () => {
  it("does not contact PostgreSQL when configuration is missing", async () => {
    delete process.env.LEARNING_DATABASE_URL;
    const query = vi.fn();

    await expect(probeLearningDatabaseReadiness(query)).resolves.toEqual({
      configured: false,
      reachable: false,
      schemaReady: false,
      readable: false,
      ready: false,
      status: "not_configured",
    });
    expect(query).not.toHaveBeenCalled();
  });

  it("reports readiness only after the published programme view is readable", async () => {
    configureDatabase();
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });

    await expect(probeLearningDatabaseReadiness(query)).resolves.toEqual({
      configured: true,
      reachable: true,
      schemaReady: true,
      readable: true,
      ready: true,
      status: "ready",
    });
    expect(query).toHaveBeenCalledWith("SELECT 1 FROM content.published_programmes LIMIT 0");
  });

  it.each([
    ["42P01", "schema_missing", true, false],
    ["3F000", "schema_missing", true, false],
    ["42501", "permission_denied", true, true],
    ["28P01", "authentication_failed", true, false],
    ["28000", "authentication_failed", true, false],
    ["3D000", "database_missing", true, false],
    ["ENOTFOUND", "dns_unresolved", false, false],
    ["EAI_AGAIN", "dns_unresolved", false, false],
    ["ECONNREFUSED", "connection_refused", false, false],
    ["ETIMEDOUT", "connection_timeout", false, false],
    ["CONNECT_TIMEOUT", "connection_timeout", false, false],
    ["SELF_SIGNED_CERT_IN_CHAIN", "tls_failed", false, false],
    ["08001", "unreachable", false, false],
  ] as const)("classifies PostgreSQL %s safely", async (code, status, reachable, schemaReady) => {
    configureDatabase();
    const query = vi.fn().mockRejectedValue(Object.assign(new Error("secret-db.internal"), { code }));

    const result = await probeLearningDatabaseReadiness(query);

    expect(result).toEqual({
      configured: true,
      reachable,
      schemaReady,
      readable: false,
      ready: false,
      status,
    });
    expect(JSON.stringify(result)).not.toContain("secret-db.internal");
  });

  it("classifies nested and aggregate connection errors without exposing their messages", async () => {
    configureDatabase();
    const nested = Object.assign(new Error("getaddrinfo ENOTFOUND former-db.internal"), { code: "ENOTFOUND" });
    const query = vi.fn().mockRejectedValue(Object.assign(new Error("connection failed"), {
      errors: [Object.assign(new Error("secret replica"), { cause: nested })],
    }));

    const result = await probeLearningDatabaseReadiness(query);

    expect(result.status).toBe("dns_unresolved");
    expect(result.reachable).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/former-db|secret replica|connection failed/);
  });

  it.each([
    "Connection terminated due to connection timeout",
    "timeout expired",
  ])("classifies node-postgres' code-less timeout %s", async (message) => {
    configureDatabase();
    const query = vi.fn().mockRejectedValue(new Error(message));

    const result = await probeLearningDatabaseReadiness(query);

    expect(result).toEqual({
      configured: true,
      reachable: false,
      schemaReady: false,
      readable: false,
      ready: false,
      status: "connection_timeout",
    });
    expect(JSON.stringify(result)).not.toContain(message);
  });

  it("classifies a code-less timeout nested under a provider error without exposing either message", async () => {
    configureDatabase();
    const query = vi.fn().mockRejectedValue(new Error("provider connection failed for secret-db.internal", {
      cause: new Error("timeout expired"),
    }));

    const result = await probeLearningDatabaseReadiness(query);

    expect(result.status).toBe("connection_timeout");
    expect(JSON.stringify(result)).not.toMatch(/secret-db|timeout expired/);
  });

  it("does not infer timeout status from arbitrary provider text", async () => {
    configureDatabase();
    const query = vi.fn().mockRejectedValue(new Error("Timed out while contacting secret-db.internal"));

    const result = await probeLearningDatabaseReadiness(query);

    expect(result.status).toBe("unreachable");
    expect(JSON.stringify(result)).not.toContain("secret-db.internal");
  });
});
