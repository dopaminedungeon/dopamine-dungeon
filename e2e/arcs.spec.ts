import { randomUUID } from "node:crypto";
import { test, expect } from "./auth.fixture";
import { createVerifiedUser } from "./auth-emulator";

test("GM creates an Arc and milestone, links a Session, and Player view hides a private parent", async ({ page, request, expectedConsoleErrors }) => {
  const session = { id: "session-one", name: "The Crossing", sessionNumber: 1, status: "completed", visibility: "public", summary: "The party crossed the river." };
  let arcs: Array<Record<string, any>> = [
    { id: "hidden-arc", name: "Secret plot", summary: "Hidden story", status: "active", visibility: "gm-only" },
  ];
  let milestones: Array<Record<string, any>> = [
    { id: "hidden-child", arcId: "hidden-arc", title: "Secret milestone", description: "Do not disclose", status: "active", visibility: "public", position: 0 },
  ];
  let links: Array<Record<string, any>> = [];
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
      const visible = mode === "gm" ? arcs : arcs.filter((arc) => arc.visibility === "public");
      return route.fulfill({ json: { ok: true, arcs: arcId ? visible.filter((arc) => arc.id === arcId) : visible } });
    }
    if (resource === "milestones") {
      if (method === "PUT") {
        const milestone = route.request().postDataJSON().milestone as Record<string, any>;
        milestones = [...milestones.filter((item) => item.id !== milestone.id), milestone];
        return route.fulfill({ json: { ok: true, milestone } });
      }
      const arcId = url.searchParams.get("arcId");
      const visibleArcIds = new Set(arcs.filter((arc) => mode === "gm" || arc.visibility === "public").map((arc) => arc.id));
      const visible = milestones.filter((item) => visibleArcIds.has(item.arcId) && (mode === "gm" || item.visibility === "public"));
      return route.fulfill({ json: { ok: true, milestones: visible.filter((item) => !arcId || item.arcId === arcId) } });
    }
    if (resource === "sessions") return route.fulfill({ json: { ok: true, sessions: [session] } });
    if (resource === "quests") return route.fulfill({ json: { ok: true, quests: [], references: { sessions: [], npcs: [], items: [], locations: [], lore: [] } } });
    if (resource === "entityLinks") {
      if (method === "PUT") {
        const link = route.request().postDataJSON().link as Record<string, any>;
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
    if (resource === "characters") return route.fulfill({ json: { ok: true, characters: [] } });
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

  await page.goto("/arcs");
  await expect(page.getByRole("heading", { name: "Arcs", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Arcs" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "New Arc" }).click();
  await page.getByLabel("Name", { exact: true }).fill("The River Oath");
  await page.getByLabel("Summary", { exact: true }).fill("An alliance takes shape.");
  await page.getByRole("button", { name: "Create Arc" }).click();
  await expect(page.getByRole("heading", { name: "The River Oath" })).toBeVisible();
  const pathSegments = new URL(page.url()).pathname.split("/");
  const arcId = pathSegments[pathSegments.length - 1];

  await page.getByRole("button", { name: "Edit Arc" }).click();
  await page.getByLabel("Arc name").fill("Unsaved Arc title");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("heading", { name: "The River Oath" })).toBeVisible();

  await page.getByRole("button", { name: "Add milestone" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Cross the river");
  await page.getByLabel("Details", { exact: true }).fill("The group earns passage.");
  await page.getByRole("button", { name: "Save milestone" }).click();
  await expect(page.getByRole("heading", { name: "Cross the river" })).toBeVisible();
  const milestoneCard = page.locator("article").filter({ has: page.getByRole("heading", { name: "Cross the river" }) });
  await milestoneCard.getByRole("button", { name: "Edit" }).click();
  await page.locator("textarea").last().fill("The party earns passage and reaches the far bank.");
  await page.getByRole("button", { name: "Save milestone" }).click();
  await expect(page.getByText("The party earns passage and reaches the far bank.")).toBeVisible();
  await page.getByRole("button", { name: "Edit Arc" }).click();
  const arcSessions = page.locator("section").filter({ has: page.getByRole("heading", { name: "Sessions", exact: true }) }).last();
  await arcSessions.getByRole("combobox", { name: "Session to link" }).selectOption("session-one");
  await arcSessions.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Save Arc" }).click();
  await expect(page.getByRole("link", { name: "The Crossing" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: "The Crossing" })).toBeVisible();
  expect(links).toHaveLength(1);
  expect(links[0].entityA.type === "Arc" ? links[0].entityA.id : links[0].entityB.id).toBe(arcId);

  await page.goto("/sessions/session-one");
  await expect(page.getByRole("heading", { name: "Arcs advanced" })).toBeVisible();
  await expect(page.getByText("The River Oath")).toBeVisible();

  await page.goto("/arcs/hidden-arc");
  await expect(page.getByRole("heading", { name: "Secret plot" })).toBeVisible();
  await page.getByRole("button", { name: "Player", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "Arc not available" })).toBeVisible();
  await expect(page.getByText("Secret plot")).toHaveCount(0);
  await expect(page.getByText("Secret milestone")).toHaveCount(0);
  await page.goto("/arcs");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.getByText("Secret plot")).toHaveCount(0);
  await expect(page.getByText("Secret milestone")).toHaveCount(0);
  await page.goto("/arcs/hidden-arc");
  await expect(page.getByRole("heading", { name: "Arc not available" })).toBeVisible();
  await expect(page.getByText("Secret plot")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  failArcListRequests = 2;
  expectedConsoleErrors.push("503 (Service Unavailable)");
  await page.goto("/arcs");
  await expect(page.getByRole("alert")).toContainText("Unable to load Arcs");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("heading", { name: "No visible Arcs yet" })).toBeVisible();
  const emptyState = page.getByRole("heading", { name: "No visible Arcs yet" }).locator("..");
  await expect(emptyState.locator("svg")).toHaveCount(0);
});
