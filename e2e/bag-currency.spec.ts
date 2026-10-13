import { expect, test } from "./auth.fixture";
import { createVerifiedUser } from "./auth-emulator";

test("spending saves the complete balance and a rejected save leaves it unchanged", async ({ page, request, expectedConsoleErrors }, testInfo) => {
  const email = `bag-spend-${Date.now()}@example.test`;
  const password = "DungeonTest42!";
  await createVerifiedUser(request, email, password);

  let savedBag = {
    currency: { pp: 1, gp: 1, ep: 0, sp: 2, cp: 4 },
    looseItems: [],
    linkedEntries: [],
  };
  let rejectNextSave = false;
  let holdNextSave = false;
  let releaseHeldSave: (() => void) | undefined;
  const saves: typeof savedBag[] = [];
  await page.route("**/api/worldbuilding?**", async (route) => {
    const url = new URL(route.request().url());
    const resource = url.searchParams.get("resource");
    if (resource === "bag") {
      if (route.request().method() === "PUT") {
        const next = route.request().postDataJSON().bag as typeof savedBag;
        saves.push(next);
        if (holdNextSave) {
          holdNextSave = false;
          await new Promise<void>((resolve) => { releaseHeldSave = resolve; });
        }
        if (rejectNextSave) {
          rejectNextSave = false;
          await route.fulfill({ status: 500, json: { ok: false, error: "Save failed" } });
          return;
        }
        savedBag = next;
      }
      await route.fulfill({ status: 200, json: { ok: true, bag: savedBag } });
      return;
    }
    if (resource === "items") {
      await route.fulfill({ status: 200, json: { ok: true, items: [] } });
      return;
    }
    if (resource === "entityLinks") {
      await route.fulfill({ status: 200, json: { ok: true, links: [] } });
      return;
    }
    await route.fulfill({ status: 200, json: { ok: true, locations: [] } });
  });

  await page.goto("/home");
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "E2E Campaign" })).toBeVisible();
  await page.goto("/pcs/bag");

  const heading = page.getByText("Adjust currency", { exact: true });
  const form = heading.locator("../../..");
  const spendButton = page.getByRole("button", { name: "Spend", exact: true });
  const checkLayout = async (width: number, error?: string) => {
    await page.setViewportSize({ width, height: 900 });
    await expect(heading).toBeVisible();
    const actions = form.getByRole("button").first().locator("..");
    const buttons = await actions.getByRole("button").all();
    expect(buttons).toHaveLength(2);
    const [formBox, headingBox, actionsBox, firstBox, secondBox] = await Promise.all([
      form.boundingBox(), heading.locator("..").boundingBox(), actions.boundingBox(),
      buttons[0].boundingBox(), buttons[1].boundingBox(),
    ]);
    expect(formBox && headingBox && actionsBox && firstBox && secondBox).toBeTruthy();
    expect(firstBox!.x + firstBox!.width).toBeLessThanOrEqual(secondBox!.x + 1);
    expect(Math.abs(firstBox!.y - secondBox!.y)).toBeLessThan(4);
    expect(actionsBox!.x).toBeGreaterThanOrEqual(formBox!.x);
    expect(actionsBox!.x + actionsBox!.width).toBeLessThanOrEqual(formBox!.x + formBox!.width + 1);
    for (const button of buttons) {
      expect(await button.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    }
    if (width === 375) expect(actionsBox!.y).toBeGreaterThanOrEqual(headingBox!.y + headingBox!.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

    if (error) {
      const alert = form.getByRole("alert").filter({ hasText: error });
      await expect(alert).toBeVisible();
      const inputs = page.getByRole("spinbutton", { name: "Platinum amount" }).locator("../..");
      const [inputsBox, alertBox] = await Promise.all([inputs.boundingBox(), alert.boundingBox()]);
      expect(inputsBox && alertBox).toBeTruthy();
      expect(alertBox!.y).toBeGreaterThanOrEqual(inputsBox!.y + inputsBox!.height);
      expect(alertBox!.width).toBeGreaterThanOrEqual(inputsBox!.width - 1);
      await form.screenshot({ path: testInfo.outputPath(`currency-${width}-${error.startsWith("Not enough") ? "insufficient" : "save-failure"}.png`) });
      if (width === 375) {
        await alert.evaluate((element) => element.scrollIntoView({ block: "center" }));
        await page.screenshot({ path: testInfo.outputPath(`currency-375-${error.startsWith("Not enough") ? "insufficient" : "save-failure"}-visible.png`) });
      }
    }
  };

  for (const width of [1280, 1440, 375]) await checkLayout(width);

  const silver = page.getByText("Silver (sp)").first().locator("../..").getByText("2", { exact: true });
  await expect(silver).toBeVisible();
  await page.getByRole("spinbutton", { name: "Silver amount" }).fill("4");
  holdNextSave = true;
  await spendButton.click();
  await expect.poll(() => saves.length).toBe(1);
  await expect(page.getByRole("button", { name: "Saving..." })).toHaveCount(2);
  for (const width of [1280, 1440, 375]) await checkLayout(width);
  releaseHeldSave?.();
  await expect.poll(() => savedBag.currency.sp).toBe(8);
  expect(savedBag.currency).toEqual({ pp: 1, gp: 0, ep: 0, sp: 8, cp: 4 });
  await page.reload();
  await expect(page.getByText("Silver (sp)").first().locator("../..").getByText("8", { exact: true })).toBeVisible();

  const saveCount = saves.length;
  await page.getByRole("spinbutton", { name: "Platinum amount" }).fill("2");
  await spendButton.click();
  await expect(page.getByText("Not enough funds in treasury. No currency was spent.")).toBeVisible();
  for (const width of [1280, 1440, 375]) await checkLayout(width, "Not enough funds in treasury. No currency was spent.");
  await expect(page.getByRole("spinbutton", { name: "Platinum amount" })).toHaveValue("2");
  expect(saves.length).toBe(saveCount);
  await page.getByRole("spinbutton", { name: "Platinum amount" }).fill("");

  rejectNextSave = true;
  expectedConsoleErrors.push("500 (Internal Server Error)");
  await page.getByRole("spinbutton", { name: "Silver amount" }).fill("2");
  await spendButton.click();
  await expect(page.getByText("Could not spend currency. Please try again.")).toBeVisible();
  for (const width of [1280, 1440, 375]) await checkLayout(width, "Could not spend currency. Please try again.");
  await expect(page.getByText("Silver (sp)").first().locator("../..").getByText("8", { exact: true })).toBeVisible();
  expect(savedBag.currency).toEqual({ pp: 1, gp: 0, ep: 0, sp: 8, cp: 4 });
  await page.reload();
  await expect(page.getByText("Silver (sp)").first().locator("../..").getByText("8", { exact: true })).toBeVisible();
});
