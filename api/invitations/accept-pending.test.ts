import type { VercelRequest, VercelResponse } from "@vercel/node";
import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state = {
    insertValues: [] as unknown[],
    onConflictDoNothingCalls: 0,
    selectRows: [] as unknown[][],
    updateValues: [] as unknown[],
  };

  const query = (rows: unknown[]) =>
    Object.assign(Promise.resolve(rows), { limit: vi.fn().mockResolvedValue(rows) });
  const executor = {
    select: vi.fn(() => ({
      from: vi.fn(() => {
        const resolveRows = () => state.selectRows.shift() ?? [];
        return {
          where: vi.fn(() => query(resolveRows())),
          then: (...args: Parameters<Promise<unknown[]>["then"]>) =>
            query(resolveRows()).then(...args),
        };
      }),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: unknown) => {
        state.insertValues.push(values);
        return {
          onConflictDoNothing: vi.fn().mockImplementation(async () => {
            state.onConflictDoNothingCalls += 1;
          }),
        };
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: unknown) => {
        state.updateValues.push(values);
        return {
          where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: "invite-1" }]) })),
        };
      }),
    })),
  };
  return {
    db: { ...executor, transaction: vi.fn(async (callback) => callback(executor)) },
    getCurrentUser: vi.fn(),
    state,
  };
});

vi.mock("../../src/server/db.js", () => ({ db: mocks.db }));
vi.mock("../../src/server/access.js", () => ({
  getCurrentUser: mocks.getCurrentUser,
  normalizeEmail: (email: string) => email.trim().toLowerCase(),
}));
vi.mock("../../src/server/cors.js", () => ({ setCorsHeaders: vi.fn() }));
vi.mock("../../src/server/apiErrors.js", () => ({
  getApiErrorMessage: (error: Error) => error.message,
  getApiErrorStatus: () => 401,
}));

import acceptPendingHandler from "./accept-pending.js";

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

function request() {
  return { body: {}, headers: { authorization: "Bearer test" }, method: "POST", query: {} } as unknown as VercelRequest;
}

const invitation = {
  id: "00000000-0000-4000-8000-000000000011",
  workspaceId: "00000000-0000-4000-8000-000000000012",
  campaignId: "00000000-0000-4000-8000-000000000013",
  normalizedEmail: "player@example.com",
  workspaceRole: "member",
  campaignRole: "player",
  invitedByUserId: "00000000-0000-4000-8000-000000000014",
  status: "pending",
  characterId: "legacy-character",
  expiresAt: new Date("2099-01-01T00:00:00.000Z"),
};

beforeEach(() => {
  mocks.state.insertValues = [];
  mocks.state.onConflictDoNothingCalls = 0;
  mocks.state.selectRows = [];
  mocks.state.updateValues = [];
  mocks.getCurrentUser.mockResolvedValue({ id: "00000000-0000-4000-8000-000000000015", email: "player@example.com" });
});

test("acceptance preserves an existing campaign role by conflict-do-nothing and creates each relational assignment once", async () => {
  mocks.state.selectRows.push(
    [invitation],
    [invitation],
    [
      { invitationId: invitation.id, characterId: "character-a" },
      { invitationId: invitation.id, characterId: "character-b" },
    ],
    [{ id: "character-a" }, { id: "character-b" }],
    [],
    [],
    [{ id: invitation.workspaceId, slug: "workspace" }],
    [{ id: invitation.campaignId, slug: "campaign" }]
  );
  const { res, result } = response();

  await acceptPendingHandler(request(), res);

  assert.equal(result.status, 200);
  assert.equal((result.body as { acceptedInvitations: unknown[] }).acceptedInvitations.length, 1);
  assert.deepEqual(mocks.state.insertValues[1], {
    campaignId: invitation.campaignId,
    userId: "00000000-0000-4000-8000-000000000015",
    role: "player",
  });
  assert.equal(mocks.state.onConflictDoNothingCalls, 2);
  assert.equal(
    mocks.state.insertValues.filter(
      (value: unknown) => (value as { characterId?: string }).characterId
    ).length,
    2
  );
});

test("expired invitation is transitioned without memberships or assignments", async () => {
  const expiredInvitation = { ...invitation, expiresAt: new Date("2000-01-01T00:00:00.000Z") };
  mocks.state.selectRows.push(
    [expiredInvitation],
    [expiredInvitation],
    [{ id: expiredInvitation.workspaceId, slug: "workspace" }],
    [{ id: expiredInvitation.campaignId, slug: "campaign" }]
  );
  const { res, result } = response();

  await acceptPendingHandler(request(), res);

  assert.equal(result.status, 200);
  assert.deepEqual((result.body as { acceptedInvitations: unknown[] }).acceptedInvitations, []);
  assert.equal(mocks.state.insertValues.length, 0);
  assert.deepEqual(mocks.state.updateValues[0], { status: "expired" });
});
