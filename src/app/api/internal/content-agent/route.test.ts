import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@/lib/server/agent/runner", () => ({ runAgent: vi.fn() }));
import { runAgent } from "@/lib/server/agent/runner";
import { POST } from "./route";
import { validAgentToken } from "@/lib/server/agent/auth";
beforeEach(() => vi.stubEnv("CONTENT_AGENT_PROVIDER", "api"));
afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });
describe("scheduler authentication", () => {
  it("fails closed for unset, short, wrong and non-bearer secrets", () => {
    expect(validAgentToken("Bearer x", undefined)).toBe(false); expect(validAgentToken("Bearer short", "short")).toBe(false);
    expect(validAgentToken(`Bearer ${"b".repeat(32)}`, "a".repeat(32))).toBe(false); expect(validAgentToken(null, "a".repeat(32))).toBe(false);
  });
  it("accepts an exact dedicated secret", () => expect(validAgentToken(`Bearer ${"a".repeat(32)}`, "a".repeat(32))).toBe(true));
  it("rejects unauthorized requests before running anything", async () => {
    vi.stubEnv("CONTENT_AGENT_CRON_SECRET", "a".repeat(32)); const response = await POST(new NextRequest("https://example.com/api/internal/content-agent", {method:"POST"}));
    expect(response.status).toBe(401); expect(runAgent).not.toHaveBeenCalled();
  });
  it("never launches Codex through the public website endpoint", async () => {
    vi.stubEnv("CONTENT_AGENT_CRON_SECRET", "a".repeat(32)); vi.stubEnv("CONTENT_AGENT_PROVIDER", "codex");
    const response = await POST(new NextRequest("https://example.com/api/internal/content-agent", {method:"POST",headers:{authorization:`Bearer ${"a".repeat(32)}`}}));
    expect((await response.json()).status).toBe("external_worker"); expect(runAgent).not.toHaveBeenCalled();
  });
  it("returns failure status so the scheduler records failed jobs", async () => {
    vi.stubEnv("CONTENT_AGENT_CRON_SECRET", "a".repeat(32)); vi.mocked(runAgent).mockResolvedValue({status:"failed",runId:"run"});
    const response = await POST(new NextRequest("https://example.com/api/internal/content-agent", {method:"POST",headers:{authorization:`Bearer ${"a".repeat(32)}`}})); expect(response.status).toBe(502);
  });
});
