import type { VercelRequest, VercelResponse } from "@vercel/node";
import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state = {
    insertValues: [] as unknown[],
    insertError: null as unknown,
    selectRows: [] as unknown[][],
    updateReturningRows: [] as unknown[][],
  };
  const query = (rows: unknown[]) =>
    Object.assign(Promise.resolve(rows), { limit: vi.fn().mockResolvedValue(rows) });
  const executor = {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => query(state.selectRows.shift() ?? [])) })) })),
    insert: vi.fn(() => ({
      values: vi.fn((values: unknown) => {
        state.insertValues.push(values);
        return {
          returning: vi.fn().mockImplementation(() => {
            if (state.insertError) return Promise.reject(state.insertError);
            return Promise.resolve([{ id: "invite-1", status: "pending", createdAt: new Date(), expiresAt: (values as { expiresAt?: Date }).expiresAt }]);
          }),
        };
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockImplementation(() => Promise.resolve(state.updateReturningRows.shift() ?? [])),
        })),
      })),
    })),
  };
  return {
    db: { ...executor, transaction: vi.fn(async (callback) => callback(executor)) },
    getCurrentUser: vi.fn(),
    requireCampaignMember: vi.fn(),
    requireWorkspaceOwner: vi.fn(),
    resolveCampaignByAppId: vi.fn(),
    resolveWorkspaceByAppId: vi.fn(),
    sendTransactionalEmail: vi.fn().mockResolvedValue(undefined),
    state,
  };
});

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
vi.mock("../../src/server/transactionalMail.js", () => ({ sendTransactionalEmail: mocks.sendTransactionalEmail }));
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
  mocks.state.insertError = null;
  mocks.state.selectRows = [];
  mocks.state.updateReturningRows = [];
  mocks.sendTransactionalEmail.mockClear();
  mocks.getCurrentUser.mockResolvedValue({ id: "00000000-0000-4000-8000-000000000001" });
  mocks.requireCampaignMember.mockResolvedValue({ role: "gm" });
  mocks.requireWorkspaceOwner.mockResolvedValue(undefined);
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

test("normalized pending duplicates are rejected before delivery", async () => {
  mocks.state.selectRows.push([{ id: "existing-pending" }]);
  const { res, result } = response();
  await invitationHandler({
    body: { email: " Player@Example.com ", tenantId: "workspace", campaignId: "campaign", campaignRole: "player" },
    headers: { "x-dd-mode": "gm" }, method: "POST", query: {},
  } as unknown as VercelRequest, res);

  assert.equal(result.status, 409);
  assert.equal(mocks.state.insertValues.length, 0);
  assert.equal(mocks.sendTransactionalEmail.mock.calls.length, 0);
});

test("database unique conflicts are returned as concurrent duplicate conflicts", async () => {
  mocks.state.selectRows.push([]);
  mocks.state.insertError = { code: "23505" };
  const { res, result } = response();
  await invitationHandler({
    body: { email: "player@example.com", tenantId: "workspace", campaignId: "campaign" },
    headers: { "x-dd-mode": "gm" }, method: "POST", query: {},
  } as unknown as VercelRequest, res);

  assert.equal(result.status, 409);
  assert.equal(mocks.sendTransactionalEmail.mock.calls.length, 0);
});

test("workspace-owner and campaign-GM authorization is enforced before invitation creation", async () => {
  mocks.requireWorkspaceOwner.mockRejectedValue(new Error("Workspace owner permission required"));
  const { res, result } = response();
  await invitationHandler({
    body: { email: "player@example.com", tenantId: "workspace", campaignId: "campaign" },
    headers: { "x-dd-mode": "gm" }, method: "POST", query: {},
  } as unknown as VercelRequest, res);

  assert.equal(result.status, 403);
  assert.equal(mocks.state.insertValues.length, 0);
});

const managedInvitation = {
  id: "00000000-0000-4000-8000-000000000010",
  email: "player@example.com",
  normalizedEmail: "player@example.com",
  workspaceId: "00000000-0000-4000-8000-000000000002",
  campaignId: "00000000-0000-4000-8000-000000000003",
  workspaceRole: "member",
  campaignRole: "player",
  status: "pending",
  characterId: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  expiresAt: new Date("2099-01-01T00:00:00.000Z"),
  acceptedAt: null,
  revokedAt: null,
  lastSentAt: new Date(),
  invitedByUserId: "00000000-0000-4000-8000-000000000001",
  acceptedByUserId: null,
};

test("scoped listing expires before presenting invitations and includes terminal lifecycle state", async () => {
  mocks.state.selectRows.push([managedInvitation], []);
  const { res, result } = response();

  await invitationHandler({
    body: undefined,
    headers: { "x-dd-mode": "gm" },
    method: "GET",
    query: { tenantId: "workspace", campaignId: "campaign" },
  } as unknown as VercelRequest, res);

  assert.equal(result.status, 200);
  assert.equal((result.body as { invitations: Array<{ status: string }> }).invitations[0]?.status, "pending");
});

test("resend reserves one pending invitation before direct delivery", async () => {
  mocks.state.updateReturningRows.push([managedInvitation]);
  mocks.state.selectRows.push([]);
  const { res, result } = response();

  await invitationHandler({
    body: { tenantId: "workspace", campaignId: "campaign", invitationId: managedInvitation.id },
    headers: { "x-dd-mode": "gm" }, method: "PATCH", query: {},
  } as unknown as VercelRequest, res);

  assert.equal(result.status, 200);
  assert.equal(mocks.sendTransactionalEmail.mock.calls.length, 1);
});

test("resend reserves delivery once and returns a cooldown with Retry-After", async () => {
  mocks.state.updateReturningRows.push([], [managedInvitation]);
  mocks.state.selectRows.push([managedInvitation]);
  const { res, result } = response();

  await invitationHandler({
    body: { tenantId: "workspace", campaignId: "campaign", invitationId: managedInvitation.id },
    headers: { "x-dd-mode": "gm" }, method: "PATCH", query: {},
  } as unknown as VercelRequest, res);

  assert.equal(result.status, 429);
  assert.equal((res.setHeader as ReturnType<typeof vi.fn>).mock.calls[0]?.[0], "Retry-After");
});

test("revoke is a pending-only lifecycle transition and returns the revoked invitation", async () => {
  const revokedInvitation = { ...managedInvitation, status: "revoked", revokedAt: new Date() };
  mocks.state.updateReturningRows.push([revokedInvitation]);
  mocks.state.selectRows.push([]);
  const { res, result } = response();

  await invitationHandler({
    body: { tenantId: "workspace", campaignId: "campaign", invitationId: managedInvitation.id },
    headers: { "x-dd-mode": "gm" }, method: "DELETE", query: {},
  } as unknown as VercelRequest, res);

  assert.equal(result.status, 200);
  assert.equal((result.body as { invitation: { status: string } }).invitation.status, "revoked");
});
