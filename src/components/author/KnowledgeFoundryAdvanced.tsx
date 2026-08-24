"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/ui/Primitives";
import {
  advancedKnowledgeAdmin,
  type AuthoringProposal,
  type CoverageDashboard,
} from "@/lib/advancedKnowledgeAdminClient";

const PROPOSAL_TYPES = [
  ["duplicate_candidate", "Duplicate candidate"],
  ["candidate_claim", "Candidate claim"],
  ["candidate_relationship", "Candidate relationship"],
  ["candidate_citation", "Candidate citation"],
  ["argument_decomposition", "Argument decomposition"],
  ["learning_link", "Learning linkage"],
  ["missing_evidence", "Missing evidence"],
] as const;

function countRows(rows: Array<{ count: number }> | undefined): number {
  return (rows || []).reduce((total, row) => total + Number(row.count || 0), 0);
}

function splitMutationIds(value: string): string[] {
  return [...new Set(value.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean))].slice(0, 100);
}

function CoverageCard({ label, value, tone = "neutral", detail }: { label: string; value: number; tone?: "neutral" | "success" | "warning" | "danger" | "info"; detail: string }) {
  return (
    <article className="rounded-xl border border-(--border) bg-(--surface-elevated) p-4">
      <div className="flex items-start justify-between gap-3"><h3 className="text-sm font-semibold">{label}</h3><StatusBadge tone={tone}>{value}</StatusBadge></div>
      <p className="mt-2 text-xs leading-5 text-(--text-muted)">{detail}</p>
    </article>
  );
}

export default function KnowledgeFoundryAdvanced({ canPropose, canReview }: { canPropose: boolean; canReview: boolean }) {
  const [coverage, setCoverage] = useState<CoverageDashboard | null>(null);
  const [proposals, setProposals] = useState<AuthoringProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [statusFilter, setStatusFilter] = useState("proposed");
  const [typeFilter, setTypeFilter] = useState("");
  const [proposalType, setProposalType] = useState("candidate_claim");
  const [proposalText, setProposalText] = useState("");
  const [targetId, setTargetId] = useState("");
  const [expiresDays, setExpiresDays] = useState("30");
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [mutationsById, setMutationsById] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [coverageResult, proposalResult] = await Promise.all([
      advancedKnowledgeAdmin.coverage(),
      advancedKnowledgeAdmin.proposals(statusFilter, typeFilter),
    ]);
    if (!coverageResult.ok) setError(coverageResult.error);
    else setCoverage(coverageResult.data);
    if (!proposalResult.ok) setError((current) => current || proposalResult.error);
    else setProposals(proposalResult.data.proposals || []);
    setLoading(false);
  }, [statusFilter, typeFilter]);

  useEffect(() => { void load(); }, [load]);

  const proposalOnly = useMemo(() => proposals.every((proposal) => proposal.status !== "accepted" || Array.isArray(proposal.acceptedMutationIds)), [proposals]);

  async function createProposal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canPropose || !proposalText.trim()) return;
    setBusy("create");
    setError("");
    const result = await advancedKnowledgeAdmin.createProposal({
      proposalType,
      input: {
        text: proposalText.trim().slice(0, 10_000),
        ...(targetId.trim() ? { targetId: targetId.trim().slice(0, 240) } : {}),
      },
      expiresDays: Math.max(1, Math.min(365, Number.parseInt(expiresDays, 10) || 30)),
    });
    if (!result.ok) setError(result.error);
    else {
      setNotice(`Created ${result.data.proposal.provider} proposal ${result.data.proposal.id}.`);
      setProposalText("");
      setTargetId("");
      setStatusFilter("proposed");
      await load();
    }
    setBusy("");
  }

  async function decide(proposal: AuthoringProposal, status: "accepted" | "rejected" | "expired") {
    if (!canReview) return;
    const mutationIds = splitMutationIds(mutationsById[proposal.id] || "");
    if (status === "accepted" && mutationIds.length === 0) {
      setError("Acceptance requires at least one current unpublished governed revision ID created after this proposal. Create the governed draft mutation first; acceptance does not create or publish it for you.");
      return;
    }
    setBusy(proposal.id);
    setError("");
    const result = await advancedKnowledgeAdmin.decideProposal(proposal.id, {
      status,
      notes: (notesById[proposal.id] || "").trim().slice(0, 10_000),
      ...(status === "accepted" ? { acceptedMutationIds: mutationIds } : {}),
    });
    if (!result.ok) setError(result.error);
    else {
      setNotice(status === "accepted"
        ? "Proposal accepted as review evidence. The referenced draft revisions still require ordinary review and publication."
        : `Proposal marked ${status}.`);
      await load();
    }
    setBusy("");
  }

  const unresolvedAssertions = countRows(coverage?.unresolvedAssertions);
  const reviewBacklog = countRows(coverage?.reviewBacklog);
  const citationBacklog = countRows(coverage?.citationBacklog);

  return (
    <div className="space-y-7">
      <section className="surface-card p-5 sm:p-6" aria-labelledby="knowledge-foundry-heading">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="eyebrow">Knowledge Foundry</p>
            <h1 id="knowledge-foundry-heading" className="editorial-heading mt-2 text-3xl font-semibold sm:text-4xl">Coverage and governed authoring assistance</h1>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-(--text-muted)">Coverage metrics identify structural editorial gaps. Assistance produces untrusted proposals only. Nothing on this screen auto-merges canonical nodes, approves doctrine, or publishes content.</p>
          </div>
          <div className="flex flex-wrap gap-2"><StatusBadge tone="success">Proposal-only</StatusBadge><StatusBadge tone={proposalOnly ? "success" : "warning"}>Auto-publish off</StatusBadge><StatusBadge tone="success">Human review required</StatusBadge></div>
        </div>
        {error ? <div role="alert" className="mt-4 rounded-lg border border-(--danger) p-3 text-sm text-(--danger)">{error}</div> : null}
        {notice ? <div role="status" className="mt-4 rounded-lg border border-(--success) p-3 text-sm text-(--success)">{notice}</div> : null}
      </section>

      <section className="surface-card p-5 sm:p-6" aria-labelledby="coverage-heading">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">Editorial QA</p><h2 id="coverage-heading" className="editorial-heading mt-1 text-2xl font-semibold">Knowledge coverage</h2></div><button type="button" className="btn-quiet px-3 py-2" disabled={loading} onClick={() => void load()}>{loading ? "Refreshing…" : "Refresh"}</button></div>
        {loading && !coverage ? <p className="mt-5 text-sm text-(--text-muted)">Loading bounded Knowledge Engine coverage…</p> : coverage ? (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <CoverageCard label="Unsupported published claims" value={coverage.unsupportedPublishedClaimLikeNodes} tone={coverage.unsupportedPublishedClaimLikeNodes ? "warning" : "success"} detail="Published claim-like nodes without an approved citation on the published revision." />
              <CoverageCard label="Published edges without provenance" value={coverage.criticalPublishedEdgesWithoutProvenance} tone={coverage.criticalPublishedEdgesWithoutProvenance ? "danger" : "success"} detail="This should remain zero. Any non-zero result is a critical integrity finding." />
              <CoverageCard label="Unanswered published objections" value={coverage.unansweredPublishedObjections} tone={coverage.unansweredPublishedObjections ? "warning" : "success"} detail="Published objection nodes with no published responds_to route." />
              <CoverageCard label="Arguments missing structure" value={coverage.publishedArgumentsMissingStructuralCoverage} tone={coverage.publishedArgumentsMissingStructuralCoverage ? "warning" : "success"} detail="Published arguments missing premises, a published conclusion, or responses to authored objections." />
              <CoverageCard label="Unresolved assertions" value={unresolvedAssertions} tone={unresolvedAssertions ? "warning" : "success"} detail="Edge assertions that have not reached approved review state." />
              <CoverageCard label="Review backlog" value={reviewBacklog} tone={reviewBacklog ? "info" : "success"} detail="Outstanding review records grouped by review dimension and state." />
              <CoverageCard label="Citation backlog" value={citationBacklog} tone={citationBacklog ? "info" : "success"} detail="Citations whose verification/review state is not approved." />
              <CoverageCard label="Critical coverage state" value={coverage.critical ? 1 : 0} tone={coverage.critical ? "danger" : "success"} detail={coverage.disclosure || "Coverage is structural editorial QA, not a truth score."} />
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-(--border) p-4"><h3 className="font-semibold">Nodes by kind</h3><div className="mt-3 flex flex-wrap gap-2">{coverage.nodesByKind.map((row) => <StatusBadge key={row.kind}>{row.kind}: {row.count}</StatusBadge>)}</div></div>
              <div className="rounded-xl border border-(--border) p-4"><h3 className="font-semibold">Nodes by content state</h3><div className="mt-3 flex flex-wrap gap-2">{coverage.nodesByState.map((row) => <StatusBadge key={row.content_state}>{row.content_state}: {row.count}</StatusBadge>)}</div></div>
            </div>
          </>
        ) : null}
      </section>

      <section className="surface-card p-5 sm:p-6" aria-labelledby="proposal-heading">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="eyebrow">Governed assistance</p><h2 id="proposal-heading" className="editorial-heading mt-1 text-2xl font-semibold">Authoring proposals</h2></div><div className="flex flex-wrap gap-2"><label className="text-xs font-semibold">Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="ml-2 rounded border border-(--border) bg-(--surface-elevated) px-2 py-1"><option value="">All</option><option value="proposed">Proposed</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option><option value="expired">Expired</option></select></label><label className="text-xs font-semibold">Type<select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="ml-2 rounded border border-(--border) bg-(--surface-elevated) px-2 py-1"><option value="">All</option>{PROPOSAL_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div></div>

        {canPropose ? (
          <form className="mt-5 grid gap-4 rounded-xl border border-(--border) bg-(--surface-elevated) p-4 lg:grid-cols-2" onSubmit={createProposal}>
            <label className="text-sm font-semibold">Proposal type<select value={proposalType} onChange={(event) => setProposalType(event.target.value)} className="mt-2 w-full rounded-lg border border-(--border) bg-(--surface) px-3 py-2">{PROPOSAL_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="text-sm font-semibold">Target canonical ID (optional)<input value={targetId} onChange={(event) => setTargetId(event.target.value)} placeholder="node:..." className="mt-2 w-full rounded-lg border border-(--border) bg-(--surface) px-3 py-2 font-mono text-sm" /></label>
            <label className="text-sm font-semibold lg:col-span-2">Input for proposal<textarea required value={proposalText} onChange={(event) => setProposalText(event.target.value)} rows={5} maxLength={10000} placeholder="Paste or draft the material to analyse. Provider output remains untrusted until reviewed." className="mt-2 w-full rounded-lg border border-(--border) bg-(--surface) px-3 py-2 text-sm leading-6" /></label>
            <label className="text-sm font-semibold">Expires after days<input value={expiresDays} onChange={(event) => setExpiresDays(event.target.value)} inputMode="numeric" className="mt-2 w-full rounded-lg border border-(--border) bg-(--surface) px-3 py-2" /></label>
            <div className="flex items-end"><button type="submit" disabled={busy === "create" || !proposalText.trim()} className="btn-primary">{busy === "create" ? "Creating…" : "Create proposal"}</button></div>
          </form>
        ) : <p className="mt-4 text-sm text-(--text-muted)">Your role may inspect proposal/coverage state but cannot create authoring proposals.</p>}

        <div className="mt-5 space-y-4">
          {!loading && proposals.length === 0 ? <div className="rounded-xl border border-(--border) p-5 text-sm text-(--text-muted)">No proposals match the current filters.</div> : proposals.map((proposal) => (
            <article key={proposal.id} className="rounded-xl border border-(--border) p-5">
              <div className="flex flex-wrap items-center gap-2"><StatusBadge tone={proposal.status === "proposed" ? "warning" : proposal.status === "accepted" ? "success" : "neutral"}>{proposal.status}</StatusBadge><StatusBadge tone="info">{proposal.proposalType}</StatusBadge><StatusBadge>{proposal.provider}{proposal.model ? ` / ${proposal.model}` : ""}</StatusBadge><code className="ml-auto break-all text-[0.68rem] text-(--text-muted)">{proposal.id}</code></div>
              <div className="mt-3 grid gap-3 lg:grid-cols-[0.7fr_1.3fr]"><div className="text-xs leading-5 text-(--text-muted)"><p><strong>Proposed:</strong> {new Date(proposal.createdAt).toLocaleString()}</p><p><strong>Input hash:</strong> <code>{proposal.inputHash.slice(0, 16)}…</code></p>{proposal.reviewedBy ? <p><strong>Reviewed by:</strong> {proposal.reviewedBy}</p> : null}{proposal.reviewNotes ? <p><strong>Review note:</strong> {proposal.reviewNotes}</p> : null}</div><pre className="max-h-64 overflow-auto rounded-lg bg-(--surface-elevated) p-3 text-xs leading-5">{JSON.stringify(proposal.proposal, null, 2)}</pre></div>

              {proposal.status === "proposed" && canReview ? (
                <div className="mt-4 grid gap-3 border-t border-(--border) pt-4 lg:grid-cols-2">
                  <label className="text-xs font-semibold">Reviewer notes<textarea rows={2} value={notesById[proposal.id] || ""} onChange={(event) => setNotesById((current) => ({ ...current, [proposal.id]: event.target.value }))} className="mt-1 w-full rounded-lg border border-(--border) bg-(--surface-elevated) px-3 py-2 text-sm" /></label>
                  <label className="text-xs font-semibold">Governed draft revision IDs for acceptance<textarea rows={2} value={mutationsById[proposal.id] || ""} onChange={(event) => setMutationsById((current) => ({ ...current, [proposal.id]: event.target.value }))} placeholder="rev:... rev:..." className="mt-1 w-full rounded-lg border border-(--border) bg-(--surface-elevated) px-3 py-2 font-mono text-sm" /><span className="mt-1 block font-normal text-(--text-muted)">Acceptance is blocked unless these are current unpublished governed revisions created after the proposal.</span></label>
                  <div className="flex flex-wrap gap-2 lg:col-span-2"><button type="button" disabled={busy === proposal.id} onClick={() => void decide(proposal, "rejected")} className="btn-quiet px-3 py-2">Reject</button><button type="button" disabled={busy === proposal.id} onClick={() => void decide(proposal, "expired")} className="btn-quiet px-3 py-2">Expire</button><button type="button" disabled={busy === proposal.id || splitMutationIds(mutationsById[proposal.id] || "").length === 0} onClick={() => void decide(proposal, "accepted")} className="btn-primary">Accept evidence linkage</button></div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
