import type { VercelRequest, VercelResponse } from "@vercel/node";
import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";

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
import { bagCurrency, bagEntries, bagTransactions } from "../../../db/schema/bag.js";

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
      onConflictDoNothing: async () => undefined,
      onConflictDoUpdate: () => ({ returning: async () => {
        if (table === bagEntries && mocks.failEntry) throw new Error("Entry write failed");
        return [values];
      }, then: (resolve: (value: unknown) => void) => {
        if (table === bagEntries && mocks.failEntry) throw new Error("Entry write failed");
        resolve(values);
      } }),
    }),
  }));
  mocks.delete.mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
  mocks.select.mockImplementation(() => ({ from: (table: unknown) => ({ where: () => {
    const rows = table === bagCurrency ? [{ gp: 0, sp: 0, cp: 0, ep: 0, pp: 0 }] : [];
    const result = Object.assign(Promise.resolve(rows), { for: () => Promise.resolve(rows) });
    return Object.assign(result, { limit: () => result });
  } }) }));
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
    assert.ok(mocks.insert.mock.calls.some(([table]) => table === bagEntries));
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

test("selling a loose entry distributes exact proceeds into a mixed purse and a retry cannot credit again", async () => {
  let storedEntry: { id: string; sourceType: string; itemId: string | null; quantity: number; worthGp: number } | null = {
    id: "entry-275", sourceType: "loose", itemId: null, quantity: 2, worthGp: 1.25,
  };
  let storedCurrency = { pp: 1, ep: 2, gp: 3, sp: 4, cp: 5 };
  const records: { type: string; amountCp: number; balanceAfterCp: number; actorUserId: string }[] = [];
  mocks.transaction.mockImplementation(async (callback) => {
    const entryBefore = storedEntry;
    const currencyBefore = { ...storedCurrency };
    const recordCountBefore = records.length;
    const tx = {
      delete: () => ({ where: () => ({ returning: async () => {
        const removed = storedEntry;
        storedEntry = null;
        return removed ? [removed] : [];
      } }) }),
      insert: (table: unknown) => ({ values: (values: { gp: number; sp: number; cp: number }) => table === bagTransactions
        ? Promise.resolve().then(() => { records.push(values as unknown as typeof records[number]); })
        : ({ onConflictDoUpdate: () => ({ returning: async () => {
        storedCurrency = { ...storedCurrency, gp: storedCurrency.gp + values.gp, sp: storedCurrency.sp + values.sp, cp: storedCurrency.cp + values.cp };
        return [storedCurrency];
      } }) }) }),
      select: () => ({ from: () => ({ where: async () => storedEntry ? [storedEntry] : [] }) }),
    };
    try { return await callback(tx); }
    catch (error) { storedEntry = entryBefore; storedCurrency = currencyBefore; records.length = recordCountBefore; throw error; }
  });
  const request = {
    method: "POST", query: { campaignId: "campaign-275", action: "sell" },
    body: { entryId: "entry-275", saleValueGp: "27.35" },
    headers: { "x-dd-mode": "gm" },
  } as unknown as VercelRequest;

  const first = response();
  await handler(request, first.res);
  assert.equal(first.result.status, 200);
  assert.equal(storedEntry, null);
  assert.deepEqual(storedCurrency, { pp: 1, ep: 2, gp: 30, sp: 7, cp: 10 });
  assert.equal(records.length, 1);
  assert.equal(records[0].type, "sale");
  assert.equal(records[0].amountCp, 2735);
  assert.equal(records[0].balanceAfterCp, 4180);
  assert.equal(records[0].actorUserId, "user-275");
  assert.deepEqual((first.result.body as { bag: { currency: typeof storedCurrency } }).bag.currency, storedCurrency);

  const retry = response();
  await handler(request, retry.res);
  assert.equal(retry.result.status, 409);
  assert.deepEqual(storedCurrency, { pp: 1, ep: 2, gp: 30, sp: 7, cp: 10 });
  assert.equal(records.length, 1);
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
    select: () => ({ from: (table: unknown) => ({ where: () => {
      const rows = table === bagCurrency ? [{ gp: 0, sp: 0, cp: 0, ep: 0, pp: 0 }]
        : table === bagEntries ? [hiddenRow] : [];
      const result = Object.assign(Promise.resolve(rows), { for: () => Promise.resolve(rows) });
      return Object.assign(result, { limit: () => result });
    } }) }),
    insert: mocks.insert, delete: mocks.delete,
  }));
  const { res, result } = response();
  await handler({ method: "PUT", query: { campaignId: "campaign-275" }, headers: { "x-dd-mode": "player" },
    body: { bag: { currency: {}, looseItems: [], linkedEntries: [] } } } as unknown as VercelRequest, res);
  assert.equal(result.status, 200);
  assert.ok(mocks.insert.mock.calls.some(([table]) => table === bagEntries));
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

test("bag saves record actual spend, add, and direct adjustment once, while entry-only saves record nothing", async () => {
  mocks.requireCampaignMember.mockResolvedValue({ role: "gm" });
  let storedCurrency = { pp: 1, gp: 1, ep: 0, sp: 2, cp: 4 };
  const records: { requestId: string; type: string; amountCp: number; balanceAfterCp: number; actorUserId: string }[] = [];
  let requestId = "";
  let failRecord = false;
  let failBalance = false;
  mocks.transaction.mockImplementation(async (callback) => {
    const before = { ...storedCurrency };
    const beforeRecords = records.length;
    const tx = {
      select: () => ({ from: (table: unknown) => ({ where: () => {
        const rows = table === bagCurrency ? [storedCurrency] : table === bagTransactions
          ? records.filter((record) => record.requestId === requestId) : [];
        const result = Object.assign(Promise.resolve(rows), { for: () => Promise.resolve(rows) });
        return Object.assign(result, { limit: () => result });
      } }) }),
      insert: (table: unknown) => ({ values: (values: typeof storedCurrency & { requestId?: string }) => ({
        onConflictDoNothing: async () => undefined,
        onConflictDoUpdate: () => ({ returning: async () => {
          if (table === bagCurrency && failBalance) throw new Error("Balance write failed");
          if (table === bagCurrency) storedCurrency = { pp: values.pp, gp: values.gp, ep: values.ep, sp: values.sp, cp: values.cp };
          return [storedCurrency];
        }, then: (resolve: (value: unknown) => void) => resolve(undefined) }),
        then: (resolve: (value: unknown) => void) => {
          if (table === bagTransactions && failRecord) throw new Error("Report write failed");
          if (table === bagTransactions) records.push(values as unknown as typeof records[number]);
          resolve(undefined);
        },
      }) }),
      delete: () => ({ where: async () => [] }),
    };
    try { return await callback(tx); }
    catch (error) { storedCurrency = before; records.length = beforeRecords; throw error; }
  });
  const save = async (currency: typeof storedCurrency, operation?: { id: string; type: string }) => {
    requestId = operation?.id || "";
    const result = response();
    await handler({ method: "PUT", query: { campaignId: "campaign-275" }, headers: { "x-dd-mode": "gm" },
      body: { bag: { currency, looseItems: [], linkedEntries: [] }, ...(operation ? { currencyOperation: operation } : {}) }
    } as unknown as VercelRequest, result.res);
    return result.result;
  };
  const spendId = "00000000-0000-4000-8000-000000000277";
  assert.equal((await save({ pp: 1, gp: 0, ep: 0, sp: 8, cp: 4 }, { id: spendId, type: "spend" })).status, 200);
  assert.deepEqual(records[0], { campaignId, requestId: spendId, actorUserId: "user-275",
    type: "spend", amountCp: 40, balanceAfterCp: 1084 });
  assert.equal((await save({ pp: 1, gp: 0, ep: 0, sp: 8, cp: 4 }, { id: spendId, type: "spend" })).status, 200);
  assert.equal(records.length, 1);
  const addId = "00000000-0000-4000-8000-000000000278";
  assert.equal((await save({ pp: 1, gp: 0, ep: 0, sp: 9, cp: 4 }, { id: addId, type: "add" })).status, 200);
  assert.equal(records[1].type, "add");
  assert.equal(records[1].amountCp, 10);
  assert.equal(records[1].balanceAfterCp, 1094);
  assert.equal((await save({ pp: 1, gp: 0, ep: 0, sp: 9, cp: 4 })).status, 200);
  assert.equal(records.length, 2);
  assert.equal((await save({ pp: 1, gp: 0, ep: 0, sp: 9, cp: 5 })).status, 200);
  assert.equal(records[2].type, "adjustment");
  assert.equal(records[2].amountCp, 1);
  assert.equal((await save({ pp: 1, gp: 0, ep: 0, sp: 8, cp: 15 })).status, 200);
  assert.equal(records[3].type, "adjustment");
  assert.equal(records[3].amountCp, 0);
  assert.equal((await save({ pp: 1, gp: 0, ep: 0, sp: 8, cp: 14 })).status, 200);
  assert.equal(records[4].amountCp, -1);
  mocks.select.mockImplementation(() => ({ from: (table: unknown) => {
    assert.equal(table, bagTransactions);
    return { leftJoin: () => ({ where: () => ({ orderBy: () => ({ limit: () => ({ offset: async () =>
      records.map((record, index) => ({ ...record, id: `record-${index}`, createdAt: new Date("2026-10-13T10:00:00Z"), actorName: null }))
    }) }) }) }) };
  } }));
  const read = response();
  await handler({ method: "GET", query: { campaignId: "campaign-275", action: "report" },
    headers: { "x-dd-mode": "gm" } } as unknown as VercelRequest, read.res);
  assert.equal(read.result.status, 200);
  assert.equal((read.result.body as { transactions: unknown[] }).transactions.length, 5);
  const beforeFailure = { ...storedCurrency };
  failRecord = true;
  assert.equal((await save({ ...storedCurrency, cp: 15 }, { id: "00000000-0000-4000-8000-000000000279", type: "add" })).status, 401);
  assert.deepEqual(storedCurrency, beforeFailure);
  assert.equal(records.length, 5);
  failRecord = false;
  failBalance = true;
  assert.equal((await save({ ...storedCurrency, cp: 15 }, { id: "00000000-0000-4000-8000-000000000280", type: "add" })).status, 401);
  assert.deepEqual(storedCurrency, beforeFailure);
  assert.equal(records.length, 5);
});

test("a failed sale record write rolls back both the entry removal and proceeds", async () => {
  mocks.requireCampaignMember.mockResolvedValue({ role: "gm" });
  const entry = { id: "sale-entry", sourceType: "loose", itemId: null, quantity: 1, worthGp: 1 };
  let storedEntry: typeof entry | null = entry;
  let storedCurrency = { pp: 0, gp: 2, ep: 0, sp: 3, cp: 4 };
  mocks.transaction.mockImplementation(async (callback) => {
    const beforeEntry = storedEntry;
    const beforeCurrency = { ...storedCurrency };
    const tx = {
      delete: () => ({ where: () => ({ returning: async () => {
        const removed = storedEntry;
        storedEntry = null;
        return removed ? [removed] : [];
      } }) }),
      insert: (table: unknown) => ({ values: (values: { gp: number; sp: number; cp: number }) =>
        table === bagTransactions ? Promise.reject(new Error("Report write failed"))
          : ({ onConflictDoUpdate: () => ({ returning: async () => {
            storedCurrency = { ...storedCurrency, gp: storedCurrency.gp + values.gp,
              sp: storedCurrency.sp + values.sp, cp: storedCurrency.cp + values.cp };
            return [storedCurrency];
          } }) }) }),
      select: () => ({ from: () => ({ where: async () => [] }) }),
    };
    try { return await callback(tx); }
    catch (error) { storedEntry = beforeEntry; storedCurrency = beforeCurrency; throw error; }
  });
  const { res, result } = response();
  await handler({ method: "POST", query: { campaignId: "campaign-275", action: "sell" },
    headers: { "x-dd-mode": "gm" }, body: { entryId: entry.id, saleValueGp: "27.35" } } as unknown as VercelRequest, res);
  assert.equal(result.status, 401);
  assert.deepEqual(storedEntry, entry);
  assert.deepEqual(storedCurrency, { pp: 0, gp: 2, ep: 0, sp: 3, cp: 4 });
});

test("report read is campaign-scoped and hides other actor details in Player mode", async () => {
  let whereClause: unknown;
  const rows = [
    { id: "record-one", type: "sale", amountCp: 2735, balanceAfterCp: 4180,
      createdAt: new Date("2026-10-13T10:00:00Z"), actorUserId: "other-user", actorName: "Secret GM Name",
      itemName: "Hidden Relic", notes: "Secret note" },
    { id: "record-two", type: "spend", amountCp: 40, balanceAfterCp: 1084,
      createdAt: new Date("2026-10-12T10:00:00Z"), actorUserId: "user-275", actorName: "Current User" },
  ];
  mocks.select.mockImplementation(() => ({ from: (table: unknown) => {
    assert.equal(table, bagTransactions);
    return { leftJoin: () => ({ where: (condition: unknown) => {
      whereClause = condition;
      return { orderBy: () => ({ limit: () => ({ offset: async () => rows }) }) };
    } }) };
  } }));
  const player = response();
  await handler({ method: "GET", query: { campaignId: "campaign-275", action: "report" },
    headers: { "x-dd-mode": "player" } } as unknown as VercelRequest, player.res);
  assert.equal(player.result.status, 200);
  const report = player.result.body as { transactions: Record<string, unknown>[] };
  assert.equal(report.transactions.length, 2);
  assert.equal(report.transactions[0].actor, "Campaign member");
  assert.equal(report.transactions[1].actor, "You");
  assert.equal(JSON.stringify(report).includes("Hidden Relic"), false);
  assert.equal(JSON.stringify(report).includes("Secret GM Name"), false);
  assert.equal(JSON.stringify(report).includes("Secret note"), false);
  const query = drizzle.mock().select().from(bagTransactions).where(whereClause as never).toSQL();
  assert.deepEqual(query.params, [campaignId]);

  const gm = response();
  await handler({ method: "GET", query: { campaignId: "campaign-275", action: "report" },
    headers: { "x-dd-mode": "gm" } } as unknown as VercelRequest, gm.res);
  assert.equal((gm.result.body as { transactions: { actor: string }[] }).transactions[0].actor, "Campaign member");
  mocks.requireCampaignMember.mockResolvedValue({ role: "gm" });
  const gmAllowed = response();
  await handler({ method: "GET", query: { campaignId: "campaign-275", action: "report" },
    headers: { "x-dd-mode": "gm" } } as unknown as VercelRequest, gmAllowed.res);
  assert.equal((gmAllowed.result.body as { transactions: { actor: string }[] }).transactions[0].actor, "Secret GM Name");

  for (let index = 2; index < 51; index++) rows.push({ ...rows[1], id: `record-${index}` });
  const bounded = response();
  await handler({ method: "GET", query: { campaignId: "campaign-275", action: "report" },
    headers: { "x-dd-mode": "gm" } } as unknown as VercelRequest, bounded.res);
  const boundedBody = bounded.result.body as { transactions: unknown[]; hasMore: boolean };
  assert.equal(boundedBody.transactions.length, 50);
  assert.equal(boundedBody.hasMore, true);

  mocks.requireCampaignMember.mockRejectedValue(new Error("Campaign membership required"));
  const denied = response();
  await handler({ method: "GET", query: { campaignId: "campaign-275", action: "report" } } as unknown as VercelRequest, denied.res);
  assert.equal(denied.result.status, 401);
});
