import { expect, test } from "@playwright/test";

async function mockEngine(page: import("@playwright/test").Page) {
  await page.route("https://engine.test/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/health") {
      await route.fulfill({ json: { ok: true } });
      return;
    }
    if (url.pathname === "/state") {
      await route.fulfill({
        json: {
          phase: "OPEN",
          endsAtMs: Date.now() + 30000,
          questionIndex: 0,
          totalQuestions: 1,
          themeTitle: "Test Topic",
          question: {
            text: "Test question",
            choices: [
              { id: "A", label: "A", text: "Alpha" },
              { id: "B", label: "B", text: "Beta" },
              { id: "C", label: "C", text: "Gamma" },
              { id: "D", label: "D", text: "Delta" },
            ],
          },
          leaderboard: { topScorers: [], topStreaks: [] },
        },
      });
      return;
    }
    if (url.pathname.startsWith("/admin/")) {
      await route.fulfill({ json: { ok: true, status: "mocked" } });
      return;
    }
    await route.fulfill({ status: 404, json: { error: "not mocked" } });
  });
}

test.beforeEach(async ({ page }) => {
  await mockEngine(page);
});

test("public routes load", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toContainText(/Apologia Sancta/i);

  await page.goto("/library");
  await expect(page.locator("body")).toContainText(/library/i);

  await page.goto("/mobile");
  await expect(page.locator("body")).toContainText(/join|waiting|question|room/i);
});

test("native home navigation and update actions work on narrow browser screens", async ({ page }) => {
  const release = {
    id: "ui-release",
    repository: "apologiasancta-ui",
    commitSha: "abc123",
    createdAt: "2026-07-12T18:00:00.000Z",
    category: "UI/UX",
    title: "Responsive navigation",
    summary: "Navigation now works across browser and app views.",
    features: ["Browser bottom navigation"],
    fixes: [],
    changes: [],
    deploymentStatus: "deployed",
    read: false,
    email: { status: "skipped" },
  };
  await page.route("https://engine.test/releases/latest", (route) => route.fulfill({ json: { release } }));
  await page.addInitScript(() => window.localStorage.setItem("apologia-seen-release", "apologiasancta-ui:abc123"));
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/native");

  const navigation = page.getByRole("navigation", { name: "Primary navigation" });
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
  await expect(navigation.getByText("Research", { exact: true })).toHaveCount(0);
  await expect(page.locator('a[href*="github.com/DocHarry22/apologia-graph"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole("button", { name: "Show latest updates" }).click();
  await expect(page.getByRole("dialog", { name: "Responsive navigation" })).toBeVisible();
  await page.getByRole("button", { name: "Got it" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("admin route redirects when logged out", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("admin auth succeeds and logout blocks dashboard again", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel(/email/i).fill("admin@example.test");
  await page.getByLabel(/password/i).fill("wrong-password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.locator("body")).toContainText(/incorrect email or password/i);

  await page.getByLabel(/email/i).fill("admin@example.test");
  await page.getByLabel(/password/i).fill("test-author-password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin\/?$/);
  await expect(page.locator("body")).toContainText(/overview|dashboard|operations/i);

  await page.getByRole("button", { name: /log out/i }).click();
  await expect(page).toHaveURL(/\/admin\/login/);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("admin security behavior is enforced in browser context", async ({ page }) => {
  const adminRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/admin/")) {
      const token = request.headers()["x-admin-token"];
      if (token) adminRequests.push(token);
    }
  });

  await page.goto("/admin/login");
  await page.getByLabel(/email/i).fill("admin@example.test");
  await page.getByLabel(/password/i).fill("test-author-password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin\/?$/);

  const csrfMissing = await page.request.post("/api/admin/start", { data: {} });
  expect(csrfMissing.status()).toBe(403);

  const unknown = await page.request.get("/api/admin/not-real");
  expect(unknown.status()).toBe(404);

  const wrongMethod = await page.request.get("/api/admin/start");
  expect(wrongMethod.status()).toBe(405);

  expect(adminRequests).toEqual([]);
});

test("mobile does not expose raw admin token controls", async ({ page }) => {
  await page.goto("/mobile");
  await expect(page.locator("body")).not.toContainText(/x-admin-token|engine_admin_token|admin token/i);
});

test("security headers are present where practical in test server", async ({ request }) => {
  const response = await request.get("/");

  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(response.headers()["permissions-policy"]).toContain("camera=()");
});
