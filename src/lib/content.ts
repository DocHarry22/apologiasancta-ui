import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Question, TopicIndex, TopicMeta } from "@/types/content";

const CONTENT_ROOT = path.join(process.cwd(), "content", "topics");

function ensureSafeId(value: string, label: "topicId" | "questionId"): string {
  if (!/^[a-z0-9_-]+$/i.test(value)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return value;
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

export async function getTopicsIndex(): Promise<TopicIndex> {
  const indexPath = path.join(CONTENT_ROOT, "index.json");
  return readJsonFile<TopicIndex>(indexPath);
}

export async function getTopicMeta(topicId: string): Promise<TopicMeta> {
  const safeTopicId = ensureSafeId(topicId, "topicId");
  const metaPath = path.join(CONTENT_ROOT, safeTopicId, "meta.json");
  return readJsonFile<TopicMeta>(metaPath);
}

export async function listTopicQuestions(topicId: string): Promise<Question[]> {
  const safeTopicId = ensureSafeId(topicId, "topicId");
  const questionsDir = path.join(CONTENT_ROOT, safeTopicId, "questions");

  const fileNames = await readdir(questionsDir);
  const jsonFiles = fileNames.filter((name) => name.endsWith(".json")).sort();

  const questions = await Promise.all(
    jsonFiles.map(async (fileName) => {
      const filePath = path.join(questionsDir, fileName);
      return readJsonFile<Question>(filePath);
    })
  );

  return questions;
}

export async function getTopicQuestion(
  topicId: string,
  questionId: string
): Promise<Question | null> {
  const safeTopicId = ensureSafeId(topicId, "topicId");
  const safeQuestionId = ensureSafeId(questionId, "questionId");
  const questionPath = path.join(
    CONTENT_ROOT,
    safeTopicId,
    "questions",
    `${safeQuestionId}.json`
  );

  try {
    return await readJsonFile<Question>(questionPath);
  } catch {
    return null;
  }
}

export interface TopicWithCount {
  id: string;
  title: string;
  description: string;
  tags: string[];
  questionCount: number;
  existingIds: string[];
}

export async function listTopicsWithCounts(): Promise<TopicWithCount[]> {
  const index = await getTopicsIndex();

  const topicsWithCounts = await Promise.all(
    index.topics.map(async (topic) => {
      const questionsDir = path.join(CONTENT_ROOT, topic.id, "questions");
      let existingIds: string[] = [];
      let questionCount = 0;

      try {
        const fileNames = await readdir(questionsDir);
        const jsonFiles = fileNames.filter((name) => name.endsWith(".json"));
        questionCount = jsonFiles.length;
        existingIds = jsonFiles.map((f) => f.replace(".json", ""));
      } catch {
        // Directory might not exist yet
      }

      return {
        id: topic.id,
        title: topic.title,
        description: topic.description,
        tags: topic.tags,
        questionCount,
        existingIds,
      };
    })
  );

  return topicsWithCounts;
}
