export const SOURCE_HOSTS = ["www.vatican.va", "vatican.va", "bible.usccb.org", "www.usccb.org", "www.newadvent.org", "newadvent.org", "plato.stanford.edu", "www.opc.org", "opc.org", "www.lcms.org", "lcms.org"] as const;
export type Source = { id: string; url: string; title: string; kind: "catechism" | "scripture" | "magisterium" | "historical" | "external"; retrievedAt: string; sha256: string; text: string };
export type Evidence = { sourceId: string; locator: string; quote: string };
export type Claim = { id: string; text: string; classification: "catholic_teaching" | "historical_claim" | "interpretation" | "reported_objection"; evidence: Evidence[] };
export type Pack = {
  title: string; summary: string;
  claims: Claim[];
  steps: { title: string; claimIds: string[] }[];
  objections: { objection: string; attributedTo: string; evidence: Evidence[]; responseClaimIds: string[] }[];
  quiz: { question: string; options: string[]; correctIndex: number; explanationClaimIds: string[] }[];
  nextTopics: string[];
};
export type PublishedPack = { id: string; topic: string; created_at: string; pack: Pack; sources: Omit<Source, "text">[]; review: { passed: boolean; issues: string[]; model: string; reviewedAt: string } };
export function sourceUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password || url.port || !SOURCE_HOSTS.includes(url.hostname as typeof SOURCE_HOSTS[number])) throw new Error("Source host is not trusted");
  url.hash = "";
  return url;
}
export function sourceKind(raw: string): Source["kind"] {
  const url = sourceUrl(raw);
  if (!url.hostname.endsWith("vatican.va") && !url.hostname.endsWith("usccb.org") && !url.hostname.endsWith("newadvent.org")) return "external";
  if (url.hostname.endsWith("vatican.va") && (url.pathname.includes("catechism") || /\/ccc[_/-]/.test(url.pathname))) return "catechism";
  if (url.hostname === "bible.usccb.org" || url.pathname.includes("/bible/")) return "scripture";
  if (url.hostname.endsWith("newadvent.org")) return "historical";
  if (!url.hostname.endsWith("vatican.va") && !url.hostname.endsWith("usccb.org")) return "external";
  return "magisterium";
}
export function normalize(value: string): string { return value.normalize("NFKC").replace(/\s+/g, " ").trim(); }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an object");
  return value as Record<string, unknown>;
}
function string(value: unknown, max = 1500): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error("Invalid text field");
  return value.trim();
}
function array(value: unknown, min: number, max: number): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new Error("Invalid array length");
  return value;
}
export function validatePack(value: unknown, sources: Source[]): Pack {
  const raw = record(value);
  const allowedIds = new Set<string>(); const citedKinds = new Set<string>(); const quoteWords = new Map<string, Set<string>>();
  function evidenceFor(value: unknown, min: number): Evidence[] {
    return array(value, min, 4).map(item => {
      const citation = record(item); const sourceId = string(citation.sourceId, 80);
      const source = sources.find(s => s.id === sourceId);
      const quote = string(citation.quote, 350); const locator = string(citation.locator, 200);
      if (!source || !normalize(source.text).includes(normalize(quote))) throw new Error("Quotation is not in retrieved source");
      citedKinds.add(source.kind);
      const quotes = quoteWords.get(sourceId) || new Set<string>(); quotes.add(normalize(quote)); quoteWords.set(sourceId, quotes);
      return { sourceId, locator, quote };
    });
  }
  const claims: Claim[] = array(raw.claims, 3, 12).map(item => {
    const claim = record(item); const id = string(claim.id, 80);
    if (!/^[a-z0-9_-]+$/.test(id) || allowedIds.has(id)) throw new Error("Invalid or duplicate claim ID");
    allowedIds.add(id);
    const classification = string(claim.classification);
    if (!["catholic_teaching", "historical_claim", "interpretation", "reported_objection"].includes(classification)) throw new Error("Invalid claim classification");
    const evidence = evidenceFor(claim.evidence, 1);
    if (classification === "catholic_teaching" && !evidence.some(e => ["catechism", "scripture", "magisterium"].includes(sources.find(s => s.id === e.sourceId)!.kind))) throw new Error("Catholic teaching requires a Church primary source");
    return { id, text: string(claim.text), classification: classification as Claim["classification"], evidence };
  });
  if (!citedKinds.has("catechism") || !citedKinds.has("scripture")) throw new Error("Catechism and Scripture evidence required");
  function refs(value: unknown): string[] {
    return array(value, 1, 12).map(id => { const key = string(id, 80); if (!allowedIds.has(key)) throw new Error("Unknown claim reference"); return key; });
  }
  const steps = array(raw.steps, 3, 8).map(item => { const step = record(item); return { title: string(step.title, 160), claimIds: refs(step.claimIds) }; });
  const covered = new Set(steps.flatMap(s => s.claimIds));
  if (claims.some(c => !covered.has(c.id))) throw new Error("Every claim must belong to a lesson step");
  const objections = array(raw.objections, 1, 5).map(item => { const o = record(item); const attributedTo = string(o.attributedTo, 160);
    const evidence = evidenceFor(o.evidence, attributedTo === "Hypothetical objection" ? 0 : 1);
    return { objection: string(o.objection, 500), attributedTo, evidence, responseClaimIds: refs(o.responseClaimIds) }; });
  const quiz = array(raw.quiz, 3, 8).map(item => {
    const q = record(item); const options = array(q.options, 4, 4).map(option => string(option, 300));
    if (new Set(options.map(normalize)).size !== 4 || !Number.isInteger(q.correctIndex) || Number(q.correctIndex) < 0 || Number(q.correctIndex) > 3) throw new Error("Invalid quiz answer/options");
    return { question: string(q.question, 500), options, correctIndex: Number(q.correctIndex), explanationClaimIds: refs(q.explanationClaimIds) };
  });
  for (const quotes of quoteWords.values()) if ([...quotes].join(" ").split(/\s+/).length > 25) throw new Error("Source quotation allowance exceeded");
  return { title: string(raw.title, 160), summary: string(raw.summary, 500), claims, steps, objections, quiz, nextTopics: array(raw.nextTopics, 0, 3).map(t => string(t, 160)) };
}

export function sourceMetadata(source: Source): Omit<Source, "text"> { return { id: source.id, url: source.url, title: source.title, kind: source.kind, retrievedAt: source.retrievedAt, sha256: source.sha256 }; }
