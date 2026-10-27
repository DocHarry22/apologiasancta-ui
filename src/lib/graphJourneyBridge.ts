import { GRAPH_BRIDGE_CHANNEL, GRAPH_JOURNEY_SOURCE } from "./graphJourneys";

type Account = { id: string; displayName: string };
type Journey = { id: string; metadata?: Record<string, unknown> };
type State = "connected" | "signed_out" | "error";
type Options = {
  graphOrigin: string;
  opener: Window;
  fetcher?: typeof fetch;
  onState: (state: State, message: string) => void;
};

const CANONICAL_ID = /^[a-z][a-z0-9_-]*:[a-z0-9][a-z0-9._:-]*$/;

export function graphJourneyInput(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("Invalid Graph journey.");
  const input = value as Record<string, unknown>;
  const metadata = input.metadata as Record<string, unknown> | undefined;
  if (metadata?.source !== GRAPH_JOURNEY_SOURCE || !["graph_path", "catalog_bookmark"].includes(String(metadata.kind))
    || typeof metadata.recordId !== "string" || !/^[a-zA-Z0-9_-]{1,160}$/.test(metadata.recordId)
    || typeof input.title !== "string" || !input.title.trim() || input.title.length > 160
    || typeof input.rootNodeId !== "string" || !CANONICAL_ID.test(input.rootNodeId)
    || !Array.isArray(input.nodeIds) || !input.nodeIds.length || input.nodeIds.length > 120
    || input.nodeIds.some((id) => typeof id !== "string" || !CANONICAL_ID.test(id))
    || typeof input.lens !== "string" || !/^[a-z0-9_-]{1,80}$/.test(input.lens)
    || new TextEncoder().encode(JSON.stringify(metadata)).length > 16 * 1024) {
    throw new Error("Invalid Graph journey. Save up to 120 canonical nodes with bounded navigation metadata.");
  }
  return { title: input.title, rootNodeId: input.rootNodeId, nodeIds: input.nodeIds, lens: input.lens, visibility: "private", metadata };
}

export function createGraphJourneyBridge({ graphOrigin, opener, fetcher = fetch, onState }: Options) {
  let accountId: string | null = null;
  let disposed = false;
  let queue = Promise.resolve();
  const send = (data: Record<string, unknown>) => {
    if (!disposed) opener.postMessage({ channel: GRAPH_BRIDGE_CHANNEL, ...data }, graphOrigin);
  };
  async function json(path: string, init: RequestInit = {}) {
    const response = await fetcher(path, { ...init, credentials: "same-origin", cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) {
        onState("signed_out", "Sign in to connect your learner account, then reconnect from Graph.");
        throw new Error("Sign in in the learner window, then reconnect from Graph.");
      }
      throw new Error(body.error?.message || (typeof body.error === "string" ? body.error : `Learner request failed (${response.status}).`));
    }
    return body;
  }
  async function account(): Promise<Account> {
    const body = await json("/api/auth/me");
    const user = body.user;
    if (!user?.id) throw new Error("Learner account unavailable.");
    if (accountId && accountId !== user.id) {
      throw new Error("The signed-in account changed. Reconnect from Graph before saving.");
    }
    accountId = user.id;
    return { id: user.id, displayName: user.displayName };
  }
  async function journeys(): Promise<Journey[]> {
    const all: Journey[] = [];
    for (let offset = 0; offset <= 100000; offset += 100) {
      const body = await json(`/api/v1/learning/journeys?limit=100&source=apologia-graph&offset=${offset}`);
      const page: Journey[] = Array.isArray(body.data) ? body.data : [];
      all.push(...page.filter((journey) => journey.metadata?.source === GRAPH_JOURNEY_SOURCE));
      if (page.length < 100) { await account(); return all; }
    }
    throw new Error("Too many saved Graph journeys. Manage your saves in the learner app.");
  }
  async function mutation(path: string, method: string, input?: unknown) {
    const csrf = await json("/api/auth/csrf");
    if (!csrf.csrfToken) throw new Error("Security token unavailable. Reconnect your account.");
    await account();
    return json(path, {
      method,
      headers: { "content-type": "application/json", "x-csrf-token": csrf.csrfToken },
      ...(input ? { body: JSON.stringify(input) } : {}),
    });
  }
  async function announce() {
    try {
      accountId = null;
      const user = await account();
      onState("connected", `Connected as ${user.displayName}. Return to Graph to save your research. Keep this window open.`);
      send({ type: "ready" });
    } catch (error) {
      if (!(error instanceof Error && error.message.startsWith("Sign in"))) onState("error", error instanceof Error ? error.message : "Connection unavailable.");
    }
  }
  async function handle(event: MessageEvent) {
    const data = event.data;
    if (disposed || event.origin !== graphOrigin || event.source !== opener || data?.channel !== GRAPH_BRIDGE_CHANNEL) return;
    if (data.type === "hello") { await announce(); return; }
    if (data.type !== "request" || typeof data.id !== "string" || data.id.length > 80) return;
    if (!["list", "save", "delete"].includes(data.action)) return;
    try {
      const user = await account();
      let result: unknown;
      if (data.action === "list") result = { account: user, journeys: await journeys() };
      else if (data.action === "save") {
        const input = graphJourneyInput(data.payload);
        // A bookmark is a toggleable catalog entry. Reuse an existing entry on
        // retries rather than creating duplicates after a lost response.
        const existing = input.metadata.kind === "catalog_bookmark"
          ? (await journeys()).find((item) => item.metadata?.kind === "catalog_bookmark" && item.metadata.recordId === input.metadata.recordId) : null;
        result = existing || (await mutation("/api/v1/learning/journeys", "POST", input)).data;
      } else {
        const id = data.payload?.id;
        const saved = await journeys();
        if (typeof id !== "string" || !saved.some((item) => item.id === id)) throw new Error("Graph bookmark was not found in this account.");
        result = (await mutation(`/api/v1/learning/journeys/${encodeURIComponent(id)}`, "DELETE")).data;
      }
      send({ type: "result", id: data.id, data: result });
    } catch (error) {
      send({ type: "result", id: data.id, error: error instanceof Error ? error.message : "Learner request failed." });
    }
  }
  return {
    announce,
    receive(event: MessageEvent) { queue = queue.then(() => handle(event)); return queue; },
    dispose() { disposed = true; },
  };
}
