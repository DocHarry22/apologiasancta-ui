export interface TopicIndexItem {
  id: string;
  title: string;
  description: string;
  questionCount: number;
  tags: string[];
}

export interface TopicIndex {
  topics: TopicIndexItem[];
}

export interface TopicMeta {
  id: string;
  title: string;
  description: string;
  difficultyRange: [number, number];
  tags: string[];
  questionCount: number;
}

export type QuestionChoiceId = "A" | "B" | "C" | "D";

export interface Question {
  id: string;
  topicId: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  question: string;
  choices: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctId: QuestionChoiceId;
  teaching: {
    title: string;
    body: string;
    refs: string[];
  };
  tags: string[];
}
