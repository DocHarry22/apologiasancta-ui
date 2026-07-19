import { AppShell } from "@/components/shell/AppShell";
import { LearningSearch } from "@/components/learn/LearningPlatform";

export const metadata = { title: "Search Learning Content | Apologia Sancta" };

export default function LearningSearchPage() {
  return <AppShell><LearningSearch /></AppShell>;
}
