export interface TopicForValidation {
  id: string;
  title: string;
  questionCount: number;
  existingIds: string[];
  tags: string[];
  difficultyRange?: [number, number];
}

export function validateTopic(topic: TopicForValidation): string[] {
  const issues: string[] = [];

  if (!/^[a-z0-9_-]+$/i.test(topic.id)) {
    issues.push("Topic ID must contain only letters, numbers, underscores, or hyphens.");
  }

  if (!topic.title.trim()) {
    issues.push("Topic title is required.");
  }

  if (topic.questionCount !== topic.existingIds.length) {
    issues.push("Question count does not match the number of question IDs.");
  }

  if (topic.questionCount === 0) {
    issues.push("Topic has no published questions.");
  }

  if (!Array.isArray(topic.tags)) {
    issues.push("Topic tags must be an array.");
  }

  if (topic.difficultyRange) {
    const [min, max] = topic.difficultyRange;
    if (min < 1 || max > 5 || min > max) {
      issues.push("Difficulty range must stay within 1-5.");
    }
  }

  return issues;
}
