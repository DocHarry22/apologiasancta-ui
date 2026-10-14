import { runAgent, agentConfiguration } from "../src/lib/server/agent/runner";
import { checkCodexAuthentication, codexModelCall } from "../src/lib/server/agent/codexModel";
import { closeLearningPoolForTests } from "../src/lib/server/learning/database";
async function main() {
  if (process.env.GITHUB_ACTIONS === "true") throw new Error("Run the subscription worker privately, outside repository CI");
  await checkCodexAuthentication();
  if (process.argv.includes("--check")) { console.log("Private Codex worker: authenticated with ChatGPT. No model request was sent."); return; }
  const config = agentConfiguration("codex");
  if (!config.configured) throw new Error(`Worker settings missing: ${config.missing.join(", ")}`);
  const once = process.argv.includes("--once"); let stopping = false;
  process.on("SIGINT", () => { stopping = true; }); process.on("SIGTERM", () => { stopping = true; });
  do {
    const result = await runAgent({ privateCodexWorker: true, modelCall: codexModelCall });
    console.log(JSON.stringify({ time: new Date().toISOString(), provider: "codex", ...result }));
    if (once || stopping) break;
    // Wait in small intervals so shutdown does not leave an hour-long timer.
    for (let minute = 0; minute < 60 && !stopping; minute++) await new Promise(resolve => setTimeout(resolve, 60_000));
  } while (!stopping);
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Private content worker failed"); process.exitCode = 1; }).finally(closeLearningPoolForTests);
