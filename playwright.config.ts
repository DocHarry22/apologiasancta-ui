import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Next.js dev compilation on the synced workspace can exceed 30 seconds on
  // the first route load, while authenticated RSC navigations can take >5s.
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
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
      ENGINE_INTERNAL_URL: "https://engine.test",
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
