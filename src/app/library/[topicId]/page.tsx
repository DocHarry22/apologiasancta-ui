import { EngineTopicDetails } from "@/components/library/EngineTopicDetails";

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
  return <EngineTopicDetails topicId={topicId} />;
}
