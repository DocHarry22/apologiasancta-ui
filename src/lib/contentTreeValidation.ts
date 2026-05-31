import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

type ChoiceId = "A" | "B" | "C" | "D";

const CHOICE_IDS: ChoiceId[] = ["A", "B", "C", "D"];

interface TopicIndex {
  topics?: Array<{ id?: unknown }>;
}

interface TopicManifest {
  questionIds?: unknown;
}

interface QuestionCandidate {
  id?: unknown;
  topicId?: unknown;
  difficulty?: unknown;
  choices?: unknown;
  correctId?: unknown;
  teaching?: unknown;
  tags?: unknown;
}

export interface ContentValidationResult {
  valid: boolean;
  errors: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function validateQuestionFile(
  question: QuestionCandidate,
  topicId: string,
  fileName: string,
  errors: string[]
) {
  const label = `${topicId}/${fileName}`;
  const questionId = typeof question.id === "string" ? question.id.trim() : "";

  if (!questionId) errors.push(`${label}: question.id is required`);
  if (questionId && fileName !== `${questionId}.json`) {
    errors.push(`${label}: filename must match question id`);
  }
  if (question.topicId !== topicId) {
    errors.push(`${label}: question.topicId must match topic folder`);
  }
  if (
    typeof question.difficulty !== "number" ||
    !Number.isInteger(question.difficulty) ||
    question.difficulty < 1 ||
    question.difficulty > 5
  ) {
    errors.push(`${label}: difficulty must be an integer from 1 to 5`);
  }

  if (!isRecord(question.choices)) {
    errors.push(`${label}: choices must be an object`);
  } else {
    for (const id of CHOICE_IDS) {
      if (typeof question.choices[id] !== "string" || !question.choices[id].trim()) {
        errors.push(`${label}: choices.${id} is required`);
      }
    }
  }

  if (!CHOICE_IDS.includes(question.correctId as ChoiceId)) {
    errors.push(`${label}: correctId must be A, B, C, or D`);
  }

  if (!isRecord(question.teaching)) {
    errors.push(`${label}: teaching must be an object`);
  } else {
    if (typeof question.teaching.title !== "string" || !question.teaching.title.trim()) {
      errors.push(`${label}: teaching.title is required`);
    }
    if (typeof question.teaching.body !== "string" || !question.teaching.body.trim()) {
      errors.push(`${label}: teaching.body is required`);
    }
    if (!Array.isArray(question.teaching.refs)) {
      errors.push(`${label}: teaching.refs must be an array`);
    }
  }

  if (!Array.isArray(question.tags)) {
    errors.push(`${label}: tags must be an array`);
  }
}

export async function validateContentTree(
  topicsRoot = path.join(process.cwd(), "content", "topics")
): Promise<ContentValidationResult> {
  const errors: string[] = [];
  const indexPath = path.join(topicsRoot, "index.json");
  const index = await readJson<TopicIndex>(indexPath);
  const topics = Array.isArray(index.topics) ? index.topics : [];

  for (const topic of topics) {
    const topicId = typeof topic.id === "string" ? topic.id : "";
    if (!topicId) {
      errors.push("content/topics/index.json: topic id is required");
      continue;
    }

    const topicRoot = path.join(topicsRoot, topicId);
    const questionsRoot = path.join(topicRoot, "questions");
    const manifestPath = path.join(topicRoot, "manifest.json");
    const metaPath = path.join(topicRoot, "meta.json");

    if (!(await pathExists(topicRoot))) errors.push(`${topicId}: topic folder is missing`);
    if (!(await pathExists(metaPath))) errors.push(`${topicId}: meta.json is missing`);
    if (!(await pathExists(manifestPath))) errors.push(`${topicId}: manifest.json is missing`);
    if (!(await pathExists(questionsRoot))) {
      errors.push(`${topicId}: questions folder is missing`);
      continue;
    }

    const manifest = (await pathExists(manifestPath))
      ? await readJson<TopicManifest>(manifestPath)
      : { questionIds: [] };
    const questionIds = Array.isArray(manifest.questionIds)
      ? manifest.questionIds.filter((id): id is string => typeof id === "string")
      : [];
    const seen = new Set<string>();

    for (const questionId of questionIds) {
      if (seen.has(questionId)) {
        errors.push(`${topicId}: duplicate question id ${questionId}`);
      }
      seen.add(questionId);

      const fileName = `${questionId}.json`;
      const questionPath = path.join(questionsRoot, fileName);
      if (!(await pathExists(questionPath))) {
        errors.push(`${topicId}/${fileName}: listed question file is missing`);
        continue;
      }

      const question = await readJson<QuestionCandidate>(questionPath);
      validateQuestionFile(question, topicId, fileName, errors);
    }

    const files = await readdir(questionsRoot);
    for (const file of files.filter((entry) => entry.endsWith(".json"))) {
      const fileQuestionId = file.replace(/\.json$/, "");
      if (!seen.has(fileQuestionId)) {
        errors.push(`${topicId}/${file}: question file is not listed in manifest`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
