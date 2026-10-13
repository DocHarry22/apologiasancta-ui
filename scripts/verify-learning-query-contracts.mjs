import { readFile } from "node:fs/promises";
import pg from "pg";

// Prepare the actual repository SQL against a migrated disposable database.
// String assertions and mocked query responses cannot catch PostgreSQL parsing
// or parameter type inference errors.
const connectionString = process.env.LEARNING_QUERY_TEST_DATABASE_URL;
if (!connectionString) throw new Error("LEARNING_QUERY_TEST_DATABASE_URL is required");
const client = new pg.Client({ connectionString });
await client.connect();
try {
  await client.query("BEGIN");
  for (const [file, functionName, queryPrefix, name, types] of [
    ["publicRepository.ts", "checkPracticeAnswer", "SELECT o.is_correct", "audit_practice", "uuid, uuid"],
    ["learnerRepository.ts", "updateLessonProgress", "INSERT INTO public.lesson_progress", "audit_progress", "uuid, uuid, text, numeric, jsonb, integer"],
  ]) {
    const source = await readFile(new URL(`../src/lib/server/learning/${file}`, import.meta.url), "utf8");
    const functionStart = source.indexOf(`export async function ${functionName}(`);
    if (functionStart < 0) throw new Error(`Missing function ${functionName}`);
    const functionEnd = source.indexOf("\nexport ", functionStart + 1);
    const body = source.slice(functionStart, functionEnd < 0 ? undefined : functionEnd);
    const sql = [...body.matchAll(/`([^`]+)`/g)].map(match => match[1]).find(value => value.startsWith(queryPrefix));
    if (!sql || sql.includes("${")) throw new Error(`Missing static SQL for ${functionName}`);
    await client.query(`PREPARE ${name} (${types}) AS ${sql}`);
    console.log(`${functionName}: PostgreSQL SQL and parameter types verified`);
  }
} finally {
  await client.query("ROLLBACK");
  await client.end();
}
