import assert from "node:assert/strict";
import { text, uuid, pgTable } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import { test } from "vitest";

import {
  entityLinksReadWhere,
  itemReadWhere,
  locationReadWhere,
  loreReadWhere,
  npcReadWhere,
  stripGmOnlyItemFields,
  stripGmOnlyNpcFields,
  stripNestedGmNotes,
} from "./security-boundaries.ts";

const database = drizzle.mock();
const campaignId = "00000000-0000-4000-8000-000000000315";
const items = pgTable("boundary_items", {
  campaignId: uuid("campaign_id").notNull(),
  id: text("id").notNull(),
  visibility: text("visibility").notNull(),
});
const lore = pgTable("boundary_lore", {
  campaignId: uuid("campaign_id").notNull(),
  id: text("id").notNull(),
  visibility: text("visibility").notNull(),
});
const locations = pgTable("boundary_locations", {
  campaignId: uuid("campaign_id").notNull(),
  id: text("id").notNull(),
  visibility: text("visibility").notNull(),
});
const npcs = pgTable("boundary_npcs", {
  campaignId: uuid("campaign_id").notNull(),
  id: text("id").notNull(),
  visibility: text("visibility").notNull(),
});
const entityLinks = pgTable("boundary_entity_links", {
  campaignId: uuid("campaign_id").notNull(),
  visibility: text("visibility").notNull(),
});

function selectSql(table, whereClause) {
  return database.select().from(table).where(whereClause).toSQL();
}

test("DD security boundary: player reads remain campaign scoped and public only", () => {
  const cases = [
    {
      table: items,
      query: itemReadWhere(items, { campaignId, isGm: false }),
      expectedVisibility: "public",
    },
    {
      table: lore,
      query: loreReadWhere(lore, { campaignId, isGm: false }),
      expectedVisibility: "public",
    },
    {
      table: locations,
      query: locationReadWhere(locations, { campaignId, isGm: false }),
      expectedVisibility: "public",
    },
    {
      table: npcs,
      query: npcReadWhere(npcs, { campaignId, isGm: false }),
      expectedVisibility: "public",
    },
  ];

  for (const entry of cases) {
    const query = selectSql(entry.table, entry.query);

    assert.match(query.sql, /"campaign_id" = \$1/);
    assert.match(query.sql, /"visibility" = \$2/);
    assert.deepEqual(query.params, [campaignId, entry.expectedVisibility]);
  }
});

test("DD security boundary: GM reads stay campaign scoped without player visibility filtering", () => {
  const cases = [
    {
      table: items,
      id: "ancient-key",
      query: itemReadWhere(items, {
        campaignId,
        itemId: "ancient-key",
        isGm: true,
      }),
    },
    {
      table: lore,
      id: "founding-myth",
      query: loreReadWhere(lore, {
        campaignId,
        loreId: "founding-myth",
        isGm: true,
      }),
    },
    {
      table: locations,
      id: "sealed-vault",
      query: locationReadWhere(locations, {
        campaignId,
        locationId: "sealed-vault",
        isGm: true,
      }),
    },
    {
      table: npcs,
      id: "archivist",
      query: npcReadWhere(npcs, {
        campaignId,
        npcId: "archivist",
        isGm: true,
      }),
    },
  ];

  for (const entry of cases) {
    const query = selectSql(entry.table, entry.query);
    const whereSql = query.sql.split(" where ")[1];

    assert.match(whereSql, /"campaign_id" = \$1/);
    assert.match(whereSql, /"id" = \$2/);
    assert.doesNotMatch(whereSql, /"visibility"/);
    assert.deepEqual(query.params, [campaignId, entry.id]);
  }
});

test("DD security boundary: player links disclose only Player-visible relationships in the same campaign", () => {
  const query = selectSql(
    entityLinks,
    entityLinksReadWhere(entityLinks, { campaignId, isGm: false })
  );

  assert.match(query.sql, /"campaign_id" = \$1/);
  assert.match(query.sql, /"visibility" = \$2/);
  assert.deepEqual(query.params, [campaignId, "Player"]);
});

test("DD security boundary: GM-only item fields are stripped for player payloads", () => {
  const playerPayload = stripGmOnlyItemFields({
    id: "moonblade",
    name: "Moonblade",
    gmNotes: "actually cursed",
    hiddenEffects: ["binds to antagonist"],
    curse: "lycanthropy",
    upgradePath: "blood moon",
    storyHooks: ["lost heir"],
    rarity: "Rare",
  });

  assert.deepEqual(playerPayload, {
    id: "moonblade",
    name: "Moonblade",
    rarity: "Rare",
  });
});

test("DD security boundary: nested GM notes are stripped from lore and location payloads", () => {
  const playerPayload = stripNestedGmNotes({
    id: "founding-myth",
    gmNotes: "the deity is alive",
    data: {
      summary: "A common temple story.",
      gmNotes: "false origin",
      data: {
        publicDetail: "Festival names",
        gmNotes: "villain cipher",
      },
    },
  });

  assert.deepEqual(playerPayload, {
    id: "founding-myth",
    data: {
      summary: "A common temple story.",
      data: {
        publicDetail: "Festival names",
      },
    },
  });
});

test("DD security boundary: NPC player payloads do not disclose GM notes", () => {
  const playerPayload = stripGmOnlyNpcFields({
    id: "archivist",
    name: "Archivist",
    gmNotes: "secret cult leader",
    summary: "Keeps the town records.",
  });

  assert.deepEqual(playerPayload, {
    id: "archivist",
    name: "Archivist",
    summary: "Keeps the town records.",
  });
});
