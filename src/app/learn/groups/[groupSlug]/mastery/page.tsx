import { AppShell } from "@/components/shell/AppShell";
import { MasteryExperience } from "@/components/learn/LearningPlatform";

export const dynamic = "force-dynamic";

export default async function MasteryPage({ params }: { params: Promise<{ groupSlug: string }> }) {
  return <AppShell><MasteryExperience groupSlug={(await params).groupSlug} /></AppShell>;
}
