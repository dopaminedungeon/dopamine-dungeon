import { randomUUID } from "node:crypto";
import { test, expect } from "./auth.fixture";
import { createVerifiedUser } from "./auth-emulator";

const workspaceId = "00000000-0000-4000-8000-000000000001";
const campaignId = "00000000-0000-4000-8000-000000000002";
const longWorkspaceName = `SyntheticWorkspace${"W".repeat(100)}`;
const longCampaignName = `SyntheticCampaign${"C".repeat(100)}`;

test.use({
  apiMeResponse: {
    ok: true,
    user: { id: "e2e-user" },
    workspaces: [{ id: workspaceId, slug: "synthetic-workspace", name: longWorkspaceName }],
    workspaceMemberships: [{ workspaceId, userId: "e2e-user", role: "owner" }],
    campaigns: [{ id: campaignId, workspaceId, slug: "synthetic-campaign", name: longCampaignName, description: "Synthetic layout fixture" }],
    campaignMemberships: [{ campaignId, userId: "e2e-user", role: "gm" }],
  },
});

test("Profile Settings cards reflow within the available viewport", async ({ page, request }) => {
  const email = `layout-${randomUUID()}@example.test`;
  await createVerifiedUser(request, email, "DungeonTest42!");
  await page.goto("/settings/profile");
  await expect(page.getByRole("heading", { name: "Profile Settings" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("DungeonTest42!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Profile Settings" })).toBeVisible();

  // 640 CSS pixels also exercises the reflow available at 200% zoom on a
  // 1280-pixel-wide browser window.
  for (const width of [375, 640, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const geometry = await page.evaluate(() => {
      const main = document.querySelector("main");
      const container = main?.querySelector("h1")?.parentElement?.parentElement?.parentElement;
      const cards = [...(main?.querySelectorAll("section") || [])];
      const bounds = (element: Element | null | undefined) => element ? {
        x: Math.round(element.getBoundingClientRect().x),
        width: Math.round(element.getBoundingClientRect().width),
      } : null;
      return {
        viewport: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        mainScrollWidth: main?.scrollWidth,
        main: bounds(main),
        container: bounds(container),
        cards: cards.map((card) => ({ title: card.querySelector("h2")?.textContent, ...bounds(card) })),
        displayName: bounds(document.querySelector("#profile-display-name")),
        email: bounds(document.querySelector("#profile-email")),
        signOut: bounds([...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Sign out")),
      };
    });
    expect(geometry.scrollWidth).toBeLessThanOrEqual(width);
    expect(geometry.mainScrollWidth).toBeLessThanOrEqual(geometry.main?.width || 0);
    const account = geometry.cards.find((card) => card.title === "Account");
    const methods = geometry.cards.find((card) => card.title === "Sign-in methods");
    expect(account).toBeDefined();
    expect(methods).toBeDefined();
    if (width <= 1280) {
      expect(methods?.x).toBe(account?.x);
      expect(account?.width).toBeGreaterThan(width === 1280 ? 800 : width === 768 ? 350 : 280);
    } else {
      expect(account?.width).toBeGreaterThan(700);
      expect(methods?.width).toBeGreaterThan(450);
      expect(methods?.x).toBeGreaterThan(account?.x || 0);
    }
    if (width >= 1024) {
      expect(geometry.email?.x).toBeGreaterThan(geometry.displayName?.x || 0);
      expect(geometry.signOut?.width).toBeLessThan(240);
    } else {
      expect(geometry.email?.x).toBe(geometry.displayName?.x);
    }
  }

  await page.setViewportSize({ width: 1280, height: 900 });
  const displayName = page.getByLabel("Display name");
  const emailField = page.getByLabel("Email", { exact: true });
  await displayName.focus();
  await page.keyboard.press("Tab");
  await expect(emailField).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Save Changes" })).toBeFocused();

  let profileSaves = 0;
  await page.route("**/api/me", async (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    profileSaves += 1;
    await route.fulfill({ json: { ok: true, profile: { reducedMotion: false } } });
  });
  await displayName.fill("Synthetic Layout User");
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByText("Profile settings saved.")).toBeVisible();
  expect(profileSaves).toBe(1);

  await page.setViewportSize({ width: 375, height: 900 });
  await page.getByRole("button", { name: "Change password" }).click();
  await page.getByLabel("Current password", { exact: true }).fill("DungeonTest42!");
  await page.getByLabel("New password", { exact: true }).fill("short");
  await page.getByLabel("Confirm new password", { exact: true }).fill("different");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByRole("alert")).toHaveText("Passwords do not match.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});
