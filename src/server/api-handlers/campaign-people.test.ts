import assert from "node:assert/strict";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { beforeEach, test, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state = {
    selectRows: [] as unknown[][],
    updateValues: [] as Array<Record<string, unknown>>,
    invitationRows: [] as Array<Record<string, unknown>>,
    deleteCalls: [] as unknown[],
  };

  const whereResult = () => {
    const rows = state.selectRows.shift() ?? [];
    const result = Promise.resolve(rows) as Promise<unknown[]> & {
      limit: ReturnType<typeof vi.fn>;
    };
    result.limit = vi.fn().mockResolvedValue(rows);
    return result;
  };

  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(whereResult),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: Record<string, unknown>) => {
        state.updateValues.push(values);
        return { where: vi.fn().mockResolvedValue([]) };
      }),
    })),
    delete: vi.fn((table: unknown) => ({
      where: vi.fn(async () => {
        state.deleteCalls.push(table);
      }),
    })),
    transaction: vi.fn(async (callback: (tx: unknown) => Promise<void>) => callback(db)),
  };

  return {
    state,
    db,
    getCurrentUser: vi.fn(),
    requireCampaignMember: vi.fn(),
    resolveCampaignBySlug: vi.fn(),
    setCorsHeaders: vi.fn(),
    getInvitationCharacterIdsByInvitationId: vi.fn(),
  };
});

vi.mock("../access.js", () => ({
  getCurrentUser: mocks.getCurrentUser,
  requireCampaignMember: mocks.requireCampaignMember,
  resolveCampaignBySlug: mocks.resolveCampaignBySlug,
}));
vi.mock("../db.js", () => ({ db: mocks.db }));
vi.mock("../cors.js", () => ({ setCorsHeaders: mocks.setCorsHeaders }));
vi.mock("../invitation-characters.js", () => ({
  getInvitationCharacterIdsByInvitationId: mocks.getInvitationCharacterIdsByInvitationId,
}));

import campaignPeopleHandler from "./campaign-people.js";

const campaign = {
  id: "00000000-0000-4000-8000-000000000003",
  slug: "campaign-alpha",
  workspaceId: "00000000-0000-4000-8000-000000000004",
};

function request(params: {
  method?: "GET" | "DELETE";
  mode?: "gm" | "player";
  memberId?: string;
} = {}) {
  return {
    method: params.method ?? "GET",
    query: { campaignId: campaign.slug },
    headers: {
      authorization: "Bearer emulator-token",
      "x-dd-mode": params.mode ?? "gm",
    },
    body: params.memberId
      ? { campaignId: campaign.slug, personType: "member", personId: params.memberId }
      : undefined,
  } as unknown as VercelRequest;
}

function response() {
  const result: { status?: number; body?: unknown } = {};
  const res = {
    end: vi.fn(() => res),
    json: vi.fn((body: unknown) => {
      result.body = body;
      return res;
    }),
    status: vi.fn((status: number) => {
      result.status = status;
      return res;
    }),
    setHeader: vi.fn(() => res),
  } as unknown as VercelResponse;
  return { result, res };
}

function invitation(params: {
  id: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  acceptedByUserId?: string | null;
  createdAt?: Date;
}) {
  return {
    id: params.id,
    status: params.status,
    email: `${params.id}@example.test`,
    workspaceId: campaign.workspaceId,
    campaignId: campaign.id,
    workspaceRole: "member",
    campaignRole: "player",
    acceptedByUserId: params.acceptedByUserId ?? null,
    createdAt: params.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    acceptedAt: params.status === "accepted" ? new Date("2026-01-02T00:00:00.000Z") : null,
    revokedAt: params.status === "revoked" ? new Date("2026-01-03T00:00:00.000Z") : null,
    lastSentAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.selectRows.length = 0;
  mocks.state.updateValues.length = 0;
  mocks.state.invitationRows.length = 0;
  mocks.state.deleteCalls.length = 0;
  mocks.getCurrentUser.mockResolvedValue({ id: "user-owner" });
  mocks.resolveCampaignBySlug.mockResolvedValue(campaign);
  mocks.requireCampaignMember.mockResolvedValue({
    id: "membership-owner",
    campaignId: campaign.id,
    userId: "user-owner",
    role: "gm",
  });
  mocks.getInvitationCharacterIdsByInvitationId.mockImplementation(
    async (_db: unknown, invitations: Array<{ id: string }>) =>
      new Map(
        invitations.map((entry) => [
          entry.id,
          entry.id === "invite-pending" ? ["character-reserved"] : [],
        ])
      )
  );
});

test("projects members, pending invitations, and terminal history without duplicate accepted rows", async () => {
  const member = { id: "membership-1", userId: "user-member", role: "gm" };
  const invitations = [
    invitation({ id: "invite-pending", status: "pending", createdAt: new Date("2026-01-05") }),
    invitation({ id: "invite-expired", status: "expired" }),
    invitation({ id: "invite-revoked", status: "revoked" }),
    invitation({ id: "invite-accepted-member", status: "accepted", acceptedByUserId: "user-member" }),
    invitation({ id: "invite-accepted-history", status: "accepted", acceptedByUserId: "user-other" }),
  ];
  mocks.state.selectRows.push(
    [member],
    [{ id: "user-member", email: "member@example.test", displayName: "Member" }],
    [{ userId: "user-member", role: "owner" }],
    invitations,
    [{ userId: "user-member", characterId: "character-assigned" }]
  );

  const { res, result } = response();
  await campaignPeopleHandler(request(), res);

  assert.equal(result.status, 200);
  assert.deepEqual(mocks.state.updateValues, [{ status: "expired" }]);
  const people = (result.body as { people: Array<Record<string, unknown>> }).people;
  assert.deepEqual(
    people.map((person) => person.id),
    [
      "member-membership-1",
      "invite-invite-pending",
      "invite-invite-accepted-history",
      "invite-invite-expired",
      "invite-invite-revoked",
    ]
  );
  assert.equal(people.some((person) => person.id === "invite-invite-accepted-member"), false);
  assert.deepEqual(people[0].characterIds, ["character-assigned"]);
  assert.deepEqual(people[1].characterIds, ["character-reserved"]);
  assert.equal(people[1].status, "pending");
  assert.equal(
    (people[1].resendAvailableAt as Date).toISOString(),
    "2026-01-01T00:01:00.000Z"
  );
  assert.equal(people[3].status, "expired");
  assert.equal(people[4].status, "revoked");
});

test("requires persisted campaign membership before any people projection query", async () => {
  mocks.requireCampaignMember.mockRejectedValue(
    new Error("Campaign membership required")
  );
  const { res, result } = response();

  await campaignPeopleHandler(request(), res);

  assert.equal(result.status, 401);
  assert.equal(mocks.db.update.mock.calls.length, 0);
  assert.equal(mocks.db.select.mock.calls.length, 0);
});

test.each([
  ["sole GM", [{ id: "membership-owner", userId: "user-owner", role: "gm" }]],
  [
    "one of multiple GMs",
    [
      { id: "membership-owner", userId: "user-owner", role: "gm" },
      { id: "membership-other-gm", userId: "user-other-gm", role: "gm" },
    ],
  ],
])("rejects self-removal for %s without mutating membership", async (_label, memberships) => {
  mocks.state.selectRows.push([memberships[0]], memberships);
  const { res, result } = response();

  await campaignPeopleHandler(
    request({ method: "DELETE", memberId: "membership-owner" }),
    res
  );

  assert.equal(result.status, 401);
  assert.deepEqual(result.body, {
    ok: false,
    error: "You cannot remove yourself from the campaign",
  });
  assert.equal(mocks.db.transaction.mock.calls.length, 0);
  assert.equal(mocks.state.deleteCalls.length, 0);
  assert.equal(mocks.db.select.mock.calls.length, 1);
  assert.equal(mocks.state.selectRows.length, 1);
});

test.each([
  ["selected Player mode", "gm", "player"],
  ["non-GM campaign membership", "player", "gm"],
] as const)("rejects member removal for %s before reading the target", async (_label, role, mode) => {
  mocks.requireCampaignMember.mockResolvedValue({
    id: "membership-owner",
    campaignId: campaign.id,
    userId: "user-owner",
    role,
  });
  const { res, result } = response();

  await campaignPeopleHandler(
    request({ method: "DELETE", mode, memberId: "membership-other" }),
    res
  );

  assert.equal(result.status, 401);
  assert.deepEqual(result.body, { ok: false, error: "Campaign GM mode required" });
  assert.equal(mocks.db.select.mock.calls.length, 0);
  assert.equal(mocks.db.transaction.mock.calls.length, 0);
  assert.equal(mocks.state.deleteCalls.length, 0);
});

test("allows an authenticated campaign GM in GM mode to remove another scoped member", async () => {
  const targetMembership = {
    id: "membership-other",
    campaignId: campaign.id,
    userId: "user-other",
    role: "player",
  };
  mocks.state.selectRows.push(
    [targetMembership],
    [
      {
        id: "membership-owner",
        campaignId: campaign.id,
        userId: "user-owner",
        role: "gm",
      },
      targetMembership,
    ],
    [
      { workspaceId: campaign.workspaceId, userId: "user-owner", role: "member" },
      { workspaceId: campaign.workspaceId, userId: "user-other", role: "member" },
    ]
  );
  const { res, result } = response();

  await campaignPeopleHandler(
    request({ method: "DELETE", memberId: targetMembership.id }),
    res
  );

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { ok: true });
  assert.deepEqual(mocks.requireCampaignMember.mock.calls[0]?.[0], {
    campaignId: campaign.id,
    userId: "user-owner",
  });
  assert.equal(mocks.db.transaction.mock.calls.length, 1);
  assert.equal(mocks.state.deleteCalls.length, 2);
});

test("rejects a member id outside the resolved campaign without mutation", async () => {
  mocks.state.selectRows.push([]);
  const { res, result } = response();

  await campaignPeopleHandler(
    request({ method: "DELETE", memberId: "membership-other-campaign" }),
    res
  );

  assert.equal(result.status, 401);
  assert.deepEqual(result.body, { ok: false, error: "Campaign member not found" });
  assert.equal(mocks.db.transaction.mock.calls.length, 0);
  assert.equal(mocks.state.deleteCalls.length, 0);
});
