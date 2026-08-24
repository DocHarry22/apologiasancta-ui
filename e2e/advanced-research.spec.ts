import { expect, test } from "@playwright/test";

test("advanced public research modes load without requiring unpublished data", async ({ page }) => {
  await page.goto("/research/timeline");
  await expect(page.getByRole("heading", { name: "Timeline", exact: true })).toBeVisible();
  await expect(page.locator("body")).toContainText(/Undated records are excluded/i);

  await page.goto("/research/compare");
  await expect(page.getByRole("heading", { name: /Compare canonical claims/i })).toBeVisible();
  await expect(page.locator("body")).toContainText(/stored published relationships/i);

  await page.goto("/research/debate");
  await expect(page.getByRole("heading", { name: /Debate mode/i })).toBeVisible();
  await expect(page.locator("body")).toContainText(/does not assign a score to theological truth/i);
});

test("Knowledge Foundry remains session-protected", async ({ page }) => {
  await page.goto("/admin/knowledge");
  await expect(page).toHaveURL(/\/admin\/login/);
});
