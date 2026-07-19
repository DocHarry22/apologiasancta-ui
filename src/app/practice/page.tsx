import { AppShell } from "@/components/shell/AppShell";
import { PublishedPractice } from "@/components/learn/LearningPlatform";

export const dynamic = "force-dynamic";
export const metadata = { title: "Solo Practice | Apologia Sancta", description: "Practice published apologetics questions and review permitted explanations." };

export default function PracticePage() {
  return <AppShell><PublishedPractice /></AppShell>;
}
