import { expect, test } from "./auth.fixture";
import { createVerifiedUser } from "./auth-emulator";

test("GM creates and edits a Quest, while Player sees only authorised narrative", async ({ page, request, expectedConsoleErrors }, testInfo) => {
  const email = `quest-${Date.now()}@example.test`;
  await createVerifiedUser(request, email, "DungeonTest42!");
  const saved: any[] = [];
  let rejectSave = false;
  let holdSave = false;
  let releaseSave: (() => void) | undefined;
  let saveCalls = 0;
  await page.route("**/api/worldbuilding?**", async (route) => {
    const url = new URL(route.request().url());
    const resource = url.searchParams.get("resource");
    if (resource === "quests") {
      const isGm = route.request().headers()["x-dd-mode"] === "gm";
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
          npcs: [{ id: "npc-1", name: "Guide" }], characters: [], items: [], locations: [] } } });
      return;
    }
    if (resource === "entityLinks") { await route.fulfill({ json: { ok: true, links: [] } }); return; }
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
  await page.getByRole("link", { name: "Create quest" }).click();
  await expect(page.getByLabel("Quest type").locator("option")).toHaveCount(7);
  await page.getByLabel("Quest name").fill("Find the long lost relic of the coast");
  await page.getByLabel("Overall visibility").selectOption("public");
  await page.getByLabel("Start session").selectOption("session-1");
  await page.getByLabel("Quest giver").selectOption("npc-1");
  await page.getByLabel("Set progress").fill("45");
  await page.getByRole("button", { name: "Add objective" }).first().click();
  await expect(page.getByLabel("Type").first().locator("option")).toHaveCount(7);
  await page.getByLabel("Description").first().fill("Find the public clue");
  await page.getByRole("button", { name: "Add objective" }).first().click();
  await page.getByLabel("Description").nth(1).fill("Hidden combat goal");
  rejectSave = true; holdSave = true;
  expectedConsoleErrors.push("500 (Internal Server Error)");
  await page.getByRole("button", { name: "Save quest" }).click();
  await expect(page.getByRole("button", { name: "Saving..." })).toBeDisabled();
  await page.getByRole("button", { name: "Saving..." }).evaluate((button: HTMLButtonElement) => button.click());
  expect(saveCalls).toBe(1);
  releaseSave?.();
  await expect(page.getByRole("alert")).toContainText("Save unavailable");
  await expect(page.getByLabel("Quest name")).toHaveValue("Find the long lost relic of the coast");
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: testInfo.outputPath(`quests-error-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await page.getByRole("button", { name: "Save quest" }).click();
  await expect(page.getByRole("heading", { name: "Find the long lost relic of the coast" })).toBeVisible();
  expect(saved).toHaveLength(1);
  await page.reload();
  await expect(page.getByText("Find the public clue")).toBeVisible();
  await expect(page.getByRole("heading", { name: "The hook" })).toHaveCount(0);
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: testInfo.outputPath(`quests-profile-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByRole("heading", { name: "The hook" })).toBeVisible();
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: testInfo.outputPath(`quests-edit-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await page.getByLabel("Status").selectOption("Completed");
  await page.getByLabel("End date").fill("2026-10-13");
  await page.getByRole("button", { name: "Save quest" }).click();
  await page.goto("/quests");
  await expect(page.getByRole("heading", { name: "Completed" })).toBeVisible();
  await page.getByLabel("Search").fill("lost relic");
  await expect(page.getByRole("link", { name: /Find the long lost relic/ })).toBeVisible();
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: testInfo.outputPath(`quests-list-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Player", exact: true }).click();
  await page.goto("/quests");
  await expect(page.getByRole("link", { name: /Find the long lost relic/ })).toBeVisible();
  await expect(page.getByText("Create quest")).toHaveCount(0);
  await page.getByRole("link", { name: /Find the long lost relic/ }).click();
  await expect(page.getByText("Hidden combat goal")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "GM", exact: true }).click();
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Overall visibility").selectOption("gm-only");
  await page.getByRole("button", { name: "Save quest" }).click();
  await page.getByRole("button", { name: "Player", exact: true }).click();
  await page.goto("/quests");
  await expect(page.getByText("No quests yet.")).toBeVisible();
});
