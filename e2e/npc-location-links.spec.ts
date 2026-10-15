import { randomUUID } from "node:crypto";
import { test, expect } from "./auth.fixture";
import { createVerifiedUser, lookupAuthEmulatorAccount } from "./auth-emulator";

const npc = { id: "archivist", name: "Archivist", visibility: "public", type: "NPC", status: "active" };
const harbor = { id: "harbor", name: "Harbor", aliases: ["Safe Haven"], visibility: "public", category: "District" };
const lookout = { id: "lookout", name: "Lookout", aliases: ["North Watch"], visibility: "public", category: "Landmark" };
const hidden = { id: "hidden-vault", name: "Hidden Vault", aliases: ["Secret Hold"], visibility: "gm-only", category: "Dungeon" };
const visibleQuest = { id: "coastal-quest", name: "Coastal lead", type: "discovery", status: "Planned", visibility: "public", progress: 20,
  startSessionId: "", endSessionId: "", endDate: "", giverId: "", mainLocationId: harbor.id,
  shortDescription: "Follow the coast.", hook: "", journey: "", aftermath: "", sectionVisibility: {}, mainObjectives: [], secondaryObjectives: [] };
const privateLinkQuest = { id: "private-link-quest", name: "Private trail", visibility: "public" };
const hiddenQuest = { id: "secret-quest", name: "Secret lead", visibility: "gm-only" };

test("Location and NPC profiles share one link and NPC search keeps linked name and alias matches", async ({ page, request }, testInfo) => {
  let links = [
    { id: "link-harbor", entityA: { type: "Map", id: harbor.id }, entityB: { type: "NPC", id: npc.id }, label: "controls", visibility: "Player" },
    { id: "link-hidden", entityA: { type: "Map", id: hidden.id }, entityB: { type: "NPC", id: npc.id }, label: "connected", visibility: "GM" },
    { id: "quest-destination", entityA: { type: "Quest", id: visibleQuest.id }, entityB: { type: "Map", id: harbor.id }, label: "leads_to", visibility: "Player" },
    { id: "quest-gm-link", entityA: { type: "Quest", id: privateLinkQuest.id }, entityB: { type: "Map", id: harbor.id }, label: "related", visibility: "GM" },
    { id: "hidden-quest-link", entityA: { type: "Quest", id: hiddenQuest.id }, entityB: { type: "Map", id: harbor.id }, label: "related", visibility: "Player" },
  ];
  const writes: string[] = [];

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
        references: { sessions: [], npcs: [], items: [], locations: visibleLocations } } });
      return;
    }
    if (resource === "entityLinks") {
      if (method === "PUT") {
        const next = route.request().postDataJSON().link as typeof links[number];
        writes.push(`PUT:${next.id}`);
        links = [...links.filter((link) => link.id !== next.id), next];
        await route.fulfill({ json: { ok: true, link: next } });
        return;
      }
      if (method === "DELETE") {
        const id = url.searchParams.get("linkId");
        writes.push(`DELETE:${id}`);
        links = links.filter((link) => link.id !== id);
        await route.fulfill({ json: { ok: true } });
        return;
      }
      await route.fulfill({ json: { ok: true, links: mode === "gm" ? links : links.filter((link) => link.visibility === "Player" &&
        link.entityA.id !== hidden.id && link.entityB.id !== hidden.id && link.entityA.id !== hiddenQuest.id) } });
      return;
    }
    if (resource === "sessions") { await route.fulfill({ json: { ok: true, sessions: [] } }); return; }
    if (resource === "items") { await route.fulfill({ json: { ok: true, items: [] } }); return; }
    if (entity === "lore") { await route.fulfill({ json: { ok: true, lore: [] } }); return; }
    await route.abort("blockedbyclient");
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
  const questsSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "Related quests", exact: true }) }).last();
  await expect(npcsSection).toContainText("Archivist");
  await expect(npcsSection).toContainText("controls");
  await expect(questsSection.getByRole("link", { name: "Coastal lead" })).toBeVisible();
  await expect(questsSection.getByRole("link", { name: "Private trail" })).toBeVisible();
  await expect(questsSection.getByRole("link", { name: "Secret lead" })).toBeVisible();
  await expect(questsSection).toContainText("leads to");
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
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: testInfo.outputPath(`location-quests-player-${width}.png`), fullPage: true });
  }
});
