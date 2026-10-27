"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { KnowledgeOption } from "./KnowledgeSelector";
import styles from "./ResearchUI.module.css";

type Topic = { id: string; title: string; summary?: string; rootNodeId?: string; root_node_id?: string };
type Pair = { left: KnowledgeOption; right: KnowledgeOption; relationship: string };

export default function ResearchDiscovery({ anchor = "", lens = "catholic", showJourneys = true }: { anchor?: string; lens?: string; showJourneys?: boolean }) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [status, setStatus] = useState("Loading research starting points…");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setPairs([]); setStatus("Loading research starting points…");
    async function read(path: string) {
      const response = await fetch(`/api/knowledge/${path}`, { signal: controller.signal });
      if (!response.ok) throw new Error();
      return response.json();
    }
    async function load() {
      try {
        const topicResult = await read("topics?limit=3").then((data) => ({ data, failed: false }), () => ({ data: { topics: [] }, failed: true }));
        if (controller.signal.aborted) return;
        const next: Topic[] = (topicResult.data.topics || []).filter((topic: Topic) => topic.rootNodeId || topic.root_node_id);
        setTopics(next);
        const roots = anchor ? [anchor] : next.map((topic) => topic.rootNodeId || topic.root_node_id || "");
        const results = await Promise.allSettled(roots.map(async (root) => {
          const neighborhood = await read(`neighborhood?${new URLSearchParams({ nodeId: root, depth: "1", limit: "20", lens })}`);
          const nodes: KnowledgeOption[] = neighborhood.nodes || [];
          return (neighborhood.edges || []).flatMap((edge: { fromNodeId?: string; toNodeId?: string; from_node_id?: string; to_node_id?: string; relationshipType?: string; relationship_type?: string }) => {
            const from = edge.fromNodeId || edge.from_node_id, to = edge.toNodeId || edge.to_node_id;
            const left = nodes.find((node) => node.id === from), right = nodes.find((node) => node.id === to);
            return left && right && left.id !== right.id && (left.id === root || right.id === root)
              ? [{ left, right, relationship: edge.relationshipType || edge.relationship_type || "related" }] : [];
          }).slice(0, 3) as Pair[];
        }));
        if (controller.signal.aborted) return;
        const seen = new Set<string>();
        setPairs(results.flatMap((result) => result.status === "fulfilled" ? result.value : []).filter((pair) => {
          const key = [pair.left.id, pair.right.id].sort().join("|");
          if (seen.has(key)) return false; seen.add(key); return true;
        }).slice(0, 3));
        setStatus(topicResult.failed || results.some((result) => result.status === "rejected") ? "Some suggestions are unavailable. You can still search above or retry." : "");
      } catch { if (!controller.signal.aborted) setStatus("Research starting points are temporarily unavailable. You can still search above."); }
    }
    void load();
    return () => controller.abort();
  }, [anchor, lens, retry]);

  return <div className={styles.discovery}>
    <section aria-labelledby="suggested-comparisons-heading">
      <h2 id="suggested-comparisons-heading">Suggested comparisons</h2>
      <p>Start with two claims connected by a published relationship.</p>
      <div className={styles.suggestions}>{pairs.map((pair) => <Link key={`${pair.left.id}:${pair.right.id}`} className={styles.comparison} href={`/research/compare?${new URLSearchParams({ left: pair.left.id, right: pair.right.id, lens })}`}>
        <strong>{pair.left.title}</strong><span>→ {pair.relationship.replaceAll("_", " ")} →</span><strong>{pair.right.title}</strong><span>Compare these claims →</span>
      </Link>)}</div>
      {!pairs.length && !status && <p className="mt-3 text-sm text-(--text-muted)">No published comparison suggestions yet. Search for two claims above.</p>}
    </section>
    {showJourneys && <section aria-labelledby="starting-journeys-heading">
      <h2 id="starting-journeys-heading">Curated starting journeys</h2>
      <p className="mt-2 text-sm text-(--text-muted)">Follow a reviewed topic from its central claim into relationships and sources.</p>
      <div className={styles.suggestions}>{topics.map((topic) => <article key={topic.id} className="surface-card p-5">
        <h3 className="editorial-heading text-xl font-semibold">{topic.title}</h3><p className="mt-2 text-sm leading-6 text-(--text-muted)">{topic.summary || "Explore this published topic and its evidence."}</p>
        <ol className="my-4 list-inside list-decimal space-y-1 text-sm text-(--text-muted)"><li>Read the central claim</li><li>Compare connected claims</li><li>Trace the sources</li></ol>
        <div className="flex flex-wrap gap-3"><Link className="btn-quiet px-3 py-2" href={`/research/compare?left=${encodeURIComponent(topic.rootNodeId || topic.root_node_id || "")}`}>Start comparing →</Link><Link className="btn-quiet px-3 py-2" href={`/research/timeline?topicId=${encodeURIComponent(topic.id)}`}>Trace timeline →</Link></div>
      </article>)}</div>
      {!topics.length && !status && <p className="mt-3 text-sm text-(--text-muted)">Reviewed topic journeys will appear here when published.</p>}
    </section>}
    {status && <div role="status" className="text-sm text-(--text-muted)">{status}{status.includes("unavailable") && <button type="button" className="btn-quiet ml-3" onClick={() => setRetry((value) => value + 1)}>Retry suggestions</button>}</div>}
  </div>;
}
