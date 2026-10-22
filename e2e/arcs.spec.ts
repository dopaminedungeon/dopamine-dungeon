import { randomUUID } from "node:crypto";
import { test, expect } from "./auth.fixture";
import { createVerifiedUser } from "./auth-emulator";

test("GM creates an Arc and milestone, links a Session, and Player view hides a private parent", async ({ page, request, expectedConsoleErrors }) => {
  const session = { id: "session-one", name: "The Crossing", sessionNumber: 1, status: "completed", visibility: "public", summary: "The party crossed the river." };
  let arcs: Array<Record<string, any>> = [
    { id: "hidden-arc", type: "main_story", name: "Secret plot", summary: "Hidden story", status: "active", progress: 45, visibility: "gm-only" },
    { id: "character-arc", type: "character_arc", name: "Kriaxin’s Descent", summary: "Corruption and consequences.", status: "progressing", progress: 30, visibility: "gm-only" },
    { id: "supporting-arc", type: "supporting_arc", name: "The Broken Crown", summary: "A fractured kingdom.", status: "waiting", progress: 70, visibility: "gm-only" },
    { id: "milestone-arc", type: "milestone_progression", name: "The Great Sundering", summary: "A turning point.", status: "resolved", progress: 100, visibility: "gm-only" },
  ];
  let milestones: Array<Record<string, any>> = [
    { id: "hidden-child", arcId: "hidden-arc", title: "Secret milestone", description: "Do not disclose", progress: 50, conditionsForLevelUp: "", intendedLevelProgression: "", status: "active", visibility: "public", position: 0 },
  ];
  let links: Array<Record<string, any>> = [];
  const linkWrites: Array<Record<string, any>> = [];
  let failArcListRequests = 0;

  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (!url.pathname.startsWith("/api/")) return route.fallback();
    if (url.pathname === "/api/auth/identity-continuity") return route.fulfill({ json: { ok: true, neonUserId: "e2e-user" } });
    if (url.pathname === "/api/me") return route.fulfill({ json: {
      ok: true, user: { id: "e2e-user" },
      workspaces: [{ id: "workspace-one", slug: "e2e-workspace", name: "E2E Workspace" }],
      workspaceMemberships: [{ workspaceId: "workspace-one", userId: "e2e-user", role: "owner" }],
      campaigns: [{ id: "campaign-one", workspaceId: "workspace-one", slug: "e2e-campaign", name: "E2E Campaign" }],
      campaignMemberships: [{ campaignId: "campaign-one", userId: "e2e-user", role: "gm" }],
    } });
    if (url.pathname === "/api/invitations/accept-pending") return route.fulfill({ json: { ok: true, acceptedInvitations: [] } });
    if (url.pathname !== "/api/worldbuilding") return route.fulfill({ json: { ok: true } });
    const resource = url.searchParams.get("resource") || url.searchParams.get("entity");
    const mode = route.request().headers()["x-dd-mode"];
    if (resource === "arcs") {
      if (mode !== "gm") return route.fulfill({ status: 403, json: { ok: false, error: "GM mode is required to access Arcs" } });
      if (method === "DELETE") {
        const arcId = url.searchParams.get("arcId");
        const removedMilestones = milestones.filter((item) => item.arcId === arcId).map((item) => item.id);
        arcs = arcs.filter((arc) => arc.id !== arcId);
        milestones = milestones.filter((item) => item.arcId !== arcId);
        links = links.filter((link) => !(
          (link.entityA.type === "Arc" && link.entityA.id === arcId) || (link.entityB.type === "Arc" && link.entityB.id === arcId) ||
          (link.entityA.type === "Milestone" && removedMilestones.includes(link.entityA.id)) || (link.entityB.type === "Milestone" && removedMilestones.includes(link.entityB.id))
        ));
        return route.fulfill({ json: { ok: true, deleted: true } });
      }
      if (method === "PUT") {
        const arc = route.request().postDataJSON().arc as Record<string, any>;
        arcs = [...arcs.filter((item) => item.id !== arc.id), arc];
        return route.fulfill({ json: { ok: true, arc } });
      }
      const arcId = url.searchParams.get("arcId");
      if (!arcId && failArcListRequests > 0) {
        failArcListRequests -= 1;
        return route.fulfill({ status: 503, json: { ok: false, error: "Arc list unavailable" } });
      }
      return route.fulfill({ json: { ok: true, arcs: arcId ? arcs.filter((arc) => arc.id === arcId) : arcs } });
    }
    if (resource === "milestones") {
      if (mode !== "gm") return route.fulfill({ status: 403, json: { ok: false, error: "GM mode is required to access Milestones" } });
      if (method === "PUT") {
        const milestone = route.request().postDataJSON().milestone as Record<string, any>;
        milestones = [...milestones.filter((item) => item.id !== milestone.id), milestone];
        return route.fulfill({ json: { ok: true, milestone } });
      }
      const arcId = url.searchParams.get("arcId");
      return route.fulfill({ json: { ok: true, milestones: milestones.filter((item) => !arcId || item.arcId === arcId) } });
    }
    if (resource === "sessions") return route.fulfill({ json: { ok: true, sessions: [session] } });
    if (resource === "quests") return route.fulfill({ json: { ok: true, quests: [], references: { sessions: [], npcs: [], items: [], locations: [], lore: [] } } });
    if (resource === "entityLinks") {
      if (method === "PUT") {
        const link = route.request().postDataJSON().link as Record<string, any>;
        linkWrites.push(link);
        links = [...links.filter((item) => item.id !== link.id), link];
        return route.fulfill({ json: { ok: true, link } });
      }
      if (method === "DELETE") {
        links = links.filter((link) => link.id !== url.searchParams.get("linkId"));
        return route.fulfill({ json: { ok: true } });
      }
      const visible = mode === "gm" ? links : links.filter((link) => link.visibility === "Player");
      return route.fulfill({ json: { ok: true, links: visible } });
    }
    if (resource === "items") return route.fulfill({ json: { ok: true, items: [] } });
    if (resource === "npcs") return route.fulfill({ json: { ok: true, npcs: [] } });
    if (resource === "locations") return route.fulfill({ json: { ok: true, locations: [] } });
    if (resource === "lore") return route.fulfill({ json: { ok: true, lore: [] } });
    if (resource === "characters") return route.fulfill({ json: { ok: true, characters: [{ id: "pc-one", name: "Kriaxin", isPlayerVisible: true }] } });
    await route.fulfill({ status: 404, json: { ok: false } });
  });

  const email = `arcs-${randomUUID()}@example.test`;
  await createVerifiedUser(request, email, "DungeonTest42!");
  await page.goto("/home");
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("DungeonTest42!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "E2E Campaign" })).toBeVisible();
  await page.getByRole("button", { name: "GM", exact: true }).click();

  // React StrictMode runs the initial effect twice in the test build.
  failArcListRequests = 2;
  expectedConsoleErrors.push("503 (Service Unavailable)");
  await page.goto("/arcs");
  await expect(page.getByRole("alert")).toContainText("Unable to load Arcs");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("heading", { name: "Arcs", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Arcs" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page).toHaveURL(/\/arcs$/);
  for (const status of ["active", "progressing", "waiting", "resolved"]) await expect(page.getByRole("heading", { name: status, exact: true })).toBeVisible();
  for (const [label, title] of [["Character arc", "Kriaxin’s Descent"], ["Main story", "Secret plot"], ["Supporting arc", "The Broken Crown"], ["Milestone progression", "The Great Sundering"]]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.getByRole("button", { name: new RegExp(title) })).toBeVisible();
    const otherTitles = ["Kriaxin’s Descent", "Secret plot", "The Broken Crown", "The Great Sundering"].filter((candidate) => candidate !== title);
    for (const otherTitle of otherTitles) await expect(page.getByRole("button", { name: new RegExp(otherTitle) })).toHaveCount(0);
  }
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.getByRole("button", { name: "Character arc", exact: true }).click();
  await page.getByRole("button", { name: /Kriaxin’s Descent/ }).click();
  await page.getByRole("button", { name: "Edit Arc" }).click();
  await page.getByLabel("Assigned PC").selectOption("pc-one");
  await page.getByRole("button", { name: "Save changes" }).first().click();
  await expect(page.getByText("Assigned PC").locator("..").getByText("Kriaxin", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Assigned PC").locator("xpath=..").getByText("Kriaxin", { exact: true })).toBeVisible();
  await page.goto("/arcs");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Add new arc" }).click();
  await expect(page.getByRole("dialog", { name: "Add new arc" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: "Close" }).click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "Add new arc" }).click();
  await expect(page.getByRole("dialog", { name: "Add new arc" })).toBeVisible();
  await page.getByLabel("Title", { exact: true }).fill("The River Oath");
  await page.getByLabel("Summary", { exact: true }).fill("An alliance takes shape.");
  await page.getByRole("button", { name: "Create arc" }).click();
  await expect(page.getByRole("heading", { name: "The River Oath" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
  const pathSegments = new URL(page.url()).pathname.split("/");
  const arcId = pathSegments[pathSegments.length - 1];

  await page.getByRole("button", { name: "Edit Arc" }).click();
  await page.getByLabel("Arc title").fill("Unsaved Arc title");
  await page.getByRole("button", { name: "Cancel", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "The River Oath" })).toBeVisible();

  await page.getByRole("button", { name: "Add milestone" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Cross the river");
  await page.getByLabel("Details", { exact: true }).fill("The group earns passage.");
  await page.getByRole("button", { name: "Save milestone" }).click();
  await expect(page.getByRole("link", { name: "Cross the river" })).toBeVisible();
  const milestoneCard = page.locator("article").filter({ has: page.getByRole("link", { name: "Cross the river" }) });
  await milestoneCard.getByRole("button", { name: "Edit" }).click();
  await page.locator("textarea").last().fill("The party earns passage and reaches the far bank.");
  await page.getByRole("button", { name: "Save milestone" }).click();
  await expect(page.getByText("The party earns passage and reaches the far bank.")).toBeVisible();
  await page.getByRole("link", { name: "Cross the river" }).click();
  await expect(page.getByRole("heading", { name: "Conditions for level up" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByLabel("Conditions for level up").fill("The party earns the river oath.");
  await page.getByLabel("Intended level progression").fill("Level 4 → Level 5");
  await page.getByRole("slider", { name: "Set progress" }).evaluate((input: HTMLInputElement) => {
    input.value = "65";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.getByRole("button", { name: "Save changes" }).first().click();
  await expect(page.getByText("The party earns the river oath.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Level 4 → Level 5")).toBeVisible();
  await page.goto(`/arcs/${arcId}`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "Edit Arc" }).click();
  const arcSessions = page.getByRole("combobox", { name: "Sessions entity" }).first();
  await arcSessions.selectOption("session-one");
  await arcSessions.locator("xpath=../..").getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Save changes" }).first().click();
  const arcConnections = page.getByRole("heading", { name: "Connections" }).locator("..");
  await expect(arcConnections.getByRole("link", { name: "The Crossing" })).toBeVisible();
  expect(linkWrites.some((link) => link.entityA.type === "Arc" && link.entityB.type === "Session" || link.entityB.type === "Arc" && link.entityA.type === "Session")).toBe(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Connections" }).locator("..").getByRole("link", { name: "The Crossing" })).toBeVisible();
  expect(links).toHaveLength(2);
  expect(links.some((link) => link.entityA.type === "Arc" && link.entityA.id === arcId || link.entityB.type === "Arc" && link.entityB.id === arcId)).toBe(true);

  await page.goto("/sessions/session-one");
  await expect(page.getByRole("heading", { name: "Arcs advanced" })).toBeVisible();
  await expect(page.getByText("The River Oath")).toBeVisible();

  await page.goto("/arcs/hidden-arc");
  await expect(page.getByRole("heading", { name: "Secret plot" })).toBeVisible();
  await page.getByRole("button", { name: "Player", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "E2E Campaign" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Arcs" })).toHaveCount(0);
  await expect(page.getByText("Secret plot")).toHaveCount(0);
  await expect(page.getByText("Secret milestone")).toHaveCount(0);
  expectedConsoleErrors.push("403 (Forbidden)");
  const deniedArcReads = await page.evaluate(async () => Promise.all(["arcs", "milestones"].map(async (resource) => {
    const response = await fetch(`/api/worldbuilding?resource=${resource}&campaignId=e2e-campaign`, { headers: { "x-dd-mode": "player" } });
    return response.status;
  })));
  expect(deniedArcReads).toEqual([403, 403]);
  await page.goto("/arcs");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.getByText("Secret plot")).toHaveCount(0);
  await expect(page.getByText("Secret milestone")).toHaveCount(0);
  await page.goto("/arcs/hidden-arc");
  await expect(page.getByRole("heading", { name: "E2E Campaign" })).toBeVisible();
  await expect(page.getByText("Secret plot")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "GM", exact: true }).click();
  await page.goto("/arcs");
  await expect(page.getByRole("button", { name: /Secret plot/ })).toBeVisible();
  await page.goto(`/arcs/${arcId}`);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete Arc" }).click();
  await expect(page).toHaveURL(/\/arcs$/);
  await expect(page.getByRole("button", { name: /The River Oath/ })).toHaveCount(0);
  expect(milestones.some((milestone) => milestone.arcId === arcId)).toBe(false);
  expect(links.some((link) => link.entityA.type === "Arc" && link.entityA.id === arcId || link.entityB.type === "Arc" && link.entityB.id === arcId)).toBe(false);
  expect(session.name).toBe("The Crossing");
});
