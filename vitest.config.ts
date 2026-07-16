import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globals: true,
    // Fork startup can exceed Vitest's worker handshake timeout when this
    // workspace is OneDrive-backed. Keep local runs deterministic while CI
    // retains file-level parallelism on its local runner disk.
    pool: process.env.CI ? "forks" : "threads",
    fileParallelism: Boolean(process.env.CI),
    maxWorkers: process.env.CI ? undefined : 1,
    setupFiles: ["./vitest.setup.ts"],
    exclude: [
      "node_modules",
      ".next",
      "out",
      "android",
      "e2e",
      "tests/**",
      "src/lib/batchImportUtils.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 60,
        lines: 60,
      },
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "src/app/**/page*.tsx",
        "src/app/**/layout.tsx",
        "src/app/favicon.ico",
      ],
    },
  },
});
