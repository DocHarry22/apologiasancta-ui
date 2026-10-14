import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fixture, sources } from "@/lib/agent/testFixtures";
vi.mock("./provider", () => ({ modelCall: vi.fn(), retrieve: vi.fn() }));
vi.mock("./repository", () => ({ claimJob: vi.fn(), stage: vi.fn(), finish: vi.fn(), fail: vi.fn() }));
import { modelCall, retrieve } from "./provider";
import { claimJob, finish, fail } from "./repository";
import { agentConfiguration, runAgent } from "./runner";
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("CONTENT_AGENT_PROVIDER", "api"); vi.stubEnv("OPENAI_API_KEY", "fixture-key"); vi.stubEnv("LEARNING_DATABASE_URL", "postgres://fixture"); vi.stubEnv("CONTENT_AGENT_CRON_SECRET", "x".repeat(32));
  vi.mocked(claimJob).mockResolvedValue({id:"job",topic:"Faith",pillar:"creed",runId:"run",leaseToken:"lease"});
});
afterEach(() => vi.unstubAllEnvs());
function generated(passed = true) {
  vi.mocked(modelCall).mockResolvedValueOnce({value:null,urls:sources.map(s=>s.url),usage:{}})
    .mockResolvedValueOnce({value:fixture(),urls:[],usage:{}})
    .mockResolvedValueOnce({value:{passed,issues:passed?[]:["Unsupported claim"]},urls:[],usage:{}});
  vi.mocked(retrieve).mockImplementation(async url => sources.find(s=>s.url===url)!);
  vi.mocked(finish).mockResolvedValue("pack-id");
}
describe("autonomous pipeline", () => {
  it("publishes only after evidence validation and a separate audit", async () => { generated(); expect(await runAgent()).toMatchObject({status:"completed",packId:"pack-id"}); expect(finish).toHaveBeenCalledTimes(1); expect(modelCall).toHaveBeenCalledTimes(3); });
  it("can run a private subscription adapter without API or web scheduler credentials", async () => {
    generated(); vi.stubEnv("OPENAI_API_KEY", ""); vi.stubEnv("CONTENT_AGENT_CRON_SECRET", "");
    expect(await runAgent({privateCodexWorker:true,modelCall})).toMatchObject({status:"completed"});
  });
  it("retries failed audits without publishing", async () => { generated(false); expect(await runAgent()).toMatchObject({status:"failed"}); expect(finish).not.toHaveBeenCalled(); expect(fail).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({reviewIssues:["Unsupported claim"]}),expect.anything(),false); });
  it("does not generate content if primary sources cannot be retrieved", async () => { vi.mocked(modelCall).mockResolvedValue({value:null,urls:[sources[0].url],usage:{}}); vi.mocked(retrieve).mockResolvedValue(sources[0]); expect(await runAgent()).toMatchObject({status:"failed"}); expect(modelCall).toHaveBeenCalledTimes(1); expect(finish).not.toHaveBeenCalled(); });
  it("does not permanently block topics when subscription connectivity fails", async () => {
    vi.mocked(modelCall).mockRejectedValue(new Error("Agent Codex request timed out"));
    expect(await runAgent()).toMatchObject({status:"failed"});
    expect(fail).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({nextAction:expect.stringContaining("do not permanently block")}),expect.anything(),true);
  });
  it("does no paid work when a budget reservation is unavailable", async () => { vi.mocked(claimJob).mockResolvedValue(null); expect(await runAgent()).toMatchObject({status:"idle"}); expect(modelCall).not.toHaveBeenCalled(); });
  it("respects a deployment pause", async () => { vi.stubEnv("CONTENT_AGENT_ENABLED", "false"); expect(await runAgent()).toEqual({status:"disabled"}); expect(claimJob).not.toHaveBeenCalled(); });
  it("bounds requested daily work", () => { vi.stubEnv("CONTENT_AGENT_DAILY_LIMIT", "10000"); expect(agentConfiguration().dailyLimit).toBe(24); });
  it("fails configuration before reserving work", async () => { vi.stubEnv("OPENAI_API_KEY", ""); await expect(runAgent()).rejects.toThrow(/configuration/); expect(claimJob).not.toHaveBeenCalled(); });
});
