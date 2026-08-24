"use client";

export type CoverageDashboard = {
  nodesByKind: Array<{ kind: string; count: number }>;
  nodesByState: Array<{ content_state: string; count: number }>;
  unsupportedPublishedClaimLikeNodes: number;
  criticalPublishedEdgesWithoutProvenance: number;
  unresolvedAssertions: Array<{ review_state: string; count: number }>;
  unansweredPublishedObjections: number;
  reviewBacklog: Array<{ review_dimension: string; state: string; count: number }>;
  citationBacklog: Array<{ review_state: string; count: number }>;
  publishedArgumentsMissingStructuralCoverage: number;
  critical: boolean;
  disclosure: string;
};

export type AuthoringProposal = {
  id: string;
  proposalType: string;
  inputHash: string;
  provider: string;
  model: string | null;
  inputSummary: Record<string, unknown>;
  proposal: Record<string, unknown>;
  status: "proposed" | "accepted" | "rejected" | "expired";
  proposedBy: string;
  reviewedBy: string | null;
  reviewNotes: string | null;
  acceptedMutationIds: unknown[];
  createdAt: string;
  reviewedAt: string | null;
  expiresAt: string | null;
  updatedAt: string;
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };

function csrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)as_csrf_token=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

async function refreshCsrf(): Promise<void> {
  try {
    await fetch("/api/auth/csrf", { credentials: "same-origin", cache: "no-store" });
  } catch {
    // Best effort; the subsequent request will fail safely if no token is available.
  }
}

async function request<T>(path: string, options: { method?: "GET" | "POST"; body?: Record<string, unknown>; retried?: boolean } = {}): Promise<Result<T>> {
  const method = options.method || "GET";
  const headers: Record<string, string> = { accept: "application/json" };
  if (method !== "GET") {
    headers["content-type"] = "application/json";
    const token = csrfToken();
    if (token) headers["x-csrf-token"] = token;
  }

  try {
    const response = await fetch(`/api/admin/knowledge-advanced${path}`, {
      method,
      headers,
      credentials: "same-origin",
      cache: "no-store",
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (response.status === 403 && method !== "GET" && !options.retried) {
      await refreshCsrf();
      return request<T>(path, { ...options, retried: true });
    }
    const contentType = response.headers.get("content-type")?.toLowerCase() || "";
    if (!contentType.includes("application/json")) return { ok: false, error: "Knowledge Foundry returned an unexpected response.", status: 502 };
    const payload = await response.json() as Record<string, unknown>;
    if (!response.ok) return { ok: false, error: typeof payload.error === "string" ? payload.error : `HTTP ${response.status}`, status: response.status };
    return { ok: true, data: payload as T };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Knowledge Foundry network error." };
  }
}

export const advancedKnowledgeAdmin = {
  coverage: () => request<CoverageDashboard>("/coverage"),
  proposals: (status = "", type = "") => {
    const search = new URLSearchParams({ limit: "100" });
    if (status) search.set("status", status);
    if (type) search.set("type", type);
    return request<{ proposals: AuthoringProposal[]; proposalOnly: boolean; autoPublish: boolean; autoMerge: boolean }>(`/proposals?${search}`);
  },
  createProposal: (body: { proposalType: string; input: Record<string, unknown>; expiresDays?: number }) =>
    request<{ proposal: AuthoringProposal; proposalOnly: boolean; autoPublish: boolean; autoMerge: boolean }>("/proposals", { method: "POST", body }),
  decideProposal: (id: string, body: { status: "accepted" | "rejected" | "expired"; notes?: string; acceptedMutationIds?: string[] }) =>
    request<{ proposal: AuthoringProposal; publicationBoundary: string }>(`/proposals/${encodeURIComponent(id)}/decision`, { method: "POST", body }),
};
