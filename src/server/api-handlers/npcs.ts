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
import { npcs } from "../../../db/schema/npcs.js";

type NpcRow = typeof npcs.$inferSelect;

function getQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeString(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

function stripGmOnlyNpcFields(data: Record<string, unknown>) {
  const { gmNotes, ...safeData } = data;
  void gmNotes;
  return safeData;
}

function toNpcPayload(row: NpcRow, isGm: boolean) {
  if (isGm) {
    return row.data;
  }

  return stripGmOnlyNpcFields(row.data);
}

function toNpcValues(campaignId: string, rawNpc: Record<string, unknown>) {
  const npcId = normalizeString(rawNpc.id);

  if (!npcId) {
    throw new Error("NPC id is required");
  }

  const visibility =
    normalizeString(rawNpc.visibility, "public") === "gm-only"
      ? "gm-only"
      : "public";
  const now = new Date();

  const values = {
    campaignId,
    id: npcId,
    name: normalizeString(rawNpc.name),
    title: normalizeString(rawNpc.title),
    type: normalizeString(rawNpc.type, "unknown") || "unknown",
    status: normalizeString(rawNpc.status, "active") || "active",
    visibility,
    summary: normalizeString(rawNpc.summary),
    description: normalizeString(rawNpc.description),
    gmNotes: normalizeString(rawNpc.gmNotes),
    imageUrl: normalizeString(rawNpc.imageUrl),
    data: {
      ...rawNpc,
      id: npcId,
      visibility,
      name: normalizeString(rawNpc.name),
      title: normalizeString(rawNpc.title),
      type: normalizeString(rawNpc.type, "unknown") || "unknown",
      status: normalizeString(rawNpc.status, "active") || "active",
      summary: normalizeString(rawNpc.summary),
      description: normalizeString(rawNpc.description),
      gmNotes: normalizeString(rawNpc.gmNotes),
      imageUrl: normalizeString(rawNpc.imageUrl),
    },
    updatedAt: now,
  };

  return values;
}

async function handleNpcs(req: VercelRequest, res: VercelResponse) {
  if (!["GET", "PUT", "DELETE"].includes(req.method || "")) {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const currentUser = await getCurrentUser(req);
  const campaignSlug = getQueryValue(req.query.campaignId) || "";
  const npcId = normalizeString(getQueryValue(req.query.npcId));
  const campaign = await resolveCampaignBySlug(campaignSlug);

  if (req.method === "GET") {
    const membership = await requireCampaignMember({
      campaignId: campaign.id,
      userId: currentUser.id,
    });
    const isGm = membership.role === "gm";

    const visibilityFilter = isGm
      ? eq(npcs.campaignId, campaign.id)
      : and(eq(npcs.campaignId, campaign.id), eq(npcs.visibility, "public"));
    const whereClause = npcId
      ? and(visibilityFilter, eq(npcs.id, npcId))
      : visibilityFilter;

    const rows = await db.select().from(npcs).where(whereClause);

    if (npcId) {
      return res.status(200).json({
        ok: true,
        campaignId: campaign.slug,
        npc: rows[0] ? toNpcPayload(rows[0], isGm) : null,
      });
    }

    return res.status(200).json({
      ok: true,
      campaignId: campaign.slug,
      npcs: rows.map((row) => toNpcPayload(row, isGm)),
    });
  }

  await requireCampaignGm({
    campaignId: campaign.id,
    userId: currentUser.id,
  });

  if (req.method === "PUT") {
    const rawNpc =
      req.body && typeof req.body === "object"
        ? (req.body.npc ?? req.body)
        : null;

    if (!rawNpc || typeof rawNpc !== "object") {
      return res.status(400).json({ ok: false, error: "NPC payload is required" });
    }

    const values = toNpcValues(campaign.id, rawNpc as Record<string, unknown>);
    const returnedRows = await db
      .insert(npcs)
      .values(values)
      .onConflictDoUpdate({
        target: [npcs.campaignId, npcs.id],
        set: {
          name: values.name,
          title: values.title,
          type: values.type,
          status: values.status,
          visibility: values.visibility,
          summary: values.summary,
          description: values.description,
          gmNotes: values.gmNotes,
          imageUrl: values.imageUrl,
          data: values.data,
          updatedAt: values.updatedAt,
        },
      })
      .returning();

    return res.status(200).json({
      ok: true,
      npc: toNpcPayload(returnedRows[0], true),
    });
  }

  if (!npcId) {
    return res.status(400).json({ ok: false, error: "npcId is required" });
  }

  await db.delete(npcs).where(and(eq(npcs.campaignId, campaign.id), eq(npcs.id, npcId)));

  return res.status(200).json({ ok: true });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, "GET, PUT, DELETE, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    const entity = normalizeString(getQueryValue(req.query.entity));

    if (entity === "npcs") {
      return await handleNpcs(req, res);
    }

    return res.status(404).json({ ok: false, error: "Worldbuilding entity not found" });
  } catch (error) {
    return res.status(401).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unauthorized",
    });
  }
}
