import { convertToPostgresPlaceholders, getAdminDatabaseDialect } from "@/lib/auth/databaseConfig";
import type { RemoteLearningProgress } from "@/lib/learningProgress";
import type { LearningProgressSyncInput } from "@/lib/learningProgressContract";
import {
  getLearningProgressMigrationStatements,
  type LearningProgressDialect,
} from "./learningProgressSchema";

type QueryRow = Record<string, unknown>;

interface DatabaseSession {
  execute(sql: string, values?: unknown[]): Promise<QueryRow[]>;
}

interface LearningDatabase extends DatabaseSession {
  transaction<T>(operation: (session: DatabaseSession) => Promise<T>): Promise<T>;
}

type ProgressRow = {
  revision: number;
  practiceBest: number;
  practiceAttempts: number;
  clientUpdatedAt: string | null;
  updatedAt: string | null;
};

export type LearningProgressSyncResult = {
  progress: RemoteLearningProgress;
  conflictMerged: boolean;
  acknowledgedMutationIds: string[];
};

let databasePromise: Promise<LearningDatabase> | null = null;
let schemaPromise: Promise<void> | null = null;

function toIsoTimestamp(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(date.valueOf()) ? date.toISOString() : null;
}

function toSafeCount(value: unknown): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function rowToProgress(row: QueryRow | undefined): ProgressRow {
  return {
    revision: toSafeCount(row?.revision),
    practiceBest: toSafeCount(row?.practice_best),
    practiceAttempts: toSafeCount(row?.practice_attempts),
    clientUpdatedAt: toIsoTimestamp(row?.client_updated_at),
    updatedAt: toIsoTimestamp(row?.updated_at),
  };
}

function laterTimestamp(left: string | null, right: string | null): string | null {
  if (!left) return right;
  if (!right) return left;
  return Date.parse(left) >= Date.parse(right) ? left : right;
}

export function isLearningCloudSyncConfigured(environment: Record<string, string | undefined> = process.env): boolean {
  return environment.LEARNING_CLOUD_SYNC_ENABLED === "true" && getAdminDatabaseDialect(environment) !== null;
}

async function createLearningDatabase(): Promise<LearningDatabase> {
  const dialect = getAdminDatabaseDialect();
  if (!dialect) throw new Error("Learning progress requires a configured PostgreSQL or MySQL database.");

  if (dialect === "postgres") {
    const postgres = await import("pg");
    const pool = new postgres.Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10_000),
      max: Number(process.env.LEARNING_DB_POOL_SIZE || 5),
    });
    const execute = async (executor: { query: (sql: string, values?: unknown[]) => Promise<{ rows: QueryRow[] }> }, sql: string, values?: unknown[]) => {
      const result = await executor.query(convertToPostgresPlaceholders(sql), values);
      return result.rows;
    };
    return {
      execute: (sql, values) => execute(pool, sql, values),
      async transaction<T>(operation: (session: DatabaseSession) => Promise<T>): Promise<T> {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const result = await operation({ execute: (sql, values) => execute(client, sql, values) });
          await client.query("COMMIT");
          return result;
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
      },
    };
  }

  const mysql = await import("mysql2/promise");
  const pool = process.env.DATABASE_URL
    ? mysql.createPool({
      uri: process.env.DATABASE_URL,
      waitForConnections: true,
      connectionLimit: Number(process.env.LEARNING_DB_POOL_SIZE || 5),
      connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10_000),
      timezone: "Z",
    })
    : mysql.createPool({
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT || 3306),
      database: process.env.MYSQL_DATABASE,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      waitForConnections: true,
      connectionLimit: Number(process.env.LEARNING_DB_POOL_SIZE || 5),
      connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10_000),
      timezone: "Z",
    });
  const execute = async (executor: { execute: unknown }, sql: string, values?: unknown[]) => {
    const run = executor.execute as (statement: string, parameters?: unknown[]) => Promise<[unknown, unknown]>;
    const [rows] = await run.call(executor, sql, values);
    return Array.isArray(rows) ? rows as QueryRow[] : [];
  };
  return {
    execute: (sql, values) => execute(pool, sql, values),
    async transaction<T>(operation: (session: DatabaseSession) => Promise<T>): Promise<T> {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const result = await operation({ execute: (sql, values) => execute(connection, sql, values) });
        await connection.commit();
        return result;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },
  };
}

async function getLearningDatabase(): Promise<LearningDatabase> {
  if (!databasePromise) {
    const pending = createLearningDatabase();
    databasePromise = pending;
    try {
      return await pending;
    } catch (error) {
      if (databasePromise === pending) databasePromise = null;
      throw error;
    }
  }
  return databasePromise;
}

export async function ensureLearningProgressSchema(): Promise<void> {
  if (schemaPromise) return schemaPromise;
  const pending = (async () => {
    const dialect = getAdminDatabaseDialect() as LearningProgressDialect | null;
    if (!dialect) throw new Error("Learning progress database dialect is unavailable.");
    const database = await getLearningDatabase();
    // The DDL is intentionally repeatable. Running every statement also repairs
    // a previous deploy interrupted before its migration ledger insert.
    for (const statement of getLearningProgressMigrationStatements(dialect)) {
      await database.execute(statement);
    }
  })();
  schemaPromise = pending;
  try {
    await pending;
  } catch (error) {
    if (schemaPromise === pending) schemaPromise = null;
    throw error;
  }
}

async function readProgress(session: DatabaseSession, accountId: string): Promise<RemoteLearningProgress> {
  const profileRows = await session.execute(
    `SELECT revision, practice_best, practice_attempts, client_updated_at, updated_at
     FROM learning_profiles WHERE account_id = ? LIMIT 1`,
    [accountId]
  );
  const profile = rowToProgress(profileRows[0]);
  const lessonRows = await session.execute(
    "SELECT lesson_id FROM learning_lesson_progress WHERE account_id = ? ORDER BY completed_at ASC, lesson_id ASC",
    [accountId]
  );
  return {
    completedLessonIds: lessonRows.map((row) => String(row.lesson_id)),
    practiceBest: profile.practiceBest,
    practiceAttempts: profile.practiceAttempts,
    revision: profile.revision,
    updatedAt: profile.updatedAt,
  };
}

export async function getLearningProgress(accountId: string): Promise<RemoteLearningProgress> {
  await ensureLearningProgressSchema();
  const database = await getLearningDatabase();
  return readProgress(database, accountId);
}

export type ProgressMergeCalculation = {
  conflictMerged: boolean;
  revision: number;
  practiceBest: number;
  practiceAttempts: number;
  clientUpdatedAt: string | null;
  newMutationIds: string[];
  changed: boolean;
};

export function calculateLearningProgressMerge(
  existing: ProgressRow,
  input: LearningProgressSyncInput,
  existingMutationIds: ReadonlySet<string>,
  lessonChanged: boolean
): ProgressMergeCalculation {
  const newEvents = input.practiceAttempts.filter((event) => !existingMutationIds.has(event.id));
  const practiceBest = Math.max(existing.practiceBest, input.practiceBest, ...newEvents.map((event) => event.score));
  const practiceAttempts = Math.max(existing.practiceAttempts, input.practiceAttemptsFloor) + newEvents.length;
  const clientUpdatedAt = laterTimestamp(existing.clientUpdatedAt, input.clientUpdatedAt);
  const changed = lessonChanged
    || newEvents.length > 0
    || practiceBest !== existing.practiceBest
    || practiceAttempts !== existing.practiceAttempts
    || clientUpdatedAt !== existing.clientUpdatedAt;
  return {
    conflictMerged: input.baseRevision !== existing.revision,
    revision: existing.revision + (changed ? 1 : 0),
    practiceBest,
    practiceAttempts,
    clientUpdatedAt,
    newMutationIds: newEvents.map((event) => event.id),
    changed,
  };
}

export async function syncLearningProgress(
  accountId: string,
  input: LearningProgressSyncInput
): Promise<LearningProgressSyncResult> {
  await ensureLearningProgressSchema();
  const database = await getLearningDatabase();
  const dialect = getAdminDatabaseDialect() as LearningProgressDialect;

  return database.transaction(async (session) => {
    if (dialect === "postgres") {
      await session.execute(
        `INSERT INTO learning_profiles (account_id, revision, practice_best, practice_attempts)
         VALUES (?, 0, 0, 0) ON CONFLICT (account_id) DO NOTHING`,
        [accountId]
      );
    } else {
      await session.execute(
        `INSERT IGNORE INTO learning_profiles (account_id, revision, practice_best, practice_attempts)
         VALUES (?, 0, 0, 0)`,
        [accountId]
      );
    }

    const profileRows = await session.execute(
      `SELECT revision, practice_best, practice_attempts, client_updated_at, updated_at
       FROM learning_profiles WHERE account_id = ? FOR UPDATE`,
      [accountId]
    );
    const existing = rowToProgress(profileRows[0]);
    const lessonRows = await session.execute(
      "SELECT lesson_id FROM learning_lesson_progress WHERE account_id = ?",
      [accountId]
    );
    const existingLessons = new Set(lessonRows.map((row) => String(row.lesson_id)));
    const missingLessonIds = input.completedLessonIds.filter((lessonId) => !existingLessons.has(lessonId));

    const existingMutationIds = new Set<string>();
    for (const event of input.practiceAttempts) {
      const rows = await session.execute(
        "SELECT mutation_id FROM learning_progress_mutations WHERE account_id = ? AND mutation_id = ? LIMIT 1",
        [accountId, event.id]
      );
      if (rows.length > 0) existingMutationIds.add(event.id);
    }

    const merge = calculateLearningProgressMerge(existing, input, existingMutationIds, missingLessonIds.length > 0);

    for (const lessonId of missingLessonIds) {
      if (dialect === "postgres") {
        await session.execute(
          `INSERT INTO learning_lesson_progress (account_id, lesson_id, completed_at, updated_at)
           VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (account_id, lesson_id) DO NOTHING`,
          [accountId, lessonId]
        );
      } else {
        await session.execute(
          `INSERT IGNORE INTO learning_lesson_progress (account_id, lesson_id, completed_at, updated_at)
           VALUES (?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
          [accountId, lessonId]
        );
      }
    }

    const newMutationIds = new Set(merge.newMutationIds);
    for (const event of input.practiceAttempts) {
      if (!newMutationIds.has(event.id)) continue;
      await session.execute(
        `INSERT INTO learning_progress_mutations
         (account_id, mutation_id, mutation_type, score, occurred_at, applied_revision, applied_at)
         VALUES (?, ?, 'practice_attempt', ?, ?, ?, ${dialect === "postgres" ? "CURRENT_TIMESTAMP" : "UTC_TIMESTAMP(3)"})`,
        [accountId, event.id, event.score, new Date(event.occurredAt), merge.revision]
      );
    }

    if (merge.changed) {
      await session.execute(
        `UPDATE learning_profiles
         SET revision = ?, practice_best = ?, practice_attempts = ?, client_updated_at = ?,
             updated_at = ${dialect === "postgres" ? "CURRENT_TIMESTAMP" : "UTC_TIMESTAMP(3)"}
         WHERE account_id = ?`,
        [
          merge.revision,
          merge.practiceBest,
          merge.practiceAttempts,
          merge.clientUpdatedAt ? new Date(merge.clientUpdatedAt) : null,
          accountId,
        ]
      );
    }

    return {
      progress: await readProgress(session, accountId),
      conflictMerged: merge.conflictMerged,
      // Returning all submitted IDs is safe: an existing row proves an earlier
      // retry already committed that same account-scoped event.
      acknowledgedMutationIds: input.practiceAttempts.map((event) => event.id),
    };
  });
}

export function resetLearningProgressStoreForTests(): void {
  databasePromise = null;
  schemaPromise = null;
}
