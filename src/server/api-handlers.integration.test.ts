import type { VercelRequest, VercelResponse } from "@vercel/node";
import assert from "node:assert/strict";
import { drizzle } from "drizzle-orm/postgres-js";
import { beforeEach, test, vi } from "vitest";

import { characterAssignments } from "../../db/schema/characterAssignments.js";
import { arcs, milestones } from "../../db/schema/arcs.js";
import { characters } from "../../db/schema/characters.js";
import { AuthenticationError } from "./apiErrors.js";
import { entityLinks } from "../../db/schema/entityLinks.js";
import { items } from "../../db/schema/items.js";
import { locations } from "../../db/schema/locations.js";
import { lore } from "../../db/schema/lore.js";
import { npcs } from "../../db/schema/npcs.js";
import { quests } from "../../db/schema/quests.js";
import { sessions } from "../../db/schema/sessions.js";

const mocks = vi.hoisted(() => {
  const state = {
    selectRows: [] as unknown[][],
    selectError: null as Error | null,
    writeRows: [] as unknown[][],
    whereClauses: [] as unknown[],
    insertValues: [] as unknown[],
    conflictConfigs: [] as unknown[],
    updateValues: [] as unknown[],
    updateClauses: [] as unknown[],
  };

  function queryResult(rows: unknown[]) {
    if (state.selectError) {
      const error = state.selectError;
      state.selectError = null;
      return Object.assign(Promise.reject(error), {
        limit: vi.fn().mockRejectedValue(error),
      });
    }
    return Object.assign(Promise.resolve(rows), {
      limit: vi.fn().mockResolvedValue(rows),
    });
  }

  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn((whereClause: unknown) => {
          state.whereClauses.push(whereClause);
          return queryResult(state.selectRows.shift() ?? []);
        }),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: unknown) => {
        state.insertValues.push(values);
        const returning = vi.fn().mockResolvedValue(state.writeRows.shift() ?? []);
        return {
          onConflictDoUpdate: vi.fn((config: unknown) => {
            state.conflictConfigs.push(config);
            return { returning };
          }),
          onConflictDoNothing: vi.fn(() => ({ returning })),
          returning,
        };
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: unknown) => {
        state.updateValues.push(values);
        return {
          where: vi.fn((whereClause: unknown) => {
            state.updateClauses.push(whereClause);
            return {
              returning: vi.fn().mockResolvedValue(state.writeRows.shift() ?? []),
            };
          }),
        };
      }),
    })),
    delete: vi.fn(() => ({
      where: vi.fn((whereClause: unknown) => {
        state.whereClauses.push(whereClause);
        return Promise.resolve([]);
      }),
    })),
    transaction: vi.fn(async (callback: (tx: any) => Promise<unknown>) => callback(db)),
  };

  return {
    db,
    state,
    getCurrentUser: vi.fn(),
    requireCampaignGm: vi.fn(),
    requireCampaignMember: vi.fn(),
    resolveCampaignBySlug: vi.fn(),
    verifyAuthHeader: vi.fn(),
    adminAuth: {
      getUser: vi.fn(),
      updateUser: vi.fn(),
    },
  };
});

vi.mock("./db.js", () => ({ db: mocks.db }));
vi.mock("./access.js", () => ({
  getCurrentUser: mocks.getCurrentUser,
  requireCampaignGm: mocks.requireCampaignGm,
  requireCampaignMember: mocks.requireCampaignMember,
  resolveCampaignBySlug: mocks.resolveCampaignBySlug,
}));
vi.mock("./auth.js", () => ({
  verifyAuthHeader: mocks.verifyAuthHeader,
  adminAuth: mocks.adminAuth,
}));

import characterAssignmentsHandler from "./api-handlers/character-assignments.js";
import charactersHandler from "./api-handlers/characters.js";
import entityLinksHandler from "./api-handlers/entity-links.js";
import itemsHandler from "./api-handlers/items.js";
import locationsHandler from "./api-handlers/locations.js";
import loreHandler from "./api-handlers/lore.js";
import npcsHandler from "./api-handlers/npcs.js";
import sessionsHandler from "./api-handlers/sessions.js";
import arcsHandler from "./api-handlers/arcs.js";
import milestonesHandler from "./api-handlers/milestones.js";
import identityContinuityHandler from "../../api/auth/identity-continuity.js";
import { users } from "../../db/schema/users.js";

const sqlDatabase = drizzle.mock();
const campaign = {
  id: "00000000-0000-4000-8000-000000000315",
  slug: "campaign-alpha",
  workspaceId: "00000000-0000-4000-8000-000000000001",
};
const currentUser = { id: "00000000-0000-4000-8000-000000000002" };

function request(
  method: string,
  query: Record<string, string> = { campaignId: campaign.slug },
  body?: Record<string, unknown>,
  selectedMode: "gm" | "player" = "player"
) {
  return {
    body,
    headers: {
      authorization: "Bearer emulator-token",
      "x-dd-mode": selectedMode,
    },
    method,
    query,
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
    setHeader: vi.fn(() => res),
    status: vi.fn((status: number) => {
      result.status = status;
      return res;
    }),
  } as unknown as VercelResponse;

  return { res, result };
}

function itemRow(overrides: Record<string, unknown> = {}) {
  return {
    campaignId: campaign.id,
    id: "moonblade",
    name: "Moonblade",
    type: "Weapon",
    rarity: "Rare",
    power: 3,
    visibility: "public",
    data: {
      gmNotes: "Actually cursed",
      hiddenEffects: ["Binds to the antagonist"],
      storyHooks: ["Lost heir"],
    },
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    ...overrides,
  };
}

function linkRow(overrides: Record<string, unknown> = {}) {
  return {
    rowId: "00000000-0000-4000-8000-000000000010",
    campaignId: campaign.id,
    id: "link-1",
    entityAType: "Item",
    entityAId: "moonblade",
    entityBType: "NPC",
    entityBId: "archivist",
    label: "owns",
    visibility: "Player",
    createdInSession: null,
    note: null,
    createdByUserId: currentUser.id,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.selectRows.length = 0;
  mocks.state.selectError = null;
  mocks.state.writeRows.length = 0;
  mocks.state.whereClauses.length = 0;
  mocks.state.insertValues.length = 0;
  mocks.state.conflictConfigs.length = 0;
  mocks.state.updateValues.length = 0;
  mocks.state.updateClauses.length = 0;

  mocks.getCurrentUser.mockResolvedValue(currentUser);
  mocks.resolveCampaignBySlug.mockResolvedValue(campaign);
  mocks.requireCampaignMember.mockResolvedValue({ role: "gm" });
  mocks.requireCampaignGm.mockResolvedValue(undefined);
  mocks.verifyAuthHeader.mockResolvedValue({
    uid: "firebase-uid-existing",
    email: "verified-google@example.test",
    email_verified: true,
  });
  mocks.adminAuth.getUser.mockResolvedValue({
    uid: "firebase-uid-existing",
    email: "verified-google@example.test",
    emailVerified: false,
    providerData: [
      { providerId: "google.com" },
      { providerId: "password" },
    ],
  });
});

test("identity continuity API returns only the existing Neon ID without provisioning", async () => {
  const neonUserId = "00000000-0000-4000-8000-000000000099";
  mocks.state.selectRows.push([{ id: neonUserId }]);
  const { res, result } = response();

  await identityContinuityHandler(request("GET"), res);

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { ok: true, neonUserId });
  const query = sqlDatabase
    .select({ id: users.id })
    .from(users)
    .where(mocks.state.whereClauses[0] as never)
    .toSQL();
  assert.deepEqual(query.params, ["firebase-uid-existing"]);
  assert.equal(mocks.db.insert.mock.calls.length, 0);
  assert.equal(mocks.db.update.mock.calls.length, 0);
});

test("identity continuity API fails safely for missing, duplicate, or unverified mappings", async () => {
  for (const rows of [
    [],
    [
      { id: "00000000-0000-4000-8000-000000000099" },
      { id: "00000000-0000-4000-8000-000000000100" },
    ],
  ]) {
    mocks.state.selectRows.push(rows);
    const { res, result } = response();
    await identityContinuityHandler(request("GET"), res);
    assert.equal(result.status, 409);
    assert.deepEqual(result.body, {
      ok: false,
      error: "Account setup unavailable",
    });
  }

  mocks.verifyAuthHeader.mockResolvedValueOnce({
    uid: "firebase-uid-existing",
    email_verified: false,
  });
  const { res, result } = response();
  await identityContinuityHandler(request("GET"), res);
  assert.equal(result.status, 409);
  assert.equal(mocks.db.insert.mock.calls.length, 0);
  assert.equal(mocks.db.update.mock.calls.length, 0);
});

test("verified pre-link token can restore verification only for the same linked Firebase and Neon identity", async () => {
  const neonUserId = "00000000-0000-4000-8000-000000000099";
  mocks.state.selectRows.push([{ id: neonUserId }]);
  const { res, result } = response();

  await identityContinuityHandler(request("POST"), res);

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { ok: true });
  assert.deepEqual(mocks.adminAuth.getUser.mock.calls, [["firebase-uid-existing"]]);
  assert.deepEqual(mocks.adminAuth.updateUser.mock.calls, [
    ["firebase-uid-existing", { emailVerified: true }],
  ]);
  const query = sqlDatabase
    .select({ id: users.id })
    .from(users)
    .where(mocks.state.whereClauses[0] as never)
    .toSQL();
  assert.deepEqual(query.params, ["firebase-uid-existing"]);
  assert.match(query.sql, /"email_verified_at" is not null/);
  assert.equal(mocks.db.insert.mock.calls.length, 0);
  assert.equal(mocks.db.update.mock.calls.length, 0);
});

test("verified-password-link reconciliation rejects every missing proof without mutation", async () => {
  const reject = async (configure: () => void, hasNeonQuery = false) => {
    configure();
    if (hasNeonQuery) mocks.state.selectRows.push([]);
    const { res, result } = response();
    await identityContinuityHandler(request("POST"), res);
    assert.equal(result.status, 409);
    assert.deepEqual(result.body, {
      ok: false,
      error: "Account setup unavailable",
    });
    assert.equal(mocks.adminAuth.updateUser.mock.calls.length, 0);
    assert.equal(mocks.db.insert.mock.calls.length, 0);
    assert.equal(mocks.db.update.mock.calls.length, 0);
    vi.clearAllMocks();
    mocks.verifyAuthHeader.mockResolvedValue({
      uid: "firebase-uid-existing",
      email: "verified-google@example.test",
      email_verified: true,
    });
    mocks.adminAuth.getUser.mockResolvedValue({
      uid: "firebase-uid-existing",
      email: "verified-google@example.test",
      emailVerified: false,
      providerData: [
        { providerId: "google.com" },
        { providerId: "password" },
      ],
    });
  };

  await reject(() => mocks.verifyAuthHeader.mockRejectedValueOnce(new Error("expired")));
  await reject(() => mocks.adminAuth.getUser.mockResolvedValueOnce({
    uid: "different-firebase-uid",
    email: "verified-google@example.test",
    emailVerified: false,
    providerData: [{ providerId: "google.com" }, { providerId: "password" }],
  }));
  await reject(() => mocks.adminAuth.getUser.mockResolvedValueOnce({
    uid: "firebase-uid-existing",
    email: "different@example.test",
    emailVerified: false,
    providerData: [{ providerId: "google.com" }, { providerId: "password" }],
  }));
  await reject(() => mocks.adminAuth.getUser.mockResolvedValueOnce({
    uid: "firebase-uid-existing",
    email: "verified-google@example.test",
    emailVerified: false,
    providerData: [{ providerId: "google.com" }],
  }));
  await reject(() => mocks.adminAuth.getUser.mockResolvedValueOnce({
    uid: "firebase-uid-existing",
    email: "verified-google@example.test",
    emailVerified: false,
    providerData: [{ providerId: "password" }],
  }));
  // The UID-only query requires a non-null historical email_verified_at; no
  // matching row covers both a missing Neon identity and a null timestamp.
  await reject(() => undefined, true);
});

test("API integration: unauthenticated requests stop before campaign or database access", async () => {
  mocks.getCurrentUser.mockRejectedValue(
    new Error("Missing or invalid Authorization header")
  );
  const { res, result } = response();

  await itemsHandler(request("GET"), res);

  assert.equal(result.status, 401);
  assert.deepEqual(result.body, {
    ok: false,
    error: "Missing or invalid Authorization header",
  });
  assert.equal(mocks.resolveCampaignBySlug.mock.calls.length, 0);
  assert.equal(mocks.db.select.mock.calls.length, 0);
});

test("API integration: a dual-role user in Player mode receives only public item fields", async () => {
  mocks.requireCampaignMember.mockResolvedValue({ role: "gm" });
  mocks.state.selectRows.push([itemRow()]);
  const { res, result } = response();

  await itemsHandler(request("GET"), res);

  assert.equal(result.status, 200);
  assert.deepEqual(mocks.requireCampaignMember.mock.calls[0], [
    { campaignId: campaign.id, userId: currentUser.id },
  ]);
  const whereQuery = sqlDatabase
    .select()
    .from(items)
    .where(mocks.state.whereClauses[0] as never)
    .toSQL();
  assert.deepEqual(whereQuery.params, [campaign.id, "public"]);
  assert.equal((result.body as any).items[0].gmNotes, undefined);
  assert.equal((result.body as any).items[0].hiddenEffects, undefined);
  assert.equal((result.body as any).items[0].storyHooks, undefined);
});

test("API integration: explicit GM mode preserves campaign-scoped GM item visibility", async () => {
  mocks.requireCampaignMember.mockResolvedValue({ role: "gm" });
  mocks.state.selectRows.push([itemRow()]);
  const { res, result } = response();

  await itemsHandler(request("GET", undefined, undefined, "gm"), res);

  assert.equal(result.status, 200);
  const whereQuery = sqlDatabase
    .select()
    .from(items)
    .where(mocks.state.whereClauses[0] as never)
    .toSQL();
  assert.deepEqual(whereQuery.params, [campaign.id]);
  assert.equal((result.body as any).items[0].gmNotes, "Actually cursed");
  assert.deepEqual((result.body as any).items[0].hiddenEffects, [
    "Binds to the antagonist",
  ]);
});

test("API integration: a dual-role user in Player mode receives spoiler-safe worldbuilding", async () => {
  mocks.requireCampaignMember.mockResolvedValue({ role: "gm" });
  const timestamps = {
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  };
  const cases = [
    {
      handler: loreHandler,
      table: lore,
      entity: "lore",
      collection: "lore",
      row: {
        ...timestamps,
        campaignId: campaign.id,
        id: "founding-myth",
        name: "Founding Myth",
        type: "Lore",
        visibility: "public",
        summary: "Public summary",
        content: "Public content",
        gmNotes: "The deity is alive",
        aliases: [],
        data: { gmNotes: "False origin", data: { gmNotes: "Villain cipher" } },
      },
    },
    {
      handler: locationsHandler,
      table: locations,
      entity: "locations",
      collection: "locations",
      row: {
        ...timestamps,
        campaignId: campaign.id,
        id: "sealed-vault",
        name: "Sealed Vault",
        category: "Dungeon",
        visibility: "public",
        summary: "Public summary",
        description: "Public description",
        gmNotes: "Antagonist entrance",
        imageUrl: "",
        aliases: [],
        data: { gmNotes: "Hidden trap", data: { gmNotes: "Secret exit" } },
      },
    },
    {
      handler: npcsHandler,
      table: npcs,
      entity: "npcs",
      collection: "npcs",
      row: {
        ...timestamps,
        campaignId: campaign.id,
        id: "archivist",
        name: "Archivist",
        title: "",
        type: "NPC",
        status: "active",
        visibility: "public",
        summary: "Keeps the town records",
        description: "Public description",
        gmNotes: "Secret cult leader",
        imageUrl: "",
        data: { gmNotes: "Secret cult leader" },
      },
    },
  ];

  for (const entry of cases) {
    mocks.state.selectRows.push([entry.row]);
    const { res, result } = response();

    await entry.handler(
      request("GET", { campaignId: campaign.slug, entity: entry.entity }),
      res
    );

    assert.equal(result.status, 200);
    assert.equal(JSON.stringify((result.body as any)[entry.collection]).includes("gmNotes"), false);
    const query = sqlDatabase
      .select()
      .from(entry.table as any)
      .where(
        mocks.state.whereClauses[mocks.state.whereClauses.length - 1] as never
      )
      .toSQL();
    assert.deepEqual(query.params, [campaign.id, "public"]);
  }
});

test("API integration: a dual-role user in Player mode receives only Player relationships", async () => {
  mocks.requireCampaignMember.mockResolvedValue({ role: "gm" });
  mocks.state.selectRows.push([linkRow()]);
  const { res, result } = response();

  await entityLinksHandler(request("GET"), res);

  assert.equal(result.status, 200);
  const query = sqlDatabase
    .select()
    .from(entityLinks)
    .where(mocks.state.whereClauses[0] as never)
    .toSQL();
  assert.deepEqual(query.params, [campaign.id, "Player"]);
  assert.deepEqual((result.body as any).links, [
    {
      id: "link-1",
      entityA: { type: "Item", id: "moonblade" },
      entityB: { type: "NPC", id: "archivist" },
      label: "owns",
      visibility: "Player",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ]);
});

test("API integration: Arc and Milestone reads are GM-only and campaign-scoped", async () => {
  mocks.requireCampaignMember.mockResolvedValue({ role: "gm" });
  mocks.state.selectRows.push([], []);
  const arcResponse = response();
  await arcsHandler(request("GET", undefined, undefined, "gm"), arcResponse.res);
  assert.equal(arcResponse.result.status, 200);
  const arcQuery = sqlDatabase.select().from(arcs).where(mocks.state.whereClauses[0] as never).toSQL();
  assert.match(arcQuery.sql, /"campaign_id" = \$1/);
  assert.doesNotMatch(arcQuery.sql, /"visibility" =/);
  assert.deepEqual(arcQuery.params, [campaign.id]);

  const milestoneResponse = response();
  await milestonesHandler(request("GET", { campaignId: campaign.slug, arcId: "visible-arc" }, undefined, "gm"), milestoneResponse.res);
  assert.equal(milestoneResponse.result.status, 200);
  const milestoneQuery = sqlDatabase.select().from(milestones).where(mocks.state.whereClauses[1] as never).toSQL();
  assert.match(milestoneQuery.sql, /"campaign_id" = \$1/);
  assert.match(milestoneQuery.sql, /"arc_id" = \$2/);
  assert.doesNotMatch(milestoneQuery.sql, /"visibility" =/);
  assert.deepEqual(milestoneQuery.params, [campaign.id, "visible-arc"]);
});

test("API integration: Player mode cannot read Arc or Milestone data", async () => {
  const arc = response();
  await arcsHandler(request("GET"), arc.res);
  assert.equal(arc.result.status, 403);
  const milestone = response();
  await milestonesHandler(request("GET"), milestone.res);
  assert.equal(milestone.result.status, 403);
  assert.equal(mocks.db.select.mock.calls.length, 0);
});

test("API integration: missing Arc tables are reported as server errors, not authentication failures", async () => {
  mocks.state.selectError = new Error('relation "arcs" does not exist');
  const { res, result } = response();

  await arcsHandler(request("GET", undefined, undefined, "gm"), res);

  assert.equal(result.status, 500);
  assert.deepEqual(result.body, { ok: false, error: "Internal server error" });

  mocks.state.selectError = new Error('relation "milestones" does not exist');
  const milestoneResponse = response();
  await milestonesHandler(request("GET", undefined, undefined, "gm"), milestoneResponse.res);

  assert.equal(milestoneResponse.result.status, 500);
  assert.deepEqual(milestoneResponse.result.body, { ok: false, error: "Internal server error" });
});

test("API integration: invalid Firebase authentication remains a 401 for Arc reads", async () => {
  mocks.getCurrentUser.mockRejectedValueOnce(new AuthenticationError("Invalid authentication token"));
  const { res, result } = response();

  await arcsHandler(request("GET"), res);

  assert.equal(result.status, 401);
  assert.deepEqual(result.body, { ok: false, error: "Invalid authentication token" });
});

test("API integration: GM Arc create and edit use one campaign-scoped upsert", async () => {
  const saved = { campaignId: campaign.id, id: "arc-main", type: "main_story", name: "The Long Road", summary: "The fellowship continues.", progress: 0, plotHook: "", grimPortentsFrontiers: "", arcStructure: "", climaxConditions: "", resolutionFallout: "", status: "progressing", visibility: "gm-only" };
  mocks.state.writeRows.push([saved], [saved]);
  for (const method of ["PUT", "PUT"] as const) {
    const { res, result } = response();
    await arcsHandler(request(method, undefined, { arc: saved }, "gm"), res);
    assert.equal(result.status, 200);
    assert.deepEqual((result.body as any).arc, saved);
  }
  assert.equal(mocks.db.insert.mock.calls.length, 2);
  assert.deepEqual(mocks.state.insertValues.map((row: any) => [row.campaignId, row.id]), [
    [campaign.id, "arc-main"], [campaign.id, "arc-main"],
  ]);
  for (const config of mocks.state.conflictConfigs as any[]) assert.deepEqual(config.target, [arcs.campaignId, arcs.id]);
  assert.equal(mocks.requireCampaignGm.mock.calls.length, 2);
});

test("API integration: Milestones require a parent Arc in the same campaign and are GM-written", async () => {
  const milestone = { campaignId: campaign.id, id: "arrival", arcId: "arc-main", title: "Reach the city", description: "", progress: 0, conditionsForLevelUp: "", intendedLevelProgression: "", status: "active", visibility: "gm-only", position: 0 };
  mocks.state.selectRows.push([{ id: "arc-main" }], []);
  mocks.state.writeRows.push([milestone]);
  const created = response();
  await milestonesHandler(request("PUT", undefined, { milestone }, "gm"), created.res);
  assert.equal(created.result.status, 200);
  assert.deepEqual((created.result.body as any).milestone, milestone);
  assert.equal((mocks.state.insertValues[0] as any).campaignId, campaign.id);
  assert.equal((mocks.state.insertValues[0] as any).arcId, "arc-main");

  const invalid = response();
  await milestonesHandler(request("PUT", undefined, { milestone: { ...milestone, id: "wrong-parent", arcId: "foreign-arc" } }, "gm"), invalid.res);
  assert.equal(invalid.result.status, 400);
  assert.equal(mocks.db.insert.mock.calls.length, 1);
});

test("API integration: Player mode cannot write Arcs, Milestones, or their typed relationships", async () => {
  const arc = response();
  await arcsHandler(request("PUT", undefined, { arc: { id: "arc-main", name: "A plot" } }, "player"), arc.res);
  assert.equal(arc.result.status, 403);
  assert.equal(mocks.db.insert.mock.calls.length, 0);

  const milestone = response();
  await milestonesHandler(request("PUT", undefined, { milestone: { id: "step-one", arcId: "arc-main", title: "A step" } }, "player"), milestone.res);
  assert.equal(milestone.result.status, 403);
  assert.equal(mocks.db.insert.mock.calls.length, 0);

  const link = response();
  await entityLinksHandler(request("PUT", undefined, { link: {
    id: "arc-session", entityA: { type: "Arc", id: "arc-main" },
    entityB: { type: "Session", id: "session-one" }, label: "advanced", visibility: "Player",
  } }, "player"), link.res);
  assert.equal(link.result.status, 401);
  assert.equal(mocks.db.insert.mock.calls.length, 0);
});

test("API integration: Arc deletion atomically removes Arc and Milestone links before cascade", async () => {
  mocks.state.selectRows.push([{ id: "milestone-a" }, { id: "milestone-b" }]);
  const deleted = response();
  await arcsHandler(request("DELETE", { campaignId: campaign.slug, arcId: "arc-main" }, undefined, "gm"), deleted.res);
  assert.equal(deleted.result.status, 200);
  assert.equal(mocks.db.transaction.mock.calls.length, 1);
  assert.equal(mocks.db.delete.mock.calls.length, 2);
  assert.deepEqual(deleted.result.body, { ok: true, deleted: true });
});

test("API integration: Arc-to-Session links require both endpoints in the resolved campaign", async () => {
  const link = {
    campaignId: campaign.id,
    id: "arc-session",
    entityAType: "Arc", entityAId: "arc-main",
    entityBType: "Session", entityBId: "session-one",
    label: "advanced", visibility: "Player",
  };
  mocks.state.selectRows.push([{ id: "arc-main" }], [{ id: "session-one" }], []);
  mocks.state.writeRows.push([linkRow({
    id: link.id, entityAType: "Arc", entityAId: "arc-main",
    entityBType: "Session", entityBId: "session-one", label: "advanced",
  })]);
  const created = response();
  await entityLinksHandler(request("PUT", undefined, { link: {
    id: link.id,
    entityA: { type: "Arc", id: "arc-main" },
    entityB: { type: "Session", id: "session-one" },
    label: "advanced", visibility: "Player",
  } }, "gm"), created.res);
  assert.equal(created.result.status, 200);
  const arcQuery = sqlDatabase.select().from(arcs).where(mocks.state.whereClauses[0] as never).toSQL();
  const sessionQuery = sqlDatabase.select().from(sessions).where(mocks.state.whereClauses[1] as never).toSQL();
  assert.deepEqual(arcQuery.params, [campaign.id, "arc-main"]);
  assert.deepEqual(sessionQuery.params, [campaign.id, "session-one"]);

  mocks.state.selectRows.push([{ id: "arc-main" }], []);
  const foreign = response();
  await entityLinksHandler(request("PUT", undefined, { link: {
    id: "foreign-session-link",
    entityA: { type: "Arc", id: "arc-main" },
    entityB: { type: "Session", id: "foreign-session" },
    label: "advanced", visibility: "Player",
  } }, "gm"), foreign.res);
  assert.equal(foreign.result.status, 401);
  assert.equal(mocks.db.insert.mock.calls.length, 1);
});

test.each([
  ["Arc endpoint", { type: "Arc", id: "arc-main" }, { type: "Quest", id: "quest-one" }],
  ["Quest endpoint", { type: "Quest", id: "quest-one" }, { type: "Arc", id: "arc-main" }],
])("API integration: duplicate Arc-Quest saves from the %s reuse the canonical relationship", async (_label, entityA, entityB) => {
  const existing = linkRow({ id: "persisted-arc-quest", entityAType: "Arc", entityAId: "arc-main",
    entityBType: "Quest", entityBId: "quest-one", label: "advances", visibility: "GM" });
  // Quest target, Arc target, Arc endpoint check, then canonical relationship match.
  mocks.state.selectRows.push([{ id: "quest-one" }], [{ id: "arc-main" }], [{ id: "arc-main" }], [existing]);
  mocks.state.writeRows.push([{ ...existing, visibility: "Player" }]);
  const { res, result } = response();
  await entityLinksHandler(request("PUT", undefined, { link: {
    id: "new-client-link-id", entityA, entityB, label: "advances", visibility: "Player",
  } }, "gm"), res);
  assert.equal(result.status, 200);
  assert.equal(mocks.db.insert.mock.calls.length, 0);
  assert.equal((mocks.state.updateValues[0] as any).id, existing.id);
  assert.equal((result.body as any).link.id, existing.id);
  assert.deepEqual((result.body as any).link.entityA, { type: "Arc", id: "arc-main" });
});

test("API integration: concurrent Arc-Quest endpoint saves reuse the row committed between lookup and insert", async () => {
  const raced = linkRow({ rowId: "race-row", id: "race-persisted", entityAType: "Arc", entityAId: "arc-main",
    entityBType: "Quest", entityBId: "quest-one", label: "advances", visibility: "GM" });
  // Endpoint validation, initial no-match lookup, then the post-conflict lookup.
  mocks.state.selectRows.push([{ id: "quest-one" }], [{ id: "arc-main" }], [{ id: "arc-main" }], [], [raced]);
  mocks.state.writeRows.push([], [{ ...raced, visibility: "Player" }]);
  const { res, result } = response();
  await entityLinksHandler(request("PUT", undefined, { link: {
    id: "stale-endpoint-id", entityA: { type: "Quest", id: "quest-one" }, entityB: { type: "Arc", id: "arc-main" },
    label: "advances", visibility: "Player",
  } }, "gm"), res);
  assert.equal(result.status, 200);
  assert.equal(mocks.db.insert.mock.calls.length, 1);
  assert.equal((mocks.state.updateValues[0] as any).id, raced.id);
  assert.equal((result.body as any).link.id, raced.id);
});

test("API integration: Arc-Quest links preserve a distinct allowed label and deny Player writes in either direction", async () => {
  const existing = linkRow({ id: "arc-quest-advances", entityAType: "Arc", entityAId: "arc-main",
    entityBType: "Quest", entityBId: "quest-one", label: "advances", visibility: "GM" });
  mocks.state.selectRows.push([{ id: "quest-one" }], [{ id: "arc-main" }], [{ id: "arc-main" }], []);
  const belongsTo = linkRow({ id: "arc-quest-belongs", entityAType: "Arc", entityAId: "arc-main",
    entityBType: "Quest", entityBId: "quest-one", label: "belongs_to", visibility: "GM" });
  mocks.state.writeRows.push([belongsTo]);
  const created = response();
  await entityLinksHandler(request("PUT", undefined, { link: {
    entityA: { type: "Quest", id: "quest-one" }, entityB: { type: "Arc", id: "arc-main" },
    label: "belongs_to", visibility: "GM",
  } }, "gm"), created.res);
  assert.equal(created.result.status, 200);
  assert.equal(mocks.db.insert.mock.calls.length, 1);
  assert.equal((created.result.body as any).link.label, "belongs_to");
  assert.equal(existing.label, "advances");

  for (const [entityA, entityB] of [
    [{ type: "Arc", id: "arc-main" }, { type: "Quest", id: "quest-one" }],
    [{ type: "Quest", id: "quest-one" }, { type: "Arc", id: "arc-main" }],
  ]) {
    const denied = response();
    await entityLinksHandler(request("PUT", undefined, { link: { entityA, entityB, label: "advances", visibility: "GM" } }, "player"), denied.res);
    assert.equal(denied.result.status, 401);
  }
  assert.equal(mocks.db.insert.mock.calls.length, 1);
});

test("API integration: a label change colliding with a distinct persisted relationship returns a clear conflict", async () => {
  const old = linkRow({ rowId: "old-row", id: "old-link", entityAType: "Arc", entityAId: "arc-main", entityBType: "Quest", entityBId: "quest-one", label: "belongs_to" });
  const target = linkRow({ rowId: "target-row", id: "target-link", entityAType: "Arc", entityAId: "arc-main", entityBType: "Quest", entityBId: "quest-one", label: "advances" });
  mocks.state.selectRows.push([{ id: "quest-one" }], [{ id: "arc-main" }], [{ id: "arc-main" }], [old, target]);
  const { res, result } = response();
  await entityLinksHandler(request("PUT", undefined, { link: {
    id: old.id, entityA: { type: "Quest", id: "quest-one" }, entityB: { type: "Arc", id: "arc-main" },
    label: "advances", visibility: "Player",
  } }, "gm"), res);
  assert.equal(result.status, 409);
  assert.match((result.body as any).error, /already exists.*Reload.*keep or remove/i);
  assert.equal(mocks.db.update.mock.calls.length, 0);
  assert.equal(mocks.db.delete.mock.calls.length, 0);
});

test("API integration: Player relationship reads omit Arc and Milestone endpoint identities", async () => {
  mocks.requireCampaignMember.mockResolvedValue({ role: "gm" });
  mocks.state.selectRows.push([]);
  const { res, result } = response();
  await entityLinksHandler(request("GET"), res);
  assert.equal(result.status, 200);
  assert.deepEqual((result.body as any).links, []);
  const query = sqlDatabase.select().from(entityLinks).where(mocks.state.whereClauses[0] as never).toSQL();
  assert.match(query.sql, /"visibility" = \$2/);
  assert.match(query.sql, /"entity_a_type" not in \('Arc', 'Milestone'\)/);
  assert.match(query.sql, /"entity_b_type" not in \('Arc', 'Milestone'\)/);
  assert.match(query.sql, /"characters"\."is_player_visible" = true/);
  assert.match(query.sql, /"items"\."visibility" = 'public'/);
  assert.deepEqual(query.params, [campaign.id, "Player"]);
});

test("API integration: Player Location-NPC links require both public endpoints in the same campaign", async () => {
  mocks.state.selectRows.push([linkRow({
    entityAType: "Map", entityAId: "harbor", entityBType: "NPC",
    entityBId: "archivist", label: "controls",
  })]);
  const { res, result } = response();
  await entityLinksHandler(request("GET"), res);

  assert.equal(result.status, 200);
  const query = sqlDatabase.select().from(entityLinks)
    .where(mocks.state.whereClauses[0] as never).toSQL();
  assert.match(query.sql, /from "locations"/);
  assert.match(query.sql, /from "npcs"/);
  assert.match(query.sql, /"locations"\."campaign_id" = "entity_links"\."campaign_id"/);
  assert.match(query.sql, /"npcs"\."campaign_id" = "entity_links"\."campaign_id"/);
  assert.match(query.sql, /"locations"\."visibility" = 'public'/);
  assert.match(query.sql, /"npcs"\."visibility" = 'public'/);
  assert.deepEqual(query.params, [campaign.id, "Player"]);
  assert.equal((result.body as any).links[0].label, "controls");
});

test("API integration: Player Quest links require a public Quest and visible campaign endpoint", async () => {
  mocks.state.selectRows.push([linkRow({ entityAType: "Quest", entityAId: "quest-one",
    entityBType: "NPC", entityBId: "archivist", label: "given_by", note: "Secret GM detail" })]);
  const { res, result } = response();
  await entityLinksHandler(request("GET"), res);
  assert.equal(result.status, 200);
  const query = sqlDatabase.select().from(entityLinks).where(mocks.state.whereClauses[0] as never).toSQL();
  assert.match(query.sql, /from "quests"/);
  assert.match(query.sql, /"quests"\."visibility" = 'public'/);
  assert.match(query.sql, /"npcs"\."visibility" = 'public'/);
  assert.match(query.sql, /"lore"\."visibility" = 'public'/);
  assert.match(query.sql, /"quests"\."campaign_id" = "entity_links"\."campaign_id"/);
  assert.equal(JSON.stringify(result.body).includes("Secret GM detail"), false);
});

test("API integration: Quest-Lore writes validate both campaign endpoints and reuse one directional record", async () => {
  const existing = linkRow({ entityAType: "Lore", entityAId: "chronicle", entityBType: "Quest",
    entityBId: "quest-one", label: "based_on", visibility: "Player" });
  mocks.state.selectRows.push([{ id: "quest-one" }], [{ id: "chronicle" }], [existing]);
  mocks.state.writeRows.push([{ ...existing, label: "reveals" }]);
  const { res, result } = response();
  await entityLinksHandler(request("PUT", undefined, { link: {
    id: "opposite-direction-id", entityA: { type: "Lore", id: "chronicle" },
    entityB: { type: "Quest", id: "quest-one" }, label: "reveals", visibility: "Player",
  } }, "gm"), res);
  assert.equal(result.status, 200);
  assert.equal(mocks.db.insert.mock.calls.length, 0);
  assert.equal((mocks.state.updateValues[0] as any).id, existing.id);
  assert.equal((result.body as any).link.id, existing.id);
  const loreQuery = sqlDatabase.select().from(lore).where(mocks.state.whereClauses[1] as never).toSQL();
  assert.deepEqual(loreQuery.params, [campaign.id, "chronicle"]);
});

test("API integration: Quest-Lore cannot link to Lore outside the selected campaign or write in Player mode", async () => {
  mocks.state.selectRows.push([{ id: "quest-one" }], []);
  const submitted = { link: { entityA: { type: "Quest", id: "quest-one" },
    entityB: { type: "Lore", id: "other-campaign-lore" }, label: "based_on", visibility: "Player" } };
  const denied = response();
  await entityLinksHandler(request("PUT", undefined, submitted, "gm"), denied.res);
  assert.equal(denied.result.status, 401);
  assert.equal(mocks.db.insert.mock.calls.length, 0);
  const player = response();
  await entityLinksHandler(request("PUT", undefined, submitted), player.res);
  assert.equal(player.result.status, 401);
  assert.equal(mocks.db.insert.mock.calls.length, 0);
});

test("API integration: Quest links reject targets outside the campaign before writing", async () => {
  mocks.state.selectRows.push([{ id: "quest-one" }], []);
  const { res, result } = response();
  await entityLinksHandler(request("PUT", undefined, { link: {
    entityA: { type: "Quest", id: "quest-one" }, entityB: { type: "Item", id: "other-campaign-item" },
    label: "requires", visibility: "Player",
  } }, "gm"), res);
  assert.equal(result.status, 401);
  assert.equal(mocks.db.insert.mock.calls.length, 0);
  const query = sqlDatabase.select().from(quests).where(mocks.state.whereClauses[0] as never).toSQL();
  assert.deepEqual(query.params, [campaign.id, "quest-one"]);
});

test.each([
  ["Session", "started"],
  ["NPC", "given_by"],
  ["Map", "leads_to"],
])("API integration: generic %s-Quest writes cannot assign reserved %s", async (entityType, label) => {
  mocks.state.selectRows.push([{ id: "quest-one" }], [{ id: "target-one" }], []);
  const { res, result } = response();
  await entityLinksHandler(request("PUT", undefined, { link: {
    id: "generic-link", entityA: { type: entityType, id: "target-one" },
    entityB: { type: "Quest", id: "quest-one" }, label, visibility: "Player",
  } }, "gm"), res);
  assert.equal(result.status, 400);
  assert.equal(mocks.db.insert.mock.calls.length, 0);
  assert.equal(mocks.db.update.mock.calls.length, 0);
});

test("API integration: generic Quest links cannot overwrite or delete a primary link", async () => {
  const primary = linkRow({ id: "quest-hero:quest-one:NPC:archivist:given_by", entityAType: "Quest", entityAId: "quest-one", entityBType: "NPC", entityBId: "archivist", label: "given_by" });
  mocks.state.selectRows.push([{ id: "quest-one" }], [{ id: "archivist" }], [primary]);
  const update = response();
  await entityLinksHandler(request("PUT", undefined, { link: {
    id: primary.id, entityA: { type: "Quest", id: "quest-one" },
    entityB: { type: "NPC", id: "archivist" }, label: "related", visibility: "Player",
  } }, "gm"), update.res);
  assert.equal(update.result.status, 400);
  assert.equal(mocks.db.update.mock.calls.length, 0);
  mocks.state.selectRows.push([primary]);
  const deletion = response();
  await entityLinksHandler(request("DELETE", { campaignId: campaign.slug, linkId: primary.id }, undefined, "gm"), deletion.res);
  assert.equal(deletion.result.status, 400);
  assert.equal(mocks.db.delete.mock.calls.length, 0);
});

test("API integration: a generic Session-Quest link can coexist with a managed start session", async () => {
  const generic = linkRow({ id: "persisted-session-quest-related", entityAType: "Quest", entityAId: "quest-one",
    entityBType: "Session", entityBId: "session-one", label: "related", visibility: "Player" });
  // The endpoint lookups succeed. The exact generic identity lookup has no row,
  // even though the same endpoints also have a managed `started` row.
  mocks.state.selectRows.push([{ id: "quest-one" }], [{ id: "session-one" }], []);
  mocks.state.writeRows.push([generic]);
  const created = response();
  await entityLinksHandler(request("PUT", undefined, { link: {
    id: generic.id, entityA: { type: "Quest", id: "quest-one" },
    entityB: { type: "Session", id: "session-one" }, label: "related", visibility: "Player",
  } }, "gm"), created.res);
  assert.equal(created.result.status, 200);
  assert.equal((created.result.body as any).link.id, generic.id);
  assert.equal(mocks.db.insert.mock.calls.length, 1);
  assert.equal(mocks.db.update.mock.calls.length, 0);
});

test("API integration: GM mode retains Location-NPC links without the Player endpoint filter", async () => {
  mocks.state.selectRows.push([linkRow({
    entityAType: "Map", entityAId: "harbor", entityBType: "NPC",
    entityBId: "archivist", label: "controls", visibility: "GM",
  })]);
  const { res, result } = response();
  await entityLinksHandler(request("GET", undefined, undefined, "gm"), res);

  assert.equal(result.status, 200);
  const query = sqlDatabase.select().from(entityLinks)
    .where(mocks.state.whereClauses[0] as never).toSQL();
  assert.deepEqual(query.params, [campaign.id]);
  assert.doesNotMatch(query.sql, /from "locations"/);
  assert.equal((result.body as any).links[0].visibility, "GM");
});

test("API integration: Location-NPC edits preserve the existing id and require campaign-scoped endpoints", async () => {
  const existing = linkRow({
    entityAType: "Map", entityAId: "harbor", entityBType: "NPC",
    entityBId: "archivist", label: "controls", visibility: "Player",
  });
  mocks.state.selectRows.push([{ id: "harbor" }], [{ id: "archivist" }], [existing]);
  mocks.state.writeRows.push([{ ...existing, label: "resides_in", visibility: "GM" }]);
  const { res, result } = response();
  await entityLinksHandler(request("PUT", undefined, { link: {
    id: "another-directional-id",
    entityA: { type: "NPC", id: "archivist" },
    entityB: { type: "Map", id: "harbor" },
    label: "resides_in", visibility: "GM",
  } }, "gm"), res);

  assert.equal(result.status, 200);
  assert.equal(mocks.db.insert.mock.calls.length, 0);
  assert.equal((mocks.state.updateValues[0] as any).id, existing.id);
  assert.equal((result.body as any).link.id, existing.id);
  const endpointQueries = [locations, npcs].map((table, index) =>
    sqlDatabase.select().from(table).where(mocks.state.whereClauses[index] as never).toSQL()
  );
  assert.deepEqual(endpointQueries[0].params, [campaign.id, "harbor"]);
  assert.deepEqual(endpointQueries[1].params, [campaign.id, "archivist"]);
});

test("API integration: Player mode cannot edit a Location-NPC link on a GM account", async () => {
  const { res, result } = response();
  await entityLinksHandler(request("PUT", undefined, { link: {
    id: "link-1", entityA: { type: "Map", id: "harbor" },
    entityB: { type: "NPC", id: "archivist" },
    label: "controls", visibility: "Player",
  } }), res);
  assert.equal(result.status, 401);
  assert.equal(mocks.db.insert.mock.calls.length, 0);
  assert.equal(mocks.db.update.mock.calls.length, 0);
});

test("API integration: Player-mode deletion does not reveal or remove a Location-NPC link", async () => {
  mocks.state.selectRows.push([linkRow({
    entityAType: "Map", entityAId: "hidden-vault", entityBType: "NPC",
    entityBId: "archivist", label: "controls", visibility: "GM",
  })]);
  const { res, result } = response();
  await entityLinksHandler(request("DELETE", { campaignId: campaign.slug, linkId: "link-1" }), res);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { ok: true });
  assert.equal(mocks.db.delete.mock.calls.length, 0);
});

test("API integration: a Location-NPC link cannot target an entity outside its campaign", async () => {
  mocks.state.selectRows.push([], [{ id: "archivist" }]);
  const { res, result } = response();
  await entityLinksHandler(request("PUT", undefined, { link: {
    id: "link-2", entityA: { type: "Map", id: "other-campaign-harbor" },
    entityB: { type: "NPC", id: "archivist" },
    label: "controls", visibility: "Player",
  } }, "gm"), res);
  assert.equal(result.status, 401);
  assert.equal(mocks.db.insert.mock.calls.length, 0);
  assert.equal(mocks.db.update.mock.calls.length, 0);
});

test("API integration: another workspace's campaign links are unavailable without membership", async () => {
  mocks.requireCampaignMember.mockRejectedValue(new Error("Campaign membership required"));
  const { res, result } = response();
  await entityLinksHandler(request("GET"), res);
  assert.equal(result.status, 401);
  assert.equal(mocks.db.select.mock.calls.length, 0);
});

test("API integration: a dual-role user in Player mode receives public sessions without GM payloads", async () => {
  mocks.requireCampaignMember.mockResolvedValue({ role: "gm" });
  mocks.state.selectRows.push([
    {
      campaignId: campaign.id,
      id: "session-1",
      sessionNumber: 1,
      name: "Arrival",
      players: 4,
      maxPlayers: 5,
      duration: "3h",
      status: "completed",
      startTime: "2026-01-01T18:00:00.000Z",
      map: "Town",
      difficulty: "Normal",
      progress: 100,
      visibility: "public",
      summary: "The party arrived.",
      timeline: "Public timeline",
      moments: "Public moments",
      quotes: "Public quote",
      gmNotes: "The innkeeper is a spy",
      gmSecrets: "The town is an illusion",
      gmPrep: ["Reveal the false moon"],
      attendees: ["Player One"],
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    },
  ]);
  const { res, result } = response();

  await sessionsHandler(request("GET"), res);

  assert.equal(result.status, 200);
  const query = sqlDatabase
    .select()
    .from(sessions)
    .where(mocks.state.whereClauses[0] as never)
    .toSQL();
  assert.deepEqual(query.params, [campaign.id, "public"]);
  const payload = (result.body as any).sessions[0];
  assert.equal(payload.gmNotes, undefined);
  assert.equal(payload.gmSecrets, undefined);
  assert.equal(payload.gmPrep, undefined);
});

test("API integration: a dual-role user in Player mode receives only assigned spoiler-safe characters", async () => {
  mocks.requireCampaignMember.mockResolvedValue({ role: "gm" });
  mocks.state.selectRows.push(
    [
      {
        campaignId: campaign.id,
        id: "assigned-hero",
        data: {
          id: "assigned-hero",
          name: "Assigned Hero",
          gmNotes: "Secret lineage",
          secrets: ["Royal heir"],
        },
      },
      {
        campaignId: campaign.id,
        id: "hidden-rival",
        data: {
          id: "hidden-rival",
          name: "Hidden Rival",
          gmNotes: "Future antagonist",
        },
      },
    ],
    [
      {
        campaignId: campaign.id,
        characterId: "assigned-hero",
        userId: currentUser.id,
      },
    ]
  );
  const { res, result } = response();

  await charactersHandler(request("GET"), res);

  assert.equal(result.status, 200);
  assert.deepEqual((result.body as any).characters, [
    { id: "assigned-hero", name: "Assigned Hero" },
  ]);
  const assignmentQuery = sqlDatabase
    .select()
    .from(characterAssignments)
    .where(mocks.state.whereClauses[1] as never)
    .toSQL();
  assert.deepEqual(assignmentQuery.params, [campaign.id, currentUser.id]);
});

test("API integration: a dual-role user in Player mode receives only their character assignments", async () => {
  mocks.requireCampaignMember.mockResolvedValue({ role: "gm" });
  const assignment = {
    id: "00000000-0000-4000-8000-000000000020",
    campaignId: campaign.id,
    characterId: "assigned-hero",
    userId: currentUser.id,
    createdByUserId: currentUser.id,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };
  mocks.state.selectRows.push(
    [assignment],
    [
      {
        campaignId: campaign.id,
        id: "assigned-hero",
        data: {
          id: "assigned-hero",
          name: "Assigned Hero",
          gmNotes: "Secret lineage",
          secrets: ["Royal heir"],
        },
      },
    ]
  );
  const { res, result } = response();

  await characterAssignmentsHandler(request("GET"), res);

  assert.equal(result.status, 200);
  assert.deepEqual((result.body as any).assignedCharacterIds, ["assigned-hero"]);
  assert.deepEqual((result.body as any).pendingAssignedCharacterIds, []);
  assert.deepEqual((result.body as any).characters, [
    { id: "assigned-hero", name: "Assigned Hero" },
  ]);
  const assignmentQuery = sqlDatabase
    .select()
    .from(characterAssignments)
    .where(mocks.state.whereClauses[0] as never)
    .toSQL();
  assert.deepEqual(assignmentQuery.params, [campaign.id, currentUser.id]);
});

test("API integration: a persisted GM in Player mode cannot mutate character assignments", async () => {
  mocks.requireCampaignMember.mockResolvedValue({ role: "gm" });
  const { res, result } = response();

  await characterAssignmentsHandler(
    request("POST", undefined, { userId: currentUser.id, characterId: "assigned-hero" }),
    res
  );

  assert.equal(result.status, 401);
  assert.deepEqual(result.body, {
    ok: false,
    error: "Campaign GM mode required",
  });
  assert.equal(mocks.db.insert.mock.calls.length, 0);
});

test("API integration: item writes fail closed when GM authorization is denied", async () => {
  mocks.requireCampaignGm.mockRejectedValue(
    new Error("Campaign GM permission required")
  );
  const { res, result } = response();

  await itemsHandler(
    request("PUT", undefined, { item: { id: "moonblade", name: "Moonblade" } }),
    res
  );

  assert.equal(result.status, 401);
  assert.deepEqual(result.body, {
    ok: false,
    error: "Campaign GM permission required",
  });
  assert.equal(mocks.db.insert.mock.calls.length, 0);
});

test("API integration: item create and update share a campaign-scoped upsert", async () => {
  mocks.state.writeRows.push([itemRow()]);
  const { res, result } = response();

  await itemsHandler(
    request("PUT", undefined, {
      item: {
        id: "moonblade",
        name: "Moonblade",
        visibility: "public",
        gmNotes: "Actually cursed",
      },
    }),
    res
  );

  assert.equal(result.status, 200);
  assert.equal((mocks.state.insertValues[0] as any).campaignId, campaign.id);
  assert.deepEqual((mocks.state.conflictConfigs[0] as any).target, [
    items.campaignId,
    items.id,
  ]);
  assert.equal((result.body as any).item.gmNotes, "Actually cursed");
});

test("API integration: GM item worth is saved and returned on reload", async () => {
  const savedRow = itemRow({ data: { worthGp: 2.75 } });
  mocks.state.writeRows.push([savedRow]);
  const saved = response();
  await itemsHandler(request("PUT", undefined, { item: { id: "moonblade", name: "Moonblade", worthGp: "2.75" } }, "gm"), saved.res);
  assert.equal(saved.result.status, 200);
  assert.equal((mocks.state.insertValues[0] as any).data.worthGp, 2.75);

  mocks.state.selectRows.push([savedRow]);
  const reloaded = response();
  await itemsHandler(request("GET", { campaignId: campaign.slug, itemId: "moonblade" }, undefined, "gm"), reloaded.res);
  assert.equal(reloaded.result.status, 200);
  assert.equal((reloaded.result.body as any).item.worthGp, 2.75);
});

test("API integration: Player mode cannot add or erase item worth", async () => {
  const add = response();
  await itemsHandler(request("PUT", undefined, { item: { id: "moonblade", name: "Moonblade", worthGp: 2 } }), add.res);
  assert.equal(add.result.status, 401);
  assert.match((add.result.body as any).error, /GM mode is required/);

  mocks.state.selectRows.push([{ data: { worthGp: 2 } }]);
  const erase = response();
  await itemsHandler(request("PUT", undefined, { item: { id: "moonblade", name: "Moonblade" } }), erase.res);
  assert.equal(erase.result.status, 401);
  assert.equal(mocks.db.insert.mock.calls.length, 0);
});

test("API integration: invalid profile worth is rejected before an item write", async () => {
  const { res, result } = response();
  await itemsHandler(request("PUT", undefined, { item: { id: "moonblade", name: "Moonblade", worthGp: "1.234" } }, "gm"), res);
  assert.equal(result.status, 401);
  assert.match((result.body as { error: string }).error, /two decimal places/);
  assert.equal(mocks.db.insert.mock.calls.length, 0);
});

test("API integration: non-GM users cannot create general campaign links", async () => {
  mocks.requireCampaignMember.mockResolvedValue({ role: "player" });
  mocks.requireCampaignGm.mockRejectedValue(
    new Error("Campaign GM permission required")
  );
  const { res, result } = response();

  await entityLinksHandler(
    request("PUT", undefined, {
      link: {
        id: "link-1",
        entityA: { type: "Item", id: "moonblade" },
        entityB: { type: "NPC", id: "archivist" },
        label: "owns",
        visibility: "Player",
      },
    }),
    res
  );

  assert.equal(result.status, 401);
  assert.equal(mocks.db.insert.mock.calls.length, 0);
  assert.equal(mocks.db.update.mock.calls.length, 0);
});

test("API integration: new relationships are linked to the resolved campaign and user", async () => {
  mocks.state.selectRows.push([]);
  mocks.state.writeRows.push([linkRow()]);
  const { res, result } = response();

  await entityLinksHandler(
    request("PUT", undefined, {
      link: {
        id: "link-1",
        entityA: { type: "NPC", id: "archivist" },
        entityB: { type: "Item", id: "moonblade" },
        label: "owns",
        visibility: "Player",
      },
    }),
    res
  );

  assert.equal(result.status, 200);
  const values = mocks.state.insertValues[0] as any;
  assert.equal(values.campaignId, campaign.id);
  assert.equal(values.createdByUserId, currentUser.id);
  assert.deepEqual(
    [values.entityAType, values.entityAId, values.entityBType, values.entityBId],
    ["Item", "moonblade", "NPC", "archivist"]
  );
  const lookupQuery = sqlDatabase
    .select()
    .from(entityLinks)
    .where(mocks.state.whereClauses[0] as never)
    .toSQL();
  assert.equal(lookupQuery.params.filter((value) => value === campaign.id).length, 2);
});

test("API integration: an existing campaign relationship uses the update path", async () => {
  const existing = linkRow();
  mocks.state.selectRows.push([existing]);
  mocks.state.writeRows.push([linkRow({ note: "Updated note" })]);
  const { res, result } = response();

  await entityLinksHandler(
    request("PUT", undefined, {
      link: {
        id: "link-1",
        entityA: { type: "Item", id: "moonblade" },
        entityB: { type: "NPC", id: "archivist" },
        label: "owns",
        visibility: "Player",
        note: "Updated note",
      },
    }),
    res
  );

  assert.equal(result.status, 200);
  assert.equal(mocks.db.insert.mock.calls.length, 0);
  assert.equal(mocks.db.update.mock.calls.length, 1);
  assert.equal((mocks.state.updateValues[0] as any).note, "Updated note");
  const updateQuery = sqlDatabase
    .select()
    .from(entityLinks)
    .where(mocks.state.updateClauses[0] as never)
    .toSQL();
  assert.deepEqual(updateQuery.params, [existing.rowId]);
});
