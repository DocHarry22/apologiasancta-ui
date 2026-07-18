#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const FORMAT = "apologia-sancta-phase1-content/v1";

const TABLES = [
  ["programmes", "content.programmes", ["id"]],
  ["programme_prerequisites", "content.programme_prerequisites", ["programme_id", "prerequisite_programme_id"]],
  ["subjects", "content.subjects", ["id"]],
  ["subject_prerequisites", "content.subject_prerequisites", ["subject_id", "prerequisite_subject_id"]],
  ["learning_groups", "content.learning_groups", ["id"]],
  ["group_prerequisites", "content.group_prerequisites", ["group_id", "prerequisite_group_id"]],
  ["lessons", "content.lessons", ["id"]],
  ["lesson_prerequisites", "content.lesson_prerequisites", ["lesson_id", "prerequisite_lesson_id"]],
  ["lesson_sections", "content.lesson_sections", ["id"]],
  ["learning_objectives", "content.learning_objectives", ["id"]],
  ["sources", "content.sources", ["id"]],
  ["questions", "content.questions", ["id"]],
  ["question_options", "content.question_options", ["id"]],
  ["question_contexts", "content.question_contexts", ["id"]],
  ["content_sources", "content.content_sources", ["id"]],
  ["content_relationships", "content.content_relationships", ["id"]],
  ["content_versions", "content.content_versions", ["id"]],
];

const JSON_COLUMNS = new Set([
  "apologia_graph_relationship", "search_metadata", "localisation",
  "mastery_policy", "content", "rights_metadata", "prompt",
  "correct_answer_explanation", "denomination_scope", "answer_policy",
  "explanation", "settings", "metadata", "snapshot",
]);

const TEXT_ARRAY_COLUMNS = new Set(["misconception_ids"]);

function usage(exitCode = 0) {
  const message = `Usage:
  node scripts/phase1-content-transfer.mjs inventory [--source content/topics]
  node scripts/phase1-content-transfer.mjs transform [--source content/topics] [--output -]
  node scripts/phase1-content-transfer.mjs validate --input <bundle.json|->
  node scripts/phase1-content-transfer.mjs import-sql --input <bundle.json|-> [--output -] [--actor <uuid>]

The utility never connects to a database. import-sql emits a transactional,
idempotent SQL file for explicit review and execution by an operator.`;
  (exitCode === 0 ? console.log : console.error)(message);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const command = argv[2];
  const options = {};
  for (let index = 3; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}`);
    options[key] = value;
    index += 1;
  }
  return { command, options };
}

function stableUuid(value) {
  const bytes = createHash("sha256").update(`apologia-sancta:${value}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function slugify(value) {
  return String(value)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "untitled";
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function readInput(input) {
  if (!input) throw new Error("--input is required");
  const text = input === "-" ? await readStdin() : await readFile(path.resolve(input), "utf8");
  return JSON.parse(text.replace(/^\uFEFF/, ""));
}

async function writeOutput(output, value) {
  if (!output || output === "-") {
    process.stdout.write(value.endsWith("\n") ? value : `${value}\n`);
    return;
  }
  await writeFile(path.resolve(output), value.endsWith("\n") ? value : `${value}\n`, "utf8");
}

async function loadLegacy(sourceRoot) {
  const root = path.resolve(sourceRoot);
  const index = await readJson(path.join(root, "index.json"));
  const topics = [];
  const questions = [];
  const issues = [];
  const seenIds = new Set();

  for (const [topicIndex, indexTopic] of (index.topics ?? []).entries()) {
    const topicDir = path.join(root, indexTopic.id);
    let meta = indexTopic;
    try {
      meta = await readJson(path.join(topicDir, "meta.json"));
    } catch (error) {
      issues.push({ severity: "warning", topicId: indexTopic.id, message: `meta.json unavailable: ${error.message}` });
    }
    topics.push({ ...indexTopic, ...meta, sourceOrder: topicIndex });

    let files = [];
    try {
      files = (await readdir(path.join(topicDir, "questions")))
        .filter((file) => file.endsWith(".json"))
        .sort();
    } catch (error) {
      issues.push({ severity: "warning", topicId: indexTopic.id, message: `question directory unavailable: ${error.message}` });
      continue;
    }

    for (const file of files) {
      const filePath = path.join(topicDir, "questions", file);
      try {
        const question = await readJson(filePath);
        if (!question.id || seenIds.has(question.id)) {
          issues.push({ severity: "error", file: filePath, message: `missing or duplicate question id: ${question.id ?? "<missing>"}` });
          continue;
        }
        seenIds.add(question.id);
        if (question.topicId !== indexTopic.id) {
          issues.push({ severity: "error", file: filePath, message: `topicId ${question.topicId} does not match ${indexTopic.id}` });
        }
        if (![1, 2, 3, 4, 5].includes(question.difficulty)) {
          issues.push({ severity: "error", file: filePath, message: "difficulty must be 1..5" });
        }
        const choices = Object.entries(question.choices ?? {});
        if (choices.length < 2 || !choices.some(([label]) => label === question.correctId)) {
          issues.push({ severity: "error", file: filePath, message: "question choices/correctId are invalid" });
        }
        if (!Array.isArray(question.teaching?.refs) || question.teaching.refs.length === 0) {
          issues.push({ severity: "warning", file: filePath, message: "question has no source references" });
        }
        questions.push({ ...question, sourceFile: path.relative(process.cwd(), filePath) });
      } catch (error) {
        issues.push({ severity: "error", file: filePath, message: error.message });
      }
    }
  }

  return { root, topics, questions, issues };
}

function inventoryReport(legacy) {
  return {
    sourceRoot: legacy.root,
    topicCount: legacy.topics.length,
    questionCount: legacy.questions.length,
    sourceReferenceCount: legacy.questions.reduce((count, q) => count + (q.teaching?.refs?.length ?? 0), 0),
    issueCount: legacy.issues.length,
    blockingIssueCount: legacy.issues.filter((issue) => issue.severity === "error").length,
    issues: legacy.issues,
  };
}

function emptyBundle() {
  return Object.fromEntries(TABLES.map(([key]) => [key, []]));
}

function transformLegacy(legacy) {
  const bundle = {
    format: FORMAT,
    generated_at: new Date().toISOString(),
    source: { kind: "legacy_topic_json", root: legacy.root },
    import_policy: {
      status: "draft",
      contexts: "none_until_editorial_review",
      rights: "unverified",
    },
    ...emptyBundle(),
  };
  const programmeId = stableUuid("legacy/programme/question-bank");
  bundle.programmes.push({
    id: programmeId,
    slug: "legacy-question-bank-import",
    title: "Legacy Question Bank Import",
    short_description: "Staged legacy questions awaiting editorial, theological and rights review.",
    display_order: 0,
    status: "draft",
    visibility: "hidden",
    level: "unreviewed_import",
    review_status: "unreviewed",
    version: 1,
    search_metadata: { import_source: "content/topics" },
    localisation: { default_locale: "en" },
  });

  const topicMap = new Map();
  for (const topic of legacy.topics) {
    const subjectId = stableUuid(`legacy/subject/${topic.id}`);
    const groupId = stableUuid(`legacy/group/${topic.id}/question-bank`);
    topicMap.set(topic.id, { subjectId, groupId });
    bundle.subjects.push({
      id: subjectId,
      programme_id: programmeId,
      slug: slugify(topic.id),
      title: topic.title || topic.id,
      short_description: topic.description || "",
      display_order: topic.sourceOrder,
      status: "draft",
      visibility: "hidden",
      level: "unreviewed_import",
      review_status: "unreviewed",
      version: 1,
      search_metadata: { legacy_topic_id: topic.id, tags: topic.tags ?? [] },
      localisation: { default_locale: "en" },
    });
    bundle.learning_groups.push({
      id: groupId,
      subject_id: subjectId,
      slug: "legacy-question-bank",
      title: `${topic.title || topic.id} Legacy Bank`,
      short_description: "Staging group; not eligible for practice, mastery or live use until reviewed.",
      display_order: 0,
      status: "draft",
      visibility: "hidden",
      level: "unreviewed_import",
      mastery_threshold_percent: 100,
      mastery_policy: { attempt_ttl_minutes: 120, default_question_limit: 10 },
      is_initially_unlocked: false,
      is_optional_expert_challenge: false,
      review_status: "unreviewed",
      version: 1,
      search_metadata: { legacy_topic_id: topic.id },
      localisation: { default_locale: "en" },
    });
  }

  const sources = new Map();
  for (const legacyQuestion of legacy.questions) {
    const target = topicMap.get(legacyQuestion.topicId);
    if (!target) continue;
    const questionId = stableUuid(`legacy/question/${legacyQuestion.id}`);
    bundle.questions.push({
      id: questionId,
      stable_key: legacyQuestion.id,
      subject_id: target.subjectId,
      group_id: target.groupId,
      difficulty: legacyQuestion.difficulty,
      question_type: "single_choice",
      prompt: { type: "text", text: legacyQuestion.question },
      correct_answer_explanation: {
        type: "teaching_moment",
        title: legacyQuestion.teaching?.title ?? "Explanation",
        text: legacyQuestion.teaching?.body ?? "",
      },
      private_notes: `Imported from ${legacyQuestion.sourceFile}`,
      misconception_ids: [],
      denomination_scope: {},
      rights_metadata: { status: "unverified", requires_human_review: true },
      answer_policy: { scoring: "exact_option_set" },
      status: "draft",
      review_status: "unreviewed",
      retirement_status: "active",
      version: 1,
    });

    for (const [position, [label, text]] of Object.entries(legacyQuestion.choices ?? {}).entries()) {
      bundle.question_options.push({
        id: stableUuid(`legacy/question/${legacyQuestion.id}/option/${label}`),
        question_id: questionId,
        position,
        label,
        content: { type: "text", text },
        enabled: true,
        is_correct: label === legacyQuestion.correctId,
        explanation: {},
      });
    }

    for (const [displayOrder, reference] of (legacyQuestion.teaching?.refs ?? []).entries()) {
      const sourceId = stableUuid(`legacy/source/${reference}`);
      if (!sources.has(sourceId)) {
        const [prefix] = String(reference).split(":", 1);
        const source = {
          id: sourceId,
          slug: `legacy-${slugify(reference).slice(0, 52)}-${sourceId.slice(0, 8)}`,
          title: reference,
          source_kind: slugify(prefix || "legacy_reference"),
          citation: reference,
          rights_metadata: { status: "unverified", quotation_text_imported: false },
          status: "draft",
          visibility: "hidden",
          review_status: "unreviewed",
          version: 1,
        };
        sources.set(sourceId, source);
        bundle.sources.push(source);
      }
      bundle.content_sources.push({
        id: stableUuid(`legacy/content-source/${legacyQuestion.id}/${reference}`),
        entity_kind: "question",
        entity_id: questionId,
        source_id: sourceId,
        relationship_type: "cites",
        citation_locator: reference,
        rights_metadata: { status: "unverified" },
        display_order: displayOrder,
      });
    }
  }

  return bundle;
}

function validateBundle(bundle) {
  const errors = [];
  const warnings = [];
  if (bundle.format !== FORMAT) errors.push(`format must equal ${FORMAT}`);
  for (const [key] of TABLES) {
    if (!Array.isArray(bundle[key])) errors.push(`${key} must be an array`);
  }
  if (errors.length) return { valid: false, errors, warnings };

  for (const [key, , conflictColumns] of TABLES) {
    const seen = new Set();
    for (const [index, row] of bundle[key].entries()) {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        errors.push(`${key}[${index}] must be an object`);
        continue;
      }
      const identity = conflictColumns.map((column) => row[column]).join("|");
      if (identity.includes("undefined")) errors.push(`${key}[${index}] is missing ${conflictColumns.join(", ")}`);
      else if (seen.has(identity)) errors.push(`${key} has duplicate identity ${identity}`);
      seen.add(identity);
    }
  }

  const optionsByQuestion = new Map();
  for (const option of bundle.question_options) {
    const list = optionsByQuestion.get(option.question_id) ?? [];
    list.push(option);
    optionsByQuestion.set(option.question_id, list);
  }
  for (const question of bundle.questions) {
    const options = optionsByQuestion.get(question.id) ?? [];
    const enabled = options.filter((option) => option.enabled !== false);
    const correct = enabled.filter((option) => option.is_correct);
    if (["single_choice", "true_false"].includes(question.question_type) && correct.length !== 1) {
      errors.push(`question ${question.stable_key ?? question.id} requires exactly one enabled correct option`);
    }
  }

  const contextGroups = new Map();
  for (const context of bundle.question_contexts.filter((item) => item.enabled !== false)) {
    const value = contextGroups.get(context.question_id) ?? new Set();
    value.add(context.context);
    contextGroups.set(context.question_id, value);
  }
  for (const [questionId, contexts] of contextGroups) {
    const practice = contexts.has("lesson_practice") || contexts.has("group_practice");
    const mastery = contexts.has("mastery_assessment") || contexts.has("expert_challenge");
    if (practice && mastery) errors.push(`question ${questionId} overlaps public practice and official mastery contexts`);
  }

  for (const source of bundle.sources) {
    if (!source.rights_metadata || source.rights_metadata.status === "unverified") {
      warnings.push(`source ${source.slug ?? source.id} requires rights review`);
    }
  }
  return { valid: errors.length === 0, errors, warnings };
}

function sqlQuote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlValue(column, value) {
  if (value === undefined) return "DEFAULT";
  if (value === null) return "NULL";
  if (JSON_COLUMNS.has(column)) return `${sqlQuote(JSON.stringify(value))}::jsonb`;
  if (TEXT_ARRAY_COLUMNS.has(column)) {
    if (!Array.isArray(value)) throw new Error(`${column} must be an array`);
    return value.length ? `ARRAY[${value.map(sqlQuote).join(", ")}]::text[]` : "'{}'::text[]";
  }
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${column} contains a non-finite number`);
    return String(value);
  }
  if (Array.isArray(value) || typeof value === "object") return `${sqlQuote(JSON.stringify(value))}::jsonb`;
  return sqlQuote(value);
}

function topologicalSections(rows) {
  const remaining = new Map(rows.map((row) => [row.id, row]));
  const emitted = new Set();
  const ordered = [];
  while (remaining.size) {
    let progress = false;
    for (const [id, row] of remaining) {
      if (!row.parent_section_id || emitted.has(row.parent_section_id) || !remaining.has(row.parent_section_id)) {
        ordered.push(row);
        emitted.add(id);
        remaining.delete(id);
        progress = true;
      }
    }
    if (!progress) throw new Error("lesson_sections contains a parent cycle");
  }
  return ordered;
}

function emitImportSql(bundle, actor) {
  const validation = validateBundle(bundle);
  if (!validation.valid) throw new Error(`Bundle validation failed:\n- ${validation.errors.join("\n- ")}`);
  if (actor && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(actor)) {
    throw new Error("--actor must be a UUID");
  }
  const output = [
    "-- Generated by scripts/phase1-content-transfer.mjs. Review before execution.",
    "-- Idempotent by stable primary/composite keys; executes as one transaction.",
    "begin;",
  ];
  if (actor) output.push(`select set_config('app.actor_id', ${sqlQuote(actor)}, true);`);

  for (const [key, table, conflictColumns] of TABLES) {
    let rows = bundle[key] ?? [];
    if (key === "lesson_sections") rows = topologicalSections(rows);
    if (!rows.length) continue;
    const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    const identifiers = columns.map((column) => `"${column.replaceAll('"', '""')}"`);
    output.push(`\ninsert into ${table} (${identifiers.join(", ")}) values`);
    output.push(rows.map((row) => `  (${columns.map((column) => sqlValue(column, row[column])).join(", ")})`).join(",\n"));
    const updateColumns = columns.filter((column) => !conflictColumns.includes(column));
    output.push(`on conflict (${conflictColumns.map((column) => `"${column}"`).join(", ")}) do ${
      updateColumns.length
        ? `update set\n  ${updateColumns.map((column) => `"${column}" = excluded."${column}"`).join(",\n  ")};`
        : "nothing;"
    }`);
  }
  output.push("\ncommit;", "", "select 'phase1_content_import_complete' as result;");
  return `${output.join("\n")}\n`;
}

async function main() {
  const { command, options } = parseArgs(process.argv);
  if (!command || command === "help" || command === "--help") usage(0);
  if (command === "inventory") {
    const legacy = await loadLegacy(options.source ?? "content/topics");
    await writeOutput(options.output ?? "-", JSON.stringify(inventoryReport(legacy), null, 2));
    process.exitCode = legacy.issues.some((issue) => issue.severity === "error") ? 1 : 0;
    return;
  }
  if (command === "transform") {
    const legacy = await loadLegacy(options.source ?? "content/topics");
    const blocking = legacy.issues.filter((issue) => issue.severity === "error");
    if (blocking.length) throw new Error(`Legacy inventory has ${blocking.length} blocking issue(s); run inventory for details`);
    const bundle = transformLegacy(legacy);
    await writeOutput(options.output ?? "-", JSON.stringify(bundle, null, 2));
    return;
  }
  if (command === "validate") {
    const result = validateBundle(await readInput(options.input));
    await writeOutput(options.output ?? "-", JSON.stringify(result, null, 2));
    process.exitCode = result.valid ? 0 : 1;
    return;
  }
  if (command === "import-sql") {
    const sql = emitImportSql(await readInput(options.input), options.actor);
    await writeOutput(options.output ?? "-", sql);
    return;
  }
  usage(1);
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
