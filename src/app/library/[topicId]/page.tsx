import Link from "next/link";
import { notFound } from "next/navigation";
import { getTopicMeta, listTopicQuestions } from "@/lib/content";
import { QuestionLibraryClient } from "@/components/library/QuestionLibraryClient";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface TopicPageProps {
  params: Promise<{
    topicId: string;
  }>;
}

export async function generateMetadata({ params }: TopicPageProps) {
  const { topicId } = await params;
  return {
    title: `${topicId} | Library`,
  };
}

export default async function TopicLibraryPage({ params }: TopicPageProps) {
  const { topicId } = await params;

  const [meta, questions] = await Promise.all([
    getTopicMeta(topicId).catch(() => null),
    listTopicQuestions(topicId).catch(() => null),
  ]);

  if (!meta || !questions) {
    notFound();
  }

  const availableTags = Array.from(
    new Set(questions.flatMap((question) => question.tags))
  ).sort();

  return (
    <main className="min-h-screen bg-background text-foreground p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="space-y-2">
          <div className="flex items-center justify-between">
            <Link href="/library" className="text-sm text-(--accent) hover:underline">
              ← Back to topics
            </Link>
            <ThemeToggle />
          </div>
          <p className="text-xs uppercase tracking-widest text-(--muted)">{meta.id}</p>
          <h1 className="text-3xl font-semibold">{meta.title}</h1>
          <p className="text-sm text-(--text-secondary)">{meta.description}</p>
        </header>

        <QuestionLibraryClient questions={questions} availableTags={availableTags} />
      </div>
    </main>
  );
}
