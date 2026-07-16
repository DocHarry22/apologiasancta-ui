import { AppShell } from "@/components/shell/AppShell";
import { EngineTopicDetails, type EngineTopicResponse } from "@/components/library/EngineTopicDetails";
import { getTopicMeta, listTopicQuestions } from "@/lib/content";

interface TopicPageProps { params: Promise<{ topicId: string }> }

export async function generateMetadata({ params }: TopicPageProps) { const { topicId } = await params; try { const topic = await getTopicMeta(topicId); return { title: `${topic.title} | Library`, description: topic.description }; } catch { return { title: `${topicId} | Library` }; } }

export default async function TopicLibraryPage({ params }: TopicPageProps) {
  const { topicId } = await params;
  let fallbackTopic: EngineTopicResponse | null = null;
  try {
    const [meta, questions] = await Promise.all([getTopicMeta(topicId), listTopicQuestions(topicId)]);
    fallbackTopic = { id: meta.id, title: meta.title, questionCount: questions.length, questions: questions.map((question) => ({ id: question.id, text: question.question, themeTitle: meta.title, difficulty: question.difficulty, choices: Object.entries(question.choices).map(([id, text]) => ({ id, label: id, text })) })) };
  } catch { /* Engine-only topics can still load on the client. */ }
  return <AppShell><EngineTopicDetails topicId={topicId} fallbackTopic={fallbackTopic} /></AppShell>;
}
