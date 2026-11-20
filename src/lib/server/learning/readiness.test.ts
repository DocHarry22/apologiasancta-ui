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
});
