import { readFile } from "node:fs/promises";
import pg from "pg";

const connectionString = process.env.LEARNING_QUERY_TEST_DATABASE_URL;
if (!connectionString) throw new Error("LEARNING_QUERY_TEST_DATABASE_URL is required");

const contracts = [
  {
    file: "publicRepository.ts",
    functionName: "checkPracticeAnswer",
    queryPrefix: "SELECT o.is_correct",
    statementName: "verify_practice_answer",
    parameterTypes: "uuid, uuid",
  },
  {
    file: "learnerRepository.ts",
    functionName: "updateLessonProgress",
    queryPrefix: "INSERT INTO public.lesson_progress",
    statementName: "verify_lesson_progress",
    parameterTypes: "uuid, uuid, text, numeric, jsonb, integer",
  },
];

function extractStaticQuery(source, { functionName, queryPrefix }) {
  const functionStart = source.indexOf(`export async function ${functionName}(`);
  if (functionStart < 0) throw new Error(`Missing function ${functionName}`);

  const functionEnd = source.indexOf("\nexport ", functionStart + 1);
  const body = source.slice(functionStart, functionEnd < 0 ? undefined : functionEnd);
  const query = [...body.matchAll(/`([^`]+)`/g)]
    .map((match) => match[1])
    .find((value) => value.trimStart().startsWith(queryPrefix));

  if (!query || query.includes("${")) throw new Error(`Missing static SQL for ${functionName}`);
  return query;
}

const client = new pg.Client({ connectionString });
await client.connect();

try {
  await client.query("BEGIN");
  for (const contract of contracts) {
    const source = await readFile(
      new URL(`../src/lib/server/learning/${contract.file}`, import.meta.url),
      "utf8",
    );
    const query = extractStaticQuery(source, contract);
    await client.query(
      `PREPARE ${contract.statementName} (${contract.parameterTypes}) AS ${query}`,
    );
    console.log(`${contract.functionName}: PostgreSQL query and parameter types verified`);
  }
} finally {
  await client.query("ROLLBACK");
  await client.end();
}
