import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, or } from "drizzle-orm";

import {
  getCurrentUser,
  requireCampaignGm,
  requireCampaignMember,
  resolveCampaignBySlug,
} from "./_lib/access";
import { setCorsHeaders } from "./_lib/cors";
import { db } from "./_lib/db";
import { entityLinks } from "../db/schema/entityLinks";
import {
  assertAllowedEntityPair,
  assertAllowedLabelForPair,
} from "../src/domain/links/link.rules";
import type { EntityType, Link, LinkEndpoint } from "../src/domain/links/link.types";

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
        )
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
    const isGm = membership.role === "gm";

    if (req.method === "GET") {
      const rows = await db
        .select()
        .from(entityLinks)
        .where(
          isGm
            ? eq(entityLinks.campaignId, campaign.id)
            : and(
                eq(entityLinks.campaignId, campaign.id),
                eq(entityLinks.visibility, "Player")
              )
        );

      return res.status(200).json({
        ok: true,
        campaignId: campaign.slug,
        links: rows.map(toLinkPayload),
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

      const values = toLinkValues(
        campaign.id,
        currentUser.id,
        rawLink as Record<string, unknown>
      );

      if (!isGm && !isBagItemLink(values.entityAType, values.entityBType)) {
        await requireCampaignGm({ campaignId: campaign.id, userId: currentUser.id });
      }

      const existingLink = await findExistingLink(values);
      let returnedRows: EntityLinkRow[];

      if (existingLink) {
        returnedRows = await db
          .update(entityLinks)
          .set({
            id: values.id,
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

    if (!isGm && !isBagItemLink(link.entityAType, link.entityBType)) {
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
