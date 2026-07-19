import { AppShell } from "@/components/shell/AppShell";
import { LearningCatalogue } from "@/components/learn/LearningPlatform";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Learning Catalogue | Apologia Sancta",
  description: "Browse published, database-backed Catholic apologetics programmes, subjects, groups, and lessons.",
};

export default function LearnPage() {
  return <AppShell><LearningCatalogue /></AppShell>;
}
