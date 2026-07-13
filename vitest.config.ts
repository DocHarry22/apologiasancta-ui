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
