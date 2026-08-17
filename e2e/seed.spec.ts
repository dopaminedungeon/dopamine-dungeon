import { test, expect } from "./auth.fixture";

test("authentication test-mode seed", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();
});
