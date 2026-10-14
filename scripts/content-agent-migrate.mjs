import { readFile } from 'node:fs/promises';
import pg from 'pg';
if (!process.env.LEARNING_DATABASE_URL) throw new Error('LEARNING_DATABASE_URL is required');
const mode = process.env.LEARNING_DB_SSL_MODE;
const pool = new pg.Pool({ connectionString: process.env.LEARNING_DATABASE_URL,
  ssl: mode === 'disable' ? false : mode ? { rejectUnauthorized: mode !== 'require' } : undefined,
  connectionTimeoutMillis: 10000, statement_timeout: 30000 });
try {
  await pool.query(await readFile(new URL('./sql/content-agent.sql', import.meta.url), 'utf8'));
  const result = await pool.query("select count(*)::int as tables from pg_tables where schemaname='apologia_agent' and rowsecurity");
  if (result.rows[0].tables !== 3) throw new Error('Agent schema verification failed');
  console.log('Agent schema installed; three private tables have RLS enabled.');
} finally { await pool.end(); }
