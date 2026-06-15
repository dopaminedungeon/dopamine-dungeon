import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";

import {
  getCurrentUser,
  requireCampaignGm,
  requireCampaignMember,
  resolveCampaignBySlug,
} from "../access.js";
import { setCorsHeaders } from "../cors.js";
import { db } from "../db.js";
import { lore } from "../../../db/schema/lore.js";

type LoreRow = typeof lore.$inferSelect;

const LORE_TYPES = new Set([
  "Religion",
  "Faction",
  "Country",
  "Event",
  "Magic",
  "Concept / Ritual",
  "Lore",
]);

function getQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeString(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizeType(value: unknown) {
  const type = normalizeString(value, "Lore");
  return LORE_TYPES.has(type) ? type : "Lore";
}

function normalizeAliases(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((alias) => normalizeString(alias))
        .filter(Boolean)
    )
  );
}

function normalizeData(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stripGmOnlyLoreFields(data: Record<string, unknown>): Record<string, unknown> {
  const { gmNotes, data: nestedData, ...safeData } = data;
  void gmNotes;
  const safeNestedData: unknown =
    nestedData && typeof nestedData === "object" && !Array.isArray(nestedData)
      ? stripGmOnlyLoreFields(nestedData as Record<string, unknown>)
      : nestedData;

  return {
    ...safeData,
    ...(safeNestedData ? { data: safeNestedData } : {}),
  };
}

function toLorePayload(row: LoreRow, isGm: boolean) {
  const payload = {
    ...row.data,
    data: row.data,
    id: row.id,
    campaignId: row.campaignId,
    name: row.name,
    type: row.type,
    visibility: row.visibility,
    summary: row.summary,
    content: row.content,
    aliases: row.aliases,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };

  if (isGm) {
    return {
      ...payload,
      gmNotes: row.gmNotes,
    };
  }

  return stripGmOnlyLoreFields(payload);
}

function toLoreValues(campaignId: string, rawLore: Record<string, unknown>) {
  const loreId = normalizeString(rawLore.id);

  if (!loreId) {
    throw new Error("Lore id is required");
  }

  const sourceData = normalizeData(rawLore.data);
  const type = normalizeType(rawLore.type);
  const visibility =
    normalizeString(rawLore.visibility, "gm-only") === "public"
      ? "public"
      : "gm-only";
  const aliases = normalizeAliases(rawLore.aliases);
  const name = normalizeString(rawLore.name);
  const summary = normalizeString(rawLore.summary);
  const content = normalizeString(rawLore.content);
  const gmNotes = normalizeString(rawLore.gmNotes);
  const now = new Date();

  const values = {
    campaignId,
    id: loreId,
    name,
    type,
    visibility,
    summary,
    content,
    gmNotes,
    aliases,
    data: {
      ...sourceData,
      id: loreId,
      visibility,
      name,
      type,
      summary,
      content,
      gmNotes,
      aliases,
    },
    updatedAt: now,
  };

  return values;
}

async function handleLore(req: VercelRequest, res: VercelResponse) {
  if (!["GET", "PUT", "DELETE"].includes(req.method || "")) {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const currentUser = await getCurrentUser(req);
  const campaignSlug = getQueryValue(req.query.campaignId) || "";
  const loreId = normalizeString(getQueryValue(req.query.loreId) || getQueryValue(req.query.id));
  const campaign = await resolveCampaignBySlug(campaignSlug);

  if (req.method === "GET") {
    const membership = await requireCampaignMember({
      campaignId: campaign.id,
      userId: currentUser.id,
    });
    const isGm = membership.role === "gm";

    const visibilityFilter = isGm
      ? eq(lore.campaignId, campaign.id)
      : and(eq(lore.campaignId, campaign.id), eq(lore.visibility, "public"));
    const whereClause = loreId
      ? and(visibilityFilter, eq(lore.id, loreId))
      : visibilityFilter;

    const rows = await db.select().from(lore).where(whereClause);

    if (loreId) {
      return res.status(200).json({
        ok: true,
        campaignId: campaign.slug,
        lore: rows[0] ? toLorePayload(rows[0], isGm) : null,
      });
    }

    return res.status(200).json({
      ok: true,
      campaignId: campaign.slug,
      lore: rows.map((row) => toLorePayload(row, isGm)),
    });
  }

  await requireCampaignGm({
    campaignId: campaign.id,
    userId: currentUser.id,
  });

  if (req.method === "PUT") {
    const rawLore =
      req.body && typeof req.body === "object"
        ? ((req.body as Record<string, unknown>).lore ?? req.body)
        : null;

    if (!rawLore || typeof rawLore !== "object") {
      return res.status(400).json({ ok: false, error: "Lore payload is required" });
    }

    const values = toLoreValues(campaign.id, rawLore as Record<string, unknown>);
    const returnedRows = await db
      .insert(lore)
      .values(values)
      .onConflictDoUpdate({
        target: [lore.campaignId, lore.id],
        set: {
          name: values.name,
          type: values.type,
          visibility: values.visibility,
          summary: values.summary,
          content: values.content,
          gmNotes: values.gmNotes,
          aliases: values.aliases,
          data: values.data,
          updatedAt: values.updatedAt,
        },
      })
      .returning();

    return res.status(200).json({
      ok: true,
      lore: toLorePayload(returnedRows[0], true),
    });
  }

  if (!loreId) {
    return res.status(400).json({ ok: false, error: "loreId is required" });
  }

  await db.delete(lore).where(and(eq(lore.campaignId, campaign.id), eq(lore.id, loreId)));

  return res.status(200).json({ ok: true });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, "GET, PUT, DELETE, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    const entity = normalizeString(getQueryValue(req.query.entity));

    if (entity === "lore") {
      return await handleLore(req, res);
    }

    return res.status(404).json({ ok: false, error: "Worldbuilding entity not found" });
  } catch (error) {
    return res.status(401).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unauthorized",
    });
  }
}
