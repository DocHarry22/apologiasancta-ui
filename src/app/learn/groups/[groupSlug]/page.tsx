import { AppShell } from "@/components/shell/AppShell";
import { LearningHierarchyPage } from "@/components/learn/LearningPlatform";

export const dynamic = "force-dynamic";

export default async function GroupPage({ params }: { params: Promise<{ groupSlug: string }> }) {
  return <AppShell><LearningHierarchyPage kind="group" slug={(await params).groupSlug} /></AppShell>;
}
