import type { QueryResult, QueryResultRow } from "pg";
import { getLearningDatabaseConfiguration, learningQuery } from "./database";

const DEFAULT_READINESS_CACHE_MS = 30_000;
const MIN_READINESS_CACHE_MS = 5_000;
const MAX_READINESS_CACHE_MS = 300_000;

export type LearningDatabaseReadinessStatus =
  | "ready"
  | "not_configured"
  | "invalid_configuration"
  | "schema_missing"
  | "permission_denied"
  | "unreachable";

export type LearningDatabaseReadiness = {
  configured: boolean;
  reachable: boolean;
  schemaReady: boolean;
  readable: boolean;
  ready: boolean;
  status: LearningDatabaseReadinessStatus;
};

type ReadinessQuery = <T extends QueryResultRow = Record<string, unknown>>(
  text: string,
  values?: unknown[],
) => Promise<QueryResult<T>>;

type PostgresLikeError = { code?: unknown };

declare global {
  var __apologiaLearningReadinessProbe: {
    expiresAt: number;
    promise: Promise<LearningDatabaseReadiness>;
  } | undefined;
}

function boundedCacheMs(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= MIN_READINESS_CACHE_MS && parsed <= MAX_READINESS_CACHE_MS
    ? parsed
    : DEFAULT_READINESS_CACHE_MS;
}

function unavailable(status: Exclude<LearningDatabaseReadinessStatus, "ready">): LearningDatabaseReadiness {
  return {
    configured: status !== "not_configured" && status !== "invalid_configuration",
    reachable: status === "schema_missing" || status === "permission_denied",
    schemaReady: status === "permission_denied",
    readable: false,
    ready: false,
    status,
  };
}

export async function probeLearningDatabaseReadiness(
  query: ReadinessQuery = learningQuery,
): Promise<LearningDatabaseReadiness> {
  const configuration = getLearningDatabaseConfiguration();
  if (!configuration.urlPresent) return unavailable("not_configured");
  if (!configuration.ready) return unavailable("invalid_configuration");

  try {
    // LIMIT 0 verifies connection, schema visibility and SELECT permission without reading learner data.
    await query("SELECT 1 FROM content.published_programmes LIMIT 0");
    return {
      configured: true,
      reachable: true,
      schemaReady: true,
      readable: true,
      ready: true,
      status: "ready",
    };
  } catch (error) {
    const code = error && typeof error === "object" ? (error as PostgresLikeError).code : undefined;
    if (code === "42P01" || code === "3F000") return unavailable("schema_missing");
    if (code === "42501") return unavailable("permission_denied");
    return unavailable("unreachable");
  }
}

export function getLearningDatabaseReadiness(): Promise<LearningDatabaseReadiness> {
  const now = Date.now();
  const cached = globalThis.__apologiaLearningReadinessProbe;
  if (cached && cached.expiresAt > now) return cached.promise;

  const promise = probeLearningDatabaseReadiness();
  globalThis.__apologiaLearningReadinessProbe = {
    expiresAt: now + boundedCacheMs(process.env.LEARNING_DB_READINESS_CACHE_MS),
    promise,
  };
  return promise;
}

export function clearLearningDatabaseReadinessCacheForTests(): void {
  globalThis.__apologiaLearningReadinessProbe = undefined;
}
