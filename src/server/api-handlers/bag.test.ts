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
  failEntry: false,
}));

vi.mock("../access.js", () => ({
  getCurrentUser: mocks.getCurrentUser,
  requireCampaignMember: mocks.requireCampaignMember,
  resolveCampaignBySlug: mocks.resolveCampaignBySlug,
}));
vi.mock("../cors.js", () => ({ setCorsHeaders: mocks.setCorsHeaders }));
vi.mock("../db.js", () => ({ db: { transaction: mocks.transaction } }));

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
  mocks.transaction.mockImplementation(async (callback) => callback({ insert: mocks.insert, delete: mocks.delete }));
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
