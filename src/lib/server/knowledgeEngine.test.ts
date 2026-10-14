import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { fetchKnowledgeEngine } from "./knowledgeEngine";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("Knowledge Engine mounts", () => {
  it.each([
    ["https://engine.test", "https://engine.test/knowledge/nodes/claim%3Atrinity"],
    ["https://engine.test/service/", "https://engine.test/service/knowledge/nodes/claim%3Atrinity"],
    ["https://project.supabase.co/functions/v1/knowledge-v2", "https://project.supabase.co/functions/v1/knowledge-v2/nodes/claim%3Atrinity"],
  ])("preserves the configured mount %s", async (base, expected) => {
    vi.stubEnv("KNOWLEDGE_ENGINE_URL", base);
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ id: "claim:trinity" })));
    await fetchKnowledgeEngine("/knowledge/nodes/claim%3Atrinity", new URLSearchParams({ lens: "catholic" }));
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(`${expected}?lens=catholic`);
  });
});
