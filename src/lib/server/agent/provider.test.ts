import { afterEach, describe, expect, it, vi } from "vitest";
import { boundedText, htmlText, modelCall, retrieve } from "./provider";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("bounded source retrieval", () => {
  it("removes executable content and navigation", () => expect(htmlText('<script>do bad things</script><nav>Menu</nav><p>Faith &amp; reason &#8212; good</p>')).toBe("Faith & reason — good"));
  it("rejects oversized streamed payloads", async () => { await expect(boundedText(new Response("123456"), 5)).rejects.toThrow(/size/); });
  it("does not follow redirects to untrusted hosts", async () => { const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://localhost/private" } })); vi.stubGlobal("fetch", fetch); await expect(retrieve("https://www.vatican.va/test")).rejects.toThrow(/trusted/); expect(fetch).toHaveBeenCalledTimes(1); });
  it("fingerprints retrieved text and records provenance", async () => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(`<title>Faith</title><p>${"Teaching faith. ".repeat(50)}</p>`, { headers: { "content-type": "text/html" } }))); const s = await retrieve("https://www.vatican.va/content/catechism/en/test"); expect(s.kind).toBe("catechism"); expect(s.sha256).toHaveLength(64); expect(s.title).toBe("Faith"); });
});
describe("model calls", () => {
  it("uses trusted search domain filters and only actual search/citation URLs", async () => {
    vi.stubEnv("OPENAI_API_KEY", "fixture-key"); const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "completed", id: "response-1", output: [{ type: "web_search_call", action: { sources: [{url: "https://www.vatican.va/test"}] } }, {content:[{type:"output_text",text:'{"urls":["https://invented.example"]}'}]}] }))); vi.stubGlobal("fetch", fetch);
    const result = await modelCall("search", true); expect(result.urls).toEqual(["https://www.vatican.va/test"]);
    const body = JSON.parse(fetch.mock.calls[0][1].body); expect(body.tools[0].filters.allowed_domains).toContain("bible.usccb.org"); expect(body.store).toBe(false); expect(body.max_tool_calls).toBe(3);
  });
  it("rejects incomplete generation", async () => { vi.stubEnv("OPENAI_API_KEY", "fixture-key"); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"status":"incomplete"}'))); await expect(modelCall("lesson")).rejects.toThrow(/incomplete/); });
  it("does not expose provider response bodies in errors", async () => { vi.stubEnv("OPENAI_API_KEY", "fixture-key"); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("sensitive response", {status:401}))); await expect(modelCall("lesson")).rejects.toThrow("Agent model request failed (HTTP 401)"); });
});
