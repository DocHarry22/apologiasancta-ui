// Canonical research response contract. Run `npm run research:sync` after editing.
// Copies in the Edge Function, UI and Graph are generated for standalone builds.
export type ResearchNode = {
  id: string; kind: string; title: string; proposition?: string; summary?: string;
  publishedRevisionId: string | null; metadata: Record<string, unknown>;
};
export type ResearchEdge = {
  id: string; fromNodeId: string; toNodeId: string; relationshipType: string;
  publishedRevisionId: string | null; metadata: Record<string, unknown>;
};
type ResearchMeta = { bounded: true; instrumentation?: { durationMs: number; nodeCount: number; edgeCount: number; resultCount: number } };
export type TimelineResponse = {
  entries: Array<{ year: number; date?: string; node: ResearchNode; provenanceIds: string[] }>;
  meta: ResearchMeta & { undatedRecordsExcluded: true; chronologyFilteredBeforeLimit: true };
};
export type CompareResponse = {
  left: ResearchNode; right: ResearchNode; directEdges: ResearchEdge[];
  sharedNeighbors: ResearchNode[]; semanticRelationships: ResearchEdge[];
  assessments: Array<{ id: string; nodeId: string; lens: string; position: string; rationaleIds: unknown[]; sourceIds: unknown[] }>;
  connectingPath: string[] | null;
  meta: ResearchMeta & { storedRelationshipsOnly: true; pathExpandedRows: number; pathExpandedRowLimit: number; pathFrontierLimit: number };
};
export type DebateResponse = {
  argument: { id: string; title: string; argumentType: string; conclusionNodeId: string; publishedRevisionId: string };
  steps: Array<{ objection: ResearchNode; candidateResponses: Array<{ edge: ResearchEdge; node: ResearchNode }> }>;
  canonicalNodeIds: string[]; scoringDisclosure: string;
  meta: ResearchMeta & { unpublishedBranchesExcluded: true; authoredObjectionRoles: true };
};

type Row = Record<string, unknown>;
const object = (value: unknown): value is Row => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const canonicalId = (value: unknown): value is string => text(value) && /^[a-z][a-z0-9_-]*:[a-z0-9][a-z0-9._:-]*$/.test(value);
const array = (value: unknown, check: (item: unknown) => boolean): boolean => Array.isArray(value) && value.every(check);
const optionalText = (value: unknown): boolean => value === undefined || typeof value === "string";
const revision = (value: unknown): boolean => value === null || text(value);
const node = (value: unknown): boolean => object(value) && canonicalId(value.id) && text(value.kind) && text(value.title)
  && optionalText(value.proposition) && optionalText(value.summary) && revision(value.publishedRevisionId) && object(value.metadata);
const edge = (value: unknown): boolean => object(value) && canonicalId(value.id) && canonicalId(value.fromNodeId)
  && canonicalId(value.toNodeId) && text(value.relationshipType) && revision(value.publishedRevisionId) && object(value.metadata);
const count = (value: unknown): boolean => typeof value === "number" && Number.isFinite(value) && value >= 0;
const meta = (value: unknown): value is Row => object(value) && value.bounded === true
  && (value.instrumentation === undefined || (object(value.instrumentation)
    && ["durationMs", "nodeCount", "edgeCount", "resultCount"].every(key => count((value.instrumentation as Row)[key]))));

export function isTimelineResponse(value: unknown): value is TimelineResponse {
  return object(value) && meta(value.meta) && value.meta.undatedRecordsExcluded === true && value.meta.chronologyFilteredBeforeLimit === true
    && array(value.entries, entry => object(entry) && typeof entry.year === "number" && Number.isInteger(entry.year)
      && optionalText(entry.date) && node(entry.node) && array(entry.provenanceIds, text));
}
export function isCompareResponse(value: unknown): value is CompareResponse {
  return object(value) && meta(value.meta) && value.meta.storedRelationshipsOnly === true
    && ["pathExpandedRows", "pathExpandedRowLimit", "pathFrontierLimit"].every(key => count((value.meta as Row)[key]))
    && node(value.left) && node(value.right) && array(value.directEdges, edge) && array(value.sharedNeighbors, node)
    && array(value.semanticRelationships, edge) && (value.connectingPath === null || array(value.connectingPath, canonicalId))
    && array(value.assessments, item => object(item) && canonicalId(item.id) && canonicalId(item.nodeId)
      && text(item.lens) && text(item.position) && Array.isArray(item.rationaleIds) && Array.isArray(item.sourceIds));
}
export function isDebateResponse(value: unknown): value is DebateResponse {
  return object(value) && meta(value.meta) && value.meta.unpublishedBranchesExcluded === true && value.meta.authoredObjectionRoles === true
    && object(value.argument) && canonicalId(value.argument.id) && text(value.argument.title) && text(value.argument.argumentType)
    && canonicalId(value.argument.conclusionNodeId) && text(value.argument.publishedRevisionId)
    && array(value.canonicalNodeIds, canonicalId) && text(value.scoringDisclosure)
    && array(value.steps, step => object(step) && node(step.objection)
      && array(step.candidateResponses, response => object(response) && edge(response.edge) && node(response.node)));
}

// Validate successful research reads at each transport boundary. Older aliases
// are rejected: silently defaulting missing arrays would hide an incompatible API.
export function assertResearchResponse(path: string, value: unknown): void {
  const valid = path === "/knowledge/timeline" ? isTimelineResponse(value)
    : path === "/knowledge/compare/advanced" ? isCompareResponse(value)
    : path.startsWith("/knowledge/debate/") ? isDebateResponse(value) : true;
  if (!valid) throw new Error("Knowledge Engine returned an incompatible research response.");
}
