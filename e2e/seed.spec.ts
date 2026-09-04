import { test, expect } from "./auth.fixture";

test("authentication test-mode seed", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("public-home")).toBeVisible();
  await expect(page.getByTestId("enter-dungeon")).toHaveAttribute("href", "/home");
});
