import { getLearningProgressMigrationStatements } from "../src/lib/server/learningProgressSchema.ts";

function resolveDialect() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (/^postgres(?:ql)?:\/\//i.test(databaseUrl ?? "")) return "postgres";
  if (/^mysql:\/\//i.test(databaseUrl ?? "")) return "mysql";
  if (["MYSQL_HOST", "MYSQL_DATABASE", "MYSQL_USER", "MYSQL_PASSWORD"].every((key) => process.env[key]?.trim())) {
    return "mysql";
  }
  throw new Error("Configure a PostgreSQL/MySQL DATABASE_URL or the four MYSQL_* variables before migrating.");
}

async function migratePostgres(statements) {
  const { Client } = await import("pg");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10_000),
  });
  await client.connect();
  try {
    for (const statement of statements) await client.query(statement);
  } finally {
    await client.end();
  }
}

async function migrateMysql(statements) {
  const mysql = await import("mysql2/promise");
  const connection = process.env.DATABASE_URL
    ? await mysql.createConnection(process.env.DATABASE_URL)
    : await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT || 3306),
      database: process.env.MYSQL_DATABASE,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10_000),
      timezone: "Z",
    });
  try {
    await connection.query("SET time_zone = '+00:00'");
    for (const statement of statements) await connection.query(statement);
  } finally {
    await connection.end();
  }
}

const dialect = resolveDialect();
const statements = getLearningProgressMigrationStatements(dialect);
if (dialect === "postgres") await migratePostgres(statements);
else await migrateMysql(statements);
process.stdout.write(`Applied ${statements.length} repeatable ${dialect} learning-progress migration statements.\n`);
