import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { ResearchModeNav } from "@/components/research/ResearchModeNav";
import { StatusBadge } from "@/components/ui/Primitives";

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
    <AppShell>
      <div className="page-container py-8 sm:py-11">
        <div className="flex flex-col gap-5 border-b border-(--border) pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow">Research · argument battle</p>
            <h1 className="editorial-heading mt-2 text-4xl font-semibold sm:text-5xl">Debate mode</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-(--text-muted)">Open a published structured argument and walk its authored objections and published candidate responses. The route can measure completeness and evidence use; it does not assign a score to theological truth.</p>
          </div>
          <ResearchModeNav current="debate" />
        </div>

        <form method="get" className="surface-card mt-7 max-w-3xl p-6" aria-label="Open published debate argument">
          <label className="text-sm font-semibold">Published argument ID
            <input name="argumentId" defaultValue={argumentId} placeholder="argument:..." className="mt-2 w-full rounded-lg border border-(--border) bg-(--surface-elevated) px-3 py-2 font-mono text-sm" />
          </label>
          <button type="submit" className="btn-primary mt-4">Open debate</button>
        </form>

        {argumentId ? <div className="surface-card mt-5 max-w-3xl p-5"><StatusBadge tone="warning">Canonical argument ID required</StatusBadge><p className="mt-3 text-sm leading-6 text-(--text-muted)">Use a canonical published argument ID such as <code>argument:...</code>. Unpublished arguments are not exposed by the public debate API.</p></div> : <div className="surface-card mt-5 max-w-3xl p-5"><StatusBadge>Published routes only</StatusBadge><p className="mt-3 text-sm leading-6 text-(--text-muted)">Argument IDs can be opened from canonical Research/Knowledge Foundry surfaces as the reviewed argument catalogue is populated.</p></div>}
      </div>
    </AppShell>
  );
}
