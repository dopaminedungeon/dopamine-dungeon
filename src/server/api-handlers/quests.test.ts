import type { VercelRequest, VercelResponse } from "@vercel/node";
import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";
import { quests } from "../../../db/schema/quests.js";
import { sessions } from "../../../db/schema/sessions.js";
import { npcs } from "../../../db/schema/npcs.js";
import { characters } from "../../../db/schema/characters.js";
import { items } from "../../../db/schema/items.js";
import { locations } from "../../../db/schema/locations.js";
import { entityLinks } from "../../../db/schema/entityLinks.js";

const mocks = vi.hoisted(() => ({
  user: vi.fn(), member: vi.fn(), campaign: vi.fn(), cors: vi.fn(),
  select: vi.fn(), transaction: vi.fn(), insert: vi.fn(), delete: vi.fn(),
  rows: new Map<unknown, unknown[]>(), saved: [] as Record<string, unknown>[], links: [] as Record<string, unknown>[],
}));
vi.mock("../access.js", () => ({ getCurrentUser: mocks.user, requireCampaignMember: mocks.member, resolveCampaignBySlug: mocks.campaign }));
vi.mock("../cors.js", () => ({ setCorsHeaders: mocks.cors }));
vi.mock("../db.js", () => ({ db: { select: mocks.select, transaction: mocks.transaction } }));
import handler from "./quests.js";

const campaignId = "00000000-0000-4000-8000-000000000281";
const visibility = { shortDescription: "public", hook: "gm-only", journey: "public",
  mainObjectives: "public", secondaryObjectives: "public", aftermath: "public" };
const base = {
  id: "quest-one", name: "Find the relic", type: "fetch", status: "Active", progress: 37,
  visibility: "public", startSessionId: "session-one", endSessionId: "", endDate: "", giverId: "npc-one",
  receiverIds: ["pc-one"], shortDescription: "Visible summary", hook: "Secret hook", journey: "Visible journey",
  aftermath: "", sectionVisibility: visibility,
  mainObjectives: [
    { id: "main-a", type: "fetch", description: "Visible goal", visibility: "public" },
    { id: "main-b", type: "combat", description: "Hidden goal", visibility: "gm-only" },
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
  mocks.rows.clear(); mocks.saved = []; mocks.links = [];
  mocks.user.mockResolvedValue({ id: "user-281" });
  mocks.member.mockResolvedValue({ role: "gm" });
  mocks.campaign.mockResolvedValue({ id: campaignId, slug: "campaign-281" });
  mocks.rows.set(sessions, [{ id: "session-one", name: "Opening", sessionNumber: 1 }]);
  mocks.rows.set(npcs, [{ id: "npc-one", name: "Guide" }]);
  mocks.rows.set(characters, [{ id: "pc-one", name: "Hero" }]);
  mocks.rows.set(items, []); mocks.rows.set(locations, []);
  mocks.select.mockImplementation(() => ({ from: (table: unknown) => ({ where: async () =>
    table === quests ? mocks.saved : mocks.rows.get(table) || [] }) }));
  mocks.insert.mockImplementation((table: unknown) => ({ values: (value: any) => ({
    onConflictDoUpdate: () => ({ returning: async () => { mocks.saved = [value]; return [value]; } }),
    onConflictDoNothing: async () => { if (table === entityLinks) mocks.links = value; return []; },
  }) }));
  mocks.delete.mockReturnValue({ where: async () => [] });
  mocks.transaction.mockImplementation(async (callback) => callback({ insert: mocks.insert, delete: mocks.delete,
    select: () => ({ from: () => ({ where: async () => [] }) }) }));
});

test("GM create, edit, and reload retain manual progress, objective order, and inactive end values", async () => {
  const created = response();
  await handler(request("PUT", "gm", { ...base, status: "Completed", endSessionId: "session-one", endDate: "2026-10-13" }), created.res);
  assert.equal(created.result.status, 200);
  assert.equal(mocks.transaction.mock.calls.length, 1);
  assert.equal(mocks.links.length, 4);
  const edited = response();
  await handler(request("PUT", "gm", { ...base, status: "Planned", progress: 91,
    endSessionId: "session-one", endDate: "2026-10-13", mainObjectives: [...base.mainObjectives].reverse() }), edited.res);
  assert.equal(edited.result.status, 200);
  const loaded = response();
  await handler(request("GET", "gm", undefined, base.id), loaded.res);
  assert.equal(loaded.result.body.quest.progress, 91);
  assert.equal(loaded.result.body.quest.endDate, "2026-10-13");
  assert.deepEqual(loaded.result.body.quest.mainObjectives.map((item: any) => item.id), ["main-b", "main-a"]);
  assert.equal(mocks.links.length, 3);
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
  assert.deepEqual(quest.mainObjectives.map((item: any) => item.id), ["main-a"]);
  assert.equal(JSON.stringify(shown.result.body).includes("Hidden goal"), false);
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
  assert.equal(mocks.transaction.mock.calls.length, 0);
  mocks.member.mockRejectedValue(new Error("Campaign membership required"));
  const denied = response();
  await handler(request("GET", "gm"), denied.res);
  assert.equal(denied.result.status, 401);
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
  mocks.transaction.mockImplementation(async (callback) => callback({ insert: mocks.insert, delete: mocks.delete,
    select: () => ({ from: () => ({ where: async () => [{ id: "legacy-quest-link" }] }) }) }));
  const saved = response();
  await handler(request("PUT", "gm", base), saved.res);
  assert.equal(saved.result.status, 200);
  assert.equal(mocks.delete.mock.calls.length, 0);
  assert.equal(mocks.links.every((link) => String(link.id).startsWith("quest-hero:quest-one:")), true);
});
