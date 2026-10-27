export const DEFAULT_RESEARCH_GRAPH_URL = "https://mediumvioletred-kingfisher-797460.hostingersite.com";
export const GRAPH_EMBED_CHANNEL = "apologia-graph-embed-v1";
const lenses = new Set(["catholic", "historical", "islamic", "protestant", "compare"]);
const text = (value: string | null, limit = 200) => value && value.length <= limit && !/[\u0000-\u001f\u007f]/.test(value) ? value : "";

export function graphOrigin(base: string | null): string | null {
  try {
    const url = new URL(base || "");
    if (url.username || url.password || !(url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "10.0.2.2", "[::1]"].includes(url.hostname)))) return null;
    return url.origin;
  } catch { return null; }
}

/** Copy navigation state only; embedded URLs never accept an arbitrary destination. */
export function graphNavigationParams(input: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams();
  const record = input.get("record");
  if (record && /^[a-zA-Z0-9_-]{1,160}$/.test(record)) params.set("record", record);
  const focus = text(input.get("focus"));
  if (focus) params.set("focus", focus);
  params.set("view", input.get("view") === "2d" ? "2d" : "3d");
  if (lenses.has(input.get("lens") || "")) params.set("lens", input.get("lens")!);
  if (/^[1-4]$/.test(input.get("depth") || "")) params.set("depth", input.get("depth")!);
  if (input.get("compatibility") === "1") params.set("compatibility", "1");
  try {
    const raw = input.get("trail") || "[]";
    const trail = raw.length <= 20000 ? JSON.parse(raw) : null;
    if (Array.isArray(trail) && trail.length && trail.length <= 120 && trail.every((entry) => entry && typeof entry.id === "string" && text(entry.id) && (entry.title === undefined || (typeof entry.title === "string" && text(entry.title, 160))))) {
      params.set("trail", JSON.stringify(trail.map(({ id, title }) => ({ id, title: title || id }))));
    }
  } catch { /* Invalid saved navigation never changes the destination. */ }
  return params;
}

export function graphAppHref(href: string, base: string | null): string | null {
  const origin = graphOrigin(base);
  if (!origin) return null;
  try {
    const url = new URL(href, origin);
    if (url.origin !== origin || url.username || url.password || !/^\/(?:graph(?:\/[^/]+)?\/?)?$/.test(url.pathname)) return null;
    const params = new URLSearchParams(url.search);
    const record = url.pathname.match(/^\/graph\/([^/]+)\/?$/)?.[1];
    if (record) params.set("record", decodeURIComponent(record));
    return `/research/graph?${graphNavigationParams(params)}`;
  } catch { return null; }
}

export function graphWebsiteHref(base: string | null, navigation: string): string | null {
  const origin = graphOrigin(base);
  if (!origin) return null;
  const params = graphNavigationParams(new URLSearchParams(navigation));
  const record = params.get("record");
  params.delete("record");
  const url = new URL(record ? `/graph/${encodeURIComponent(record)}` : "/graph", origin);
  url.search = params.toString();
  return url.href;
}

export function graphFrameHref(base: string | null, navigation: string, appOrigin: string): string | null {
  const href = graphWebsiteHref(base, navigation);
  if (!href || !graphOrigin(appOrigin)) return null;
  const url = new URL(href);
  url.searchParams.set("embed", "android");
  url.searchParams.set("appOrigin", new URL(appOrigin).origin);
  return url.href;
}

export function graphAppDestination(path: unknown): string | null {
  if (typeof path !== "string" || path.length > 160000 || !path.startsWith("/") || path.startsWith("//")) return null;
  try {
    const url = new URL(path, "https://learner.invalid");
    if (url.origin !== "https://learner.invalid" || !["/research/journeys", "/report-issue"].includes(url.pathname.replace(/\/$/, ""))) return null;
    return url.pathname + url.search + url.hash;
  } catch { return null; }
}
