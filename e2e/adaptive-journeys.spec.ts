import { expect, test } from "@playwright/test";

test("saved research journeys remain account-owned", async ({ page }) => {
  await page.goto("/research/journeys");
  await expect(page.getByRole("heading", { name: /Keep a path/i })).toBeVisible();
  await expect(page.getByText("Account required")).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", /\/login\/?\?next=\/research\/journeys/);
});

test("learn catalogue does not invent weak concepts for signed-out users", async ({ page }) => {
  await page.goto("/learn");
  await expect(page.getByRole("heading", { name: /Know your faith/i })).toBeVisible();
  await expect(page.getByText("Review concepts your assessment evidence says need work.")).toHaveCount(0);
});

test("invalid shared journey tokens fail closed", async ({ page }) => {
  await page.goto("/research/journeys/not-a-token");
  // Next streams the shared layout with status 200 before rendering notFound().
  await expect(page.getByRole("heading", { name: /Page not found/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Canonical path" })).toHaveCount(0);
  const response = await page.request.get("/api/v1/learning/journeys/shared/not-a-token");
  expect(response.status()).toBe(400);
});
