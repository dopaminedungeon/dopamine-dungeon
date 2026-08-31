import type { VercelRequest, VercelResponse } from "@vercel/node";
import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state = { insertValues: [] as unknown[], selectRows: [] as unknown[][] };
  const query = (rows: unknown[]) =>
    Object.assign(Promise.resolve(rows), { limit: vi.fn().mockResolvedValue(rows) });
  const executor = {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => query(state.selectRows.shift() ?? [])) })) })),
    insert: vi.fn(() => ({
      values: vi.fn((values: unknown) => {
        state.insertValues.push(values);
        return { returning: vi.fn().mockResolvedValue([{ id: "invite-1", status: "pending", createdAt: new Date(), expiresAt: (values as { expiresAt?: Date }).expiresAt }]) };
      }),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) })),
  };
  return {
    adminDb: { collection: vi.fn(() => ({ add: vi.fn().mockResolvedValue(undefined) })) },
    db: { ...executor, transaction: vi.fn(async (callback) => callback(executor)) },
    getCurrentUser: vi.fn(),
    requireCampaignMember: vi.fn(),
    requireWorkspaceOwner: vi.fn(),
    resolveCampaignByAppId: vi.fn(),
    resolveWorkspaceByAppId: vi.fn(),
    state,
  };
});

vi.mock("../../src/server/auth.js", () => ({ adminDb: mocks.adminDb }));
vi.mock("../../src/server/db.js", () => ({ db: mocks.db }));
vi.mock("../../src/server/access.js", () => ({
  getCurrentUser: mocks.getCurrentUser,
  normalizeEmail: (email: string) => email.trim().toLowerCase(),
  requireCampaignMember: mocks.requireCampaignMember,
  requireWorkspaceOwner: mocks.requireWorkspaceOwner,
  resolveCampaignByAppId: mocks.resolveCampaignByAppId,
  resolveWorkspaceByAppId: mocks.resolveWorkspaceByAppId,
}));
vi.mock("../../src/server/cors.js", () => ({ setCorsHeaders: vi.fn() }));
vi.mock("../../src/server/transactionalMail.js", () => ({ sendTransactionalEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../../src/domain/mail/inviteEmail.template.js", () => ({ buildInviteEmailHtml: vi.fn(() => "html") }));

import invitationHandler from "./index.js";

function response() {
  const result: { status?: number; body?: unknown } = {};
  const res = {
    end: vi.fn(),
    json: vi.fn((body: unknown) => {
      result.body = body;
      return res;
    }),
    setHeader: vi.fn(),
    status: vi.fn((status: number) => {
      result.status = status;
      return res;
    }),
  } as unknown as VercelResponse;
  return { result, res };
}

beforeEach(() => {
  mocks.state.insertValues = [];
  mocks.state.selectRows = [];
  mocks.getCurrentUser.mockResolvedValue({ id: "00000000-0000-4000-8000-000000000001" });
  mocks.requireCampaignMember.mockResolvedValue({ role: "gm" });
  mocks.resolveWorkspaceByAppId.mockResolvedValue({ id: "00000000-0000-4000-8000-000000000002", slug: "workspace", name: "Workspace" });
  mocks.resolveCampaignByAppId.mockResolvedValue({ id: "00000000-0000-4000-8000-000000000003", slug: "campaign", name: "Campaign" });
});

test("invitation creation assigns seven-day expiry from server time and never writes CSV characters", async () => {
  mocks.state.selectRows.push([]);
  const { res, result } = response();
  const before = Date.now();
  await invitationHandler({
    body: { email: "player@example.com", tenantId: "workspace", campaignId: "campaign", characterIds: [] },
    headers: { "x-dd-mode": "gm" }, method: "POST", query: {},
  } as unknown as VercelRequest, res);

  assert.equal(result.status, 201);
  const inserted = mocks.state.insertValues[0] as { characterId: string | null; expiresAt: Date };
  assert.equal(inserted.characterId, null);
  assert.ok(inserted.expiresAt.getTime() >= before + 7 * 24 * 60 * 60 * 1000);
  assert.ok(inserted.expiresAt.getTime() <= Date.now() + 7 * 24 * 60 * 60 * 1000);
});

test("invitation creation rejects client expiration and privileged field overrides", async () => {
  const { res, result } = response();
  await invitationHandler({
    body: {
      email: "player@example.com", tenantId: "workspace", campaignId: "campaign",
      expiresAt: "2099-01-01T00:00:00.000Z", invitedByUserId: "forged",
    },
    headers: { "x-dd-mode": "gm" }, method: "POST", query: {},
  } as unknown as VercelRequest, res);

  assert.equal(result.status, 400);
  assert.equal(mocks.state.insertValues.length, 0);
});

test("a persisted GM in Player mode cannot create invitations", async () => {
  const { res, result } = response();
  await invitationHandler({
    body: { email: "player@example.com", tenantId: "workspace", campaignId: "campaign" },
    headers: { "x-dd-mode": "player" }, method: "POST", query: {},
  } as unknown as VercelRequest, res);

  assert.equal(result.status, 403);
  assert.equal(mocks.state.insertValues.length, 0);
});
