import type { VercelRequest, VercelResponse } from "@vercel/node";
import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";

import { AuthenticationError } from "../apiErrors.js";

const mocks = vi.hoisted(() => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn((): unknown[] => []) })),
    })),
  },
  getCurrentUser: vi.fn(),
  setCorsHeaders: vi.fn(),
  updateUserProfile: vi.fn(),
}));

vi.mock("../access.js", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("../cors.js", () => ({ setCorsHeaders: mocks.setCorsHeaders }));
vi.mock("../userProfile.js", () => ({
  toUserProfile: vi.fn((user: { reducedMotion: boolean }) => ({
    reducedMotion: user.reducedMotion,
  })),
  updateUserProfile: mocks.updateUserProfile,
  UserProfileInputError: class UserProfileInputError extends Error {},
}));
vi.mock("../db.js", () => ({ db: mocks.db }));

import handler from "../../../api/me.js";

const currentUser = {
  id: "00000000-0000-4000-8000-000000000032",
  reducedMotion: false,
};

function request(body: Record<string, unknown>) {
  return {
    body,
    headers: { authorization: "Bearer emulator-token" },
    method: "PATCH",
    query: {},
  } as unknown as VercelRequest;
}

function getRequest() {
  return {
    headers: { authorization: "Bearer emulator-token" },
    method: "GET",
    query: {},
  } as unknown as VercelRequest;
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue(currentUser);
  mocks.updateUserProfile.mockResolvedValue({ reducedMotion: true });
});

test("updates the authenticated caller profile without accepting a caller-supplied identity", async () => {
  const { res, result } = response();

  await handler(request({ reducedMotion: true, userId: "another-user" }), res);

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { ok: true, profile: { reducedMotion: true } });
  assert.deepEqual(mocks.updateUserProfile.mock.calls, [
    [currentUser, { reducedMotion: true, userId: "another-user" }],
  ]);
  assert.deepEqual(mocks.setCorsHeaders.mock.calls[0], [res, "GET, PATCH, OPTIONS"]);
});

test("returns only the authenticated caller profile through the existing me response", async () => {
  mocks.getCurrentUser.mockResolvedValue({ ...currentUser, reducedMotion: true });
  const { res, result } = response();

  await handler(getRequest(), res);

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    ok: true,
    user: { id: currentUser.id },
    profile: { reducedMotion: true },
    workspaces: [],
    workspaceMemberships: [],
    campaigns: [],
    campaignMemberships: [],
  });
});

test("never serializes campaign GM notes through the shared me response", async () => {
  const workspace = { id: "workspace-1", slug: "workspace-alpha" };
  const campaign = {
    id: "campaign-1",
    workspaceId: workspace.id,
    slug: "campaign-alpha",
    name: "Alpha",
    playerSummary: "Player-safe summary",
    gmNotes: "Private preparation",
  };
  const rows = [
    [{ workspaceId: workspace.id, userId: currentUser.id, role: "player" }],
    [workspace],
    [{ campaignId: campaign.id, userId: currentUser.id, role: "player" }],
    [campaign],
  ];
  mocks.db.select.mockImplementationOnce(() => ({
    from: vi.fn(() => ({ where: vi.fn(() => rows.shift() ?? []) })),
  }));
  mocks.db.select.mockImplementationOnce(() => ({
    from: vi.fn(() => ({ where: vi.fn(() => rows.shift() ?? []) })),
  }));
  mocks.db.select.mockImplementationOnce(() => ({
    from: vi.fn(() => ({ where: vi.fn(() => rows.shift() ?? []) })),
  }));
  mocks.db.select.mockImplementationOnce(() => ({
    from: vi.fn(() => ({ where: vi.fn(() => rows.shift() ?? []) })),
  }));
  const { res, result } = response();

  await handler(getRequest(), res);

  assert.equal(result.status, 200);
  assert.deepEqual((result.body as { campaigns: unknown[] }).campaigns, [{
    id: campaign.id,
    workspaceId: campaign.workspaceId,
    slug: campaign.slug,
    name: campaign.name,
    playerSummary: campaign.playerSummary,
  }]);
});

test("rejects unauthenticated profile updates before a write", async () => {
  mocks.getCurrentUser.mockRejectedValue(new AuthenticationError("Invalid token"));
  const { res, result } = response();

  await handler(request({ reducedMotion: true }), res);

  assert.equal(result.status, 401);
  assert.equal(mocks.updateUserProfile.mock.calls.length, 0);
});
