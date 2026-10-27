import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { GRAPH_BRIDGE_CHANNEL, graphJourneyHref } from "../src/lib/graphJourneys.ts";

// Match the bundler's extensionless TypeScript resolution in Node's test runner.
registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.endsWith("/knowledgeLearnerRepository.ts")) {
    if (specifier === "./database") return { url: "data:text/javascript,export async function learningQuery(sql, params) { globalThis.graphQuery = {sql, params}; return { rows: [] }; }", shortCircuit: true };
    if (specifier === "./serialize") return { url: "data:text/javascript,export function serializeLearningRow(row) { return row; }", shortCircuit: true };
  }
  return next(specifier === "./graphJourneys" && context.parentURL?.endsWith("/graphJourneyBridge.ts") ? "./graphJourneys.ts" : specifier, context);
} });
const { createGraphJourneyBridge, graphJourneyInput } = await import("../src/lib/graphJourneyBridge.ts");

const input = {
  title: "Crucifixion research", rootNodeId: "claim:crucifixion", nodeIds: ["claim:crucifixion", "source:passion"], lens: "historical", visibility: "public",
  metadata: { source: "apologia-graph", kind: "graph_path", recordId: "crucifixion", graph: {
    canonical: true, focusId: "source:passion", depth: 3, view: "2d", trail: [{ id: "claim:crucifixion", title: "Root" }, { id: "source:passion", title: "Sources" }],
  } },
};

function fixture(options: { unauthorized?: boolean; failSave?: boolean; items?: unknown[]; pages?: unknown[][] } = {}) {
  const messages: Record<string, unknown>[] = [];
  const calls: { path: string; init: RequestInit }[] = [];
  let userId = "account-a";
  const opener = { postMessage: (message: Record<string, unknown>, origin: string) => { assert.equal(origin, "https://graph.test"); messages.push(message); } } as unknown as Window;
  const fetcher = async (path: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ path: String(path), init });
    assert.equal(init.credentials, "same-origin");
    assert.equal(init.cache, "no-store");
    const data = String(path) === "/api/auth/me"
      ? { user: { id: userId, displayName: "Learner" } }
      : String(path) === "/api/auth/csrf" ? { csrfToken: "secret-csrf" }
      : init.method === "POST" ? { data: { id: "new-save", ...JSON.parse(String(init.body)) } }
      : init.method === "DELETE" ? { data: { deleted: true } }
      : { data: options.pages ? options.pages[Number(new URL(String(path), "https://learner.test").searchParams.get("offset")) / 100] || [] : options.items || [] };
    const status = options.unauthorized ? 401 : options.failSave && init.method === "POST" ? 503 : 200;
    return new Response(JSON.stringify(status === 200 ? data : { error: { message: "Service unavailable" } }), { status });
  };
  const states: { state: string; message: string }[] = [];
  const bridge = createGraphJourneyBridge({ graphOrigin: "https://graph.test", opener, fetcher: fetcher as typeof fetch, onState(state, message) { states.push({ state, message }); } });
  const request = (action: string, payload?: unknown, origin = "https://graph.test", source = opener) => bridge.receive({
    origin, source, data: { channel: GRAPH_BRIDGE_CHANNEL, type: "request", id: "request-1", action, payload },
  } as MessageEvent);
  return { bridge, request, messages, calls, states, switchAccount() { userId = "account-b"; } };
}

test("reopening a Graph journey preserves the record, ordered trail and exploration settings", () => {
  const url = new URL(graphJourneyHref("https://graph.test", input)!);
  assert.equal(url.origin, "https://graph.test");
  assert.equal(url.pathname, "/graph/crucifixion");
  assert.equal(url.searchParams.get("focus"), "source:passion");
  assert.equal(url.searchParams.get("depth"), "3");
  assert.equal(url.searchParams.get("view"), "2d");
  assert.equal(url.searchParams.get("lens"), "historical");
  assert.deepEqual(JSON.parse(url.searchParams.get("trail")!), input.metadata.graph.trail);
});

test("ordinary journeys retain root links and stored data cannot change Graph's origin", () => {
  const url = new URL(graphJourneyHref("https://graph.test", { rootNodeId: "claim:root", lens: "catholic", metadata: { recordId: "https://attacker.test" } })!);
  assert.equal(url.pathname, "/graph");
  assert.equal(url.origin, "https://graph.test");
  assert.equal(url.searchParams.get("focus"), "claim:root");
  assert.equal(graphJourneyHref("javascript:alert(1)", input), null);
});

test("compatibility journeys reopen their display path in compatibility mode", () => {
  const journey = { ...input, metadata: { ...input.metadata, graph: { ...input.metadata.graph, canonical: false, focusId: "display-2" } } };
  const url = new URL(graphJourneyHref("https://graph.test", journey)!);
  assert.equal(url.searchParams.get("compatibility"), "1");
  assert.equal(url.searchParams.get("focus"), "display-2");
});

test("Graph saves are forced private and invalid canonical IDs are rejected", () => {
  assert.equal(graphJourneyInput(input).visibility, "private");
  assert.throws(() => graphJourneyInput({ ...input, nodeIds: ["display-id"] }), /Invalid/);
  assert.throws(() => graphJourneyInput({ ...input, metadata: { source: "another-app" } }), /Invalid/);
  assert.throws(() => graphJourneyInput({ ...input, nodeIds: Array(121).fill("claim:a") }), /Invalid/);
});

test("untrusted origins, windows, channels and actions cause no account reads or writes", async () => {
  const f = fixture();
  await f.request("save", input, "https://attacker.test");
  await f.request("save", input, "https://graph.test", {} as Window);
  await f.request("fetch-arbitrary-url", { url: "/api/auth/me" });
  await f.bridge.receive({ origin: "https://graph.test", source: {} as Window, data: { channel: "wrong-channel", type: "request", id: "wrong", action: "save", payload: input } } as MessageEvent);
  assert.equal(f.calls.length, 0);
  assert.equal(f.messages.length, 0);
});

test("signed-out users see sign-in and cannot create an account save", async () => {
  const f = fixture({ unauthorized: true });
  await f.bridge.announce();
  await f.request("save", input);
  assert.equal(f.states[0].state, "signed_out");
  assert.ok(f.messages.at(-1)?.error);
  assert.ok(f.calls.every((call) => !call.init.method));
});

test("authenticated saves use the existing learner API and same-origin CSRF", async () => {
  const f = fixture();
  await f.request("save", input);
  const save = f.calls.find((call) => call.init.method === "POST")!;
  assert.equal(save.path, "/api/v1/learning/journeys");
  assert.equal((save.init.headers as Record<string, string>)["x-csrf-token"], "secret-csrf");
  assert.equal(JSON.parse(String(save.init.body)).visibility, "private");
  assert.ok(!JSON.stringify(f.messages).includes("secret-csrf"));
  assert.ok(!JSON.stringify(f.messages).includes("cookie"));
});

test("listing sends only this learner's Graph journeys", async () => {
  const f = fixture({ items: [{ id: "graph", metadata: input.metadata }, { id: "compare", metadata: { source: "compare" } }] });
  await f.request("list");
  const result = f.messages.at(-1)?.data as { account: { id: string }; journeys: { id: string }[] };
  assert.deepEqual(result.journeys.map((item) => item.id), ["graph"]);
  assert.equal(result.account.id, "account-a");
  assert.ok(f.calls.some((call) => call.path.includes("source=apologia-graph")));
});

test("failed saves return an error and never report a saved journey", async () => {
  const f = fixture({ failSave: true });
  await f.request("save", input);
  assert.equal(f.messages.at(-1)?.error, "Service unavailable");
  assert.equal(f.messages.at(-1)?.data, undefined);
});

test("bookmarks and paths beyond the first hundred are loaded across pages", async () => {
  const first = Array.from({ length: 100 }, (_, id) => ({ id: `path-${id}`, metadata: input.metadata }));
  const f = fixture({ pages: [first, [{ id: "older-bookmark", metadata: { ...input.metadata, kind: "catalog_bookmark" } }]] });
  await f.request("list");
  const saved = (f.messages.at(-1)?.data as { journeys: { id: string }[] }).journeys;
  assert.equal(saved.length, 101);
  assert.equal(saved.at(-1)?.id, "older-bookmark");
});

test("bookmark retries reuse an existing account entry", async () => {
  const bookmark = { ...input, metadata: { ...input.metadata, kind: "catalog_bookmark" } };
  const f = fixture({ items: [{ id: "existing-bookmark", metadata: bookmark.metadata }] });
  await f.request("save", bookmark);
  assert.equal((f.messages.at(-1)?.data as { id: string }).id, "existing-bookmark");
  assert.ok(f.calls.every((call) => !call.init.method));
});

test("deletion is limited to a Graph journey already belonging to this account", async () => {
  const f = fixture({ items: [{ id: "owned", metadata: input.metadata }] });
  await f.request("delete", { id: "someone-else" });
  assert.match(String(f.messages.at(-1)?.error), /not found/);
  assert.ok(f.calls.every((call) => !call.init.method));
  await f.request("delete", { id: "owned" });
  assert.ok(f.calls.some((call) => call.path.endsWith("/owned") && call.init.method === "DELETE"));
});

test("changing signed-in accounts requires reconnection before further access", async () => {
  const f = fixture();
  await f.bridge.announce();
  f.switchAccount();
  await f.request("save", input);
  assert.match(String(f.messages.at(-1)?.error), /account changed/);
  assert.ok(f.calls.every((call) => !call.init.method));
});

test("Graph filtering and paging keep the server-derived learner ownership predicate", async () => {
  const { listSavedKnowledgeJourneys } = await import("../src/lib/server/learning/knowledgeLearnerRepository.ts");
  await listSavedKnowledgeJourneys("learner-a", 100, "apologia-graph", 100);
  const query = (globalThis as unknown as { graphQuery: { sql: string; params: unknown[] } }).graphQuery;
  assert.match(query.sql, /WHERE learner_id = \$1/);
  assert.match(query.sql, /metadata->>'source' = \$3/);
  assert.match(query.sql, /LIMIT \$2 OFFSET \$4/);
  assert.deepEqual(query.params, ["learner-a", 100, "apologia-graph", 100]);
  await listSavedKnowledgeJourneys("learner-b");
  assert.deepEqual((globalThis as unknown as { graphQuery: { params: unknown[] } }).graphQuery.params, ["learner-b", 50, null, 0]);
});
