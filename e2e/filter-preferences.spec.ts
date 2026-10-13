import { expect, test } from "./auth.fixture";
import { createVerifiedUser } from "./auth-emulator";

test("all categorical filters persist by user, campaign, and selected mode", async ({ page, request, browser }) => {
  const firstEmail = `filters-${Date.now()}@example.test`;
  const secondEmail = `filters-second-${Date.now()}@example.test`;
  const npcRows = [
    { id: "synthetic-active", name: "Active Example", type: "NPC", role: "ally", status: "active", visibility: "public" },
    { id: "synthetic-missing", name: "Missing Example", type: "Monster", role: "antagonist", status: "missing", visibility: "gm-only" },
  ];
  const itemRows = [
    { id: "synthetic-weapon", name: "Training Blade", type: "Weapon", rarity: "Common", visibility: "public" },
    { id: "synthetic-potion", name: "Travel Tonic", type: "Potion", rarity: "Rare", visibility: "public" },
  ];
  const locationRows = [
    { id: "synthetic-city", name: "Sample City", category: "City", visibility: "public" },
    { id: "synthetic-dungeon", name: "Sample Dungeon", category: "Dungeon", visibility: "gm-only" },
  ];
  const loreRows = [
    { id: "synthetic-religion", name: "Sample Faith", type: "Religion", visibility: "public" },
    { id: "synthetic-faction", name: "Sample Group", type: "Faction", visibility: "gm-only" },
  ];

  await page.route("**/api/worldbuilding?**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("entity") === "npcs") {
      await route.fulfill({ status: 200, json: { ok: true, npcs: npcRows } });
      return;
    }
    if (url.searchParams.get("resource") === "items") {
      await route.fulfill({ status: 200, json: { ok: true, items: itemRows } });
      return;
    }
    if (url.searchParams.get("entity") === "locations") {
      await route.fulfill({ status: 200, json: { ok: true, locations: locationRows } });
      return;
    }
    if (url.searchParams.get("entity") === "lore") {
      await route.fulfill({ status: 200, json: { ok: true, lore: loreRows } });
      return;
    }
    if (url.searchParams.get("resource") === "sessions") {
      await route.fulfill({ status: 200, json: { ok: true, sessions: [
        { id: "synthetic-active-session", name: "Active Session", status: "active", visibility: "public" },
        { id: "synthetic-paused-session", name: "Paused Session", status: "paused", visibility: "public" },
      ] } });
      return;
    }
    if (url.searchParams.get("resource") === "bag") {
      await route.fulfill({ status: 200, json: { ok: true, bag: {
        currency: {},
        looseItems: [
          { id: "synthetic-bag-weapon", name: "Bag Blade", type: "Weapon", qty: 1 },
          { id: "synthetic-bag-potion", name: "Bag Tonic", type: "Potion", qty: 1 },
        ],
        linkedEntries: [],
      } } });
      return;
    }
    if (url.searchParams.get("resource") === "entityLinks") {
      await route.fulfill({ status: 200, json: { ok: true, links: [] } });
      return;
    }
    await route.fulfill({ status: 200, json: { ok: true, locations: [] } });
  });

  const password = "DungeonTest42!";
  await createVerifiedUser(request, firstEmail, password);
  await createVerifiedUser(request, secondEmail, password);
  const signIn = async (email: string) => {
    await page.goto("/home");
    await page.getByRole("button", { name: "Continue with email" }).click();
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
  };
  const signOut = async (email: string) => {
    const banner = page.getByRole("banner");
    await banner.getByRole("button").filter({ hasText: email }).click();
    await banner.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.getByTestId("public-home")).toBeVisible();
  };
  await signIn(firstEmail);
  await expect(page.getByRole("heading", { name: "E2E Campaign" })).toBeVisible();
  await page.getByRole("button", { name: "GM", exact: true }).click();

  await page.goto("/npcs");
  await page.getByLabel("Status").selectOption("missing");
  await page.getByLabel("Type").selectOption("Monster");
  await page.getByLabel("Role").selectOption("antagonist");
  await page.getByLabel("Visibility").selectOption("gm-only");
  await expect(page.getByText("Missing Example")).toBeVisible();
  await expect(page.getByText("Active Example")).toHaveCount(0);
  await page.goto("/home");
  await page.goto("/npcs");
  await expect(page.getByLabel("Status")).toHaveValue("missing");
  await expect(page.getByLabel("Type")).toHaveValue("Monster");
  await expect(page.getByLabel("Role")).toHaveValue("antagonist");
  await expect(page.getByLabel("Visibility")).toHaveValue("gm-only");
  await page.reload();
  await expect(page.getByLabel("Status")).toHaveValue("missing");
  await expect(page.getByText("Missing Example")).toBeVisible();
  await page.getByLabel("Status").selectOption("All");
  await page.getByLabel("Type").selectOption("All");
  await page.getByLabel("Role").selectOption("All");
  await page.getByLabel("Visibility").selectOption("All");
  await page.reload();
  await expect(page.getByLabel("Status")).toHaveValue("All");
  await expect(page.getByLabel("Type")).toHaveValue("All");
  await expect(page.getByLabel("Role")).toHaveValue("All");
  await expect(page.getByLabel("Visibility")).toHaveValue("All");

  await page.goto("/items");
  await page.getByRole("button", { name: "Potion", exact: true }).click();
  await page.locator('select:has(option[value="Legendary"])').selectOption("Rare");
  await expect(page.getByText("Travel Tonic")).toBeVisible();
  await expect(page.getByText("Training Blade")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Potion", exact: true })).toHaveClass(/bg-blue-500/);
  await expect(page.locator('select:has(option[value="Legendary"])')).toHaveValue("Rare");
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.locator('select:has(option[value="Legendary"])').selectOption("All");
  await page.reload();
  await expect(page.getByRole("button", { name: "All", exact: true })).toHaveClass(/bg-blue-500/);
  await expect(page.locator('select:has(option[value="Legendary"])')).toHaveValue("All");

  await page.goto("/maps");
  await page.getByLabel("Category").selectOption("Dungeon");
  await page.getByLabel("Visibility").selectOption("gm-only");
  await expect(page.getByText("Sample Dungeon")).toBeVisible();
  await expect(page.getByText("Sample City")).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("Category")).toHaveValue("Dungeon");
  await expect(page.getByLabel("Visibility")).toHaveValue("gm-only");
  await page.getByLabel("Category").selectOption("All");
  await page.getByLabel("Visibility").selectOption("All");
  await page.reload();
  await expect(page.getByLabel("Category")).toHaveValue("All");
  await expect(page.getByLabel("Visibility")).toHaveValue("All");

  await page.goto("/lore");
  await page.getByLabel("Type").selectOption("Faction");
  await page.getByLabel("Visibility").selectOption("gm-only");
  await expect(page.getByText("Sample Group")).toBeVisible();
  await expect(page.getByText("Sample Faith")).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("Type")).toHaveValue("Faction");
  await expect(page.getByLabel("Visibility")).toHaveValue("gm-only");
  await page.getByLabel("Type").selectOption("All");
  await page.getByLabel("Visibility").selectOption("All");
  await page.reload();
  await expect(page.getByLabel("Type")).toHaveValue("All");
  await expect(page.getByLabel("Visibility")).toHaveValue("All");

  await page.goto("/sessions");
  await page.getByRole("button", { name: "Paused", exact: true }).click();
  await expect(page.getByText("Paused Session")).toBeVisible();
  await expect(page.getByText("Active Session")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Paused", exact: true })).toHaveClass(/bg-emerald-500/);
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "All", exact: true })).toHaveClass(/bg-emerald-500/);

  await page.goto("/pcs/bag");
  await page.getByRole("button", { name: "Potion", exact: true }).click();
  await expect(page.getByText("Bag Tonic")).toBeVisible();
  await expect(page.getByText("Bag Blade")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Potion", exact: true })).toHaveClass(/bg-blue-500/);
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "All", exact: true })).toHaveClass(/bg-blue-500/);

  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((entry) => entry.startsWith("dd_filter_preferences_v1:"));
    if (!key) throw new Error("Filter preference storage key was not created");
    const document = JSON.parse(localStorage.getItem(key) || "{}");
    document.scopes[JSON.stringify(["e2e-workspace", "e2e-campaign", "player"])] = {
      npcs: { type: "Removed Type", status: "removed-status", visibility: "gm-only" },
    };
    localStorage.setItem(key, JSON.stringify(document));
  });
  await page.reload();

  await page.goto("/npcs");
  await expect(page.getByText("Missing Example")).toBeVisible();
  await page.evaluate(() => {
    const observer = new MutationObserver(() => {
      if (document.body.innerText.includes("Missing Example")) {
        (window as Window & { filter360PlayerLeak?: boolean }).filter360PlayerLeak = true;
      }
    });
    (window as Window & { filter360Observer?: MutationObserver; filter360PlayerLeak?: boolean }).filter360PlayerLeak = false;
    (window as Window & { filter360Observer?: MutationObserver }).filter360Observer = observer;
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  });
  await page.getByRole("button", { name: "Player", exact: true }).click();
  await expect(page.getByText("Missing Example")).toHaveCount(0);
  await expect(page.getByLabel("Type")).toHaveValue("All");
  await expect(page.getByLabel("Status")).toHaveValue("All");
  await expect(page.getByLabel("Visibility")).toHaveCount(0);
  expect(await page.evaluate(() => {
    const target = window as Window & { filter360Observer?: MutationObserver; filter360PlayerLeak?: boolean };
    target.filter360Observer?.disconnect();
    return target.filter360PlayerLeak;
  })).toBe(false);
  await page.getByRole("button", { name: "GM", exact: true }).click();
  await page.goto("/npcs");
  await page.getByLabel("Status").selectOption("missing");
  await page.goto("/items");
  await page.getByRole("button", { name: "Potion", exact: true }).click();

  await signOut(firstEmail);
  await signIn(secondEmail);
  await expect(page.getByRole("heading", { name: "E2E Campaign" })).toBeVisible();
  await page.getByRole("button", { name: "GM", exact: true }).click();
  await page.goto("/npcs");
  await expect(page.getByLabel("Status")).toHaveValue("All");
  await page.goto("/items");
  await expect(page.getByRole("button", { name: "All", exact: true })).toHaveClass(/bg-blue-500/);

  await signOut(secondEmail);
  await signIn(firstEmail);
  await expect(page.getByRole("heading", { name: "E2E Campaign" })).toBeVisible();
  await page.getByRole("button", { name: "GM", exact: true }).click();
  await page.goto("/npcs");
  await expect(page.getByLabel("Status")).toHaveValue("missing");
  await page.goto("/items");
  await expect(page.getByRole("button", { name: "Potion", exact: true })).toHaveClass(/bg-blue-500/);

  const storedPreference = await page.evaluate(() => Object.entries(localStorage)
    .find(([key]) => key.startsWith("dd_filter_preferences_v1:")) ?? null);
  expect(storedPreference).not.toBeNull();
  const restartedContext = await browser.newContext({ storageState: await page.context().storageState() });
  const restartedPage = await restartedContext.newPage();
  await restartedPage.goto("/");
  await expect.poll(() => restartedPage.evaluate((key) => localStorage.getItem(key), storedPreference![0]))
    .toBe(storedPreference![1]);
  await restartedContext.close();

  await page.evaluate(() => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key.startsWith("dd_filter_preferences_v1:")) throw new Error("Synthetic storage failure");
      return originalSetItem.call(this, key, value);
    };
  });
  await page.getByRole("button", { name: "Weapon", exact: true }).click();
  await expect(page.getByText("Training Blade")).toBeVisible();
  await expect(page.getByText("Travel Tonic")).toHaveCount(0);
});
