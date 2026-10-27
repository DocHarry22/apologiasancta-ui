export const GRAPH_JOURNEY_SOURCE = "apologia-graph";
export const GRAPH_BRIDGE_CHANNEL = "apologia-graph-journeys-v1";

export type GraphJourney = {
  rootNodeId: string;
  lens: string;
  metadata?: Record<string, unknown>;
};

export function isGraphJourney(journey: GraphJourney): boolean {
  return journey.metadata?.source === GRAPH_JOURNEY_SOURCE;
}

/** Rebuild navigation against the configured Graph origin, never a stored URL. */
export function graphJourneyHref(base: string | null, journey: GraphJourney): string | null {
  if (!base) return null;
  try {
    const metadata = journey.metadata;
    const graph = isGraphJourney(journey) && metadata?.graph && typeof metadata.graph === "object"
      ? metadata.graph as Record<string, unknown> : null;
    const recordId = isGraphJourney(journey) && typeof metadata?.recordId === "string" ? metadata.recordId : "";
    const url = new URL(recordId ? `/graph/${encodeURIComponent(recordId)}` : "/graph", base);
    if (!["https:", "http:"].includes(url.protocol)) return null;
    url.searchParams.set("focus", typeof graph?.focusId === "string" ? graph.focusId : journey.rootNodeId);
    url.searchParams.set("lens", journey.lens);
    if (graph?.depth && Number.isInteger(graph.depth) && Number(graph.depth) >= 1 && Number(graph.depth) <= 4) url.searchParams.set("depth", String(graph.depth));
    if (graph?.view === "2d" || graph?.view === "3d") url.searchParams.set("view", graph.view);
    if (graph?.canonical === false) url.searchParams.set("compatibility", "1");
    if (Array.isArray(graph?.trail) && graph.trail.length <= 120) url.searchParams.set("trail", JSON.stringify(graph.trail));
    return url.href;
  } catch {
    return null;
  }
}
