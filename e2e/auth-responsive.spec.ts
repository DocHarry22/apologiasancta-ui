import { expect, test } from "@playwright/test";

// Browser layout coverage only: these checks do not certify an Android WebView,
// software keyboard, device cutout, APK installation, or Google Play review.
for (const [width, height] of [[320, 568], [360, 800], [412, 915], [768, 1024], [1024, 768], [915, 412]] as const) {
  test(`account forms fit ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.route("**/releases/latest", route => route.fulfill({ json: { release: null } }));
    await page.goto("/login");
    for (const mode of ["Sign in", "Create account"]) {
      await page.getByRole("tab", { name: mode, exact: true }).click();
      const panel = page.getByRole("tabpanel");
      await expect(panel).toBeVisible();
      await expect(panel.getByLabel("Email address", { exact: true })).toBeVisible();
      await expect(panel.getByLabel("Password", { exact: true })).toHaveAttribute("autocomplete", mode === "Sign in" ? "current-password" : "new-password");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${mode} overflow`).toBe(true);
      for (const field of await panel.locator("input").all()) {
        await field.scrollIntoViewIfNeeded();
        const bounds = await field.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
      }
      const submit = panel.locator('button[type="submit"]');
      await submit.scrollIntoViewIfNeeded();
      await expect(submit).toBeVisible();
    }
    // Resize the existing page to approximate reduced space above a keyboard.
    await page.setViewportSize({ width, height: 280 });
    const submit = page.getByRole("tabpanel").locator('button[type="submit"]');
    await submit.scrollIntoViewIfNeeded();
    await expect(submit).toBeInViewport();
  });
}
