import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { convertToPostgresPlaceholders, getAdminDatabaseDialect } from "../../auth/databaseConfig";

const DATA_DIR = process.env.APP_DATA_DIR || ".data";

type DatabasePool = {
  execute: (sql: string, values?: unknown[]) => Promise<[unknown[], unknown]>;
};

let poolPromise: Promise<DatabasePool> | null = null;
let schemaPromise: Promise<void> | null = null;

function databaseStorageEnabled(): boolean {
  return getAdminDatabaseDialect() !== null && process.env.APP_STORAGE_DRIVER !== "file";
}

async function getDatabasePool(): Promise<DatabasePool> {
  if (poolPromise) return poolPromise;

  const pending = (async (): Promise<DatabasePool> => {
    const dialect = getAdminDatabaseDialect();
    if (!dialect) throw new Error("Application database storage is not configured.");

    if (dialect === "postgres") {
      const postgres = await import("pg");
      const pool = new postgres.Pool({ connectionString: process.env.DATABASE_URL });
      return {
        async execute(sql: string, values?: unknown[]): Promise<[unknown[], unknown]> {
          const result = await pool.query(convertToPostgresPlaceholders(sql), values);
          return [result.rows, []];
        },
      };
    }

    const mysql = await import("mysql2/promise");
    if (process.env.DATABASE_URL) return mysql.createPool(process.env.DATABASE_URL) as unknown as DatabasePool;
    return mysql.createPool({
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT || 3306),
      database: process.env.MYSQL_DATABASE,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      waitForConnections: true,
      connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 5),
    }) as unknown as DatabasePool;
  })();
  poolPromise = pending;
  try {
    return await pending;
  } catch (error) {
    if (poolPromise === pending) poolPromise = null;
    throw error;
  }
}

async function ensureDatabaseSchema(): Promise<void> {
  if (schemaPromise) return schemaPromise;
  const pending = (async () => {
    const pool = await getDatabasePool();
    if (getAdminDatabaseDialect() === "postgres") {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS app_kv_store (
          store_key VARCHAR(191) PRIMARY KEY,
          payload JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      return;
    }
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS app_kv_store (
        store_key VARCHAR(191) PRIMARY KEY,
        payload JSON NOT NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  })();
  schemaPromise = pending;
  try {
    await pending;
  } catch (error) {
    if (schemaPromise === pending) schemaPromise = null;
    throw error;
  }
}

function parseDatabasePayload<T>(value: unknown): T {
  if (typeof value === "string") return JSON.parse(value) as T;
  return value as T;
}

export class JsonStore<T> {
  private readonly filePath: string;
  private readonly storeKey: string;
  private readonly fallback: T;

  constructor(fileName: string, fallback: T) {
    this.filePath = path.join(/*turbopackIgnore: true*/ DATA_DIR, fileName);
    this.storeKey = fileName.replace(/\.json$/i, "");
    this.fallback = fallback;
  }

  private async readFile(): Promise<T> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return JSON.parse(raw) as T;
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (code === "ENOENT") return structuredClone(this.fallback);
      throw error;
    }
  }

  private async writeFile(value: T): Promise<void> {
    await mkdir(DATA_DIR, { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(tempPath, this.filePath);
  }

  async read(): Promise<T> {
    if (!databaseStorageEnabled()) return this.readFile();

    await ensureDatabaseSchema();
    const pool = await getDatabasePool();
    const [rows] = await pool.execute("SELECT payload FROM app_kv_store WHERE store_key = ? LIMIT 1", [this.storeKey]);
    const row = (rows as Array<{ payload?: unknown }>)[0];
    if (row?.payload !== undefined) return parseDatabasePayload<T>(row.payload);

    // One-time migration path: preserve an existing local JSON snapshot when a
    // deployment first enables database storage.
    const fileValue = await this.readFile();
    if (JSON.stringify(fileValue) !== JSON.stringify(this.fallback)) await this.write(fileValue);
    return fileValue;
  }

  async write(value: T): Promise<void> {
    if (!databaseStorageEnabled()) return this.writeFile(value);

    await ensureDatabaseSchema();
    const pool = await getDatabasePool();
    const payload = JSON.stringify(value);
    if (getAdminDatabaseDialect() === "postgres") {
      await pool.execute(
        `INSERT INTO app_kv_store (store_key, payload, updated_at)
         VALUES (?, ?::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (store_key) DO UPDATE SET payload = EXCLUDED.payload, updated_at = CURRENT_TIMESTAMP`,
        [this.storeKey, payload]
      );
      return;
    }
    await pool.execute(
      `INSERT INTO app_kv_store (store_key, payload, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = CURRENT_TIMESTAMP`,
      [this.storeKey, payload]
    );
  }
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}
