import { expect, test } from "./auth.fixture";
import { createVerifiedUser } from "./auth-emulator";

test("Quest creation modal and profile follow GM edit and Player visibility rules", async ({ page, request, expectedConsoleErrors }, testInfo) => {
  const email = `quest-${Date.now()}@example.test`;
  await createVerifiedUser(request, email, "DungeonTest42!");
  const saved: any[] = [];
  const links: any[] = [];
  let rejectSave = false;
  let holdSave = false;
  let releaseSave: (() => void) | undefined;
  let saveCalls = 0;
  await page.route("**/api/worldbuilding?**", async (route) => {
    const url = new URL(route.request().url());
    const resource = url.searchParams.get("resource");
    const isGm = route.request().headers()["x-dd-mode"] === "gm";
    if (resource === "entityLinks") {
      if (route.request().method() === "PUT") {
        const link = route.request().postDataJSON().link;
        links.push(link);
        await route.fulfill({ json: { ok: true, link } }); return;
      }
      await route.fulfill({ json: { ok: true, links: isGm ? links : links.filter((link) => link.visibility === "Player") } });
      return;
    }
    if (resource === "quests") {
      if (route.request().method() === "PUT") {
        saveCalls++;
        if (holdSave) { holdSave = false; await new Promise<void>((resolve) => { releaseSave = resolve; }); }
        if (rejectSave) { rejectSave = false; await route.fulfill({ status: 500, json: { ok: false, error: "Save unavailable" } }); return; }
        const quest = route.request().postDataJSON().quest;
        const index = saved.findIndex((entry) => entry.id === quest.id);
        if (index < 0) saved.push(quest); else saved[index] = quest;
        await route.fulfill({ json: { ok: true, quest } }); return;
      }
      const projected = saved.filter((quest) => isGm || quest.visibility === "public").map((quest) => isGm ? quest : {
        ...quest, hook: "", mainObjectives: quest.mainObjectives.filter((entry: any) => entry.visibility === "public"),
        secondaryObjectives: quest.secondaryObjectives.filter((entry: any) => entry.visibility === "public"),
      });
      const questId = url.searchParams.get("questId");
      await route.fulfill({ json: { ok: true, ...(questId ? { quest: projected.find((quest) => quest.id === questId) || null } : { quests: projected }),
        references: { sessions: [{ id: "session-1", name: "Opening", sessionNumber: 1 }],
          npcs: [{ id: "npc-1", name: "Guide" }], items: [], locations: isGm ? [
            { id: "location-1", name: "The destination" }, { id: "location-2", name: "The side passage" },
          ] : [{ id: "location-1", name: "The destination" }, { id: "location-2", name: "The side passage" }] } } });
      return;
    }
    await route.fulfill({ json: { ok: true, items: [], sessions: [], npcs: [], locations: [], lore: [], characters: [] } });
  });
  await page.route("**/api/campaign-content?**", (route) => route.fulfill({ json: { ok: true, people: [], assignments: [], characters: [] } }));
  await page.goto("/home");
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("DungeonTest42!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "E2E Campaign" })).toBeVisible();
  await page.getByRole("button", { name: "GM", exact: true }).click();
  await page.goto("/quests");
  await expect(page.getByText("No quests yet.")).toBeVisible();
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: testInfo.outputPath(`quest-list-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const search = await page.getByLabel("Search quests").boundingBox();
    const status = await page.getByRole("button", { name: "All", exact: true }).boundingBox();
    expect(search && status && status.y >= search.y && status.y - search.y < 100).toBe(true);
    if (width === 375) {
      expect(search?.y).toBeGreaterThanOrEqual(95);
      expect(search?.width).toBeGreaterThan(300);
      expect(search?.height).toBeGreaterThan(40);
      expect(await page.getByLabel("Search quests").evaluate((input) => {
        const box = input.getBoundingClientRect();
        return document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2) === input;
      })).toBe(true);
    }
  }
  await page.getByRole("button", { name: "Add new" }).click();
  const dialog = page.getByRole("dialog", { name: "Create a quest" });
  await expect(dialog).toBeVisible();
  await expect(page.getByText("No quests yet.")).toBeVisible();
  await expect(dialog.getByLabel("Quest name")).toBeFocused();
  expect(await page.evaluate(() => document.elementFromPoint(5, 5)?.getAttribute("data-testid"))).toBe("quest-modal-backdrop");
  await expect(dialog.getByText("The hook")).toHaveCount(0);
  await expect(dialog.getByText("Main objective")).toHaveCount(0);
  await expect(dialog.getByText("Quest receivers")).toHaveCount(0);
  await expect(dialog.getByText("Short description visibility")).toHaveCount(0);
  await expect(dialog.getByLabel("Quest type").locator("option")).toHaveCount(7);
  await page.setViewportSize({ width: 375, height: 600 });
  expect(await dialog.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await dialog.getByRole("button", { name: "Cancel" }).scrollIntoViewIfNeeded();
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 900 });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(saveCalls).toBe(0);
  await page.getByRole("button", { name: "Add new" }).click();
  await dialog.getByLabel("Quest name").fill("Find the long lost relic of the coast");
  await dialog.getByLabel("Overall visibility").selectOption("public");
  await dialog.getByLabel("Short description").fill("A visible summary for the whole party.");
  await dialog.getByLabel("Start session").selectOption("session-1");
  await dialog.getByLabel("Quest giver").selectOption("npc-1");
  rejectSave = true; holdSave = true;
  expectedConsoleErrors.push("500 (Internal Server Error)");
  await dialog.getByRole("button", { name: "Save quest" }).click();
  await expect(dialog.getByRole("button", { name: "Saving..." })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath("quest-create-pending-375.png"), fullPage: true });
  await dialog.getByRole("button", { name: "Saving..." }).evaluate((button: HTMLButtonElement) => button.click());
  expect(saveCalls).toBe(1);
  releaseSave?.();
  await expect(dialog.getByRole("alert")).toContainText("Save unavailable");
  await expect(dialog.getByLabel("Quest name")).toHaveValue("Find the long lost relic of the coast");
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: testInfo.outputPath(`quest-create-error-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await dialog.getByRole("button", { name: "Save quest" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Find the long lost relic of the coast" })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/quests");
  expect(saved).toHaveLength(1);
  await page.getByLabel("Search quests").fill("no matching quest");
  await expect(page.getByText("No quests match these filters.")).toBeVisible();
  await page.getByLabel("Search quests").clear();
  await page.getByRole("button", { name: "Active", exact: true }).click();
  await expect(page.getByText("No quests match these filters.")).toBeVisible();
  await page.getByRole("button", { name: "Planned", exact: true }).click();
  await expect(page.getByRole("link", { name: "Find the long lost relic of the coast" })).toBeVisible();
  await page.getByRole("link", { name: "Find the long lost relic of the coast" }).click();
  await expect(page.getByText("A visible summary for the whole party.")).toBeVisible();
  await expect(page.getByText("Main objective")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add Location" })).toHaveCount(0);
  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByRole("heading", { name: "Main objective" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add main objective" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Remove" })).toHaveCount(0);
  await expect(page.getByLabel("Main objective visibility 1")).toHaveCount(1);
  await page.getByLabel("Main location").selectOption("location-1");
  await page.getByRole("button", { name: "Add Location" }).click();
  await page.getByRole("button", { name: "The side passage" }).click();
  await page.locator("section").filter({ has: page.getByRole("heading", { name: "Main objective", exact: true }) }).getByLabel("Description").fill("Find the hidden clue");
  await page.getByLabel("Main objective visibility 1").selectOption("gm-only");
  await page.getByRole("button", { name: "Add secondary objective" }).click();
  await page.locator("section").filter({ has: page.getByRole("heading", { name: "Secondary / bonus objectives" }) }).getByLabel("Description").fill("Find the public clue");
  await page.getByLabel("Secondary objective visibility 1").selectOption("public");
  await page.getByLabel("Set progress").fill("45");
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: testInfo.outputPath(`quest-edit-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await page.getByRole("button", { name: "Save quest" }).click();
  await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Find the hidden clue")).toBeVisible();
  await expect(page.getByText("The side passage")).toBeVisible();
  await expect(page.getByText("The destination")).toBeVisible();
  await expect(page.getByLabel("Quest progress 45%")).toBeVisible();
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: testInfo.outputPath(`quest-read-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Player", exact: true }).click();
  await page.goto("/quests");
  await expect(page.getByRole("link", { name: "Find the long lost relic of the coast" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add new" })).toHaveCount(0);
  await page.getByRole("link", { name: "Find the long lost relic of the coast" }).click();
  await expect(page.getByText("Find the hidden clue")).toHaveCount(0);
  await expect(page.getByText("Find the public clue")).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
});
