import { AppShell } from "@/components/shell/AppShell";
import { LearningHierarchyPage } from "@/components/learn/LearningPlatform";

export const dynamic = "force-dynamic";

export default async function SubjectPage({ params }: { params: Promise<{ subjectSlug: string }> }) {
  return <AppShell><LearningHierarchyPage kind="subject" slug={(await params).subjectSlug} /></AppShell>;
}
