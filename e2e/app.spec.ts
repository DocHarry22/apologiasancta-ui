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
  const researchTab = navigation.getByRole("link", { name: "Research (opens in a new tab)" });
  await expect(researchTab).toHaveAttribute(
    "href",
    "https://mediumvioletred-kingfisher-797460.hostingersite.com",
  );
  await expect(researchTab).toHaveAttribute("target", "_blank");
  await expect(researchTab).toHaveAttribute("rel", "noopener noreferrer");
  await expect(page.getByRole("link", { name: "Open Research Graph (opens in a new tab)" })).toHaveAttribute(
    "href",
    "https://mediumvioletred-kingfisher-797460.hostingersite.com",
  );
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

test("authoring workflow rejects duplicate IDs, invalid submissions, and empty rejection comments", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel(/email/i).fill("admin@example.test");
  await page.getByLabel(/password/i).fill("test-author-password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin\/?$/);
  await page.goto("/admin/authoring");

  const topicId = await page.locator("select").first().locator("option").nth(1).getAttribute("value");
  expect(topicId).toBeTruthy();
  const suffix = Date.now().toString().slice(-8);
  const validQuestion = {
    id: `e2e_${suffix}`,
    topicId: topicId!,
    difficulty: 3,
    question: "Which title does John 1 use for Christ?",
    choices: { A: "The Word", B: "The temple", C: "The prophet", D: "The servant" },
    correctId: "A",
    teaching: { title: "The eternal Word", body: "John identifies Christ as the eternal Word.", refs: ["John 1:1"] },
    tags: ["christology"],
  };

  const statuses = await page.evaluate(async ({ question, invalidId }) => {
    const csrf = document.cookie.match(/(?:^|;\s*)as_csrf_token=([^;]+)/)?.[1] || "";
    const request = (body: unknown, path = "/api/workflow/items") => fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "x-csrf-token": decodeURIComponent(csrf) },
      body: JSON.stringify(body),
    });

    const created = await request({ question, status: "draft" });
    const duplicate = await request({ question, status: "draft" });
    const invalid = await request({ question: { ...question, id: invalidId, question: "" }, status: "submitted" });
    const submitted = await request({ question: { ...question, id: `${question.id}_review` }, status: "submitted" });
    const submittedBody = await submitted.json() as { item?: { id?: string } };
    const workflowId = submittedBody.item?.id || "missing";
    const rejected = await request({}, `/api/workflow/items/${encodeURIComponent(workflowId)}/reject`);
    const approved = await request({ comment: "Doctrine and references verified." }, `/api/workflow/items/${encodeURIComponent(workflowId)}/approve`);
    const publish = await request({}, `/api/workflow/items/${encodeURIComponent(workflowId)}/publish`);
    const afterFailedPublish = await fetch(`/api/workflow/items/${encodeURIComponent(workflowId)}`, { credentials: "same-origin" });
    const afterFailedPublishBody = await afterFailedPublish.json() as { item?: { status?: string } };

    return {
      created: created.status,
      duplicate: duplicate.status,
      invalid: invalid.status,
      submitted: submitted.status,
      rejected: rejected.status,
      approved: approved.status,
      publish: publish.status,
      statusAfterFailedPublish: afterFailedPublishBody.item?.status,
    };
  }, { question: validQuestion, invalidId: `e2e_invalid_${suffix}` });

  expect(statuses).toEqual({
    created: 201,
    duplicate: 409,
    invalid: 400,
    submitted: 201,
    rejected: 400,
    approved: 200,
    publish: 502,
    statusAfterFailedPublish: "approved",
  });
});

test("mobile does not expose raw admin token controls", async ({ page }) => {
  await page.goto("/mobile");
  await expect(page.locator("body")).not.toContainText(/x-admin-token|engine_admin_token|admin token/i);
});

test("switching rooms preserves and reuses the saved player identity", async ({ page }) => {
  const verificationRequests: Array<{ userId: string | null; roomId: string | null }> = [];
  const rooms = [
    { roomId: "alpha", name: "Alpha Room", isActive: true, playerCount: 2 },
    { roomId: "beta", name: "Beta Room", isActive: true, playerCount: 1 },
  ];

  await page.route("https://engine.test/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/rooms") {
      await route.fulfill({ json: { rooms } });
      return;
    }
    if (url.pathname === "/register/me") {
      verificationRequests.push({
        userId: url.searchParams.get("userId"),
        roomId: url.searchParams.get("roomId"),
      });
      await route.fulfill({
        json: {
          ok: true,
          userId: "player-1",
          username: "Thabo",
          roomId: url.searchParams.get("roomId"),
        },
      });
      return;
    }
    await route.fallback();
  });
  await page.addInitScript(() => {
    window.localStorage.setItem("userId", "player-1");
    window.localStorage.setItem("playerName", "Thabo");
    window.localStorage.setItem("selectedRoomId", "alpha");
    window.localStorage.setItem("selectedRoomName", "Alpha Room");
  });
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto("/mobile");
  await expect(page.getByRole("button", { name: /Alpha Room/ })).toBeVisible();
  await page.getByRole("button", { name: /Alpha Room/ }).click();
  await page.getByLabel("Search rooms").fill("Beta Room");
  await page.getByRole("button", { name: "Join room" }).click();

  await expect(page.getByRole("button", { name: /Beta Room/ })).toBeVisible();
  await expect.poll(() => verificationRequests).toContainEqual({ userId: "player-1", roomId: "beta" });
  await expect.poll(() => page.evaluate(() => ({
    userId: window.localStorage.getItem("userId"),
    username: window.localStorage.getItem("playerName"),
  }))).toEqual({ userId: "player-1", username: "Thabo" });
  await expect(page.getByLabel("Enter your display name")).toHaveCount(0);
});

test("security headers are present where practical in test server", async ({ request }) => {
  const response = await request.get("/");

  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(response.headers()["permissions-policy"]).toContain("camera=()");
});
