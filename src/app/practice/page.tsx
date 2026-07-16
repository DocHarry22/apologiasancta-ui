import { AppShell } from "@/components/shell/AppShell";
import { PracticeQuiz } from "@/components/practice/PracticeQuiz";

export const metadata = { title: "Solo Practice | Apologia Sancta", description: "Practice sourced Catholic apologetics questions and review every explanation." };

export default function PracticePage() {
  return <AppShell><div className="page-container py-8 sm:py-11"><header className="mx-auto mb-7 max-w-3xl"><p className="eyebrow">Solo formation</p><h1 className="editorial-heading mt-2 text-4xl font-semibold sm:text-5xl">Practice with explanations.</h1><p className="mt-3 text-base leading-7 text-(--text-muted)">Take your time. Every answer includes the reasoning and references that make the question useful.</p></header><PracticeQuiz /></div></AppShell>;
}
