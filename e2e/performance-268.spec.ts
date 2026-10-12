import { randomUUID } from "node:crypto";
import { test, expect } from "./auth.fixture";
import { createVerifiedUser } from "./auth-emulator";

const publicNpcs = Array.from({ length: 120 }, (_, index) => ({
  id: `npc-${String(index).padStart(3, "0")}`,
  name: `NPC ${String(index).padStart(3, "0")}`,
  type: "NPC", status: "active", role: "neutral", visibility: "public",
  description: "Shared campaign profile",
}));
const hiddenNpcs = Array.from({ length: 60 }, (_, index) => ({
  id: `private-npc-${index}`, name: `Private NPC ${index}`,
  type: "NPC", status: "active", role: "unknown", visibility: "gm-only",
  description: "GM-only profile",
}));
const publicLocations = Array.from({ length: 120 }, (_, index) => ({
  id: `map-${String(index).padStart(3, "0")}`,
  name: `Location ${String(index).padStart(3, "0")}`,
  category: "District", visibility: "public", aliases: [],
}));
const hiddenLocations = Array.from({ length: 60 }, (_, index) => ({
  id: `private-map-${index}`, name: `Private Location ${index}`,
  category: "District", visibility: "gm-only", aliases: [],
}));

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test.use({ apiMeDelayMs: 180 });

test("@audit268 measures protected load and entity routes with fixed synthetic data", async ({ page, request }) => {
  const requests: Array<{ path: string; mode: string | undefined }> = [];
  const responses: Array<{ path: string; at: number }> = [];
  page.on("request", (item) => {
    if (new URL(item.url()).pathname.startsWith("/api/")) {
      requests.push({ path: new URL(item.url()).pathname, mode: item.headers()["x-dd-mode"] });
    }
  });
  page.on("response", (item) => {
    if (new URL(item.url()).pathname === "/api/worldbuilding") {
      responses.push({ path: item.url(), at: Date.now() });
    }
  });

  await page.route("**/api/worldbuilding?**", async (route) => {
    const url = new URL(route.request().url());
    const gm = route.request().headers()["x-dd-mode"] === "gm";
    const entity = url.searchParams.get("entity");
    const resource = url.searchParams.get("resource");
    if (entity === "npcs") {
      if (url.searchParams.has("npcId")) {
        await pause(80);
        await route.fulfill({ json: { ok: true, npc: publicNpcs[0] } });
      } else {
        await pause(220);
        await route.fulfill({ json: { ok: true, npcs: gm ? [...publicNpcs, ...hiddenNpcs] : publicNpcs } });
      }
      return;
    }
    if (entity === "locations") {
      if (url.searchParams.has("locationId")) {
        await pause(80);
        await route.fulfill({ json: { ok: true, location: publicLocations[0] } });
      } else {
        await pause(620);
        await route.fulfill({ json: { ok: true, locations: gm ? [...publicLocations, ...hiddenLocations] : publicLocations } });
      }
      return;
    }
    await pause(620);
    if (entity === "lore") { await route.fulfill({ json: { ok: true, lore: [] } }); return; }
    if (resource === "items") { await route.fulfill({ json: { ok: true, items: [] } }); return; }
    if (resource === "sessions") { await route.fulfill({ json: { ok: true, sessions: [] } }); return; }
    if (resource === "entityLinks") { await route.fulfill({ json: { ok: true, links: [] } }); return; }
    await route.abort("blockedbyclient");
  });

  const email = `audit-${randomUUID()}@example.test`;
  await createVerifiedUser(request, email, "DungeonTest42!");
  await page.goto("/home");
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("DungeonTest42!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "E2E Campaign" }).first()).toBeVisible();

  const measurements: Array<Record<string, unknown>> = [];
  for (const mode of ["gm", "player"] as const) {
    await page.getByRole("button", { name: mode === "gm" ? "GM" : "Player", exact: true }).click();
    for (let run = 1; run <= 3; run += 1) {
      const initialStart = Date.now();
      const initialRequests = requests.length;
      await page.reload();
      await page.getByRole("heading", { name: "E2E Campaign" }).first().waitFor();
      measurements.push({ mode, run, flow: "protected-home", ms: Date.now() - initialStart,
        requests: requests.length - initialRequests });

      const listStart = Date.now();
      const listRequests = requests.length;
      await page.locator('aside a[href="/npcs"]').click();
      await page.locator('a[href="/npcs/npc-000"]').waitFor();
      measurements.push({ mode, run, flow: "npc-list", ms: Date.now() - listStart,
        requests: requests.length - listRequests, rows: mode === "gm" ? 180 : 120 });

      const profileStart = Date.now();
      const profileRequests = requests.length;
      const profileResponses = responses.length;
      await page.locator('a[href="/npcs/npc-000"]').click();
      await page.getByRole("heading", { name: "NPC 000" }).waitFor();
      const headingMs = Date.now() - profileStart;
      await expect(page.getByText("Loading linked campaign details...")).toBeVisible();
      await expect.poll(() => responses.length - profileResponses).toBeGreaterThanOrEqual(6);
      await expect(page.getByText("No linked locations yet.")).toBeVisible();
      measurements.push({ mode, run, flow: "npc-profile", ms: Date.now() - profileStart,
        headingMs,
        lastResponseMs: Math.max(...responses.slice(profileResponses).map((item) => item.at - profileStart)),
        requests: requests.length - profileRequests });

      const locationStart = Date.now();
      const locationRequests = requests.length;
      await page.locator('aside a[href="/maps"]').click();
      await page.locator('a[href="/maps/map-000"]').waitFor();
      measurements.push({ mode, run, flow: "location-list", ms: Date.now() - locationStart,
        requests: requests.length - locationRequests, rows: mode === "gm" ? 180 : 120 });
      await page.locator('aside a[href="/home"]').click();
    }
    if (mode === "player") {
      await expect(page.getByText("Private NPC 0")).toHaveCount(0);
      await expect(page.getByText("Private Location 0")).toHaveCount(0);
    }
  }
  console.log(`PERF268 ${process.env.PERF268_PHASE || "measurement"} ${JSON.stringify(measurements)}`);
});

test("@audit268 keeps scoped loading, retry, empty, and mode changes clear", async ({ page, request, expectedConsoleErrors }) => {
  expectedConsoleErrors.push("503 (Service Unavailable)", "[Npcs] Failed to load NPCs", "[NpcProfile] Failed to load NPC", "[NpcProfile] Failed to load linked details", "[Locations] Failed to load locations");
  let failNpcs = true;
  let failProfile = true;
  let failLocations = true;
  let emptyLocations = false;
  const observedModes: string[] = [];
  await page.route("**/api/worldbuilding?**", async (route) => {
    const url = new URL(route.request().url());
    const mode = route.request().headers()["x-dd-mode"];
    observedModes.push(mode);
    const entity = url.searchParams.get("entity");
    const resource = url.searchParams.get("resource");
    if (entity === "npcs" && url.searchParams.has("npcId")) {
      await pause(180);
      await route.fulfill(failProfile
        ? { status: 503, json: { error: "Temporary failure" } }
        : { json: { ok: true, npc: publicNpcs[0] } });
      return;
    }
    if (entity === "npcs") {
      await pause(180);
      await route.fulfill(failNpcs
        ? { status: 503, json: { error: "Temporary failure" } }
        : { json: { ok: true, npcs: mode === "gm" ? [publicNpcs[0], hiddenNpcs[0]] : [publicNpcs[0]] } });
      return;
    }
    if (entity === "locations") {
      await pause(180);
      await route.fulfill(failLocations
        ? { status: 503, json: { error: "Temporary failure" } }
        : { json: { ok: true, locations: emptyLocations ? [] : [publicLocations[0]] } });
      return;
    }
    if (entity === "lore") { await route.fulfill({ json: { ok: true, lore: [] } }); return; }
    if (resource === "items") { await route.fulfill({ json: { ok: true, items: [] } }); return; }
    if (resource === "sessions") { await route.fulfill({ json: { ok: true, sessions: [] } }); return; }
    if (resource === "entityLinks") { await route.fulfill({ json: { ok: true, links: [] } }); return; }
    await route.abort("blockedbyclient");
  });

  const email = `audit-${randomUUID()}@example.test`;
  await createVerifiedUser(request, email, "DungeonTest42!");
  await page.goto("/home");
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("DungeonTest42!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "E2E Campaign" }).first()).toBeVisible();

  await page.locator('aside a[href="/npcs"]').click();
  await expect(page.getByText("Loading NPCs for this campaign...")).toBeVisible();
  await expect(page.getByText("Unable to load NPCs right now.")).toBeVisible();
  await expect(page.getByText("No NPCs found")).toHaveCount(0);
  failNpcs = false;
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.locator('a[href="/npcs/npc-000"]')).toBeVisible();
  await expect(page.getByText("Private NPC 0")).toBeVisible();

  await page.locator('a[href="/npcs/npc-000"]').click();
  await expect(page.getByRole("heading", { name: "Unable to load NPC" })).toBeVisible();
  failProfile = false;
  failLocations = false;
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("heading", { name: "NPC 000" })).toBeVisible();
  await expect(page.getByText("No linked locations yet.")).toBeVisible();

  await page.getByRole("button", { name: "Player", exact: true }).click();
  await expect(page.getByRole("heading", { name: "NPC 000" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "NPC 000" })).toBeVisible();
  await page.locator('aside a[href="/npcs"]').click();
  await expect(page.locator('a[href="/npcs/npc-000"]')).toBeVisible();
  await expect(page.getByText("Private NPC 0")).toHaveCount(0);
  expect(observedModes[observedModes.length - 1]).toBe("player");

  failLocations = true;
  await page.locator('aside a[href="/maps"]').click();
  await expect(page.getByText("Unable to load Locations right now.")).toBeVisible();
  await expect(page.getByText("No Locations yet")).toHaveCount(0);
  failLocations = false;
  emptyLocations = true;
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("No Locations yet")).toBeVisible();
  emptyLocations = false;
  await page.reload();
  await expect(page.locator('a[href="/maps/map-000"]')).toBeVisible();
});
