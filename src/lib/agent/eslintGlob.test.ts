import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";
const require = createRequire(import.meta.url);
const { globSync } = require("../../../tooling/eslint-safe-glob/index.cjs");
let directory: string;
afterEach(() => { if (directory) rmSync(directory,{recursive:true,force:true}); });
describe("Next lint root-directory glob adapter", () => {
  it("finds monorepo directories while excluding files", () => {
    directory = mkdtempSync(join(tmpdir(),"apologia-glob-")); mkdirSync(join(directory,"apps")); mkdirSync(join(directory,"apps","web")); writeFileSync(join(directory,"apps","file.txt"),"fixture");
    expect(globSync("apps/*",{cwd:directory,onlyDirectories:true})).toEqual([join("apps", "web")]);
    expect(globSync(join(directory,"apps","web"),{onlyDirectories:true})).toEqual([join(directory,"apps","web")]);
  });
  it("rejects nested brace expansion and unsupported APIs", () => {
    expect(()=>globSync("{".repeat(10000),{onlyDirectories:true})).toThrow();
    expect(()=>globSync("apps/*",{onlyDirectories:false})).toThrow();
  });
  it("keeps the installed Next plugin's expected export available", () => {
    expect(typeof require("fast-glob").globSync).toBe("function");
    expect(require("fast-glob/package.json").name).toBe("@apologia/eslint-safe-glob");
  });
});
