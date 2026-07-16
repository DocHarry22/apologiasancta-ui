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

export const editorialSourceKinds = [
  "scripture",
  "catechism",
  "church_document",
  "council",
  "church_father",
  "canon_law",
  "scholarship",
] as const;

export type EditorialSourceKind = (typeof editorialSourceKinds)[number];

/**
 * A source as checked by the editorial workflow. Public/legacy question files
 * continue to use teaching.refs; workflow publication derives those display
 * citations from this structured record.
 */
export interface EditorialSourceReference {
  kind: EditorialSourceKind;
  citation: string;
  locator?: string;
  url?: string;
}

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
  /** Present on drafts handled by the human editorial workflow. */
  sourceReferences?: EditorialSourceReference[];
}
