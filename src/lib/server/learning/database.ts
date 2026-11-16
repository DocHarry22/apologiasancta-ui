import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { LearningApiError } from "./errors";

const DEFAULT_CONNECT_TIMEOUT_MS = 8_000;
const DEFAULT_STATEMENT_TIMEOUT_MS = 15_000;

declare global {
  var __apologiaLearningPool: Pool | undefined;
}

export type LearningDatabaseConfiguration = {
  urlPresent: boolean;
  urlSupported: boolean;
  sslModeSupported: boolean;
  ready: boolean;
};

const SUPPORTED_SSL_MODES = new Set(["disable", "require", "verify-ca", "verify-full"]);

function isSupportedLearningDatabaseUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "postgres:" || parsed.protocol === "postgresql:";
  } catch {
    return false;
  }
}

export function getLearningDatabaseConfiguration(): LearningDatabaseConfiguration {
  const databaseUrl = process.env.LEARNING_DATABASE_URL?.trim() ?? "";
  const sslMode = process.env.LEARNING_DB_SSL_MODE?.trim().toLowerCase() ?? "";
  const urlPresent = databaseUrl.length > 0;
  const urlSupported = urlPresent && isSupportedLearningDatabaseUrl(databaseUrl);
  const sslModeSupported = sslMode.length === 0 || SUPPORTED_SSL_MODES.has(sslMode);
  return {
    urlPresent,
    urlSupported,
    sslModeSupported,
    ready: urlSupported && sslModeSupported,
  };
}

function boundedTimeout(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1_000 && parsed <= 60_000 ? parsed : fallback;
}

function getLearningDatabaseUrl(): string {
  const value = process.env.LEARNING_DATABASE_URL?.trim();
  if (!value) {
    throw new LearningApiError(
      "learning_service_unavailable",
      503,
      "The learning service is temporarily unavailable.",
    );
  }
  if (!isSupportedLearningDatabaseUrl(value)) {
    throw new LearningApiError(
      "learning_service_unavailable",
      503,
      "The learning service is temporarily unavailable.",
    );
  }
  return value;
}

function getLearningSsl(): false | { rejectUnauthorized: boolean } | undefined {
  const mode = process.env.LEARNING_DB_SSL_MODE?.trim().toLowerCase();
  if (!mode) return undefined;
  if (mode === "disable") return false;
  if (mode === "require") return { rejectUnauthorized: false };
  if (mode === "verify-ca" || mode === "verify-full") return { rejectUnauthorized: true };
  throw new LearningApiError(
    "learning_service_unavailable",
    503,
    "The learning service is temporarily unavailable.",
  );
}

export function getLearningPool(): Pool {
  if (globalThis.__apologiaLearningPool) return globalThis.__apologiaLearningPool;

  const pool = new Pool({
    connectionString: getLearningDatabaseUrl(),
    ssl: getLearningSsl(),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: boundedTimeout(process.env.LEARNING_DB_CONNECT_TIMEOUT_MS, DEFAULT_CONNECT_TIMEOUT_MS),
    statement_timeout: boundedTimeout(process.env.LEARNING_DB_STATEMENT_TIMEOUT_MS, DEFAULT_STATEMENT_TIMEOUT_MS),
    application_name: "apologia-sancta-learning-api",
  });
  pool.on("error", () => {
    // Pool errors are intentionally not logged with connection details.
  });
  globalThis.__apologiaLearningPool = pool;
  return pool;
}

export function learningQuery<T extends QueryResultRow = Record<string, unknown>>(
  text: string,
  values: unknown[] = [],
): Promise<QueryResult<T>> {
  return getLearningPool().query<T>(text, values);
}

export async function withLearningTransaction<T>(
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getLearningPool().connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original failure.
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function closeLearningPoolForTests(): Promise<void> {
  if (!globalThis.__apologiaLearningPool) return;
  const pool = globalThis.__apologiaLearningPool;
  globalThis.__apologiaLearningPool = undefined;
  await pool.end();
}
