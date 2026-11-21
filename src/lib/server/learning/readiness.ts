import type { QueryResult, QueryResultRow } from "pg";
import { getLearningDatabaseConfiguration, learningQuery } from "./database";

const DEFAULT_READINESS_CACHE_MS = 30_000;
const MIN_READINESS_CACHE_MS = 5_000;
const MAX_READINESS_CACHE_MS = 300_000;

export type LearningDatabaseReadinessStatus =
  | "ready"
  | "not_configured"
  | "invalid_configuration"
  | "dns_unresolved"
  | "connection_refused"
  | "connection_timeout"
  | "tls_failed"
  | "authentication_failed"
  | "database_missing"
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

type PostgresLikeError = {
  code?: unknown;
  message?: unknown;
  cause?: unknown;
  errors?: unknown;
};

const TLS_ERROR_CODES = new Set([
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_GET_ISSUER_CERT",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
]);

// node-postgres emits these exact messages for its own connection timers
// without attaching a machine-readable error code. Match only the library's
// fixed text so hostnames, credentials and provider messages are never used as
// public diagnostic output.
const POSTGRES_TIMEOUT_MESSAGES = new Set([
  "connection terminated due to connection timeout",
  "timeout expired",
]);

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
  const serverResponded = status === "authentication_failed"
    || status === "database_missing"
    || status === "schema_missing"
    || status === "permission_denied";
  return {
    configured: status !== "not_configured" && status !== "invalid_configuration",
    reachable: serverResponded,
    schemaReady: status === "permission_denied",
    readable: false,
    ready: false,
    status,
  };
}

function errorCodes(error: unknown, depth = 0): string[] {
  if (!error || typeof error !== "object" || depth > 3) return [];
  const candidate = error as PostgresLikeError;
  const code = typeof candidate.code === "string" ? [candidate.code.toUpperCase()] : [];
  const nested = candidate.cause ? errorCodes(candidate.cause, depth + 1) : [];
  const aggregate = Array.isArray(candidate.errors)
    ? candidate.errors.flatMap((item) => errorCodes(item, depth + 1))
    : [];
  return [...code, ...nested, ...aggregate];
}

function errorMessages(error: unknown, depth = 0): string[] {
  if (!error || typeof error !== "object" || depth > 3) return [];
  const candidate = error as PostgresLikeError;
  const message = typeof candidate.message === "string" ? [candidate.message.trim().toLowerCase()] : [];
  const nested = candidate.cause ? errorMessages(candidate.cause, depth + 1) : [];
  const aggregate = Array.isArray(candidate.errors)
    ? candidate.errors.flatMap((item) => errorMessages(item, depth + 1))
    : [];
  return [...message, ...nested, ...aggregate];
}

function classifyConnectionFailure(error: unknown): Exclude<LearningDatabaseReadinessStatus, "ready"> {
  const codes = new Set(errorCodes(error));
  const messages = new Set(errorMessages(error));
  if (codes.has("42P01") || codes.has("3F000")) return "schema_missing";
  if (codes.has("42501")) return "permission_denied";
  if (codes.has("28P01") || codes.has("28000")) return "authentication_failed";
  if (codes.has("3D000")) return "database_missing";
  if (codes.has("ENOTFOUND") || codes.has("EAI_AGAIN")) return "dns_unresolved";
  if (codes.has("ECONNREFUSED")) return "connection_refused";
  if (
    codes.has("ETIMEDOUT")
    || codes.has("CONNECT_TIMEOUT")
    || [...messages].some((message) => POSTGRES_TIMEOUT_MESSAGES.has(message))
  ) return "connection_timeout";
  if ([...codes].some((code) => TLS_ERROR_CODES.has(code))) return "tls_failed";
  return "unreachable";
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
    return unavailable(classifyConnectionFailure(error));
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
