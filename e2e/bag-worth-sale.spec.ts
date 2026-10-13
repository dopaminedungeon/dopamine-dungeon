import { expect, test } from "./auth.fixture";
import { createVerifiedUser } from "./auth-emulator";

test("GM profile worth becomes an editable bag default and a failed sale can be retried", async ({ page, request, expectedConsoleErrors }) => {
  const email = `bag-worth-${Date.now()}@example.test`;
  await createVerifiedUser(request, email, "DungeonTest42!");

  let profile = { id: "test-ring", name: "Test Ring", type: "Ring", rarity: "Common", visibility: "public", worthGp: null as number | null };
  let bag = {
    currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 4 },
    looseItems: [] as { id: string; name: string; qty: number; worth: number | null }[],
    linkedEntries: [] as { id: string; itemId: string; quantity: number; worth: number | null; sourceType: "linked" }[],
  };
  let links: unknown[] = [];
  let rejectSale = false;
  let holdSale = false;
  let releaseSale: (() => void) | undefined;
  let saleRequests = 0;
  await page.route("**/api/worldbuilding?**", async (route) => {
    const url = new URL(route.request().url());
    const resource = url.searchParams.get("resource");
    const method = route.request().method();
    if (resource === "items") {
      if (method === "PUT") profile = { ...profile, ...route.request().postDataJSON().item };
      await route.fulfill({ json: url.searchParams.has("itemId")
        ? { ok: true, item: profile }
        : method === "PUT" ? { ok: true, item: profile } : { ok: true, items: [profile] } });
      return;
    }
    if (resource === "bag") {
      if (method === "PUT") bag = route.request().postDataJSON().bag;
      if (method === "POST") {
        saleRequests++;
        if (rejectSale) {
          rejectSale = false;
          await route.fulfill({ status: 500, json: { ok: false, error: "Sale failed" } });
          return;
        }
        if (holdSale) {
          holdSale = false;
          await new Promise<void>((resolve) => { releaseSale = resolve; });
        }
        const { entryId, saleValueGp } = route.request().postDataJSON();
        bag = {
          ...bag,
          currency: { ...bag.currency, cp: bag.currency.cp + Math.round(Number(saleValueGp) * 100) },
          looseItems: bag.looseItems.filter((entry) => entry.id !== entryId),
          linkedEntries: bag.linkedEntries.filter((entry) => entry.id !== entryId),
        };
      }
      await route.fulfill({ json: { ok: true, bag } });
      return;
    }
    if (resource === "entityLinks") {
      if (method === "PUT") links = [...links, route.request().postDataJSON().link];
      if (method === "DELETE") links = [];
      await route.fulfill({ json: { ok: true, links, link: links[links.length - 1] } });
      return;
    }
    await route.fulfill({ json: { ok: true, locations: [], sessions: [], npcs: [], lore: [], characters: [] } });
  });
  await page.route("**/api/campaign-content?**", async (route) => {
    await route.fulfill({ json: { ok: true, people: [], assignments: [], characters: [] } });
  });

  await page.goto("/home");
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("DungeonTest42!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "E2E Campaign" })).toBeVisible();
  await page.getByRole("button", { name: "GM", exact: true }).click();

  await page.goto("/items/test-ring");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Worth (gp each)").fill("2.50");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("2.50 gp", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("2.50 gp", { exact: true })).toBeVisible();

  await page.goto("/pcs/bag");
  await page.getByRole("button", { name: "+ Link existing item" }).first().click();
  await page.getByRole("button", { name: /Test Ring\(Ring\)/ }).click();
  await expect(page.getByText("Worth: 2.5 gp each")).toBeVisible();
  expect(bag.linkedEntries[0].worth).toBe(2.5);

  await page.getByRole("button", { name: "Edit worth" }).click();
  await page.getByLabel("Worth (gp each) for Test Ring").fill("3.75");
  await page.getByRole("button", { name: "Save worth" }).click();
  await expect(page.getByText("Worth: 3.75 gp each")).toBeVisible();
  expect(profile.worthGp).toBe("2.50");

  await page.getByRole("button", { name: "Remove", exact: true }).click();
  const dialog = page.getByRole("heading", { name: "Remove or sell item" }).locator("..");
  const saleValue = page.getByLabel("Total sale value (gp)");
  await expect(saleValue).toHaveValue("3.75");
  await saleValue.fill("4.25");
  rejectSale = true;
  expectedConsoleErrors.push("500 (Internal Server Error)");
  await page.getByRole("button", { name: "Sell item" }).click();
  const alert = page.getByRole("alert").filter({ hasText: "Could not sell item" });
  await expect(alert).toBeVisible();
  await expect(saleValue).toHaveValue("4.25");
  expect(bag.currency.cp).toBe(4);
  expect(bag.linkedEntries).toHaveLength(1);
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    const [alertBox, valueBox, buttonBox] = await Promise.all([alert.boundingBox(), saleValue.boundingBox(), page.getByRole("button", { name: "Sell item" }).boundingBox()]);
    expect(alertBox && valueBox && buttonBox).toBeTruthy();
    expect(alertBox!.y).toBeGreaterThanOrEqual(valueBox!.y + valueBox!.height);
    expect(buttonBox!.y).toBeGreaterThanOrEqual(alertBox!.y + alertBox!.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  }
  holdSale = true;
  await page.getByRole("button", { name: "Sell item" }).click();
  await expect(page.getByRole("button", { name: "Selling..." })).toBeDisabled();
  expect(saleRequests).toBe(2);
  releaseSale?.();
  await expect(dialog).toHaveCount(0);
  expect(saleRequests).toBe(2);
  expect(bag.currency.cp).toBe(429);
  expect(bag.linkedEntries).toHaveLength(0);
  await page.reload();
  await expect(page.getByText("429", { exact: true }).first()).toBeVisible();
  await page.goto("/items/test-ring");
  await expect(page.getByText("2.50 gp", { exact: true })).toBeVisible();

  await page.goto("/pcs/bag");
  await page.getByRole("button", { name: "Add loose item" }).first().click();
  await page.getByLabel("Item", { exact: true }).fill("Rope");
  await page.getByLabel("Qty").fill("2");
  await page.getByLabel("Worth (gp each)").fill("1.25");
  await page.locator("form").getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Rope", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByLabel("Total sale value (gp)")).toHaveValue("2.50");
  await expect(page.getByText("Sale removes all 2 units from this entry.")).toBeVisible();
  await page.getByRole("button", { name: "Sell item" }).click();
  expect(bag.currency.cp).toBe(679);
  expect(bag.looseItems).toHaveLength(0);
});
