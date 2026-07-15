import { describe, expect, it, vi } from "vitest";
import { getAdminAuthConfigurationReport } from "@/lib/auth/availability";
import { classifyAuthFailure, recordAuthFailure } from "./authDiagnostics";

function databaseError(code: string, errno?: number): Error {
  return Object.assign(new Error("driver detail must not be logged"), { code, errno });
}

describe("authentication diagnostics", () => {
  it("identifies incomplete configuration without exposing values", () => {
    const configuration = getAdminAuthConfigurationReport({
      NODE_ENV: "production",
      MYSQL_HOST: "database.internal",
      MYSQL_DATABASE: "apologia",
      MYSQL_USER: "admin",
    });

    expect(classifyAuthFailure(configuration)).toBe("session_secret_missing");
    expect(configuration.missingVariables).toEqual([
      "AUTHOR_SESSION_SECRET",
      "MYSQL_PASSWORD",
    ]);
  });

  it.each([
    ["ER_ACCESS_DENIED_ERROR", 1045, "database_access_denied"],
    ["28P01", undefined, "database_access_denied"],
    ["ER_DBACCESS_DENIED_ERROR", 1044, "database_permission_denied"],
    ["ER_BAD_DB_ERROR", 1049, "database_not_found"],
    ["3D000", undefined, "database_not_found"],
    ["ENOTFOUND", undefined, "database_host_not_found"],
    ["ECONNREFUSED", undefined, "database_connection_refused"],
    ["ETIMEDOUT", undefined, "database_connection_timeout"],
    ["ER_PARSE_ERROR", 1064, "database_schema_incompatible"],
  ])("classifies driver error %s", (code, errno, expected) => {
    const configuration = getAdminAuthConfigurationReport({
      NODE_ENV: "production",
      AUTHOR_SESSION_SECRET: "strong-production-session-secret",
      MYSQL_HOST: "database.internal",
      MYSQL_DATABASE: "apologia",
      MYSQL_USER: "admin",
      MYSQL_PASSWORD: "secret",
    });

    expect(classifyAuthFailure(configuration, databaseError(code, errno))).toBe(expected);
  });

  it("logs a correlation ID and safe metadata without error messages or values", () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const configuration = getAdminAuthConfigurationReport({
      NODE_ENV: "production",
      AUTHOR_SESSION_SECRET: "do-not-log-this-session-secret",
      MYSQL_HOST: "private-host.example",
      MYSQL_DATABASE: "private_database",
      MYSQL_USER: "private_user",
      MYSQL_PASSWORD: "do-not-log-this-password",
    });

    const diagnostic = recordAuthFailure({
      operation: "test.authenticate",
      configuration,
      error: databaseError("ER_ACCESS_DENIED_ERROR", 1045),
    });
    const logged = String(errorLog.mock.calls[0]?.[0]);

    expect(diagnostic.reason).toBe("database_access_denied");
    expect(logged).toContain(diagnostic.diagnosticId);
    expect(logged).toContain("ER_ACCESS_DENIED_ERROR");
    expect(logged).not.toContain("do-not-log");
    expect(logged).not.toContain("private-host");
    expect(logged).not.toContain("private_database");
    expect(logged).not.toContain("private_user");
    expect(logged).not.toContain("driver detail");
  });
});
