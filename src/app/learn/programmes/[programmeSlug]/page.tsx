import { AppShell } from "@/components/shell/AppShell";
import { LearningHierarchyPage } from "@/components/learn/LearningPlatform";

export const dynamic = "force-dynamic";

export default async function ProgrammePage({ params }: { params: Promise<{ programmeSlug: string }> }) {
  return <AppShell><LearningHierarchyPage kind="programme" slug={(await params).programmeSlug} /></AppShell>;
}
