import { expect, test } from "./auth.fixture";
import { createVerifiedUser } from "./auth-emulator";

test("financial report starts empty, records currency and sale activity, and keeps errors readable", async ({ page, request, expectedConsoleErrors }, testInfo) => {
  const email = `bag-report-${Date.now()}@example.test`;
  await createVerifiedUser(request, email, "DungeonTest42!");
  let bag = {
    currency: { pp: 1, gp: 1, ep: 0, sp: 2, cp: 4 },
    looseItems: [{ id: "rope", name: "Rope", qty: 1, worth: 1.25 }],
    linkedEntries: [],
  };
  const rows: { id: string; type: string; amountCp: number; balanceAfterCp: number; createdAt: string; actor: string }[] = [];
  let holdReport = false;
  let releaseReport: (() => void) | undefined;
  let rejectReport = false;
  const total = (coins: typeof bag.currency) => coins.pp * 1000 + coins.gp * 100 + coins.ep * 50 + coins.sp * 10 + coins.cp;
  await page.route("**/api/worldbuilding?**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.searchParams.get("resource") === "bag") {
      if (url.searchParams.get("action") === "report") {
        if (holdReport) {
          holdReport = false;
          await new Promise<void>((resolve) => { releaseReport = resolve; });
        }
        if (rejectReport) {
          rejectReport = false;
          await route.fulfill({ status: 500, json: { ok: false, error: "Report unavailable" } });
          return;
        }
        const player = route.request().headers()["x-dd-mode"] === "player";
        await route.fulfill({ json: { ok: true, transactions: rows.map((row) => ({
          ...row, actor: player ? "Campaign member" : row.actor,
        })), hasMore: false } });
        return;
      }
      if (method === "PUT") {
        const body = route.request().postDataJSON();
        const previousTotal = total(bag.currency);
        bag = body.bag;
        const difference = total(bag.currency) - previousTotal;
        if (difference) rows.unshift({ id: `record-${rows.length}`, type: body.currencyOperation?.type || "adjustment",
          amountCp: Math.abs(difference), balanceAfterCp: total(bag.currency),
          createdAt: new Date().toISOString(), actor: "A Very Long Game Master Display Name That Must Wrap" });
      }
      if (method === "POST") {
        const body = route.request().postDataJSON();
        const copper = Math.round(Number(body.saleValueGp) * 100);
        bag = { ...bag, currency: { ...bag.currency,
          gp: bag.currency.gp + Math.floor(copper / 100),
          sp: bag.currency.sp + Math.floor((copper % 100) / 10),
          cp: bag.currency.cp + copper % 10,
        }, looseItems: bag.looseItems.filter((item) => item.id !== body.entryId) };
        rows.unshift({ id: `record-${rows.length}`, type: "sale", amountCp: copper,
          balanceAfterCp: total(bag.currency), createdAt: new Date().toISOString(),
          actor: "A Very Long Game Master Display Name That Must Wrap" });
      }
      await route.fulfill({ json: { ok: true, bag } });
      return;
    }
    if (url.searchParams.get("resource") === "items") {
      await route.fulfill({ json: { ok: true, items: [] } });
      return;
    }
    if (url.searchParams.get("resource") === "entityLinks") {
      await route.fulfill({ json: { ok: true, links: [] } });
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

  holdReport = true;
  await page.getByRole("button", { name: "Financial Report" }).click();
  const report = page.getByRole("region", { name: "Financial Report" });
  await expect(report.getByRole("status")).toHaveText("Loading transactions...");
  releaseReport?.();
  await expect(report.getByText(/Recording starts with this feature/)).toBeVisible();
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await report.screenshot({ path: testInfo.outputPath(`report-empty-${width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }

  await page.getByRole("button", { name: "Financial Report" }).click();
  rejectReport = true;
  expectedConsoleErrors.push("500 (Internal Server Error)");
  await page.getByRole("button", { name: "Financial Report" }).click();
  await expect(report.getByRole("alert")).toContainText("Could not load the financial report");
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await report.screenshot({ path: testInfo.outputPath(`report-error-${width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await report.getByRole("button", { name: "Retry" }).click();
  await expect(report.getByText(/Recording starts with this feature/)).toBeVisible();

  await page.getByRole("spinbutton", { name: "Gold amount" }).fill("1");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(report.getByText("Added currency")).toBeVisible();
  await expect(report.getByText("+1.00 gp")).toBeVisible();
  await page.getByRole("spinbutton", { name: "Silver amount" }).fill("4");
  await page.getByRole("button", { name: "Spend", exact: true }).click();
  await expect(report.getByText("Spent currency")).toBeVisible();
  await expect(report.getByText("−0.40 gp")).toBeVisible();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByLabel("Total sale value (gp)").fill("27.35");
  await page.getByRole("button", { name: "Sell item" }).click();
  await expect(report.getByText("Sale proceeds")).toBeVisible();
  await expect(report.getByText("+27.35 gp")).toBeVisible();
  expect(bag.currency).toEqual({ pp: 1, gp: 28, ep: 0, sp: 11, cp: 9 });
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await report.screenshot({ path: testInfo.outputPath(`report-list-${width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Player", exact: true }).click();
  await page.getByRole("button", { name: "Financial Report" }).click();
  await expect(report.getByText("Campaign member").first()).toBeVisible();
  await expect(report.getByText("A Very Long Game Master Display Name That Must Wrap")).toHaveCount(0);
});
