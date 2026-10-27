import { redirect } from "next/navigation";
import { ResearchLayout } from "@/components/research/ResearchLayout";
import { StatusBadge } from "@/components/ui/Primitives";
import KnowledgeSelector from "@/components/research/KnowledgeSelector";
import ResearchDiscovery from "@/components/research/ResearchDiscovery";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Debate | Apologia Sancta Research",
  description: "Practice published objection-response routes from governed canonical arguments.",
};

const CANONICAL_ID = /^[a-z][a-z0-9_-]*:[a-z0-9][a-z0-9._:-]*$/;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function DebateIndexPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const argumentId = first(raw.argumentId).trim();
  if (CANONICAL_ID.test(argumentId)) redirect(`/research/debate/${encodeURIComponent(argumentId)}`);

  return (
    <ResearchLayout current="debate" eyebrow="Research · debate" title="Listen thoughtfully." accent="Respond with charity." description="Explore an argument through its premises, objections, responses, and evidence. Begin with a published argument below.">

        <form method="get" className="surface-card mt-7 max-w-3xl p-6" aria-label="Open published debate argument">
          <KnowledgeSelector label="Choose an argument" name="argumentId" kind="argument" />
          <button type="submit" className="btn-primary mt-4">Open debate</button>
        </form>

        <div className="surface-card mt-5 max-w-3xl p-5"><StatusBadge>Published routes only</StatusBadge><p className="mt-3 text-sm leading-6 text-(--text-muted)">{argumentId ? "Choose an argument from the search results to open its debate route." : "Search arguments by title, or focus the selector to browse published arguments. Follow the premises, objections, responses and evidence."}</p></div>
        <ResearchDiscovery />
    </ResearchLayout>
  );
}
