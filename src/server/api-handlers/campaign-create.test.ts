import type { VercelRequest, VercelResponse } from "@vercel/node";
import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";

import { campaigns } from "../../../db/schema/campaigns.js";
import { AuthenticationError } from "../apiErrors.js";

const mocks = vi.hoisted(() => {
  const state = {
    conflictTargets: [] as unknown[],
    insertErrors: [] as Array<Error | undefined>,
    insertRows: [] as unknown[][],
    insertValues: [] as unknown[],
    selectRows: [] as unknown[][],
  };

  function selectResult(rows: unknown[]) {
    return {
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue(rows),
        })),
      })),
    };
  }

  const tx = {
    insert: vi.fn(() => ({
      values: vi.fn((values: unknown) => {
        state.insertValues.push(values);
        const returning = vi.fn(() => {
          const error = state.insertErrors.shift();
          if (error) return Promise.reject(error);
          return Promise.resolve(state.insertRows.shift() ?? []);
        });

        return {
          onConflictDoNothing: vi.fn((config: unknown) => {
            state.conflictTargets.push(config);
            return { returning };
          }),
          returning,
        };
      }),
    })),
    select: vi.fn(() => selectResult(state.selectRows.shift() ?? [])),
  };

  return {
    db: {
      transaction: vi.fn((callback: (transaction: typeof tx) => unknown) =>
        callback(tx)
      ),
    },
    getCurrentUser: vi.fn(),
    setCorsHeaders: vi.fn(),
    state,
  };
});

vi.mock("../access.js", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("../db.js", () => ({ db: mocks.db }));
vi.mock("../cors.js", () => ({ setCorsHeaders: mocks.setCorsHeaders }));

import campaignCreateHandler from "./campaign-create.js";

const currentUser = { id: "00000000-0000-4000-8000-000000000020" };
const otherUser = { id: "00000000-0000-4000-8000-000000000021" };
const workspace = {
  id: "00000000-0000-4000-8000-000000000022",
  slug: "canonical-workspace",
};
const idempotencyKey = "d6564317-6dd5-4fad-ae3f-9b18bd3699b8";
const campaign = {
  id: "00000000-0000-4000-8000-000000000023",
  workspaceId: workspace.id,
  createdByUserId: currentUser.id,
  creationRequestKey: idempotencyKey,
  name: "Canonical Campaign",
  slug: "campaign-278d496f-c748-4b7b-a635-04ad09e10f42",
};
const gmMembership = {
  id: "00000000-0000-4000-8000-000000000024",
  campaignId: campaign.id,
  userId: currentUser.id,
  role: "gm",
};

function request(body: Record<string, unknown>) {
  return {
    body,
    headers: { authorization: "Bearer emulator-token" },
    method: "POST",
    query: {},
  } as unknown as VercelRequest;
}

function optionsRequest() {
  return { headers: {}, method: "OPTIONS", query: {} } as unknown as VercelRequest;
}

function response() {
  const result: { body?: unknown; status?: number } = {};
  const res = {
    end: vi.fn(() => res),
    json: vi.fn((body: unknown) => {
      result.body = body;
      return res;
    }),
    setHeader: vi.fn(() => res),
    status: vi.fn((status: number) => {
      result.status = status;
      return res;
    }),
  } as unknown as VercelResponse;

  return { res, result };
}

function ownerMembership(userId = currentUser.id) {
  return { workspaceId: workspace.id, userId, role: "owner" };
}

function configureSuccessfulCreate(createdCampaign = campaign, membership = gmMembership) {
  mocks.state.selectRows.push([workspace], [ownerMembership()], [], []);
  mocks.state.insertRows.push([createdCampaign], [membership]);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.conflictTargets.length = 0;
  mocks.state.insertErrors.length = 0;
  mocks.state.insertRows.length = 0;
  mocks.state.insertValues.length = 0;
  mocks.state.selectRows.length = 0;
  mocks.getCurrentUser.mockResolvedValue(currentUser);
});

test("advertises POST in the campaign creation endpoint preflight response", async () => {
  const { res, result } = response();

  await campaignCreateHandler(optionsRequest(), res);

  assert.equal(result.status, 204);
  assert.deepEqual(mocks.setCorsHeaders.mock.calls[0], [res, "POST, OPTIONS"]);
  assert.equal(mocks.getCurrentUser.mock.calls.length, 0);
});

test("creates a Neon campaign and server-owned GM membership for a workspace owner", async () => {
  configureSuccessfulCreate();
  const { res, result } = response();

  await campaignCreateHandler(
    request({
      workspaceId: workspace.slug,
      name: campaign.name,
      description: "Client-safe description",
      system: "D&D 5.5e",
      idempotencyKey,
      ownerUid: otherUser.id,
      gmUid: otherUser.id,
      role: "player",
    }),
    res
  );

  assert.equal(result.status, 201);
  assert.deepEqual(result.body, {
    ok: true,
    campaign: { id: campaign.id, name: campaign.name, slug: campaign.slug },
  });
  assert.equal(mocks.db.transaction.mock.calls.length, 1);
  const [campaignInsert, membershipInsert] = mocks.state.insertValues as Array<
    Record<string, unknown>
  >;
  assert.equal(campaignInsert.workspaceId, workspace.id);
  assert.equal(campaignInsert.createdByUserId, currentUser.id);
  assert.equal(campaignInsert.creationRequestKey, idempotencyKey);
  assert.match(String(campaignInsert.slug), /^campaign-[0-9a-f-]{36}$/);
  assert.equal(String(campaignInsert.slug).includes(idempotencyKey), false);
  assert.deepEqual(membershipInsert, {
    campaignId: campaign.id,
    userId: currentUser.id,
    role: "gm",
  });
  assert.deepEqual((mocks.state.conflictTargets[0] as { target: unknown }).target, [
    campaigns.workspaceId,
    campaigns.createdByUserId,
    campaigns.creationRequestKey,
  ]);
});

test("denies a Player before campaign persistence starts", async () => {
  mocks.state.selectRows.push([workspace], [{ ...ownerMembership(), role: "player" }]);
  const { res, result } = response();

  await campaignCreateHandler(
    request({ workspaceId: workspace.slug, name: campaign.name, idempotencyKey }),
    res
  );

  assert.equal(result.status, 403);
  assert.deepEqual(result.body, {
    ok: false,
    error: "Campaign creation request cannot be completed",
  });
  assert.equal(mocks.state.insertValues.length, 0);
});

test("denies a workspace outside the caller's membership boundary", async () => {
  const otherWorkspace = {
    id: "00000000-0000-4000-8000-000000000028",
    slug: "other-workspace",
  };
  mocks.state.selectRows.push([otherWorkspace], []);
  const { res, result } = response();

  await campaignCreateHandler(
    request({ workspaceId: "other-workspace", name: campaign.name, idempotencyKey }),
    res
  );

  assert.equal(result.status, 403);
  assert.equal(mocks.state.insertValues.length, 0);
});

test("rejects unauthenticated creation before starting a database transaction", async () => {
  mocks.getCurrentUser.mockRejectedValue(new AuthenticationError("Invalid token"));
  const { res, result } = response();

  await campaignCreateHandler(
    request({ workspaceId: workspace.slug, name: campaign.name, idempotencyKey }),
    res
  );

  assert.equal(result.status, 401);
  assert.equal(mocks.db.transaction.mock.calls.length, 0);
});

test("returns the same campaign for an owner retry without duplicate writes", async () => {
  mocks.state.selectRows.push([workspace], [ownerMembership()], [campaign], [gmMembership]);
  const { res, result } = response();

  await campaignCreateHandler(
    request({ workspaceId: workspace.slug, name: "Ignored retry name", idempotencyKey }),
    res
  );

  assert.equal(result.status, 201);
  assert.deepEqual(result.body, {
    ok: true,
    campaign: { id: campaign.id, name: campaign.name, slug: campaign.slug },
  });
  assert.equal(mocks.state.insertValues.length, 0);
});

test("allows same-name campaigns for different owner-scoped request keys", async () => {
  const secondKey = "c9b63bcc-cfa8-4cb7-b0b6-ea9ee4b64768";
  const secondCampaign = {
    ...campaign,
    id: "00000000-0000-4000-8000-000000000025",
    slug: "campaign-65efc937-47ff-4d58-8479-cfd3201f2d1e",
    creationRequestKey: secondKey,
  };
  const secondMembership = { ...gmMembership, campaignId: secondCampaign.id };
  configureSuccessfulCreate();
  configureSuccessfulCreate(secondCampaign, secondMembership);
  const first = response();
  const second = response();

  await campaignCreateHandler(
    request({ workspaceId: workspace.slug, name: campaign.name, idempotencyKey }),
    first.res
  );
  await campaignCreateHandler(
    request({ workspaceId: workspace.slug, name: campaign.name, idempotencyKey: secondKey }),
    second.res
  );

  assert.equal((first.result.body as { campaign: { id: string } }).campaign.id, campaign.id);
  assert.equal(
    (second.result.body as { campaign: { id: string } }).campaign.id,
    secondCampaign.id
  );
});

test("scopes a reused request key to its authenticated creator", async () => {
  const otherCampaign = {
    ...campaign,
    id: "00000000-0000-4000-8000-000000000026",
    createdByUserId: otherUser.id,
    slug: "campaign-45bc6f70-931f-427c-a979-b073d0d6e302",
  };
  const otherMembership = { ...gmMembership, campaignId: otherCampaign.id, userId: otherUser.id };
  mocks.getCurrentUser.mockResolvedValue(otherUser);
  mocks.state.selectRows.push([workspace], [ownerMembership(otherUser.id)], [], []);
  mocks.state.insertRows.push([otherCampaign], [otherMembership]);
  const { res, result } = response();

  await campaignCreateHandler(
    request({ workspaceId: workspace.slug, name: campaign.name, idempotencyKey }),
    res
  );

  assert.equal(result.status, 201);
  const [campaignInsert] = mocks.state.insertValues as Array<Record<string, unknown>>;
  assert.equal(campaignInsert.createdByUserId, otherUser.id);
  assert.equal(campaignInsert.creationRequestKey, idempotencyKey);
});

test("surfaces membership insertion failure from the campaign transaction", async () => {
  mocks.state.selectRows.push([workspace], [ownerMembership()], [], []);
  mocks.state.insertRows.push([campaign]);
  mocks.state.insertErrors.push(undefined, new Error("membership insert failed"));
  const { res, result } = response();

  await campaignCreateHandler(
    request({ workspaceId: workspace.slug, name: campaign.name, idempotencyKey }),
    res
  );

  assert.equal(result.status, 500);
  assert.deepEqual(result.body, { ok: false, error: "Campaign creation failed" });
  assert.equal(mocks.state.insertValues.length, 2);
});
