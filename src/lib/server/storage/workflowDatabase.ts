import { convertToPostgresPlaceholders, getAdminDatabaseDialect, type AdminDatabaseDialect } from "@/lib/auth/databaseConfig";

export interface WorkflowDatabaseExecutor {
  dialect: AdminDatabaseDialect;
  query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<T[]>;
}

export interface WorkflowDatabase extends WorkflowDatabaseExecutor {
  transaction<T>(operation: (executor: WorkflowDatabaseExecutor) => Promise<T>): Promise<T>;
}

let databasePromise: Promise<WorkflowDatabase> | null = null;
let schemaPromise: Promise<void> | null = null;

export function workflowDatabaseEnabled(): boolean {
  return getAdminDatabaseDialect() !== null && process.env.APP_STORAGE_DRIVER !== "file";
}

function postgresSql(sql: string): string {
  return convertToPostgresPlaceholders(sql);
}

export async function getWorkflowDatabase(): Promise<WorkflowDatabase> {
  if (databasePromise) return databasePromise;
  const pending = (async (): Promise<WorkflowDatabase> => {
    const dialect = getAdminDatabaseDialect();
    if (!dialect) throw new Error("Editorial workflow database is not configured.");

    if (dialect === "postgres") {
      const postgres = await import("pg");
      const pool = new postgres.Pool({ connectionString: process.env.DATABASE_URL });
      return {
        dialect,
        async query<T extends Record<string, unknown>>(sql: string, values: unknown[] = []): Promise<T[]> {
          const result = await pool.query(postgresSql(sql), values);
          return result.rows as T[];
        },
        async transaction<T>(operation: (executor: WorkflowDatabaseExecutor) => Promise<T>): Promise<T> {
          const client = await pool.connect();
          try {
            await client.query("BEGIN");
            const result = await operation({
              dialect,
              async query<Row extends Record<string, unknown>>(sql: string, values: unknown[] = []): Promise<Row[]> {
                const response = await client.query(postgresSql(sql), values);
                return response.rows as Row[];
              },
            });
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
      ? mysql.createPool(process.env.DATABASE_URL)
      : mysql.createPool({
          host: process.env.MYSQL_HOST,
          port: Number(process.env.MYSQL_PORT || 3306),
          database: process.env.MYSQL_DATABASE,
          user: process.env.MYSQL_USER,
          password: process.env.MYSQL_PASSWORD,
          waitForConnections: true,
          connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 5),
        });
    return {
      dialect,
      async query<T extends Record<string, unknown>>(sql: string, values: unknown[] = []): Promise<T[]> {
        const [rows] = await pool.execute(sql, values as never);
        return rows as T[];
      },
      async transaction<T>(operation: (executor: WorkflowDatabaseExecutor) => Promise<T>): Promise<T> {
        const connection = await pool.getConnection();
        try {
          await connection.beginTransaction();
          const result = await operation({
            dialect,
            async query<Row extends Record<string, unknown>>(sql: string, values: unknown[] = []): Promise<Row[]> {
              const [rows] = await connection.execute(sql, values as never);
              return rows as Row[];
            },
          });
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
  })();
  databasePromise = pending;
  try {
    return await pending;
  } catch (error) {
    if (databasePromise === pending) databasePromise = null;
    throw error;
  }
}

async function ensurePostgresSchema(database: WorkflowDatabase): Promise<void> {
  await database.query(`
    CREATE TABLE IF NOT EXISTS app_schema_migrations (
      migration_id VARCHAR(191) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS content_workflow_items (
      id VARCHAR(191) PRIMARY KEY,
      question_id VARCHAR(191) NOT NULL UNIQUE,
      question_id_normalized VARCHAR(191) NOT NULL UNIQUE,
      topic_id VARCHAR(191) NOT NULL,
      status VARCHAR(32) NOT NULL,
      author_id VARCHAR(191) NOT NULL,
      reviewer_id VARCHAR(191),
      current_revision_id VARCHAR(191) NOT NULL,
      content_hash CHAR(64) NOT NULL,
      payload JSONB NOT NULL,
      created_at VARCHAR(40) NOT NULL,
      updated_at VARCHAR(40) NOT NULL
    )
  `);
  await database.query("CREATE INDEX IF NOT EXISTS idx_content_workflow_status ON content_workflow_items (status, updated_at)");
  await database.query("CREATE INDEX IF NOT EXISTS idx_content_workflow_topic ON content_workflow_items (topic_id, status)");
  await database.query("CREATE INDEX IF NOT EXISTS idx_content_workflow_author ON content_workflow_items (author_id, status)");
  await database.query("CREATE INDEX IF NOT EXISTS idx_content_workflow_reviewer ON content_workflow_items (reviewer_id, status)");

  await database.query(`
    CREATE TABLE IF NOT EXISTS content_workflow_revisions (
      id VARCHAR(191) PRIMARY KEY,
      workflow_item_id VARCHAR(191) NOT NULL,
      revision_number INTEGER NOT NULL,
      content_hash CHAR(64) NOT NULL,
      snapshot JSONB NOT NULL,
      created_by VARCHAR(191) NOT NULL,
      created_at VARCHAR(40) NOT NULL,
      UNIQUE (workflow_item_id, revision_number)
    )
  `);
  await database.query("CREATE INDEX IF NOT EXISTS idx_content_revisions_item_hash ON content_workflow_revisions (workflow_item_id, content_hash)");

  await database.query(`
    CREATE TABLE IF NOT EXISTS content_review_records (
      id VARCHAR(191) PRIMARY KEY,
      workflow_item_id VARCHAR(191) NOT NULL,
      revision_id VARCHAR(191) NOT NULL,
      content_hash CHAR(64) NOT NULL,
      reviewer_id VARCHAR(191) NOT NULL,
      decision VARCHAR(32) NOT NULL,
      comment TEXT NOT NULL,
      attestation JSONB,
      created_at VARCHAR(40) NOT NULL
    )
  `);
  await database.query("CREATE INDEX IF NOT EXISTS idx_content_reviews_item ON content_review_records (workflow_item_id, created_at)");
  await database.query("CREATE INDEX IF NOT EXISTS idx_content_reviews_reviewer ON content_review_records (reviewer_id, created_at)");

  await database.query(`
    CREATE TABLE IF NOT EXISTS content_workflow_events (
      id VARCHAR(191) PRIMARY KEY,
      workflow_item_id VARCHAR(191) NOT NULL,
      event_type VARCHAR(64) NOT NULL,
      actor_id VARCHAR(191) NOT NULL,
      content_hash CHAR(64),
      event JSONB NOT NULL,
      created_at VARCHAR(40) NOT NULL
    )
  `);
  await database.query("CREATE INDEX IF NOT EXISTS idx_content_events_item ON content_workflow_events (workflow_item_id, created_at)");
  await database.query("CREATE INDEX IF NOT EXISTS idx_content_events_actor ON content_workflow_events (actor_id, created_at)");

  await database.query(`
    CREATE TABLE IF NOT EXISTS content_publication_outbox (
      idempotency_key VARCHAR(255) PRIMARY KEY,
      workflow_item_id VARCHAR(191) NOT NULL,
      revision_id VARCHAR(191) NOT NULL,
      content_hash CHAR(64) NOT NULL,
      status VARCHAR(32) NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      lease_expires_at VARCHAR(40),
      last_error TEXT,
      engine_result JSONB,
      created_at VARCHAR(40) NOT NULL,
      updated_at VARCHAR(40) NOT NULL,
      completed_at VARCHAR(40)
    )
  `);
  await database.query("CREATE INDEX IF NOT EXISTS idx_content_outbox_status ON content_publication_outbox (status, lease_expires_at)");
  await database.query("CREATE INDEX IF NOT EXISTS idx_content_outbox_item ON content_publication_outbox (workflow_item_id, created_at)");
  await database.query(
    "INSERT INTO app_schema_migrations (migration_id) VALUES (?) ON CONFLICT (migration_id) DO NOTHING",
    ["2026-07-16-human-editorial-gates-v1"]
  );
}

async function ensureMysqlSchema(database: WorkflowDatabase): Promise<void> {
  await database.query(`
    CREATE TABLE IF NOT EXISTS app_schema_migrations (
      migration_id VARCHAR(191) PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS content_workflow_items (
      id VARCHAR(191) PRIMARY KEY,
      question_id VARCHAR(191) NOT NULL UNIQUE,
      question_id_normalized VARCHAR(191) NOT NULL UNIQUE,
      topic_id VARCHAR(191) NOT NULL,
      status VARCHAR(32) NOT NULL,
      author_id VARCHAR(191) NOT NULL,
      reviewer_id VARCHAR(191) NULL,
      current_revision_id VARCHAR(191) NOT NULL,
      content_hash CHAR(64) NOT NULL,
      payload JSON NOT NULL,
      created_at VARCHAR(40) NOT NULL,
      updated_at VARCHAR(40) NOT NULL,
      INDEX idx_content_workflow_status (status, updated_at),
      INDEX idx_content_workflow_topic (topic_id, status),
      INDEX idx_content_workflow_author (author_id, status),
      INDEX idx_content_workflow_reviewer (reviewer_id, status)
    )
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS content_workflow_revisions (
      id VARCHAR(191) PRIMARY KEY,
      workflow_item_id VARCHAR(191) NOT NULL,
      revision_number INTEGER NOT NULL,
      content_hash CHAR(64) NOT NULL,
      snapshot JSON NOT NULL,
      created_by VARCHAR(191) NOT NULL,
      created_at VARCHAR(40) NOT NULL,
      UNIQUE KEY uq_content_revision_number (workflow_item_id, revision_number),
      INDEX idx_content_revisions_item_hash (workflow_item_id, content_hash)
    )
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS content_review_records (
      id VARCHAR(191) PRIMARY KEY,
      workflow_item_id VARCHAR(191) NOT NULL,
      revision_id VARCHAR(191) NOT NULL,
      content_hash CHAR(64) NOT NULL,
      reviewer_id VARCHAR(191) NOT NULL,
      decision VARCHAR(32) NOT NULL,
      comment TEXT NOT NULL,
      attestation JSON NULL,
      created_at VARCHAR(40) NOT NULL,
      INDEX idx_content_reviews_item (workflow_item_id, created_at),
      INDEX idx_content_reviews_reviewer (reviewer_id, created_at)
    )
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS content_workflow_events (
      id VARCHAR(191) PRIMARY KEY,
      workflow_item_id VARCHAR(191) NOT NULL,
      event_type VARCHAR(64) NOT NULL,
      actor_id VARCHAR(191) NOT NULL,
      content_hash CHAR(64) NULL,
      event JSON NOT NULL,
      created_at VARCHAR(40) NOT NULL,
      INDEX idx_content_events_item (workflow_item_id, created_at),
      INDEX idx_content_events_actor (actor_id, created_at)
    )
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS content_publication_outbox (
      idempotency_key VARCHAR(255) PRIMARY KEY,
      workflow_item_id VARCHAR(191) NOT NULL,
      revision_id VARCHAR(191) NOT NULL,
      content_hash CHAR(64) NOT NULL,
      status VARCHAR(32) NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      lease_expires_at VARCHAR(40) NULL,
      last_error TEXT NULL,
      engine_result JSON NULL,
      created_at VARCHAR(40) NOT NULL,
      updated_at VARCHAR(40) NOT NULL,
      completed_at VARCHAR(40) NULL,
      INDEX idx_content_outbox_status (status, lease_expires_at),
      INDEX idx_content_outbox_item (workflow_item_id, created_at)
    )
  `);
  await database.query(
    "INSERT IGNORE INTO app_schema_migrations (migration_id) VALUES (?)",
    ["2026-07-16-human-editorial-gates-v1"]
  );
}

export async function ensureWorkflowDatabaseSchema(): Promise<void> {
  if (!workflowDatabaseEnabled()) return;
  if (schemaPromise) return schemaPromise;
  const pending = (async () => {
    const database = await getWorkflowDatabase();
    if (database.dialect === "postgres") await ensurePostgresSchema(database);
    else await ensureMysqlSchema(database);
  })();
  schemaPromise = pending;
  try {
    await pending;
  } catch (error) {
    if (schemaPromise === pending) schemaPromise = null;
    throw error;
  }
}

export function databaseJsonCast(executor: WorkflowDatabaseExecutor): string {
  return executor.dialect === "postgres" ? "?::jsonb" : "?";
}

export function parseWorkflowDatabaseJson<T>(value: unknown): T {
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}
