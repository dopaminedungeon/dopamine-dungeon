import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";

import {
  getCurrentUser,
  requireCampaignGm,
  requireCampaignMember,
  resolveCampaignBySlug,
} from "./lib/access.ts";
import { setCorsHeaders } from "./lib/cors.ts";
import { db } from "./lib/db.ts";
import { items } from "../db/schema/items";

type ItemRow = typeof items.$inferSelect;

function getQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeString(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stripGmOnlyItemFields(data: Record<string, unknown>) {
  const { gmNotes, hiddenEffects, curse, upgradePath, storyHooks, ...safeData } =
    data;
  void gmNotes;
  void hiddenEffects;
  void curse;
  void upgradePath;
  void storyHooks;
  return safeData;
}

function toItemPayload(row: ItemRow, isGm: boolean) {
  if (isGm) {
    return row.data;
  }

  // Player visibility projection: public items never expose GM-only fields.
  return stripGmOnlyItemFields(row.data);
}

function toItemValues(campaignId: string, rawItem: Record<string, unknown>) {
  const itemId = normalizeString(rawItem.id);

  if (!itemId) {
    throw new Error("Item id is required");
  }

  const visibility =
    normalizeString(rawItem.visibility, "public") === "gm-only"
      ? "gm-only"
      : "public";
  const now = new Date();

  return {
    campaignId,
    id: itemId,
    name: normalizeString(rawItem.name),
    type: normalizeString(rawItem.type, "Other") || "Other",
    rarity: normalizeString(rawItem.rarity, "Common") || "Common",
    power: normalizeNumber(rawItem.power, 0),
    visibility,
    data: {
      ...rawItem,
      id: itemId,
      visibility,
    },
    updatedAt: now,
  };
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
    const itemId = normalizeString(getQueryValue(req.query.itemId));
    // Normalize the app-safe campaign slug from the frontend to the Postgres campaign UUID.
    const campaign = await resolveCampaignBySlug(campaignSlug);

    if (req.method === "GET") {
      const membership = await requireCampaignMember({
        campaignId: campaign.id,
        userId: currentUser.id,
      });
      const isGm = membership.role === "gm";

      const visibilityFilter = isGm
        ? eq(items.campaignId, campaign.id)
        : and(eq(items.campaignId, campaign.id), eq(items.visibility, "public"));
      const whereClause = itemId
        ? and(visibilityFilter, eq(items.id, itemId))
        : visibilityFilter;

      const rows = await db.select().from(items).where(whereClause);

      if (itemId) {
        return res.status(200).json({
          ok: true,
          campaignId: campaign.slug,
          item: rows[0] ? toItemPayload(rows[0], isGm) : null,
        });
      }

      return res.status(200).json({
        ok: true,
        campaignId: campaign.slug,
        items: rows.map((row) => toItemPayload(row, isGm)),
      });
    }

    await requireCampaignGm({
      campaignId: campaign.id,
      userId: currentUser.id,
    });

    if (req.method === "PUT") {
      const rawItem =
        req.body && typeof req.body === "object"
          ? (req.body.item ?? req.body)
          : null;

      if (!rawItem || typeof rawItem !== "object") {
        return res
          .status(400)
          .json({ ok: false, error: "Item payload is required" });
      }

      const values = toItemValues(campaign.id, rawItem as Record<string, unknown>);
      const returnedRows = await db
        .insert(items)
        .values(values)
        .onConflictDoUpdate({
          target: [items.campaignId, items.id],
          set: {
            name: values.name,
            type: values.type,
            rarity: values.rarity,
            power: values.power,
            visibility: values.visibility,
            data: values.data,
            updatedAt: values.updatedAt,
          },
        })
        .returning();

      return res.status(200).json({
        ok: true,
        item: toItemPayload(returnedRows[0], true),
      });
    }

    if (!itemId) {
      return res.status(400).json({ ok: false, error: "itemId is required" });
    }

    await db
      .delete(items)
      .where(and(eq(items.campaignId, campaign.id), eq(items.id, itemId)));

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(401).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unauthorized",
    });
  }
}
