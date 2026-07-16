import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Next.js dev compilation on the synced workspace can exceed 30 seconds on
  // the first route load, while authenticated RSC navigations can take >5s.
  timeout: 90_000,
  expect: {
    timeout: 30_000,
  },
  fullyParallel: true,
  // OneDrive-backed local workspaces can spend tens of seconds compacting
  // Turbopack's filesystem cache. Keep local runs deterministic; CI runners
  // use two workers because their workspace is local disk.
  workers: process.env.CI ? 2 : 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    env: {
      ADMIN_EMAIL: "admin@example.test",
      ADMIN_PASSWORD: "test-author-password",
      ADMIN_AUTH_MEMORY_STORE: "true",
      AUTHOR_SESSION_SECRET: "test-session-secret-that-is-long-enough",
      // Use an explicitly closed loopback port so server-side publish failure
      // tests fail fast and never depend on DNS, proxies, or external state.
      ENGINE_INTERNAL_URL: "http://127.0.0.1:9",
      ENGINE_ADMIN_TOKEN: "server-only-admin-token",
      NEXT_PUBLIC_ENGINE_URL: "https://engine.test",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
