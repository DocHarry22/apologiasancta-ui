/* eslint @typescript-eslint/no-require-imports: "off" -- Next ESLint loads this adapter through CommonJS. */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
// Next's get-root-dirs uses only globSync(pattern, { onlyDirectories: true }).
// Keep that narrow contract and remove the unpatched micromatch/braces chain.
function globSync(pattern, options = {}) {
  const patterns = Array.isArray(pattern) ? pattern : [pattern];
  if (!patterns.length || patterns.length > 16 || options.onlyDirectories !== true || Object.keys(options).some(key => !["onlyDirectories", "cwd"].includes(key))) throw new Error("Unsupported Next.js root-directory glob options");
  for (const value of patterns) {
    if (typeof value !== "string" || !value || value.length > 512 || /[{}\u0000]/.test(value) || value.split("/").length > 32) throw new Error("Invalid or excessive root-directory pattern");
    let nesting = 0;
    for (const char of value) { if (char === "(" || char === "[") nesting++; if (char === ")" || char === "]") nesting--; if (nesting < 0 || nesting > 8) throw new Error("Excessive root-directory pattern nesting"); }
    if (nesting !== 0) throw new Error("Unbalanced root-directory pattern");
  }
  const cwd = options.cwd || process.cwd();
  return [...new Set(fs.globSync(patterns, { cwd }))].filter(match => {
    try { return fs.statSync(path.resolve(cwd, match)).isDirectory(); } catch { return false; }
  });
}
module.exports = { globSync, sync: globSync };
