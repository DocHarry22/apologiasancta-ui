import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
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
      AUTHOR_ADMIN_PASSWORD: "test-author-password",
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
