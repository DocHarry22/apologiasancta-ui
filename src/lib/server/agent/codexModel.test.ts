import { afterEach, describe, expect, it, vi } from "vitest";
import { codexArguments, codexEnvironment, executeCodex } from "./codexModel";
afterEach(() => vi.unstubAllEnvs());
describe("private subscription worker boundary", () => {
  it("does not pass database, API or scheduler credentials to the model process", () => {
    const env = codexEnvironment({PATH:"/bin",HOME:"/private",LEARNING_DATABASE_URL:"sensitive",OPENAI_API_KEY:"sensitive",CONTENT_AGENT_CRON_SECRET:"sensitive",CODEX_API_KEY:"sensitive"});
    expect(env).toEqual({PATH:"/bin",HOME:"/private",NODE_ENV:"production"});
  });
  it("uses native ChatGPT auth, denies command tools and keeps jobs non-interactive", () => {
    const args = codexArguments("/tmp/output.json", true);
    expect(args).toContain('forced_login_method="chatgpt"'); expect(args).toContain("features.shell_tool=false"); expect(args).toContain("never"); expect(args).toContain("read-only"); expect(args).toContain("--ignore-user-config"); expect(args).toContain('web_search="live"');
    expect(args).not.toContain("--dangerously-bypass-approvals-and-sandbox");
  });
  it("disables web search during writing and checking", () => expect(codexArguments("/tmp/output.json",false)).toContain('web_search="disabled"'));
  it("rejects subscription execution in GitHub CI before spawning", async () => { vi.stubEnv("GITHUB_ACTIONS","true"); await expect(executeCodex([],"","/tmp")).rejects.toThrow(/repository CI/); });
});
