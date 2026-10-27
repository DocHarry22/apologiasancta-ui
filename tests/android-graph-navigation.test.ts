import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
test("native Graph routing matches only the configured subframe origin", (context) => {
  try { execFileSync("javac", ["-version"], { stdio: "ignore" }); }
  catch { context.skip("A JDK is required to run the native Java policy checks."); return; }
  const output = mkdtempSync(join(tmpdir(), "apologia-graph-policy-"));
  try {
    execFileSync("javac", ["-d", output, join(root, "android/app/src/main/java/com/apologiasancta/live/GraphNavigationPolicy.java"), join(root, "tests/java/GraphNavigationCheck.java")], { stdio: "pipe" });
    const result = execFileSync("java", ["-cp", output, "GraphNavigationCheck"], { encoding: "utf8" });
    assert.match(result, /15 native Graph navigation checks passed/);
  } finally {
    const target = realpathSync(output);
    assert.equal(dirname(target), realpathSync(tmpdir()));
    assert.equal(basename(target).startsWith("apologia-graph-policy-"), true);
    rmSync(target, { recursive: true, force: true });
  }
});
