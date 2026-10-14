import type { VercelRequest, VercelResponse } from "@vercel/node";
import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";
import { quests } from "../../../db/schema/quests.js";
import { sessions } from "../../../db/schema/sessions.js";
import { npcs } from "../../../db/schema/npcs.js";
import { items } from "../../../db/schema/items.js";
import { locations } from "../../../db/schema/locations.js";
import { entityLinks } from "../../../db/schema/entityLinks.js";

const mocks = vi.hoisted(() => ({
  user: vi.fn(), member: vi.fn(), campaign: vi.fn(), cors: vi.fn(),
  select: vi.fn(), transaction: vi.fn(), insert: vi.fn(), delete: vi.fn(), update: vi.fn(),
  rows: new Map<unknown, unknown[]>(), saved: [] as Record<string, unknown>[], links: [] as Record<string, unknown>[],
  values: [] as { table: unknown; value: any }[],
}));
vi.mock("../access.js", () => ({ getCurrentUser: mocks.user, requireCampaignMember: mocks.member, resolveCampaignBySlug: mocks.campaign }));
vi.mock("../cors.js", () => ({ setCorsHeaders: mocks.cors }));
vi.mock("../db.js", () => ({ db: { select: mocks.select, transaction: mocks.transaction } }));
import handler from "./quests.js";

const campaignId = "00000000-0000-4000-8000-000000000281";
const visibility = { hook: "gm-only", journey: "public", aftermath: "public" };
const base = {
  id: "quest-one", name: "Find the relic", type: "fetch", status: "Active", progress: 37,
  visibility: "public", startSessionId: "session-one", endSessionId: "", endDate: "", giverId: "npc-one",
  mainLocationId: "", shortDescription: "Visible summary", hook: "Secret hook", journey: "Visible journey",
  aftermath: "", sectionVisibility: visibility,
  mainObjectives: [
    { id: "main-a", type: "fetch", description: "Visible goal", visibility: "public" },
  ], secondaryObjectives: [{ id: "bonus-a", type: "discovery", description: "Bonus", visibility: "public" }],
};
function response() {
  const result: { status?: number; body?: any } = {};
  const res = { status: vi.fn((code) => { result.status = code; return res; }),
    json: vi.fn((body) => { result.body = body; return res; }), end: vi.fn() };
  return { res: res as unknown as VercelResponse, result };
}
function request(method: string, mode = "gm", quest?: unknown, questId?: string) {
  return { method, headers: { "x-dd-mode": mode }, query: { campaignId: "campaign-281", ...(questId ? { questId } : {}) },
    body: quest ? { quest } : {} } as unknown as VercelRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rows.clear(); mocks.saved = []; mocks.links = []; mocks.values = [];
  mocks.user.mockResolvedValue({ id: "user-281" });
  mocks.member.mockResolvedValue({ role: "gm" });
  mocks.campaign.mockResolvedValue({ id: campaignId, slug: "campaign-281" });
  mocks.rows.set(sessions, [{ id: "session-one", name: "Opening", sessionNumber: 1 }]);
  mocks.rows.set(npcs, [{ id: "npc-one", name: "Guide" }]);
  mocks.rows.set(items, []); mocks.rows.set(locations, []);
  mocks.select.mockImplementation(() => ({ from: (table: unknown) => ({ where: async () =>
    table === quests ? mocks.saved : mocks.rows.get(table) || [] }) }));
  mocks.insert.mockImplementation((table: unknown) => ({ values: (value: any) => {
    mocks.values.push({ table, value });
    return {
    onConflictDoUpdate: () => ({ returning: async () => { mocks.saved = [value]; return [value]; } }),
    onConflictDoNothing: async () => { if (table === entityLinks) mocks.links.push(...value); return []; },
    }; } }));
  mocks.delete.mockReturnValue({ where: async () => [] });
  mocks.update.mockReturnValue({ set: () => ({ where: async () => [] }) });
  mocks.transaction.mockImplementation(async (callback) => callback({ insert: mocks.insert, delete: mocks.delete,
    update: mocks.update, select: () => ({ from: (table: unknown) => ({ where: () => {
      const rows: any = table === quests ? [...mocks.saved] : table === entityLinks ? [...mocks.links] : [];
      rows.limit = async () => rows.slice(0, 1);
      return rows;
    } }) }) }));
});

test("GM create, edit, and reload retain manual progress and inactive end values", async () => {
  const created = response();
  await handler(request("PUT", "gm", { ...base, status: "Completed", endSessionId: "session-one", endDate: "2026-10-13" }), created.res);
  assert.equal(created.result.status, 200);
  assert.equal(mocks.transaction.mock.calls.length, 1);
  assert.equal(mocks.links.length, 3);
  const edited = response();
  await handler(request("PUT", "gm", { ...base, status: "Planned", progress: 91,
    endSessionId: "session-one", endDate: "2026-10-13" }), edited.res);
  assert.equal(edited.result.status, 200);
  const loaded = response();
  await handler(request("GET", "gm", undefined, base.id), loaded.res);
  assert.equal(loaded.result.body.quest.progress, 91);
  assert.equal(loaded.result.body.quest.endDate, "2026-10-13");
  assert.deepEqual(loaded.result.body.quest.mainObjectives.map((item: any) => item.id), ["main-a"]);
});

test("Player projection excludes hidden sections, objectives, and hidden entity references without changing manual progress", async () => {
  mocks.saved = [{ ...base, campaignId }];
  mocks.rows.set(npcs, []);
  const shown = response();
  await handler(request("GET", "player", undefined, base.id), shown.res);
  const quest = shown.result.body.quest;
  assert.equal(quest.progress, 37);
  assert.equal(quest.hook, "");
  assert.equal(quest.giverId, "");
  assert.equal(quest.shortDescription, "Visible summary");
  assert.deepEqual(quest.mainObjectives.map((item: any) => item.id), ["main-a"]);
  assert.equal(JSON.stringify(shown.result.body).includes("receiverIds"), false);
  assert.equal(JSON.stringify(shown.result.body).includes("Secret hook"), false);
  assert.equal(JSON.stringify(shown.result.body).includes("Guide"), false);
});

test("a GM-only Quest is absent from Player list and detail responses", async () => {
  mocks.saved = [{ ...base, campaignId, visibility: "gm-only" }];
  const list = response();
  await handler(request("GET", "player"), list.res);
  assert.deepEqual(list.result.body.quests, []);
  const detail = response();
  await handler(request("GET", "player", undefined, base.id), detail.res);
  assert.equal(detail.result.body.quest, null);
});

test("all statuses keep manually set progress, zero objectives, and eligible end values", async () => {
  for (const status of ["Active", "Abandoned", "Completed", "Planned"]) {
    const result = response();
    await handler(request("PUT", "gm", { ...base, status, progress: 0, mainObjectives: [],
      secondaryObjectives: [], endSessionId: "session-one", endDate: "2026-10-13" }), result.res);
    assert.equal(result.result.status, 200);
    assert.equal(result.result.body.quest.progress, 0);
    assert.deepEqual(result.result.body.quest.mainObjectives, []);
    const player = response();
    await handler(request("GET", "player", undefined, base.id), player.res);
    assert.equal(player.result.body.quest.endDate, status === "Completed" || status === "Abandoned" ? "2026-10-13" : "");
    assert.equal(mocks.saved[0].endDate, "2026-10-13");
  }
});

test("Player mode and nonmembers cannot save; invalid campaign references and types reject before transaction", async () => {
  const player = response();
  await handler(request("PUT", "player", base), player.res);
  assert.equal(player.result.status, 403);
  const invalid = response();
  await handler(request("PUT", "gm", { ...base, giverId: "other-campaign-npc" }), invalid.res);
  assert.equal(invalid.result.status, 400);
  const type = response();
  await handler(request("PUT", "gm", { ...base, type: "unknown" }), type.res);
  assert.equal(type.result.status, 400);
  const location = response();
  await handler(request("PUT", "gm", { ...base, mainLocationId: "other-campaign-location" }), location.res);
  assert.equal(location.result.status, 400);
  const multiple = response();
  await handler(request("PUT", "gm", { ...base, mainObjectives: [...base.mainObjectives, {
    id: "another", type: "combat", description: "Another", visibility: "public",
  }] }), multiple.res);
  assert.equal(multiple.result.status, 400);
  assert.equal(mocks.transaction.mock.calls.length, 0);
  mocks.member.mockRejectedValue(new Error("Campaign membership required"));
  const denied = response();
  await handler(request("GET", "gm"), denied.res);
  assert.equal(denied.result.status, 401);
});

test("main destination is projected only with an authorised location and link", async () => {
  mocks.saved = [{ ...base, campaignId, receiverIds: ["legacy-pc"],
    sectionVisibility: { ...visibility, shortDescription: "gm-only" } }];
  mocks.rows.set(locations, [{ id: "location-one", name: "Secret destination", visibility: "gm-only" }]);
  mocks.rows.set(entityLinks, [{ label: "leads_to", visibility: "GM", entityAType: "Quest",
    entityAId: base.id, entityBType: "Map", entityBId: "location-one" }]);
  const hidden = response();
  await handler(request("GET", "player", undefined, base.id), hidden.res);
  assert.equal(hidden.result.body.quest.mainLocationId, "");
  assert.equal(hidden.result.body.quest.destinationHidden, true);
  assert.equal(JSON.stringify(hidden.result.body).includes("location-one"), false);
  assert.equal(JSON.stringify(hidden.result.body).includes("Secret destination"), false);
  assert.equal(hidden.result.body.quest.shortDescription, "Visible summary");
  assert.equal("receiverIds" in hidden.result.body.quest, false);
  const gm = response();
  await handler(request("GET", "gm", undefined, base.id), gm.res);
  assert.equal(gm.result.body.quest.mainLocationId, "location-one");
  mocks.rows.set(entityLinks, [{ label: "leads_to", visibility: "Player", entityAType: "Quest",
    entityAId: base.id, entityBType: "Map", entityBId: "location-one" }]);
  const hiddenLocation = response();
  await handler(request("GET", "player", undefined, base.id), hiddenLocation.res);
  assert.equal(hiddenLocation.result.body.quest.destinationHidden, true);
  assert.equal(JSON.stringify(hiddenLocation.result.body).includes("location-one"), false);
  mocks.rows.set(locations, [{ id: "location-one", name: "Destination", visibility: "public" }]);
  const shown = response();
  await handler(request("GET", "player", undefined, base.id), shown.res);
  assert.equal(shown.result.body.quest.mainLocationId, "location-one");
  assert.equal(shown.result.body.quest.destinationHidden, undefined);
  mocks.rows.set(entityLinks, []);
  const unset = response();
  await handler(request("GET", "player", undefined, base.id), unset.res);
  assert.equal(unset.result.body.quest.mainLocationId, "");
  assert.equal(unset.result.body.quest.destinationHidden, undefined);
});

test("saving a main destination uses one Quest location link and omits receiver writes", async () => {
  mocks.rows.set(locations, [{ id: "location-one", name: "Destination" }]);
  const created = response();
  await handler(request("PUT", "gm", { ...base, mainLocationId: "location-one" }), created.res);
  assert.equal(created.result.status, 200);
  assert.equal(mocks.transaction.mock.calls.length, 1);
  const questWrite = mocks.values.find((entry) => entry.table === quests)?.value;
  assert.equal("receiverIds" in questWrite, false);
  assert.equal("mainLocationId" in questWrite, false);
  const mainLinks = mocks.values.filter((entry) => entry.table === entityLinks && entry.value.label === "leads_to");
  assert.equal(mainLinks.length, 1);
  assert.equal(mainLinks[0].value.entityBId === "location-one" || mainLinks[0].value.entityAId === "location-one", true);
  assert.equal(mainLinks[0].value.visibility, "Player");
});

test("failed relationship persistence does not report a saved Quest", async () => {
  mocks.insert.mockImplementation((table: unknown) => ({ values: (value: any) => ({
    onConflictDoUpdate: () => ({ returning: async () => [value] }),
    onConflictDoNothing: async () => { if (table === entityLinks) throw new Error("Link write failed"); return []; },
  }) }));
  const failed = response();
  await handler(request("PUT", "gm", base), failed.res);
  assert.notEqual(failed.result.status, 200);
  assert.equal(failed.result.body.error, "Link write failed");
});

test("saving hero relationships leaves legacy Quest links outside its owned IDs untouched", async () => {
  mocks.links = [{ id: "legacy-quest-link", label: "assigned_to", entityAType: "Quest", entityAId: base.id,
    entityBType: "PC", entityBId: "pc-one" }];
  const saved = response();
  await handler(request("PUT", "gm", base), saved.res);
  assert.equal(saved.result.status, 200);
  assert.equal(mocks.delete.mock.calls.length, 0);
  assert.equal(mocks.links.some((link) => link.id === "legacy-quest-link"), true);
});
