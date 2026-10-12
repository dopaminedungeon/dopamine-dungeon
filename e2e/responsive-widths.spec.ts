import { randomUUID } from "node:crypto";
import { test, expect } from "./auth.fixture";
import { createVerifiedUser } from "./auth-emulator";

const longName = `Synthetic${"LongName".repeat(18)}`;
const npc = { id: "synthetic-npc", name: longName, type: "NPC", status: "active", role: "neutral", visibility: "public", description: longName };
const location = { id: "synthetic-location", name: longName, category: "District", visibility: "public", aliases: [] };
const lore = { id: "synthetic-lore", name: longName, type: "Lore", category: "History", visibility: "public", description: longName };
const item = { id: "synthetic-item", name: longName, type: "Tool", rarity: "common", visibility: "public", description: longName, stats: {} };
const session = { id: "synthetic-session", title: longName, name: longName, status: "planned", visibility: "public", description: longName };
const character = { id: "synthetic-pc", name: longName, visibility: "public", isPlayerVisible: true, stats: {}, identity: {}, narrative: {} };
const hiddenName = "Synthetic GM-only overflow marker";
const hiddenNpc = { ...npc, id: "synthetic-hidden-npc", name: hiddenName, visibility: "gm-only" };
const hiddenLocation = { ...location, id: "synthetic-hidden-location", name: hiddenName, visibility: "gm-only" };
const hiddenLore = { ...lore, id: "synthetic-hidden-lore", name: hiddenName, visibility: "gm-only" };
const hiddenItem = { ...item, id: "synthetic-hidden-item", name: hiddenName, visibility: "gm-only" };

test("@width389 shared page widths remain bounded across modes and viewports", async ({ page, request }) => {
  test.setTimeout(240_000);
  await page.route("**/api/worldbuilding?**", async (route) => {
    const url = new URL(route.request().url());
    const entity = url.searchParams.get("entity");
    const resource = url.searchParams.get("resource");
    const isGm = route.request().headers()["x-dd-mode"] === "gm";
    if (entity === "npcs") return route.fulfill({ json: url.searchParams.has("npcId") ? { ok: true, npc } : { ok: true, npcs: isGm ? [npc, hiddenNpc] : [npc] } });
    if (entity === "locations") return route.fulfill({ json: url.searchParams.has("locationId") ? { ok: true, location } : { ok: true, locations: isGm ? [location, hiddenLocation] : [location] } });
    if (entity === "lore") return route.fulfill({ json: url.searchParams.has("loreId") ? { ok: true, lore: lore } : { ok: true, lore: isGm ? [lore, hiddenLore] : [lore] } });
    if (resource === "items") return route.fulfill({ json: url.searchParams.has("itemId") ? { ok: true, item } : { ok: true, items: isGm ? [item, hiddenItem] : [item] } });
    if (resource === "sessions") return route.fulfill({ json: url.searchParams.has("sessionId") ? { ok: true, session } : { ok: true, sessions: [session] } });
    if (resource === "characters") return route.fulfill({ json: url.searchParams.has("characterId") ? { ok: true, character } : { ok: true, characters: [character] } });
    if (resource === "entityLinks") return route.fulfill({ json: { ok: true, links: [] } });
    return route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/campaign-content?**", async (route) => {
    const resource = new URL(route.request().url()).searchParams.get("resource");
    if (resource === "campaignSettings") return route.fulfill({ json: { ok: true, campaign: { id: "synthetic-campaign", name: "Synthetic Campaign", description: longName, status: "active", system: "", playerSummary: longName, gmNotes: longName } } });
    if (resource === "campaignPeople") return route.fulfill({ json: { ok: true, people: [] } });
    if (resource === "characterAssignments") return route.fulfill({ json: { ok: true, assignments: [] } });
    return route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/workspace?**", async (route) => route.fulfill({ json: { ok: true, members: [] } }));

  const email = `width-${randomUUID()}@example.test`;
  await createVerifiedUser(request, email, "DungeonTest42!");
  await page.goto("/home");
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("DungeonTest42!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "E2E Campaign" }).first()).toBeVisible();

  const routes = [
    "/home", "/sessions", "/sessions/synthetic-session", "/items", "/items/synthetic-item",
    "/pcs", "/pcs/bag", "/pcs/synthetic-pc", "/npcs", "/npcs/synthetic-npc",
    "/maps", "/maps/synthetic-location", "/lore", "/lore/synthetic-lore",
    "/settings/profile",
  ];
  const measurements: Array<{ mode: string; path: string; viewport: number; width: number }> = [];
  for (const mode of ["GM", "Player"]) {
    await page.getByRole("button", { name: mode, exact: true }).click();
    await page.goto("/npcs");
    if (mode === "Player") await expect(page.getByText(hiddenName)).toHaveCount(0);
    else await expect(page.getByText(hiddenName)).toBeVisible();
    for (const width of [375, 640, 768, 1280, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of [...routes, ...(mode === "GM" ? ["/campaigns/settings"] : [])]) {
        await page.goto(path);
        const container = page.locator(".app-page-wide, .app-page-standard").first();
        await expect(container, `${mode} ${path} at ${width}px`).toBeVisible();
        if (mode === "Player" && ["/items", "/npcs", "/maps", "/lore"].includes(path)) {
          await expect(page.getByText(hiddenName)).toHaveCount(0);
        }
        if (["/sessions", "/sessions/synthetic-session", "/items", "/items/synthetic-item", "/npcs", "/npcs/synthetic-npc", "/maps", "/maps/synthetic-location", "/lore", "/lore/synthetic-lore"].includes(path)) {
          await expect(page.getByText(longName, { exact: true }).first(), `${mode} ${path} synthetic long value`).toBeVisible();
          const overflowingLongText = await page.locator("body").evaluate(
            (element, value) => [...element.querySelectorAll("h1, h2, h3, p")]
              .filter((node) => node.textContent?.includes(value) && node.scrollWidth > node.clientWidth + 1)
              .map((node) => ({ tag: node.tagName, className: node.getAttribute("class"), clientWidth: node.clientWidth, scrollWidth: node.scrollWidth, text: node.textContent?.slice(0, 60) })),
            longName,
          );
          expect(overflowingLongText, `${mode} ${path} long text should wrap`).toEqual([]);
        }
        const geometry = await container.evaluate((element) => ({
          width: element.getBoundingClientRect().width,
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        }));
        if (path === "/npcs/synthetic-npc") {
          const prose = page.locator(".markdown-content p").first();
          await expect(prose).toBeVisible();
          const proseWidth = await prose.evaluate((element) => element.getBoundingClientRect().width);
          expect(proseWidth).toBeLessThanOrEqual(600);
          expect(proseWidth).toBeLessThanOrEqual(geometry.viewportWidth);
        }
        measurements.push({ mode, path, viewport: width, width: geometry.width });
        expect(geometry.width, `${mode} ${path} at ${width}px`).toBeLessThanOrEqual(width);
        expect(geometry.documentWidth, `${mode} ${path} at ${width}px`).toBeLessThanOrEqual(geometry.viewportWidth);
        if (width === 1920) {
          expect(geometry.width, `${mode} ${path} wide bound`).toBeLessThanOrEqual(1280);
          if (path === "/home") expect(geometry.width, "overview standard bound").toBeLessThanOrEqual(1152);
        }
        if (path === "/settings/profile") {
          await page.getByRole("button", { name: "Workspace Settings" }).click();
          await expect(page.getByRole("heading", { name: "Profile Settings" })).toBeVisible();
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        }
      }
    }
  }

  console.log("WIDTH389", JSON.stringify(measurements.filter(({ mode, path }) => mode === "GM" && ["/home", "/sessions", "/pcs", "/npcs", "/npcs/synthetic-npc", "/settings/profile", "/campaigns/settings"].includes(path))));
  await page.setViewportSize({ width: 640, height: 900 });
  await page.goto("/settings/profile");
  const halfDesktopViewport = await page.evaluate(() => ({ width: window.innerWidth, documentWidth: document.documentElement.scrollWidth }));
  console.log("WIDTH389_HALF_DESKTOP_VIEWPORT_PROXY", JSON.stringify(halfDesktopViewport));
  expect(halfDesktopViewport.documentWidth).toBeLessThanOrEqual(halfDesktopViewport.width);
});
