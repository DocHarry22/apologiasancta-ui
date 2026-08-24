import { AppShell } from "@/components/shell/AppShell";
import KnowledgeGapRecommendations from "@/components/learn/KnowledgeGapRecommendations";
import { LearningCatalogue } from "@/components/learn/LearningPlatform";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Learning Catalogue | Apologia Sancta",
  description: "Browse published, database-backed Catholic apologetics programmes, subjects, groups, and lessons.",
};

export default function LearnPage() {
  return <AppShell><KnowledgeGapRecommendations /><LearningCatalogue /></AppShell>;
}
