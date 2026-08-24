import "server-only";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 1024 * 1024;

export class AdvancedKnowledgeAdminError extends Error {
  constructor(message: string, public readonly status: number, public readonly upstreamStatus?: number) {
    super(message);
    this.name = "AdvancedKnowledgeAdminError";
  }
}

function boundedInt(raw: string | undefined, fallback: number, max: number): number {
  const parsed = Number.parseInt(raw || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

function engineBaseUrl(): string | null {
  const raw = process.env.ENGINE_INTERNAL_URL?.trim() || process.env.NEXT_PUBLIC_ENGINE_URL?.trim() || null;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.username || url.password) return null;
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") return null;
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function adminToken(): string | null {
  return process.env.ENGINE_ADMIN_TOKEN?.trim() || null;
}

async function readBoundedJson(response: Response, maxBytes: number): Promise<unknown> {
  const declared = Number.parseInt(response.headers.get("content-length") || "", 10);
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new AdvancedKnowledgeAdminError("Knowledge admin response exceeded the size limit.", 502, response.status);
  }
  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  if (!contentType.includes("application/json")) {
    throw new AdvancedKnowledgeAdminError("Knowledge admin returned an unexpected response.", 502, response.status);
  }
  if (!response.body) return null;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("advanced-knowledge-admin-response-size-limit").catch(() => undefined);
        throw new AdvancedKnowledgeAdminError("Knowledge admin response exceeded the size limit.", 502, response.status);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return total ? JSON.parse(new TextDecoder().decode(merged)) : null;
  } catch {
    throw new AdvancedKnowledgeAdminError("Knowledge admin returned invalid JSON.", 502, response.status);
  }
}

export async function fetchAdvancedKnowledgeAdmin(options: {
  path: "coverage" | "proposals" | `proposals/${string}/decision`;
  method?: "GET" | "POST";
  search?: URLSearchParams;
  body?: Record<string, unknown>;
  editorId: string;
}): Promise<unknown> {
  const base = engineBaseUrl();
  const token = adminToken();
  if (!base || !token) throw new AdvancedKnowledgeAdminError("Knowledge admin is not configured.", 503);

  const timeoutMs = boundedInt(process.env.KNOWLEDGE_ADMIN_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 30_000);
  const maxBytes = boundedInt(process.env.KNOWLEDGE_ADMIN_MAX_BYTES, DEFAULT_MAX_BYTES, 5 * 1024 * 1024);
  const url = new URL(`/admin/knowledge/advanced/${options.path}`, base);
  if (options.search) url.search = options.search.toString();

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method || "GET",
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-admin-token": token,
        "x-editor-id": options.editorId.slice(0, 200),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new AdvancedKnowledgeAdminError("Knowledge admin request timed out.", 504);
    }
    throw new AdvancedKnowledgeAdminError("Knowledge admin is unreachable.", 502);
  }

  const payload = await readBoundedJson(response, maxBytes);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload
      ? String((payload as { error?: unknown }).error || "")
      : "";
    const safeStatus = [400, 404, 409, 422, 503].includes(response.status) ? response.status : response.status === 403 ? 403 : 502;
    throw new AdvancedKnowledgeAdminError(message || "Knowledge admin request failed.", safeStatus, response.status);
  }
  return payload;
}
