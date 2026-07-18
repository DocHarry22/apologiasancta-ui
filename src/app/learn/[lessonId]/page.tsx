import { AppShell } from "@/components/shell/AppShell";
import { DatabaseLesson } from "@/components/learn/LearningPlatform";

type LessonPageProps = { params: Promise<{ lessonId: string }> };

export const dynamic = "force-dynamic";

export default async function LessonPage({ params }: LessonPageProps) {
  const { lessonId } = await params;
  return <AppShell><DatabaseLesson slug={lessonId} /></AppShell>;
}
