import { randomUUID } from "node:crypto";
import { test, expect } from "./auth.fixture";
import { createVerifiedUser, lookupAuthEmulatorAccount } from "./auth-emulator";

const npc = { id: "archivist", name: "Archivist", visibility: "public", type: "NPC", status: "active" };
const harbor = { id: "harbor", name: "Harbor", aliases: ["Safe Haven"], visibility: "public", category: "District" };
const lookout = { id: "lookout", name: "Lookout", aliases: ["North Watch"], visibility: "public", category: "Landmark" };
const hidden = { id: "hidden-vault", name: "Hidden Vault", aliases: ["Secret Hold"], visibility: "gm-only", category: "Dungeon" };
const visibleQuest = { id: "coastal-quest", name: "Coastal lead", type: "discovery", status: "Planned", visibility: "public", progress: 20,
  startSessionId: "quest-session", endSessionId: "", endDate: "", giverId: npc.id, mainLocationId: harbor.id,
  shortDescription: "Follow the coast.", hook: "", journey: "", aftermath: "", sectionVisibility: {}, mainObjectives: [], secondaryObjectives: [] };
const privateLinkQuest = { id: "private-link-quest", name: "Private trail", visibility: "public" };
const hiddenQuest = { id: "secret-quest", name: "Secret lead", visibility: "gm-only" };
const questItem = { id: "quest-item", name: "Coastal token", type: "Tool", rarity: "common", visibility: "public", description: "A marked token.", stats: {} };
const questSession = { id: "quest-session", name: "Coastal opening", title: "Coastal opening", status: "planned", visibility: "public", description: "The coast is in view." };

test("Location and NPC profiles share one link and NPC search keeps linked name and alias matches", async ({ page, request, expectedConsoleErrors }, testInfo) => {
  test.setTimeout(90_000);
  let links = [
    { id: "link-harbor", entityA: { type: "Map", id: harbor.id }, entityB: { type: "NPC", id: npc.id }, label: "controls", visibility: "Player" },
    { id: "link-hidden", entityA: { type: "Map", id: hidden.id }, entityB: { type: "NPC", id: npc.id }, label: "connected", visibility: "GM" },
    { id: `quest-main-location:${visibleQuest.id}:${harbor.id}`, entityA: { type: "Quest", id: visibleQuest.id }, entityB: { type: "Map", id: harbor.id }, label: "leads_to", visibility: "Player" },
    { id: "quest-gm-link", entityA: { type: "Quest", id: privateLinkQuest.id }, entityB: { type: "Map", id: harbor.id }, label: "related", visibility: "GM" },
    { id: "hidden-quest-link", entityA: { type: "Quest", id: hiddenQuest.id }, entityB: { type: "Map", id: harbor.id }, label: "related", visibility: "Player" },
    { id: `quest-hero:${visibleQuest.id}:NPC:${npc.id}:given_by`, entityA: { type: "Quest", id: visibleQuest.id }, entityB: { type: "NPC", id: npc.id }, label: "given_by", visibility: "Player" },
    { id: "quest-item-link", entityA: { type: "Quest", id: visibleQuest.id }, entityB: { type: "Item", id: questItem.id }, label: "related", visibility: "Player" },
    { id: `quest-hero:${visibleQuest.id}:Session:${questSession.id}:started`, entityA: { type: "Quest", id: visibleQuest.id }, entityB: { type: "Session", id: questSession.id }, label: "started", visibility: "Player" },
  ];
  const writes: string[] = [];
  let rejectNextGenericWrite = false;
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));

  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const mode = route.request().headers()["x-dd-mode"];
    const method = route.request().method();
    const authorization = route.request().headers().authorization;

    if (url.pathname === "/api/auth/identity-continuity") {
      expect(authorization).toMatch(/^Bearer /);
      expect(mode).toBeUndefined();
      const account = await lookupAuthEmulatorAccount(request, authorization!.slice("Bearer ".length));
      expect(account.emailVerified).toBe(true);
      await route.fulfill({ json: { ok: true, neonUserId: "e2e-user" } });
      return;
    }

    if (url.pathname === "/api/me") {
      expect(authorization).toMatch(/^Bearer /);
      expect(mode).toMatch(/^(gm|player)$/);
      await route.fulfill({ json: {
        ok: true,
        user: { id: "e2e-user" },
        workspaces: [{ id: "00000000-0000-4000-8000-000000000001", slug: "e2e-workspace", name: "E2E Workspace" }],
        workspaceMemberships: [{ workspaceId: "00000000-0000-4000-8000-000000000001", userId: "e2e-user", role: "owner" }],
        campaigns: [{ id: "00000000-0000-4000-8000-000000000002", workspaceId: "00000000-0000-4000-8000-000000000001", slug: "e2e-campaign", name: "E2E Campaign", description: "Authentication emulator test campaign" }],
        campaignMemberships: [{ campaignId: "00000000-0000-4000-8000-000000000002", userId: "e2e-user", role: "gm" }],
      } });
      return;
    }

    if (url.pathname === "/api/invitations/accept-pending") {
      expect(authorization).toMatch(/^Bearer /);
      expect(mode).toMatch(/^(gm|player)$/);
      await route.fulfill({ json: { ok: true, acceptedInvitations: [] } });
      return;
    }

    if (url.pathname !== "/api/worldbuilding") {
      await route.fallback();
      return;
    }

    const entity = url.searchParams.get("entity");
    const resource = url.searchParams.get("resource");
    const visibleLocations = mode === "gm" ? [harbor, lookout, hidden] : [harbor, lookout];
    if (entity === "npcs") {
      if (method === "PUT") { await route.fulfill({ json: { ok: true, npc } }); return; }
      await route.fulfill({ json: url.searchParams.has("npcId")
        ? { ok: true, npc }
        : { ok: true, npcs: [npc] } });
      return;
    }
    if (entity === "locations") {
      if (method === "PUT") { await route.fulfill({ json: { ok: true, location: route.request().postDataJSON().location } }); return; }
      await route.fulfill({ json: url.searchParams.has("locationId")
        ? { ok: true, location: visibleLocations.find((location) => location.id === url.searchParams.get("locationId")) ?? null }
        : { ok: true, locations: visibleLocations } });
      return;
    }
    if (resource === "quests") {
      const quests = mode === "gm" ? [visibleQuest, privateLinkQuest, hiddenQuest] : [visibleQuest, privateLinkQuest];
      const questId = url.searchParams.get("questId");
      await route.fulfill({ json: { ok: true, ...(questId ? { quest: quests.find((quest) => quest.id === questId) ?? null } : { quests }),
        references: { sessions: [questSession], npcs: [npc], items: [questItem], locations: visibleLocations, lore: [] } } });
      return;
    }
    if (resource === "entityLinks") {
      if (method === "PUT") {
        const next = route.request().postDataJSON().link as typeof links[number];
        writes.push(`PUT:${next.id}`);
        if (/^(quest-hero:|quest-main-location:)/.test(next.id)) {
          await route.fulfill({ status: 400, json: { ok: false, error: "Edit the primary Quest relationship on the Quest profile" } });
          return;
        }
        if (rejectNextGenericWrite) {
          rejectNextGenericWrite = false;
          await route.fulfill({ status: 500, json: { ok: false, error: "Relationship write failed" } });
          return;
        }
        links = [...links.filter((link) => link.id !== next.id), next];
        await route.fulfill({ json: { ok: true, link: next } });
        return;
      }
      if (method === "DELETE") {
        const id = url.searchParams.get("linkId");
        writes.push(`DELETE:${id}`);
        if (/^(quest-hero:|quest-main-location:)/.test(id || "")) {
          await route.fulfill({ status: 400, json: { ok: false, error: "Edit the primary Quest relationship on the Quest profile" } });
          return;
        }
        if (rejectNextGenericWrite) {
          rejectNextGenericWrite = false;
          await route.fulfill({ status: 500, json: { ok: false, error: "Relationship write failed" } });
          return;
        }
        links = links.filter((link) => link.id !== id);
        await route.fulfill({ json: { ok: true } });
        return;
      }
      await route.fulfill({ json: { ok: true, links: mode === "gm" ? links : links.filter((link) => link.visibility === "Player" &&
        link.entityA.id !== hidden.id && link.entityB.id !== hidden.id && link.entityA.id !== hiddenQuest.id) } });
      return;
    }
    if (resource === "characters") { await route.fulfill({ json: { ok: true, characters: [] } }); return; }
    if (resource === "sessions") { await route.fulfill({ json: url.searchParams.has("sessionId")
      ? { ok: true, session: questSession } : { ok: true, sessions: [questSession] } }); return; }
    if (resource === "items") { await route.fulfill({ json: url.searchParams.has("itemId")
      ? { ok: true, item: questItem } : { ok: true, items: [questItem] } }); return; }
    if (entity === "lore") { await route.fulfill({ json: { ok: true, lore: [] } }); return; }
    await route.abort("blockedbyclient");
  });
  await page.route("**/api/campaign-content?**", async (route) => {
    const resource = new URL(route.request().url()).searchParams.get("resource");
    await route.fulfill({ json: { ok: true, ...(resource === "characterAssignments" ? { assignments: [] } : { people: [] }) } });
  });

  const email = `links-${randomUUID()}@example.test`;
  await createVerifiedUser(request, email, "DungeonTest42!");
  await page.goto("/home");
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("DungeonTest42!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "E2E Campaign" })).toBeVisible();
  await page.getByRole("button", { name: "GM", exact: true }).click();

  await page.goto(`/maps/${harbor.id}`);
  const npcsSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "NPCs", exact: true }) }).last();
  const questsSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "Quests", exact: true }) }).last();
  await expect(npcsSection).toContainText("Archivist");
  await expect(npcsSection).toContainText("controls");
  await expect(questsSection.getByRole("link", { name: "Coastal lead" })).toBeVisible();
  await expect(questsSection.getByRole("link", { name: "Private trail" })).toBeVisible();
  await expect(questsSection.getByRole("link", { name: "Secret lead" })).toBeVisible();
  await expect(questsSection).toContainText("destination");
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    const questsBox = await questsSection.boundingBox();
    const npcsBox = await npcsSection.boundingBox();
    expect(questsBox && npcsBox && Math.abs(questsBox.x - npcsBox.x) < 2 && Math.abs(questsBox.width - npcsBox.width) < 2).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`location-quests-gm-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await questsSection.getByRole("link", { name: "Coastal lead" }).click();
  await expect(page).toHaveURL(/\/quests\/coastal-quest$/);
  await page.goto(`/maps/${harbor.id}`);

  await page.goto(`/npcs/${npc.id}`);
  const npcQuestsSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "Quests", exact: true }) }).last();
  await expect(npcQuestsSection.getByRole("link", { name: "Coastal lead" })).toBeVisible();
  await expect(npcQuestsSection.getByText("quest giver", { exact: true })).toBeVisible();
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: testInfo.outputPath(`npc-quests-gm-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const locationsSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "Locations", exact: true }) }).last();
  await expect(locationsSection).toContainText("Harbor");
  await expect(locationsSection).toContainText("controls");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await locationsSection.getByRole("button", { name: "Add Map" }).click();
  await locationsSection.getByPlaceholder("Search locations...").fill("safe");
  await expect(locationsSection.getByRole("button", { name: "Harbor — Already linked" })).toBeDisabled();
  await locationsSection.getByPlaceholder("Search locations...").fill("watch");
  await expect(locationsSection.getByRole("button", { name: "Lookout" })).toBeVisible();
  await locationsSection.getByRole("button", { name: "Lookout" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
  await page.reload();
  await expect(locationsSection).toContainText("Lookout");
  await page.goto(`/maps/${lookout.id}`);
  await expect(npcsSection).toContainText("Archivist");

  // Editing on the Location side updates the same id and survives both refreshes.
  const lookoutLinkId = links.find((link) => link.entityA.id === lookout.id || link.entityB.id === lookout.id)!.id;
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await npcsSection.getByRole("combobox").first().selectOption("controls");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
  await page.reload();
  await expect(npcsSection).toContainText("controls");
  await page.goto(`/npcs/${npc.id}`);
  await expect(locationsSection).toContainText("Lookout");
  await expect(locationsSection).toContainText("controls");
  expect(links.filter((link) => link.id === lookoutLinkId)).toHaveLength(1);

  // Deletion and re-linking from the Location side remain symmetric.
  await page.goto(`/maps/${lookout.id}`);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await npcsSection.getByRole("button", { name: "Remove link" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
  expect(writes).toContain(`DELETE:${lookoutLinkId}`);
  await page.goto(`/npcs/${npc.id}`);
  await expect(locationsSection).not.toContainText("Lookout");
  await page.goto(`/maps/${lookout.id}`);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await npcsSection.getByRole("button", { name: "Add NPC" }).click();
  await npcsSection.getByPlaceholder("Search NPCs...").fill("arch");
  await npcsSection.getByRole("button", { name: "Archivist" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
  await page.goto(`/npcs/${npc.id}`);
  await expect(locationsSection).toContainText("Lookout");
  expect(links.filter((link) => link.entityA.id === lookout.id || link.entityB.id === lookout.id)).toHaveLength(1);

  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await locationsSection.locator(".group").filter({ hasText: "Lookout" }).getByRole("combobox").first().selectOption("resides_in");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
  await page.goto(`/maps/${lookout.id}`);
  await expect(npcsSection).toContainText("resides in");
  expect(writes.filter((write) => write === `PUT:${lookoutLinkId}`)).toHaveLength(2);

  await page.goto(`/npcs/${npc.id}`);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await locationsSection.locator(".group").filter({ hasText: "Lookout" }).getByRole("button", { name: "Remove link" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
  await page.goto(`/maps/${lookout.id}`);
  await expect(npcsSection).toContainText("No related NPCs yet.");

  for (const [path, badge, screenshotName] of [
    [`/items/${questItem.id}`, "related", "item"],
    [`/sessions/${questSession.id}`, "start session", "session"],
  ]) {
    await page.goto(path);
    const reciprocal = page.locator("section").filter({ has: page.getByRole("heading", { name: "Quests", exact: true }) }).last();
    await expect(reciprocal.getByRole("link", { name: "Coastal lead" })).toHaveAttribute("href", `/quests/${visibleQuest.id}`);
    await expect(reciprocal.getByText(badge, { exact: true })).toBeVisible();
    for (const width of [1440, 375]) {
      await page.setViewportSize({ width, height: 900 });
      await page.screenshot({ path: testInfo.outputPath(`${screenshotName}-quests-gm-${width}.png`), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });

  // Saving unrelated Session fields must leave the managed Quest primary alone.
  await page.goto(`/sessions/${questSession.id}`);
  const sessionQuests = page.locator("section").filter({ has: page.getByRole("heading", { name: "Quests", exact: true }) }).last();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(sessionQuests.getByText("start session", { exact: true })).toBeVisible();
  await expect(sessionQuests.getByRole("button", { name: /Remove.*Coastal lead/ })).toHaveCount(0);
  await expect(sessionQuests.getByRole("combobox", { name: "Relationship for Coastal lead" })).toHaveCount(0);
  const writesBeforeSessionSave = writes.length;
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Coastal opening revised");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
  expect(writes).toHaveLength(writesBeforeSessionSave);

  // Each host profile stages its own Quest edits; the Quest-side canonical
  // primary link may coexist with a separately meaningful generic link.
  for (const [path, quest, primaryLabel, genericLabel] of [
    [`/sessions/${questSession.id}`, visibleQuest, "started", "advanced"],
    [`/npcs/${npc.id}`, visibleQuest, "given_by", "target"],
    [`/items/${questItem.id}`, privateLinkQuest, "", "requires"],
    [`/maps/${harbor.id}`, visibleQuest, "leads_to", "takes_place_in"],
  ] as const) {
    const displayedLabel = genericLabel.split("_").join(" ");
    await page.goto(path);
    const reciprocal = page.locator("section").filter({ has: page.getByRole("heading", { name: "Quests", exact: true }) }).last();
    const originalWrites = writes.length;
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await reciprocal.getByRole("button", { name: "Add Quest" }).click();
    const roleOptions = await reciprocal.getByRole("combobox", { name: "Quest relationship" }).locator("option").allTextContents();
    expect(roleOptions).not.toContain("start session");
    expect(roleOptions).not.toContain("quest giver");
    expect(roleOptions).not.toContain("destination");
    await reciprocal.getByRole("combobox", { name: "Quest relationship" }).selectOption(genericLabel);
    await reciprocal.getByRole("button", { name: quest.name, exact: true }).click();
    expect(writes).toHaveLength(originalWrites);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(writes).toHaveLength(originalWrites);
    await expect(reciprocal.getByRole("link", { name: quest.name })).toHaveCount(primaryLabel ? 1 : 0);

    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await reciprocal.getByRole("button", { name: "Add Quest" }).click();
    await reciprocal.getByRole("combobox", { name: "Quest relationship" }).selectOption(genericLabel);
    await reciprocal.getByRole("button", { name: quest.name, exact: true }).click();
    if (path.startsWith("/maps/")) {
      for (const width of [1440, 375]) {
        await page.setViewportSize({ width, height: 900 });
        await page.screenshot({ path: testInfo.outputPath(`location-quests-edit-${width}.png`), fullPage: true });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      }
      await page.setViewportSize({ width: 1440, height: 900 });
    }
    if (path.startsWith("/sessions/")) {
      rejectNextGenericWrite = true;
      expectedConsoleErrors.push("500 (Internal Server Error)", "[SessionProfile] Failed to save Session");
    }
    await page.getByRole("button", { name: "Save", exact: true }).click();
    if (path.startsWith("/sessions/")) {
      await expect(page.getByRole("alert")).toContainText("relationship did not");
      await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible();
      await expect(reciprocal.locator("span").filter({ hasText: displayedLabel }).first()).toBeVisible();
      expect(pageErrors).toHaveLength(0);
      await page.getByRole("button", { name: "Save", exact: true }).click();
    }
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
    await page.reload();
    await expect(reciprocal.getByRole("link", { name: quest.name })).toHaveCount(1);
    const questCard = reciprocal.getByRole("link", { name: quest.name }).locator("..");
    await expect(questCard.getByText(displayedLabel, { exact: true })).toBeVisible();
    if (primaryLabel) await expect(questCard.getByText(
      primaryLabel === "started" ? "start session" : primaryLabel === "given_by" ? "quest giver" : "destination",
      { exact: true }
    )).toBeVisible();
    const generic = links.filter((link) => link.label === genericLabel &&
      (link.entityA.id === quest.id || link.entityB.id === quest.id) &&
      (link.entityA.id === path.split("/").pop() || link.entityB.id === path.split("/").pop()));
    expect(generic).toHaveLength(1);

    await page.goto(`/quests/${quest.id}`);
    const questGroup = path.startsWith("/sessions/") ? "Sessions" : path.startsWith("/npcs/") ? "NPCs" : path.startsWith("/items/") ? "Items" : "Locations";
    const questSection = page.locator("section").filter({ has: page.getByRole("heading", { name: questGroup, exact: true }) }).last();
    const hostName = path.startsWith("/sessions/") ? questSession.name : path.startsWith("/npcs/") ? npc.name : path.startsWith("/items/") ? questItem.name : harbor.name;
    await expect(questSection.getByRole("link", { name: hostName })).toHaveCount(1);
    await expect(questSection.getByText(displayedLabel, { exact: true })).toBeVisible();
    await page.goto(path);

    if (path.startsWith("/sessions/")) {
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      await reciprocal.getByRole("combobox", { name: `Relationship for ${quest.name}` }).selectOption("related");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
      await page.reload();
      expect(links.find((link) => link.id === generic[0].id)?.label).toBe("related");
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      await reciprocal.getByRole("combobox", { name: `Relationship for ${quest.name}` }).selectOption(genericLabel);
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
    }

    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await reciprocal.getByRole("button", { name: `Remove ${displayedLabel} Quest link to ${quest.name}` }).click();
    await expect(reciprocal.getByRole("link", { name: quest.name })).toHaveCount(primaryLabel ? 1 : 0);
    expect(writes.some((write) => /^(PUT|DELETE):(quest-hero:|quest-main-location:)/.test(write))).toBe(false);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect.poll(() => writes.filter((write) => write === `DELETE:${generic[0].id}`).length).toBe(1);
    await page.reload();
    await expect(reciprocal.getByRole("link", { name: quest.name })).toHaveCount(primaryLabel ? 1 : 0);
    expect(links.filter((link) => link.id === generic[0].id)).toHaveLength(0);
    if (primaryLabel) expect(links.filter((link) => link.label === primaryLabel &&
      (link.entityA.id === quest.id || link.entityB.id === quest.id))).toHaveLength(1);
    await page.goto(`/quests/${quest.id}`);
    await expect(questSection.getByText(displayedLabel, { exact: true })).toHaveCount(0);
    await expect(questSection.getByRole("link", { name: hostName })).toHaveCount(primaryLabel ? 1 : 0);
  }

  await page.goto(`/npcs/${npc.id}`);
  await expect(locationsSection).toContainText("Hidden Vault");
  await page.getByRole("button", { name: "Player", exact: true }).click();
  await expect(locationsSection).toContainText("Harbor");
  await expect(locationsSection).not.toContainText("Hidden Vault");
  await expect(locationsSection).not.toContainText("Lookout");
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(locationsSection).toContainText("Harbor");
  await expect(locationsSection).not.toContainText("Hidden Vault");
  await page.goto(`/maps/${harbor.id}`);
  await expect(questsSection.getByRole("link", { name: "Coastal lead" })).toBeVisible();
  await expect(questsSection.getByRole("link", { name: "Private trail" })).toHaveCount(0);
  await expect(questsSection.getByRole("link", { name: "Secret lead" })).toHaveCount(0);
  await expect(questsSection).not.toContainText("related");
  await expect(questsSection.getByRole("button", { name: "Add Quest" })).toHaveCount(0);
  for (const path of [`/npcs/${npc.id}`, `/items/${questItem.id}`, `/sessions/${questSession.id}`]) {
    await page.goto(path);
    const reciprocal = page.locator("section").filter({ has: page.getByRole("heading", { name: "Quests", exact: true }) }).last();
    await expect(reciprocal.getByRole("link", { name: "Coastal lead" })).toBeVisible();
    await expect(reciprocal.getByRole("link", { name: "Secret lead" })).toHaveCount(0);
    await expect(reciprocal.getByRole("button", { name: "Add Quest" })).toHaveCount(0);
  }
  await page.goto(`/maps/${harbor.id}`);
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: testInfo.outputPath(`location-quests-player-${width}.png`), fullPage: true });
  }
  expect(writes.some((write) => /^(PUT|DELETE):(quest-hero:|quest-main-location:)/.test(write))).toBe(false);
  expect(pageErrors).toHaveLength(0);
});
