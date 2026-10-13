import { expect, test } from "./auth.fixture";
import { createVerifiedUser } from "./auth-emulator";

test("spending saves the complete balance and a rejected save leaves it unchanged", async ({ page, request, expectedConsoleErrors }) => {
  const email = `bag-spend-${Date.now()}@example.test`;
  const password = "DungeonTest42!";
  await createVerifiedUser(request, email, password);

  let savedBag = {
    currency: { pp: 1, gp: 1, ep: 0, sp: 2, cp: 4 },
    looseItems: [],
    linkedEntries: [],
  };
  let rejectNextSave = false;
  const saves: typeof savedBag[] = [];
  await page.route("**/api/worldbuilding?**", async (route) => {
    const url = new URL(route.request().url());
    const resource = url.searchParams.get("resource");
    if (resource === "bag") {
      if (route.request().method() === "PUT") {
        const next = route.request().postDataJSON().bag as typeof savedBag;
        saves.push(next);
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

  const silver = page.getByText("Silver (sp)").first().locator("../..").getByText("2", { exact: true });
  await expect(silver).toBeVisible();
  await page.getByRole("spinbutton", { name: "Silver amount" }).fill("4");
  await page.getByRole("button", { name: "Spend", exact: true }).click();
  await expect.poll(() => saves.length).toBe(1);
  expect(savedBag.currency).toEqual({ pp: 1, gp: 0, ep: 0, sp: 8, cp: 4 });
  await page.reload();
  await expect(page.getByText("Silver (sp)").first().locator("../..").getByText("8", { exact: true })).toBeVisible();

  const saveCount = saves.length;
  await page.getByRole("spinbutton", { name: "Platinum amount" }).fill("2");
  await page.getByRole("button", { name: "Spend", exact: true }).click();
  await expect(page.getByText("Not enough funds in treasury. No currency was spent.")).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: "Platinum amount" })).toHaveValue("2");
  expect(saves.length).toBe(saveCount);
  await page.getByRole("spinbutton", { name: "Platinum amount" }).fill("");

  rejectNextSave = true;
  expectedConsoleErrors.push("500 (Internal Server Error)");
  await page.getByRole("spinbutton", { name: "Silver amount" }).fill("2");
  await page.getByRole("button", { name: "Spend", exact: true }).click();
  await expect(page.getByText("Could not spend currency. Please try again.")).toBeVisible();
  await expect(page.getByText("Silver (sp)").first().locator("../..").getByText("8", { exact: true })).toBeVisible();
  expect(savedBag.currency).toEqual({ pp: 1, gp: 0, ep: 0, sp: 8, cp: 4 });
  await page.reload();
  await expect(page.getByText("Silver (sp)").first().locator("../..").getByText("8", { exact: true })).toBeVisible();
});
