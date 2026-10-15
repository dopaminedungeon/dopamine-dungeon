import { expect, test } from "./auth.fixture";
import { createVerifiedUser } from "./auth-emulator";

test("Quest creation modal and profile follow GM edit and Player visibility rules", async ({ page, request, expectedConsoleErrors }, testInfo) => {
  test.setTimeout(90_000);
  const email = `quest-${Date.now()}@example.test`;
  await createVerifiedUser(request, email, "DungeonTest42!");
  const saved: any[] = [];
  const links: any[] = [];
  let rejectSave = false;
  let holdSave = false;
  let releaseSave: (() => void) | undefined;
  let saveCalls = 0;
  let linkWrites = 0;
  let playerQuestResponse: any;
  const questReads: string[] = [];
  let holdPlayerRead = false;
  let releasePlayerRead: (() => void) | undefined;
  let failPlayerRead = false;
  let hidePlayerQuest = false;
  let holdPlayerListRead = false;
  let releasePlayerListRead: (() => void) | undefined;
  let sessionReads = 0;
  const documentRequests: string[] = [];
  page.on("request", (request) => { if (request.resourceType() === "document") documentRequests.push(request.url()); });
  const locations = [{ id: "location-1", name: "The destination", visibility: "public" },
    { id: "location-2", name: "The side passage", visibility: "public" },
    { id: "location-3", name: "GM hidden destination", visibility: "gm-only" },
    { id: "location-4", name: "The newer trail", visibility: "public" }];
  await page.route("**/api/worldbuilding?**", async (route) => {
    const url = new URL(route.request().url());
    const resource = url.searchParams.get("resource");
    const isGm = route.request().headers()["x-dd-mode"] === "gm";
    if (resource === "entityLinks") {
      if (route.request().method() === "PUT") {
        linkWrites++;
        const link = route.request().postDataJSON().link;
        links.push(link);
        await route.fulfill({ json: { ok: true, link } }); return;
      }
      await route.fulfill({ json: { ok: true, links: isGm ? links : links.filter((link) => link.visibility === "Player" &&
        ![link.entityA.id, link.entityB.id].includes("location-3")) } });
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
      const questId = url.searchParams.get("questId");
      questReads.push(`${isGm ? "gm" : "player"}:${questId ? "profile" : "list"}`);
      if (!questId && !isGm && holdPlayerListRead) {
        holdPlayerListRead = false;
        await new Promise<void>((resolve) => { releasePlayerListRead = resolve; });
      }
      if (questId && !isGm && holdPlayerRead) {
        holdPlayerRead = false;
        await new Promise<void>((resolve) => { releasePlayerRead = resolve; });
      }
      if (questId && !isGm && failPlayerRead) {
        failPlayerRead = false;
        await route.fulfill({ status: 500, json: { ok: false, error: "Read unavailable" } }); return;
      }
      const projected = saved.filter((quest) => isGm || quest.visibility === "public").map((quest) => {
        if (isGm) return quest;
        const { sectionVisibility, ...playerFields } = quest;
        return { ...playerFields, mainLocationId: quest.mainLocationId === "location-3" ? "" : quest.mainLocationId,
          ...(quest.mainLocationId === "location-3" ? { destinationHidden: true } : {}),
          hook: sectionVisibility.hook === "public" ? quest.hook : "",
          journey: sectionVisibility.journey === "public" ? quest.journey : "",
          mainObjectives: quest.mainObjectives.filter((entry: any) => entry.visibility === "public"),
          secondaryObjectives: quest.secondaryObjectives.filter((entry: any) => entry.visibility === "public") };
      });
      const response = { ok: true, ...(questId ? { quest: hidePlayerQuest && !isGm ? null : projected.find((quest) => quest.id === questId) || null } : { quests: projected }),
        references: { sessions: [{ id: "session-1", name: "Opening", sessionNumber: 1 }],
          npcs: [{ id: "npc-1", name: "Guide" }], items: [], locations: locations.filter((location) => isGm || location.visibility === "public") } };
      if (!isGm) playerQuestResponse = response;
      await route.fulfill({ json: response });
      return;
    }
    if (resource === "sessions") {
      sessionReads++;
      await route.fulfill({ json: { ok: true, sessions: [{ id: "session-1", name: "Opening", visibility: "public", summary: "Public session recap", gmNotes: "Private session prep" }] } });
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
  await page.goto("/sessions/session-1");
  await expect(page.getByRole("heading", { name: "Opening" })).toBeVisible();
  const sessionReadsBeforeModes = sessionReads;
  const documentsBeforeSessionModes = documentRequests.length;
  await page.getByRole("button", { name: "Player", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Opening" })).toBeVisible();
  await expect(page.getByText("Loading session...")).toHaveCount(0);
  await page.getByRole("button", { name: "GM", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Opening" })).toBeVisible();
  expect(sessionReads).toBe(sessionReadsBeforeModes);
  expect(documentRequests).toHaveLength(documentsBeforeSessionModes);
  await page.goto("/npcs");
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByPlaceholder("Search NPCs...")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`npc-reference-filters-${width}.png`), fullPage: true });
  }
  await page.goto("/quests");
  await expect(page.getByText("No quests yet.")).toBeVisible();
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: testInfo.outputPath(`quest-list-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const search = await page.getByLabel("Search quests").boundingBox();
    const status = await page.getByLabel("Filter quest status").boundingBox();
    const add = await page.getByRole("button", { name: "Add new" }).boundingBox();
    expect(search && status && status.y >= search.y + search.height).toBe(true);
    if (width === 1440) expect(search && add && Math.abs(add.y - search.y) < 10).toBe(true);
    else expect(search && add && add.y > search.y + search.height).toBe(true);
    for (const name of ["Status", "Type", "Visibility"]) {
      const control = page.getByLabel(`Filter quest ${name.toLowerCase()}`);
      await expect(control).toBeVisible();
      expect(await control.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    }
    if (width === 375) {
      expect(search?.y).toBeGreaterThanOrEqual(95);
      expect(search?.width).toBeGreaterThan(260);
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
  await expect(dialog.getByLabel("Destination")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Save quest" })).toBeVisible();
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
  const questCard = page.getByRole("link", { name: "Open quest Find the long lost relic of the coast" });
  await expect(questCard).toBeVisible();
  await expect(questCard).toContainText("Start: Opening");
  await expect(questCard).toContainText("Giver: Guide");
  await expect(questCard.locator("a")).toHaveCount(0);
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: testInfo.outputPath(`quest-populated-list-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  expect(new URL(page.url()).pathname).toBe("/quests");
  expect(saved).toHaveLength(1);
  links.push({ id: "legacy-location-link", entityA: { type: "Quest", id: saved[0].id },
    entityB: { type: "Map", id: "location-2" }, label: "takes_place_in", visibility: "Player" });
  await page.getByLabel("Search quests").fill("no matching quest");
  await expect(page.getByText("No quests match these filters.")).toBeVisible();
  await page.getByLabel("Search quests").clear();
  await page.getByLabel("Filter quest status").selectOption("Active");
  await expect(page.getByText("No quests match these filters.")).toBeVisible();
  await page.getByLabel("Filter quest status").selectOption("Planned");
  await expect(questCard).toBeVisible();
  await page.getByLabel("Filter quest type").selectOption("combat");
  await expect(page.getByText("No quests match these filters.")).toBeVisible();
  await page.getByLabel("Filter quest type").selectOption("fetch");
  await page.getByLabel("Filter quest visibility").selectOption("gm-only");
  await expect(page.getByText("No quests match these filters.")).toBeVisible();
  await page.getByLabel("Filter quest visibility").selectOption("public");
  await expect(questCard).toBeVisible();
  await questCard.focus();
  await expect(questCard).toBeFocused();
  await questCard.press("Enter");
  await expect(page).toHaveURL(/\/quests\/[^/]+$/);
  await expect(page.getByText("A visible summary for the whole party.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Destination", exact: true })).toBeVisible();
  await expect(page.locator("header").getByRole("link", { name: "Opening" })).toHaveCount(0);
  await expect(page.locator("header").getByRole("link", { name: "Guide" })).toHaveCount(0);
  const primarySection = (title: string) => page.locator("section").filter({ has: page.getByRole("heading", { name: title, exact: true }) }).last();
  await expect(primarySection("Start session").getByRole("link", { name: "Opening" })).toHaveAttribute("href", "/sessions/session-1");
  await expect(primarySection("Quest giver").getByRole("link", { name: "Guide" })).toHaveAttribute("href", "/npcs/npc-1");
  await expect(primarySection("Destination").getByText("Not set")).toBeVisible();
  await expect(page.getByText("Main objective")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add Location" })).toHaveCount(0);
  await page.getByRole("button", { name: "Edit" }).click();
  const profileHeader = page.locator("main.app-page-wide header");
  await expect(profileHeader.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expect(profileHeader.getByRole("button", { name: "Save quest" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save quest" })).toHaveCount(1);
  expect(saveCalls).toBe(2);
  await page.getByLabel("Quest name").fill("Unsaved quest title");
  await profileHeader.getByLabel("Status").selectOption("Active");
  await page.getByLabel("The hook", { exact: true }).fill("An unsaved first line");
  await page.getByLabel("The hook", { exact: true }).press("Enter");
  await page.getByLabel("The hook", { exact: true }).type("and a second line");
  await primarySection("Start session").getByLabel("Start session").selectOption("");
  await primarySection("Quest giver").getByLabel("Quest giver").selectOption("");
  await page.getByLabel("Destination").selectOption("location-1");
  await page.getByRole("button", { name: "Add Location" }).click();
  await expect(page.getByLabel("Relationship", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(profileHeader.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expect(page.getByLabel("The hook", { exact: true })).toHaveValue("An unsaved first line\nand a second line");
  expect(saveCalls).toBe(2);
  expect(linkWrites).toBe(0);
  await profileHeader.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Destination:")).toHaveCount(0);
  await expect(primarySection("Destination").getByText("Not set")).toBeVisible();
  expect(saveCalls).toBe(2);
  expect(linkWrites).toBe(0);
  await profileHeader.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByLabel("Quest name")).toHaveValue("Find the long lost relic of the coast");
  await expect(profileHeader.getByLabel("Status")).toHaveValue("Planned");
  await expect(page.getByLabel("The hook", { exact: true })).toHaveValue("");
  await expect(primarySection("Start session").getByLabel("Start session")).toHaveValue("session-1");
  await expect(primarySection("Quest giver").getByLabel("Quest giver")).toHaveValue("npc-1");
  await expect(page.getByLabel("Destination")).toHaveValue("");
  await expect(page.getByRole("heading", { name: "Main objective" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add main objective" })).toHaveCount(0);
  await expect(page.locator("section").filter({ has: page.getByRole("heading", { name: "Main objective", exact: true }) }).getByRole("button", { name: "Remove" })).toHaveCount(0);
  await expect(page.getByLabel("Main objective visibility 1")).toHaveCount(1);
  await page.getByLabel("Destination").selectOption("location-1");
  for (const label of ["Session", "NPC", "Item", "Location"]) {
    await page.getByRole("button", { name: `Add ${label}` }).click();
    await expect(page.getByLabel("Relationship", { exact: true }).locator("option")).toHaveText(["Related"]);
    await page.getByRole("button", { name: "Close" }).click();
  }
  await expect(page.getByRole("link", { name: "The side passage" })).toBeVisible();
  await expect(page.getByText("takes place in")).toBeVisible();
  await page.getByRole("button", { name: "Add Location" }).click();
  await expect(page.getByRole("button", { name: "The side passage" })).toHaveCount(0);
  await page.getByRole("button", { name: "The newer trail" }).click();
  await page.locator("section").filter({ has: page.getByRole("heading", { name: "Main objective", exact: true }) }).getByLabel("Description").fill("Find the hidden clue");
  await page.getByLabel("Main objective visibility 1").selectOption("gm-only");
  await page.getByRole("button", { name: "Add secondary objective" }).click();
  await page.locator("section").filter({ has: page.getByRole("heading", { name: "Secondary / bonus objectives" }) }).getByLabel("Description").fill("Find the public clue");
  await page.getByLabel("Secondary objective visibility 1").selectOption("public");
  const progressSlider = profileHeader.getByRole("slider", { name: "Set progress" });
  await expect(progressSlider).toHaveCount(1);
  await expect(profileHeader.getByRole("progressbar")).toHaveCount(0);
  expect(await progressSlider.evaluate((element) => Math.round(element.getBoundingClientRect().height))).toBe(12);
  await progressSlider.focus();
  await progressSlider.press("End");
  await expect(progressSlider).toHaveValue("100");
  await progressSlider.press("ArrowLeft");
  await expect(progressSlider).toHaveValue("99");
  await progressSlider.fill("45");
  expect(saveCalls).toBe(2);
  rejectSave = true;
  expectedConsoleErrors.push("500 (Internal Server Error)");
  await profileHeader.getByRole("button", { name: "Save quest" }).click();
  await expect(profileHeader.getByRole("alert")).toContainText("Save unavailable");
  await expect(page.getByLabel("Destination")).toHaveValue("location-1");
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: testInfo.outputPath(`quest-edit-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await profileHeader.getByRole("button", { name: "Save quest" }).click();
  await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Find the hidden clue")).toBeVisible();
  await expect(page.getByRole("link", { name: "The side passage" })).toBeVisible();
  await expect(page.getByRole("link", { name: "The newer trail" })).toBeVisible();
  await expect(page.getByText("takes place in")).toBeVisible();
  await expect(page.getByText("The destination")).toBeVisible();
  await expect(primarySection("Destination").getByRole("link", { name: "The destination" })).toHaveAttribute("href", "/maps/location-1");
  await expect(page.locator("header").getByText("The destination")).toHaveCount(0);
  await expect(page.getByLabel("Quest progress 45%")).toBeVisible();
  await expect(profileHeader.getByRole("progressbar")).toHaveCount(1);
  await expect(profileHeader.getByRole("slider")).toHaveCount(0);
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: testInfo.outputPath(`quest-read-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const [title, name, pathname] of [["Start session", "Opening", "/sessions/session-1"],
    ["Quest giver", "Guide", "/npcs/npc-1"], ["Destination", "The destination", "/maps/location-1"]] as const) {
    await primarySection(title).getByRole("link", { name }).click();
    await expect(page).toHaveURL(new RegExp(`${pathname}$`));
    await page.goBack();
    await expect(page.getByRole("heading", { name: "Find the long lost relic of the coast" })).toBeVisible();
  }
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Destination").selectOption("location-3");
  await profileHeader.getByRole("button", { name: "Save quest" }).click();
  await expect(page.getByText("GM hidden destination")).toBeVisible();
  saved[0] = { ...saved[0], hook: "GM secret hook", journey: "A public journey",
    sectionVisibility: { ...saved[0].sectionVisibility, hook: "gm-only", journey: "public" } };
  await page.getByRole("button", { name: "Player", exact: true }).click();
  await page.goto("/quests");
  await expect(questCard).toBeVisible();
  await expect(page.getByText("Destination: Unknown")).toBeVisible();
  await expect(questCard).toContainText("Destination: Unknown");
  await expect(questCard.locator("a")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add new" })).toHaveCount(0);
  await expect(page.getByLabel("Filter quest visibility")).toHaveCount(0);
  await questCard.click();
  await expect(page.getByText("Destination: Unknown")).toBeVisible();
  await expect(primarySection("Destination").getByRole("link")).toHaveCount(0);
  await primarySection("Start session").getByRole("link", { name: "Opening" }).click();
  await expect(page).toHaveURL(/\/sessions\/session-1$/);
  await page.goBack();
  await expect(page.getByText("Destination: Unknown")).toBeVisible();
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: testInfo.outputPath(`quest-player-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  expect(JSON.stringify(playerQuestResponse)).not.toContain("location-3");
  expect(JSON.stringify(playerQuestResponse)).not.toContain("GM hidden destination");
  await expect(page.getByRole("link", { name: "GM hidden destination" })).toHaveCount(0);
  await expect(page.getByText("Find the hidden clue")).toHaveCount(0);
  await expect(page.getByText("Find the public clue")).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
  await page.getByRole("button", { name: "GM", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Find the long lost relic of the coast" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
  await expect(page.getByText("GM secret hook")).toBeVisible();
  const documentsBeforeQuestModes = documentRequests.length;
  for (const mode of ["Player", "GM", "Player", "GM"]) {
    await page.getByRole("button", { name: mode, exact: true }).click();
    await expect(page.getByText(mode === "Player" ? "Destination: Unknown" : "GM secret hook")).toBeVisible();
    if (mode === "Player") await expect(page.getByText("GM secret hook")).toHaveCount(0);
  }
  expect(documentRequests).toHaveLength(documentsBeforeQuestModes);
  const writesBeforeModeDraft = saveCalls;
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Quest name").fill("Uncommitted mode draft");
  await page.getByRole("button", { name: "Player", exact: true }).click();
  await expect(page.getByText("Uncommitted mode draft")).toHaveCount(0);
  await expect(page.getByText("Destination: Unknown")).toBeVisible();
  await page.getByRole("button", { name: "GM", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Find the long lost relic of the coast" })).toBeVisible();
  expect(saveCalls).toBe(writesBeforeModeDraft);
  holdPlayerRead = true;
  const priorPlayerReads = questReads.filter((entry) => entry === "player:profile").length;
  await page.getByRole("button", { name: "Player", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Loading quest");
  await expect(page.getByText("GM secret hook")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("quest-mode-transition-profile.png"), fullPage: true });
  await expect.poll(() => questReads.filter((entry) => entry === "player:profile").length).toBe(priorPlayerReads + 1);
  await page.getByRole("button", { name: "GM", exact: true }).click();
  await expect(page.getByText("GM secret hook")).toBeVisible();
  const latePlayerResponse = page.waitForResponse((response) => response.url().includes("resource=quests") &&
    response.url().includes("questId=") && response.request().headers()["x-dd-mode"] === "player");
  releasePlayerRead?.();
  await latePlayerResponse;
  await expect(page.getByText("GM secret hook")).toBeVisible();
  failPlayerRead = true;
  expectedConsoleErrors.push("500 (Internal Server Error)");
  await page.getByRole("button", { name: "Player", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Could not load this quest");
  await expect(page.getByText("GM secret hook")).toHaveCount(0);
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("Destination: Unknown")).toBeVisible();
  hidePlayerQuest = true;
  await page.getByRole("button", { name: "GM", exact: true }).click();
  await expect(page.getByText("GM secret hook")).toBeVisible();
  await page.getByRole("button", { name: "Player", exact: true }).click();
  await expect(page.getByText("Quest not available in this mode.")).toBeVisible();
  await expect(page.getByText("GM secret hook")).toHaveCount(0);
  hidePlayerQuest = false;
  saved.push({ ...saved[0], id: "gm-secret-quest", name: "GM secret quest", visibility: "gm-only" });
  await page.getByRole("button", { name: "GM", exact: true }).click();
  await page.goto("/quests");
  await expect(page.getByRole("link", { name: "Open quest GM secret quest" })).toBeVisible();
  holdPlayerListRead = true;
  const documentsBeforeListModes = documentRequests.length;
  await page.getByRole("button", { name: "Player", exact: true }).click();
  await expect(page.getByLabel("Search quests")).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Loading quests");
  await expect(page.getByRole("link", { name: "Open quest GM secret quest" })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("quest-mode-transition-list.png"), fullPage: true });
  await page.getByRole("button", { name: "GM", exact: true }).click();
  await expect(page.getByRole("link", { name: "Open quest GM secret quest" })).toBeVisible();
  const latePlayerListResponse = page.waitForResponse((response) => response.url().includes("resource=quests") &&
    !response.url().includes("questId=") && response.request().headers()["x-dd-mode"] === "player");
  releasePlayerListRead?.();
  await latePlayerListResponse;
  await expect(page.getByRole("link", { name: "Open quest GM secret quest" })).toBeVisible();
  await page.getByRole("button", { name: "Player", exact: true }).click();
  await expect(questCard).toBeVisible();
  await expect(page.getByRole("link", { name: "Open quest GM secret quest" })).toHaveCount(0);
  expect(documentRequests).toHaveLength(documentsBeforeListModes);
  await testInfo.attach("quest-mode-reads", { body: questReads.join("\n"), contentType: "text/plain" });
});
