import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { learningPath, practiceQuestions } from "../src/lib/learningContent.ts";
import { completeLesson, parseLearningProgress, recordPracticeAttempt } from "../src/lib/learningProgress.ts";

test("learning path is ordered, sourced, and connected to practice", () => {
  assert.equal(learningPath.lessons.length >= 4, true);
  assert.deepEqual(learningPath.lessons.map((lesson) => lesson.order), [1, 2, 3, 4]);
  for (const lesson of learningPath.lessons) {
    assert.equal(lesson.objectives.length >= 3, true, `${lesson.id} needs measurable objectives`);
    assert.equal(lesson.sections.length >= 3, true, `${lesson.id} needs structured content`);
    assert.equal(lesson.sources.length >= 2, true, `${lesson.id} needs primary sources`);
    assert.equal(lesson.sources.every((source) => source.url.startsWith("https://")), true);
    assert.equal(practiceQuestions.some((question) => question.lessonId === lesson.id), true);
  }
  for (const question of practiceQuestions) {
    assert.equal(question.choices.length, 4);
    assert.equal(question.references.length > 0, true, `${question.id} needs references`);
    assert.equal(question.explanation.trim().length > 30, true, `${question.id} needs an explanation`);
  }
});

test("device learning progress is resilient and monotonic", () => {
  assert.deepEqual(parseLearningProgress("not-json").completedLessonIds, []);
  const completed = completeLesson(parseLearningProgress(null), "lesson-one");
  const duplicate = completeLesson(completed, "lesson-one");
  assert.deepEqual(duplicate.completedLessonIds, ["lesson-one"]);
  const attempt = recordPracticeAttempt(duplicate, 6);
  const lowerAttempt = recordPracticeAttempt(attempt, 4);
  assert.equal(lowerAttempt.practiceBest, 6);
  assert.equal(lowerAttempt.practiceAttempts, 2);
});

test("every published question explanation has at least one source reference", async () => {
  const topicsRoot = path.join(process.cwd(), "content", "topics");
  const topicDirectories = await readdir(topicsRoot, { withFileTypes: true });
  let questionCount = 0;
  for (const topic of topicDirectories.filter((entry) => entry.isDirectory())) {
    const questionsRoot = path.join(topicsRoot, topic.name, "questions");
    let files: string[];
    try {
      files = (await readdir(questionsRoot)).filter((file) => file.endsWith(".json"));
    } catch {
      continue;
    }
    for (const file of files) {
      const question = JSON.parse(await readFile(path.join(questionsRoot, file), "utf8")) as { teaching?: { refs?: unknown[] } };
      assert.equal(Array.isArray(question.teaching?.refs) && question.teaching!.refs!.length > 0, true, `${topic.name}/${file} needs a source reference`);
      questionCount += 1;
    }
  }
  assert.equal(questionCount > 250, true);
});

test("live answer client sends its room join token", async () => {
  const mobilePage = await readFile(path.join(process.cwd(), "src", "app", "mobile", "page.tsx"), "utf8");
  const registrationHook = await readFile(path.join(process.cwd(), "src", "hooks", "useRoomRegistration.ts"), "utf8");
  assert.match(mobilePage, /Authorization: `Bearer \$\{joinToken\}`/);
  assert.match(registrationHook, /playerJoinToken|saveStoredJoinToken/);
});
