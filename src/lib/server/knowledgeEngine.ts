import "server-only";

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;

export class KnowledgeEngineError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly upstreamStatus?: number,
  ) {
    super(message);
    this.name = "KnowledgeEngineError";
  }
}

function positiveInt(raw: string | undefined, fallback: number, max: number): number {
  const value = Number.parseInt(raw || "", 10);
  return Number.isFinite(value) && value > 0 ? Math.min(value, max) : fallback;
}

export function getKnowledgeEngineBaseUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = env.KNOWLEDGE_ENGINE_URL?.trim() || env.ENGINE_INTERNAL_URL?.trim() || null;
  if (!raw) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.username || parsed.password) return null;
  if (env.NODE_ENV === "production" && parsed.protocol !== "https:") return null;
  if (!["https:", "http:"].includes(parsed.protocol)) return null;
  parsed.pathname = "/";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

export function getKnowledgeEngineClientStatus() {
  return {
    configured: Boolean(getKnowledgeEngineBaseUrl()),
    timeoutMs: positiveInt(process.env.KNOWLEDGE_ENGINE_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 30_000),
    maxBytes: positiveInt(process.env.KNOWLEDGE_ENGINE_MAX_BYTES, DEFAULT_MAX_BYTES, 10 * 1024 * 1024),
  };
}

export async function fetchKnowledgeEngine(
  path: string,
  search?: URLSearchParams,
): Promise<unknown> {
  if (!path.startsWith("/knowledge/") && path !== "/knowledge") {
    throw new KnowledgeEngineError("Knowledge Engine path is not allowed.", 400);
  }
  if (path.includes("..") || /[?#]/.test(path)) {
    throw new KnowledgeEngineError("Knowledge Engine path is invalid.", 400);
  }

  const base = getKnowledgeEngineBaseUrl();
  if (!base) throw new KnowledgeEngineError("Knowledge Engine is not configured.", 503);
  const url = new URL(path, `${base}/`);
  if (search) url.search = search.toString();
  const timeoutMs = positiveInt(process.env.KNOWLEDGE_ENGINE_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 30_000);
  const maxBytes = positiveInt(process.env.KNOWLEDGE_ENGINE_MAX_BYTES, DEFAULT_MAX_BYTES, 10 * 1024 * 1024);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new KnowledgeEngineError("Knowledge Engine request timed out.", 504);
    }
    throw new KnowledgeEngineError("Knowledge Engine is unreachable.", 502);
  }

  const declared = Number.parseInt(response.headers.get("content-length") || "", 10);
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new KnowledgeEngineError("Knowledge Engine response is too large.", 502, response.status);
  }
  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  if (!contentType.includes("application/json")) {
    throw new KnowledgeEngineError("Knowledge Engine returned an unexpected response.", 502, response.status);
  }
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new KnowledgeEngineError("Knowledge Engine response is too large.", 502, response.status);
  }

  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new KnowledgeEngineError("Knowledge Engine returned invalid JSON.", 502, response.status);
  }
  if (!response.ok) {
    const upstreamMessage = payload && typeof payload === "object" && "error" in payload
      ? String((payload as { error?: unknown }).error || "")
      : "";
    const safeStatus = response.status === 404 ? 404 : response.status === 400 ? 400 : response.status === 503 ? 503 : 502;
    throw new KnowledgeEngineError(upstreamMessage || "Knowledge Engine request failed.", safeStatus, response.status);
  }
  return payload;
}
