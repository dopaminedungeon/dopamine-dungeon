import type { VercelRequest, VercelResponse } from "@vercel/node";
import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  requireCampaignMember: vi.fn(),
  resolveCampaignBySlug: vi.fn(),
  setCorsHeaders: vi.fn(),
  transaction: vi.fn(),
  insert: vi.fn(),
  delete: vi.fn(),
  select: vi.fn(),
  failEntry: false,
}));

vi.mock("../access.js", () => ({
  getCurrentUser: mocks.getCurrentUser,
  requireCampaignMember: mocks.requireCampaignMember,
  resolveCampaignBySlug: mocks.resolveCampaignBySlug,
}));
vi.mock("../cors.js", () => ({ setCorsHeaders: mocks.setCorsHeaders }));
vi.mock("../db.js", () => ({ db: { transaction: mocks.transaction, select: mocks.select } }));

import handler from "./bag.js";
import { bagCurrency, bagEntries } from "../../../db/schema/bag.js";

const campaignId = "00000000-0000-4000-8000-000000000275";

function response() {
  const result: { status?: number; body?: unknown } = {};
  const res = {
    status: vi.fn((status: number) => { result.status = status; return res; }),
    json: vi.fn((body: unknown) => { result.body = body; return res; }),
    end: vi.fn(),
  };
  return { result, res: res as unknown as VercelResponse };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.failEntry = false;
  mocks.getCurrentUser.mockResolvedValue({ id: "user-275" });
  mocks.resolveCampaignBySlug.mockResolvedValue({ id: campaignId, slug: "campaign-275" });
  mocks.requireCampaignMember.mockResolvedValue({ role: "player" });
  mocks.insert.mockImplementation((table) => ({
    values: (values: unknown) => ({
      onConflictDoUpdate: async () => {
        if (table === bagEntries && mocks.failEntry) throw new Error("Entry write failed");
        return values;
      },
    }),
  }));
  mocks.delete.mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
  mocks.select.mockReturnValue({ from: () => ({ where: () => Promise.resolve([]) }) });
  mocks.transaction.mockImplementation(async (callback) => callback({ insert: mocks.insert, delete: mocks.delete, select: mocks.select }));
});

for (const mode of ["gm", "player"]) {
  test(`bag PUT keeps campaign membership authorization in ${mode} mode and writes inside one transaction`, async () => {
    const bag = {
      currency: { pp: 1, gp: 0, ep: 0, sp: 8, cp: 4 },
      looseItems: [{ id: "entry-275", name: "Rope", qty: 1 }],
      linkedEntries: [],
    };
    const req = {
      method: "PUT",
      query: { campaignId: "campaign-275" },
      headers: { "x-dd-mode": mode },
      body: { bag },
    } as unknown as VercelRequest;
    const { res, result } = response();

    await handler(req, res);

    assert.equal(result.status, 200);
    assert.equal(mocks.requireCampaignMember.mock.calls.length, 1);
    assert.deepEqual(mocks.requireCampaignMember.mock.calls[0][0], { campaignId, userId: "user-275" });
    assert.equal(mocks.transaction.mock.calls.length, 1);
    assert.equal(mocks.insert.mock.calls[0][0], bagCurrency);
    assert.equal(mocks.insert.mock.calls[1][0], bagEntries);
    assert.equal(mocks.delete.mock.calls.length, 1);
  });
}

test("failed entry persistence rejects the transaction instead of reporting a saved bag", async () => {
  mocks.failEntry = true;
  const { res, result } = response();
  await handler({
    method: "PUT",
    query: { campaignId: "campaign-275" },
    body: { bag: { currency: { sp: 8 }, looseItems: [{ id: "entry-275", name: "Rope" }], linkedEntries: [] } },
  } as unknown as VercelRequest, res);

  assert.equal(mocks.transaction.mock.calls.length, 1);
  assert.equal(result.status, 401);
  assert.deepEqual(result.body, { ok: false, error: "Entry write failed" });
  assert.equal(mocks.delete.mock.calls.length, 0);
});

test("a non-member cannot start a bag write", async () => {
  mocks.requireCampaignMember.mockRejectedValue(new Error("Campaign membership required"));
  const { res, result } = response();
  await handler({
    method: "PUT",
    query: { campaignId: "campaign-275" },
    body: { bag: { currency: { sp: 8 }, looseItems: [], linkedEntries: [] } },
  } as unknown as VercelRequest, res);

  assert.equal(result.status, 401);
  assert.equal(mocks.transaction.mock.calls.length, 0);
});

test("selling a loose entry credits exact copper once and a retry cannot credit again", async () => {
  let storedEntry: { id: string; sourceType: string; itemId: string | null; quantity: number; worthGp: number } | null = {
    id: "entry-275", sourceType: "loose", itemId: null, quantity: 2, worthGp: 1.25,
  };
  let storedCopper = 4;
  mocks.transaction.mockImplementation(async (callback) => {
    const entryBefore = storedEntry;
    const copperBefore = storedCopper;
    const tx = {
      delete: () => ({ where: () => ({ returning: async () => {
        const removed = storedEntry;
        storedEntry = null;
        return removed ? [removed] : [];
      } }) }),
      insert: () => ({ values: (values: { cp: number }) => ({ onConflictDoUpdate: () => ({ returning: async () => {
        storedCopper += values.cp;
        return [{ cp: storedCopper, sp: 0, ep: 0, gp: 0, pp: 0 }];
      } }) }) }),
      select: () => ({ from: () => ({ where: async () => storedEntry ? [storedEntry] : [] }) }),
    };
    try { return await callback(tx); }
    catch (error) { storedEntry = entryBefore; storedCopper = copperBefore; throw error; }
  });
  const request = {
    method: "POST", query: { campaignId: "campaign-275", action: "sell" },
    body: { entryId: "entry-275", saleValueGp: "2.75" },
    headers: { "x-dd-mode": "gm" },
  } as unknown as VercelRequest;

  const first = response();
  await handler(request, first.res);
  assert.equal(first.result.status, 200);
  assert.equal(storedEntry, null);
  assert.equal(storedCopper, 279);
  assert.deepEqual((first.result.body as { bag: { currency: { cp: number }; looseItems: unknown[] } }).bag.currency.cp, 279);

  const retry = response();
  await handler(request, retry.res);
  assert.equal(retry.result.status, 409);
  assert.equal(storedCopper, 279);
});

test("invalid sale values and non-members cannot start a sale transaction", async () => {
  for (const saleValueGp of ["", "1.234", "-2"]) {
    const { res, result } = response();
    await handler({ method: "POST", query: { campaignId: "campaign-275", action: "sell" },
      body: { entryId: "entry-275", saleValueGp } } as unknown as VercelRequest, res);
    assert.equal(result.status, 400);
  }
  assert.equal(mocks.transaction.mock.calls.length, 0);
  mocks.requireCampaignMember.mockRejectedValue(new Error("Campaign membership required"));
  const denied = response();
  await handler({ method: "POST", query: { campaignId: "campaign-275", action: "sell" },
    body: { entryId: "entry-275", saleValueGp: "1" } } as unknown as VercelRequest, denied.res);
  assert.equal(denied.result.status, 401);
  assert.equal(mocks.transaction.mock.calls.length, 0);
});

test("invalid bag-entry worth is rejected before a bag write", async () => {
  const { res, result } = response();
  await handler({ method: "PUT", query: { campaignId: "campaign-275" },
    body: { bag: { currency: { gp: 1 }, looseItems: [{ id: "loose", name: "Rope", worth: 1.234 }], linkedEntries: [] } }
  } as unknown as VercelRequest, res);
  assert.equal(result.status, 401);
  assert.match((result.body as { error: string }).error, /two decimal places/);
  assert.equal(mocks.transaction.mock.calls.length, 0);
});

test("Player bag reads hide linked entries whose source item is not public", async () => {
  mocks.requireCampaignMember.mockResolvedValue({ role: "gm" });
  mocks.select.mockImplementation(() => ({ from: (table: unknown) => ({
    where: () => {
      if (table === bagCurrency) return { limit: async () => [] };
      if (table === bagEntries) return Promise.resolve([
        { id: "public-entry", sourceType: "linked", itemId: "public-item", quantity: 1, worthGp: 3 },
        { id: "hidden-entry", sourceType: "linked", itemId: "hidden-item", quantity: 1, worthGp: 9 },
      ]);
      return Promise.resolve([{ id: "public-item" }]);
    },
  }) }));
  const player = response();
  await handler({ method: "GET", query: { campaignId: "campaign-275" }, headers: { "x-dd-mode": "player" } } as unknown as VercelRequest, player.res);
  assert.equal(player.result.status, 200);
  assert.deepEqual((player.result.body as { bag: { linkedEntries: { id: string }[] } }).bag.linkedEntries.map((entry) => entry.id), ["public-entry"]);

  const gm = response();
  await handler({ method: "GET", query: { campaignId: "campaign-275" }, headers: { "x-dd-mode": "gm" } } as unknown as VercelRequest, gm.res);
  assert.equal(gm.result.status, 200);
  assert.deepEqual((gm.result.body as { bag: { linkedEntries: { id: string }[] } }).bag.linkedEntries.map((entry) => entry.id), ["public-entry", "hidden-entry"]);
});

test("Player bag writes preserve hidden linked entries without returning them", async () => {
  const hiddenRow = { rowId: "hidden-row", campaignId, id: "hidden-entry", sourceType: "linked",
    itemId: "hidden-item", name: "", category: null, quantity: 1, worthGp: 9,
    notes: null, addedBy: null, createdAt: new Date(), updatedAt: new Date() };
  mocks.select.mockReturnValue({ from: () => ({ where: async () => [{ id: "public-item" }] }) });
  mocks.transaction.mockImplementation(async (callback) => callback({
    select: () => ({ from: () => ({ where: async () => [hiddenRow] }) }),
    insert: mocks.insert, delete: mocks.delete,
  }));
  const { res, result } = response();
  await handler({ method: "PUT", query: { campaignId: "campaign-275" }, headers: { "x-dd-mode": "player" },
    body: { bag: { currency: {}, looseItems: [], linkedEntries: [] } } } as unknown as VercelRequest, res);
  assert.equal(result.status, 200);
  assert.equal(mocks.insert.mock.calls[1][0], bagEntries);
  assert.equal((result.body as { bag: { linkedEntries: unknown[] } }).bag.linkedEntries.length, 0);
});

test("a failed linked sale rolls back entry removal and does not credit currency", async () => {
  mocks.requireCampaignMember.mockResolvedValue({ role: "gm" });
  const entry = { id: "linked-entry", sourceType: "linked", itemId: "public-item", quantity: 2, worthGp: 1.5 };
  let storedEntry: typeof entry | null = entry;
  let storedCopper = 10;
  mocks.transaction.mockImplementation(async (callback) => {
    const before = storedEntry;
    const tx = {
      delete: () => ({ where: () => ({ returning: async () => { storedEntry = null; return [entry]; } }) }),
      insert: () => ({ values: () => ({ onConflictDoUpdate: () => ({ returning: async () => { throw new Error("Currency write failed"); } }) }) }),
      select: () => ({ from: () => ({ where: async () => [] }) }),
    };
    try { return await callback(tx); }
    catch (error) { storedEntry = before; throw error; }
  });
  const failed = response();
  await handler({ method: "POST", query: { campaignId: "campaign-275", action: "sell" },
    headers: { "x-dd-mode": "gm" }, body: { entryId: entry.id, saleValueGp: "3.25" } } as unknown as VercelRequest, failed.res);
  assert.equal(failed.result.status, 401);
  assert.deepEqual(storedEntry, entry);
  assert.equal(storedCopper, 10);
});
