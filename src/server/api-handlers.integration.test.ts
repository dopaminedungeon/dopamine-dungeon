import type { VercelRequest, VercelResponse } from "@vercel/node";
import assert from "node:assert/strict";
import { drizzle } from "drizzle-orm/postgres-js";
import { beforeEach, test, vi } from "vitest";

import { characterAssignments } from "../../db/schema/characterAssignments.js";
import { characters } from "../../db/schema/characters.js";
import { entityLinks } from "../../db/schema/entityLinks.js";
import { items } from "../../db/schema/items.js";
import { locations } from "../../db/schema/locations.js";
import { lore } from "../../db/schema/lore.js";
import { npcs } from "../../db/schema/npcs.js";
import { sessions } from "../../db/schema/sessions.js";

const mocks = vi.hoisted(() => {
  const state = {
    selectRows: [] as unknown[][],
    writeRows: [] as unknown[][],
    whereClauses: [] as unknown[],
    insertValues: [] as unknown[],
    conflictConfigs: [] as unknown[],
    updateValues: [] as unknown[],
    updateClauses: [] as unknown[],
  };

  function queryResult(rows: unknown[]) {
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
  };

  return {
    db,
    state,
    getCurrentUser: vi.fn(),
    requireCampaignGm: vi.fn(),
    requireCampaignMember: vi.fn(),
    resolveCampaignBySlug: vi.fn(),
    verifyAuthHeader: vi.fn(),
  };
});

vi.mock("./db.js", () => ({ db: mocks.db }));
vi.mock("./access.js", () => ({
  getCurrentUser: mocks.getCurrentUser,
  requireCampaignGm: mocks.requireCampaignGm,
  requireCampaignMember: mocks.requireCampaignMember,
  resolveCampaignBySlug: mocks.resolveCampaignBySlug,
}));
vi.mock("./auth.js", () => ({ verifyAuthHeader: mocks.verifyAuthHeader }));

import characterAssignmentsHandler from "./api-handlers/character-assignments.js";
import charactersHandler from "./api-handlers/characters.js";
import entityLinksHandler from "./api-handlers/entity-links.js";
import itemsHandler from "./api-handlers/items.js";
import locationsHandler from "./api-handlers/locations.js";
import loreHandler from "./api-handlers/lore.js";
import npcsHandler from "./api-handlers/npcs.js";
import sessionsHandler from "./api-handlers/sessions.js";
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
    email_verified: true,
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
