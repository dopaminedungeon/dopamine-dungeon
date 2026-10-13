import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, or, sql } from "drizzle-orm";

import {
  getCurrentUser,
  requireCampaignGm,
  requireCampaignMember,
  resolveCampaignBySlug,
} from "../access.js";
import { setCorsHeaders } from "../cors.js";
import { db } from "../db.js";
import { entityLinksReadWhere } from "../security-boundaries.js";
import { canViewAsGm } from "../viewer-mode.js";
import { entityLinks } from "../../../db/schema/entityLinks.js";
import { locations } from "../../../db/schema/locations.js";
import { npcs } from "../../../db/schema/npcs.js";
import { quests } from "../../../db/schema/quests.js";
import { sessions } from "../../../db/schema/sessions.js";
import { items } from "../../../db/schema/items.js";
import { characters } from "../../../db/schema/characters.js";
import {
  assertAllowedEntityPair,
  assertAllowedLabelForPair,
} from "../../domain/links/link.rules.js";
import type { EntityType, Link, LinkEndpoint } from "../../domain/links/link.types.js";

type EntityLinkRow = typeof entityLinks.$inferSelect;
type EntityLinkInsert = typeof entityLinks.$inferInsert;

function getQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeString(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizeVisibility(value: unknown) {
  return value === "Player" ? "Player" : "GM";
}

function normalizeEndpoint(value: unknown): LinkEndpoint {
  const endpoint = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const type = normalizeString(endpoint.type) as EntityType;
  const id = normalizeString(endpoint.id);

  if (!type || !id) {
    throw new Error("Link endpoints require type and id");
  }

  return { type, id };
}

function normalizeEndpoints(
  entityA: LinkEndpoint,
  entityB: LinkEndpoint
): [LinkEndpoint, LinkEndpoint] {
  const keyA = `${entityA.type}:${entityA.id}`;
  const keyB = `${entityB.type}:${entityB.id}`;

  // Bidirectional normalization: store one canonical row for A<->B and B<->A.
  return keyA <= keyB ? [entityA, entityB] : [entityB, entityA];
}

function isBagItemLink(entityAType: string, entityBType: string) {
  const pair = new Set([entityAType, entityBType]);
  return pair.has("BagOfHolding") && pair.has("Item");
}

function isLocationNpcLink(entityAType: string, entityBType: string) {
  return new Set([entityAType, entityBType]).size === 2 &&
    [entityAType, entityBType].every((type) => type === "Map" || type === "NPC");
}

// A Player-visible link cannot disclose a hidden endpoint, even when its own
// visibility was set to Player. Handle either orientation for historical rows.
function playerLocationNpcWhere() {
  return sql`(
    not ((${entityLinks.entityAType} = 'Map' and ${entityLinks.entityBType} = 'NPC')
      or (${entityLinks.entityAType} = 'NPC' and ${entityLinks.entityBType} = 'Map'))
    or (
      exists (select 1 from ${locations} where ${locations.campaignId} = ${entityLinks.campaignId}
        and ${locations.id} = case when ${entityLinks.entityAType} = 'Map' then ${entityLinks.entityAId} else ${entityLinks.entityBId} end
        and ${locations.visibility} = 'public')
      and exists (select 1 from ${npcs} where ${npcs.campaignId} = ${entityLinks.campaignId}
        and ${npcs.id} = case when ${entityLinks.entityAType} = 'NPC' then ${entityLinks.entityAId} else ${entityLinks.entityBId} end
        and ${npcs.visibility} = 'public')
    )
  )`;
}

// Existing generic links include reserved Quest endpoints. Once Quest is active,
// a visible link must be unable to disclose a hidden Quest or hidden counterpart.
function playerQuestWhere() {
  const questId = sql`case when ${entityLinks.entityAType} = 'Quest' then ${entityLinks.entityAId} else ${entityLinks.entityBId} end`;
  const otherId = sql`case when ${entityLinks.entityAType} = 'Quest' then ${entityLinks.entityBId} else ${entityLinks.entityAId} end`;
  const otherType = sql`case when ${entityLinks.entityAType} = 'Quest' then ${entityLinks.entityBType} else ${entityLinks.entityAType} end`;
  return sql`(
    (${entityLinks.entityAType} <> 'Quest' and ${entityLinks.entityBType} <> 'Quest')
    or (exists (select 1 from ${quests} where ${quests.campaignId} = ${entityLinks.campaignId}
      and ${quests.id} = ${questId} and ${quests.visibility} = 'public')
      and (
        (${otherType} = 'Session' and exists (select 1 from ${sessions} where ${sessions.campaignId} = ${entityLinks.campaignId}
          and ${sessions.id} = ${otherId} and ${sessions.visibility} = 'public'))
        or (${otherType} = 'NPC' and exists (select 1 from ${npcs} where ${npcs.campaignId} = ${entityLinks.campaignId}
          and ${npcs.id} = ${otherId} and ${npcs.visibility} = 'public'))
        or (${otherType} = 'Map' and exists (select 1 from ${locations} where ${locations.campaignId} = ${entityLinks.campaignId}
          and ${locations.id} = ${otherId} and ${locations.visibility} = 'public'))
        or (${otherType} = 'Item' and exists (select 1 from ${items} where ${items.campaignId} = ${entityLinks.campaignId}
          and ${items.id} = ${otherId} and ${items.visibility} = 'public'))
        or (${otherType} = 'PC' and exists (select 1 from ${characters} where ${characters.campaignId} = ${entityLinks.campaignId}
          and ${characters.id} = ${otherId} and ${characters.isPlayerVisible} = true))
      ))
  )`;
}

async function requireQuestEndpoints(values: EntityLinkInsert) {
  if (values.entityAType !== "Quest" && values.entityBType !== "Quest") return;
  const questId = values.entityAType === "Quest" ? values.entityAId : values.entityBId;
  const otherType = values.entityAType === "Quest" ? values.entityBType : values.entityAType;
  const otherId = values.entityAType === "Quest" ? values.entityBId : values.entityAId;
  const table = { Session: sessions, NPC: npcs, Map: locations, Item: items, PC: characters }[otherType];
  if (!table) throw new Error("Quest relationship target is not available");
  const [questRows, targetRows] = await Promise.all([
    db.select({ id: quests.id }).from(quests).where(and(eq(quests.campaignId, values.campaignId), eq(quests.id, questId))).limit(1),
    db.select({ id: table.id }).from(table).where(and(eq(table.campaignId, values.campaignId), eq(table.id, otherId))).limit(1),
  ]);
  if (!questRows.length || !targetRows.length) throw new Error("Quest relationship target is unavailable in this campaign");
}

async function requireLocationNpcEndpoints(values: EntityLinkInsert) {
  if (!isLocationNpcLink(values.entityAType, values.entityBType)) return;
  const locationId = values.entityAType === "Map" ? values.entityAId : values.entityBId;
  const npcId = values.entityAType === "NPC" ? values.entityAId : values.entityBId;
  const [locationRows, npcRows] = await Promise.all([
    db.select({ id: locations.id }).from(locations).where(and(
      eq(locations.campaignId, values.campaignId), eq(locations.id, locationId)
    )).limit(1),
    db.select({ id: npcs.id }).from(npcs).where(and(
      eq(npcs.campaignId, values.campaignId), eq(npcs.id, npcId)
    )).limit(1),
  ]);
  if (!locationRows.length || !npcRows.length) {
    throw new Error("Location or NPC is unavailable in this campaign");
  }
}

function toDate(value: unknown) {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return new Date();
}

function toLinkPayload(row: EntityLinkRow): Link {
  return {
    id: row.id,
    entityA: {
      type: row.entityAType as EntityType,
      id: row.entityAId,
    },
    entityB: {
      type: row.entityBType as EntityType,
      id: row.entityBId,
    },
    label: row.label,
    visibility: row.visibility === "Player" ? "Player" : "GM",
    ...(row.createdInSession ? { createdInSession: row.createdInSession } : {}),
    ...(row.note ? { note: row.note } : {}),
    createdAt: row.createdAt.toISOString(),
  };
}

function toLinkValues(
  campaignId: string,
  userId: string,
  rawLink: Record<string, unknown>
): EntityLinkInsert {
  const entityA = normalizeEndpoint(rawLink.entityA);
  const entityB = normalizeEndpoint(rawLink.entityB);

  if (entityA.type === entityB.type && entityA.id === entityB.id) {
    throw new Error("An entity cannot be linked to itself");
  }

  const label = normalizeString(rawLink.label);
  assertAllowedEntityPair(entityA.type, entityB.type);
  assertAllowedLabelForPair(entityA.type, entityB.type, label);

  const [normalizedA, normalizedB] = normalizeEndpoints(entityA, entityB);
  const id = normalizeString(rawLink.id, crypto.randomUUID());
  const now = new Date();

  return {
    campaignId,
    id,
    entityAType: normalizedA.type,
    entityAId: normalizedA.id,
    entityBType: normalizedB.type,
    entityBId: normalizedB.id,
    label,
    visibility: normalizeVisibility(rawLink.visibility),
    createdInSession:
      rawLink.createdInSession != null
        ? normalizeString(rawLink.createdInSession)
        : null,
    note: rawLink.note != null ? normalizeString(rawLink.note) : null,
    createdByUserId: userId,
    createdAt: toDate(rawLink.createdAt),
    updatedAt: now,
  };
}

async function findExistingLink(values: EntityLinkInsert) {
  const rows = await db
    .select()
    .from(entityLinks)
    .where(
      or(
        and(eq(entityLinks.campaignId, values.campaignId), eq(entityLinks.id, values.id)),
        and(
          eq(entityLinks.campaignId, values.campaignId),
          eq(entityLinks.entityAType, values.entityAType),
          eq(entityLinks.entityAId, values.entityAId),
          eq(entityLinks.entityBType, values.entityBType),
          eq(entityLinks.entityBId, values.entityBId),
          eq(entityLinks.label, values.label),
          eq(entityLinks.visibility, values.visibility)
        ),
        isLocationNpcLink(values.entityAType, values.entityBType)
          ? and(
              eq(entityLinks.campaignId, values.campaignId),
              or(
                and(eq(entityLinks.entityAType, values.entityAType), eq(entityLinks.entityAId, values.entityAId),
                  eq(entityLinks.entityBType, values.entityBType), eq(entityLinks.entityBId, values.entityBId)),
                and(eq(entityLinks.entityAType, values.entityBType), eq(entityLinks.entityAId, values.entityBId),
                  eq(entityLinks.entityBType, values.entityAType), eq(entityLinks.entityBId, values.entityAId))
              )
            )
          : undefined
      )
    )
    .limit(1);

  return rows[0] ?? null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, "GET, PUT, DELETE, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (!["GET", "PUT", "DELETE"].includes(req.method || "")) {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const currentUser = await getCurrentUser(req);
    const campaignSlug = getQueryValue(req.query.campaignId) || "";
    // Normalize the app-safe campaign slug from the frontend to the Postgres campaign UUID.
    const campaign = await resolveCampaignBySlug(campaignSlug);
    const membership = await requireCampaignMember({
      campaignId: campaign.id,
      userId: currentUser.id,
    });
    const isGmMember = membership.role === "gm";
    const isGmView = canViewAsGm(req, membership.role);

    if (req.method === "GET") {
      const rows = await db
        .select()
        .from(entityLinks)
        .where(
          and(entityLinksReadWhere(entityLinks, {
            campaignId: campaign.id,
            isGm: isGmView,
          }), isGmView ? undefined : playerLocationNpcWhere(), isGmView ? undefined : playerQuestWhere())
        );

      return res.status(200).json({
        ok: true,
        campaignId: campaign.slug,
        links: rows.map((row) => {
          const link = toLinkPayload(row);
          if (!isGmView && (row.entityAType === "Quest" || row.entityBType === "Quest")) {
            return { id: link.id, entityA: link.entityA, entityB: link.entityB,
              label: link.label, visibility: link.visibility, createdAt: link.createdAt };
          }
          return link;
        }),
      });
    }

    if (req.method === "PUT") {
      const rawLink =
        req.body && typeof req.body === "object"
          ? ((req.body as Record<string, unknown>).link ?? req.body)
          : null;

      if (!rawLink || typeof rawLink !== "object") {
        return res.status(400).json({ ok: false, error: "Link payload is required" });
      }
      const submitted = rawLink as Record<string, unknown>;
      const aType = (submitted.entityA as Record<string, unknown> | undefined)?.type;
      const bType = (submitted.entityB as Record<string, unknown> | undefined)?.type;
      if ((aType === "Quest" || bType === "Quest") && !["GM", "Player"].includes(String(submitted.visibility))) {
        return res.status(400).json({ ok: false, error: "Invalid Quest relationship visibility" });
      }

      const values = toLinkValues(
        campaign.id,
        currentUser.id,
        rawLink as Record<string, unknown>
      );

      if (!isGmMember && !isBagItemLink(values.entityAType, values.entityBType)) {
        await requireCampaignGm({ campaignId: campaign.id, userId: currentUser.id });
      }
      if (isLocationNpcLink(values.entityAType, values.entityBType) && !isGmView) {
        throw new Error("GM mode is required to edit this relationship");
      }
      if ((values.entityAType === "Quest" || values.entityBType === "Quest") && !isGmView) {
        throw new Error("GM mode is required to edit this relationship");
      }

      await requireLocationNpcEndpoints(values);
      await requireQuestEndpoints(values);

      const existingLink = await findExistingLink(values);
      if ((values.entityAType === "Quest" || values.entityBType === "Quest") &&
        (values.label === "leads_to" || existingLink?.label === "leads_to")) {
        return res.status(400).json({ ok: false, error: "Edit the main location on the Quest profile" });
      }
      let returnedRows: EntityLinkRow[];

      if (existingLink) {
        returnedRows = await db
          .update(entityLinks)
          .set({
            id: existingLink.id,
            entityAType: values.entityAType,
            entityAId: values.entityAId,
            entityBType: values.entityBType,
            entityBId: values.entityBId,
            label: values.label,
            visibility: values.visibility,
            createdInSession: values.createdInSession,
            note: values.note,
            updatedAt: values.updatedAt,
          })
          .where(eq(entityLinks.rowId, existingLink.rowId))
          .returning();
      } else {
        returnedRows = await db.insert(entityLinks).values(values).returning();
      }

      return res.status(200).json({
        ok: true,
        link: toLinkPayload(returnedRows[0]),
      });
    }

    const linkId = normalizeString(getQueryValue(req.query.linkId));

    if (!linkId) {
      return res.status(400).json({ ok: false, error: "linkId is required" });
    }

    const rows = await db
      .select()
      .from(entityLinks)
      .where(and(eq(entityLinks.campaignId, campaign.id), eq(entityLinks.id, linkId)))
      .limit(1);
    const link = rows[0];

    if (!link) {
      return res.status(200).json({ ok: true });
    }

    if (isLocationNpcLink(link.entityAType, link.entityBType) && !isGmView) {
      // Match the absent-link response without revealing this link's existence.
      return res.status(200).json({ ok: true });
    }
    if ((link.entityAType === "Quest" || link.entityBType === "Quest") && !isGmView) {
      return res.status(200).json({ ok: true });
    }
    if ((link.entityAType === "Quest" || link.entityBType === "Quest") && link.label === "leads_to") {
      return res.status(400).json({ ok: false, error: "Edit the main location on the Quest profile" });
    }

    if (!isGmMember && !isBagItemLink(link.entityAType, link.entityBType)) {
      await requireCampaignGm({ campaignId: campaign.id, userId: currentUser.id });
    }

    await db
      .delete(entityLinks)
      .where(and(eq(entityLinks.campaignId, campaign.id), eq(entityLinks.id, linkId)));

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(401).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unauthorized",
    });
  }
}
