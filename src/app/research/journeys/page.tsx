import { ResearchLayout } from "@/components/research/ResearchLayout";
import SavedKnowledgeJourneys from "@/components/research/SavedKnowledgeJourneys";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Saved Journeys | Apologia Sancta Research",
  description: "Reopen account-owned Graph paths, catalog bookmarks, Timeline, Compare, and Debate journeys across desktop and Android.",
};

export default function SavedJourneysPage() {
  return (
    <ResearchLayout current="saved" eyebrow="Your research journeys" title="Keep a path." accent="Come back to it." description="Return to the claims, comparisons, and research trails you’ve saved to your account.">
        <section className="mt-7" aria-label="Saved research journeys"><SavedKnowledgeJourneys /></section>
    </ResearchLayout>
  );
}
