import { AppShell } from "@/components/shell/AppShell";
import { ResearchModeNav } from "@/components/research/ResearchModeNav";
import SavedKnowledgeJourneys from "@/components/research/SavedKnowledgeJourneys";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Saved Journeys | Apologia Sancta Research",
  description: "Reopen durable canonical research journeys saved from Timeline, Compare, and Debate.",
};

export default function SavedJourneysPage() {
  return (
    <AppShell>
      <div className="page-container py-8 sm:py-11">
        <div className="flex flex-col gap-5 border-b border-(--border) pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow">Research · saved paths</p>
            <h1 className="editorial-heading mt-2 text-4xl font-semibold sm:text-5xl">Saved canonical journeys</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-(--text-muted)">Keep reusable research trails attached to your learner account. Saved journeys store canonical IDs and navigation context; the underlying theological content remains governed by the Knowledge Engine.</p>
          </div>
          <ResearchModeNav current="saved" />
        </div>
        <section className="mt-7" aria-label="Saved research journeys"><SavedKnowledgeJourneys /></section>
      </div>
    </AppShell>
  );
}
