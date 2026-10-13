import { expect, test } from "./auth.fixture";
import { createVerifiedUser } from "./auth-emulator";

test("GM profile worth becomes an editable bag default and a failed sale can be retried", async ({ page, request, expectedConsoleErrors }, testInfo) => {
  const email = `bag-worth-${Date.now()}@example.test`;
  await createVerifiedUser(request, email, "DungeonTest42!");

  let profile = { id: "test-ring", name: "Test Ring", type: "Ring", rarity: "Common", visibility: "public", worthGp: null as number | null };
  const otherProfiles = [
    { id: "unset", name: "Very Long Item Name That Must Remain Readable On Narrow Screens", type: "Other", visibility: "public", worthGp: null },
    { id: "zero", name: "Zero Worth", type: "Other", visibility: "public", worthGp: 0 },
    { id: "hidden", name: "Hidden Worth", type: "Other", visibility: "gm-only", worthGp: 99 },
  ];
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
  let holdLinkSave = false;
  let releaseLinkSave: (() => void) | undefined;
  let bagReads = 0;
  let itemReads = 0;
  await page.route("**/api/worldbuilding?**", async (route) => {
    const url = new URL(route.request().url());
    const resource = url.searchParams.get("resource");
    const method = route.request().method();
    if (resource === "items") {
      if (method === "PUT") profile = { ...profile, ...route.request().postDataJSON().item };
      if (method === "GET") itemReads++;
      await route.fulfill({ json: url.searchParams.has("itemId")
        ? { ok: true, item: profile }
        : method === "PUT" ? { ok: true, item: profile } : { ok: true, items: [profile, ...otherProfiles] } });
      return;
    }
    if (resource === "bag") {
      if (method === "GET") bagReads++;
      if (method === "PUT") {
        if (holdLinkSave && route.request().postDataJSON().bag.linkedEntries.length > 0) {
          holdLinkSave = false;
          await new Promise<void>((resolve) => { releaseLinkSave = resolve; });
        }
        bag = route.request().postDataJSON().bag;
      }
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
        const copper = Math.round(Number(saleValueGp) * 100);
        bag = {
          ...bag,
          currency: {
            ...bag.currency,
            gp: bag.currency.gp + Math.floor(copper / 100),
            sp: bag.currency.sp + Math.floor((copper % 100) / 10),
            cp: bag.currency.cp + copper % 10,
          },
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
  await page.getByRole("button", { name: "Player", exact: true }).click();
  await page.getByRole("button", { name: "+ Link existing item" }).first().click();
  await expect(page.getByRole("button", { name: /Hidden Worth/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Zero Worth.*Worth: 0.00 gp/ })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "GM", exact: true }).click();
  await page.getByRole("button", { name: "+ Link existing item" }).first().click();
  await expect(page.getByRole("button", { name: /Very Long Item Name.*Worth: Not set/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Zero Worth.*Worth: 0.00 gp/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Test Ring.*Worth: 2.50 gp/ })).toBeVisible();
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: testInfo.outputPath(`link-normal-${width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    expect(await page.evaluate(() => {
      const backdrop = document.querySelector("body > .fixed.inset-0");
      return backdrop?.parentElement === document.body && getComputedStyle(backdrop).position === "fixed";
    })).toBe(true);
  }
  const readsBeforeLink = { bag: bagReads, items: itemReads };
  holdLinkSave = true;
  await page.getByRole("button", { name: /Test Ring.*Worth: 2.50 gp/ }).click();
  await expect(page.getByRole("button", { name: /Linking/ })).toBeDisabled();
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: testInfo.outputPath(`link-pending-${width}.png`) });
  }
  releaseLinkSave?.();
  await expect(page.getByRole("heading", { name: "Link existing Item" })).toHaveCount(0);
  expect(bagReads).toBe(readsBeforeLink.bag);
  expect(itemReads).toBe(readsBeforeLink.items);
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
  expect(bag.currency).toEqual({ pp: 0, gp: 0, ep: 0, sp: 0, cp: 4 });
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
  expect(bag.currency).toEqual({ pp: 0, gp: 4, ep: 0, sp: 2, cp: 9 });
  expect(bag.linkedEntries).toHaveLength(0);
  await page.reload();
  await expect(page.getByText("4", { exact: true }).first()).toBeVisible();
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
  expect(bag.currency).toEqual({ pp: 0, gp: 6, ep: 0, sp: 7, cp: 9 });
  expect(bag.looseItems).toHaveLength(0);
});

test("Remove stays locked through saving and does not offer a second removal after link cleanup fails", async ({ page, request, expectedConsoleErrors }, testInfo) => {
  const email = `bag-remove-${Date.now()}@example.test`;
  await createVerifiedUser(request, email, "DungeonTest42!");
  const item = { id: "linked-relic", name: "Linked Relic", type: "Other", visibility: "public", worthGp: 1.25 };
  let bag = {
    currency: { pp: 1, gp: 2, ep: 3, sp: 4, cp: 5 },
    looseItems: [{ id: "loose-rope", name: "Rope", qty: 1, worth: 0 }],
    linkedEntries: [] as { id: string; itemId: string; quantity: number; worth: number | null; sourceType: "linked" }[],
  };
  let links: { id: string; entityA: { type: string; id: string }; entityB: { type: string; id: string }; label: string; visibility: string }[] = [];
  let rejectBagSave = false;
  let holdBagSave = false;
  let releaseBagSave: (() => void) | undefined;
  let rejectLinkDelete = false;
  let bagWrites = 0;
  let linkWrites = 0;
  const linkedSaveIds: string[] = [];
  await page.route("**/api/worldbuilding?**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.searchParams.get("resource") === "items") {
      await route.fulfill({ json: { ok: true, items: [item] } });
      return;
    }
    if (url.searchParams.get("resource") === "bag") {
      if (method === "PUT") {
        bagWrites++;
        if (route.request().postDataJSON().bag.linkedEntries[0]) {
          linkedSaveIds.push(route.request().postDataJSON().bag.linkedEntries[0].id);
        }
        if (rejectBagSave) {
          rejectBagSave = false;
          await route.fulfill({ status: 500, json: { ok: false, error: "Save failed" } });
          return;
        }
        if (holdBagSave) {
          holdBagSave = false;
          await new Promise<void>((resolve) => { releaseBagSave = resolve; });
        }
        bag = route.request().postDataJSON().bag;
      }
      await route.fulfill({ json: { ok: true, bag } });
      return;
    }
    if (url.searchParams.get("resource") === "entityLinks") {
      if (method === "PUT") {
        linkWrites++;
        links = [...links, route.request().postDataJSON().link];
      }
      if (method === "DELETE") {
        if (rejectLinkDelete) {
          rejectLinkDelete = false;
          await route.fulfill({ status: 500, json: { ok: false, error: "Link delete failed" } });
          return;
        }
        links = [];
      }
      await route.fulfill({ json: { ok: true, links, link: links[links.length - 1] } });
      return;
    }
    await route.fulfill({ json: { ok: true, locations: [], sessions: [], npcs: [], lore: [], characters: [] } });
  });
  await page.route("**/api/campaign-content?**", (route) => route.fulfill({ json: { ok: true, people: [], assignments: [], characters: [] } }));
  await page.goto("/home");
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("DungeonTest42!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "E2E Campaign" })).toBeVisible();
  await page.getByRole("button", { name: "GM", exact: true }).click();
  await page.goto("/pcs/bag");

  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(page.getByRole("button", { name: "Remove only" })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`remove-normal-${width}.png`) });
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
  }

  await page.getByRole("button", { name: "Remove", exact: true }).click();
  rejectBagSave = true;
  expectedConsoleErrors.push("500 (Internal Server Error)");
  await page.getByRole("button", { name: "Remove only" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Could not remove item" })).toBeVisible();
  expect(bag.looseItems).toHaveLength(1);
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: testInfo.outputPath(`remove-error-${width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  }

  holdBagSave = true;
  const writesBefore = bagWrites;
  await page.getByRole("button", { name: "Remove only" }).click();
  await expect(page.getByRole("button", { name: "Removing..." })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Sell item" })).toBeDisabled();
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: testInfo.outputPath(`remove-pending-${width}.png`) });
  }
  await page.getByRole("button", { name: "Removing..." }).evaluate((button) => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  expect(bagWrites).toBe(writesBefore + 1);
  releaseBagSave?.();
  await expect(page.getByRole("heading", { name: "Remove or sell item" })).toHaveCount(0);
  expect(bag.looseItems).toHaveLength(0);
  expect(bagWrites).toBe(writesBefore + 1);

  await page.getByRole("button", { name: "+ Link existing item" }).first().click();
  rejectBagSave = true;
  await page.getByRole("button", { name: /Linked Relic.*Worth: 1.25 gp/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Retry to finish linking safely" })).toBeVisible();
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: testInfo.outputPath(`link-error-${width}.png`) });
  }
  expect(bag.linkedEntries).toHaveLength(0);
  expect(linkWrites).toBe(1);
  await page.getByRole("button", { name: /Linked Relic.*Worth: 1.25 gp/ }).click();
  await expect(page.getByRole("heading", { name: "Link existing Item" })).toHaveCount(0);
  expect(linkWrites).toBe(1);
  expect(bag.linkedEntries).toHaveLength(1);
  expect(linkedSaveIds).toHaveLength(2);
  expect(linkedSaveIds[1]).toBe(linkedSaveIds[0]);

  await page.getByRole("button", { name: "Remove", exact: true }).click();
  rejectLinkDelete = true;
  await page.getByRole("button", { name: "Remove only" }).click();
  await expect(page.getByRole("heading", { name: "Remove or sell item" })).toHaveCount(0);
  await expect(page.getByRole("alert").filter({ hasText: "Item removed, but its link" })).toBeVisible();
  expect(bag.linkedEntries).toHaveLength(0);
  expect(links).toHaveLength(1);
  expect(bag.currency).toEqual({ pp: 1, gp: 2, ep: 3, sp: 4, cp: 5 });
});
