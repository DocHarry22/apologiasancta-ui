import { expect, test } from "@playwright/test";

test("saved research journeys remain account-owned", async ({ page }) => {
  await page.goto("/research/journeys");
  await expect(page.getByRole("heading", { name: "Saved canonical journeys" })).toBeVisible();
  await expect(page.getByText("Account required")).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", /\/login\?next=\/research\/journeys/);
});

test("learn catalogue does not invent weak concepts for signed-out users", async ({ page }) => {
  await page.goto("/learn");
  await expect(page.getByRole("heading", { name: "Learn the faith, step by step." })).toBeVisible();
  await expect(page.getByText("Review concepts your assessment evidence says need work.")).toHaveCount(0);
});

test("invalid shared journey tokens fail closed", async ({ page }) => {
  const response = await page.goto("/research/journeys/not-a-token");
  expect(response?.status()).toBe(404);
});
