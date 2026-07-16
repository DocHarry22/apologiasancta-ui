import { AppShell } from "@/components/shell/AppShell";
import { EngineTopicsList, type LibraryResource } from "@/components/library/EngineTopicsList";
import { learningPath } from "@/lib/learningContent";
import { listPublishedQuestionRecords, listTopicsWithCounts } from "@/lib/content";

export const metadata = { title: "Catholic Knowledge Library | Apologia Sancta" };

function categoryFor(id: string, tags: string[]): string {
  if (["genesis", "acts", "romans", "1corinthians", "john_gospel", "ot_theology"].includes(id) || tags.includes("scripture")) return "Scripture";
  if (id.includes("history") || tags.includes("fathers") || tags.includes("councils")) return "Church History";
  if (id.includes("sacrament") || id === "eucharist") return "Sacraments";
  if (id === "apologetics" || tags.includes("sola-scriptura")) return "Apologetics";
  return "Doctrine";
}

function eraFor(id: string, tags: string[]): string {
  if (["genesis", "acts", "romans", "1corinthians", "john_gospel", "ot_theology"].includes(id)) return "Biblical";
  if (tags.some((tag) => ["fathers", "councils", "heresies", "creeds"].includes(tag))) return "Early Church";
  if (tags.includes("reformation") || tags.includes("sola-scriptura")) return "Reformation";
  return "General";
}

export default async function LibraryPage() {
  const [topics, questionRecords] = await Promise.all([listTopicsWithCounts(), listPublishedQuestionRecords()]);
  const byTopic = new Map<string, typeof questionRecords>();
  for (const record of questionRecords) byTopic.set(record.question.topicId, [...(byTopic.get(record.question.topicId) ?? []), record]);

  const resources: LibraryResource[] = topics.map((topic) => {
    const records = byTopic.get(topic.id) ?? [];
    const refs = new Set(records.flatMap((record) => record.question.teaching.refs));
    const difficulty = records.length ? Math.round(records.reduce((sum, record) => sum + record.question.difficulty, 0) / records.length) : null;
    return {
      id: topic.id,
      title: topic.title,
      description: topic.description.startsWith("Auto-created") ? `${topic.title} questions from the published Apologia Sancta bank.` : topic.description,
      href: `/library/${topic.id}`,
      format: "Question collection" as const,
      category: categoryFor(topic.id, topic.tags),
      era: eraFor(topic.id, topic.tags),
      tags: topic.tags,
      difficulty,
      questionCount: topic.questionCount,
      sourceCount: refs.size,
      durationMinutes: Math.max(5, Math.ceil(topic.questionCount * 0.75)),
      featured: ["scripture_tradition", "christology", "church_history"].includes(topic.id),
    };
  });

  resources.push(...learningPath.lessons.map((lesson) => ({
    id: `lesson-${lesson.id}`,
    title: lesson.title,
    description: lesson.summary,
    href: `/learn/${lesson.id}`,
    format: "Lesson" as const,
    category: lesson.id.includes("eucharist") ? "Sacraments" : "Apologetics",
    era: "General",
    tags: [lesson.difficulty.toLowerCase()],
    difficulty: lesson.difficulty === "Foundation" ? 1 : 3,
    questionCount: 0,
    sourceCount: lesson.sources.length,
    durationMinutes: lesson.durationMinutes,
  })));

  const allReferences = new Set(questionRecords.flatMap((record) => record.question.teaching.refs));
  for (const lesson of learningPath.lessons) for (const source of lesson.sources) allReferences.add(`${source.reference}:${source.url}`);

  return <AppShell><div className="page-container py-8 sm:py-11"><EngineTopicsList resources={resources} questionTotal={questionRecords.length} sourceTotal={allReferences.size} /></div></AppShell>;
}
