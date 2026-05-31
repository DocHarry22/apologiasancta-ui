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

test("author route redirects when logged out", async ({ page }) => {
  await page.goto("/author");
  await expect(page).toHaveURL(/\/author\/login/);
});

test("author auth succeeds and logout blocks dashboard again", async ({ page }) => {
  await page.goto("/author/login");
  await page.getByLabel(/password/i).fill("wrong-password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.locator("body")).toContainText(/incorrect password/i);

  await page.getByLabel(/password/i).fill("test-author-password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/author$/);
  await expect(page.locator("body")).toContainText(/overview|dashboard|operations/i);

  await page.getByRole("button", { name: /log out/i }).click();
  await expect(page).toHaveURL(/\/author\/login/);

  await page.goto("/author");
  await expect(page).toHaveURL(/\/author\/login/);
});

test("admin security behavior is enforced in browser context", async ({ page }) => {
  const adminRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/admin/")) {
      const token = request.headers()["x-admin-token"];
      if (token) adminRequests.push(token);
    }
  });

  await page.goto("/author/login");
  await page.getByLabel(/password/i).fill("test-author-password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/author$/);

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
