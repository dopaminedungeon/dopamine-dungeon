import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, or } from "drizzle-orm";

import {
  getCurrentUser,
  requireCampaignGm,
  requireCampaignMember,
  resolveCampaignBySlug,
} from "./_lib/access.ts";
import { setCorsHeaders } from "./_lib/cors.ts";
import { db } from "./_lib/db.ts";
import { characters } from "../db/schema/characters";

type CharacterRow = typeof characters.$inferSelect;

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

function stripGmOnlyCharacterFields(data: Record<string, unknown>) {
  const { gmNotes, secrets, ...safeData } = data;
  void gmNotes;
  void secrets;
  return safeData;
}

function toCharacterPayload(row: CharacterRow, isGm: boolean) {
  if (isGm) {
    return row.data;
  }

  // Player visibility projection: never send GM-only character notes/secrets.
  return stripGmOnlyCharacterFields(row.data);
}

function toCharacterValues(
  campaignId: string,
  rawCharacter: Record<string, unknown>
) {
  const characterId = normalizeString(rawCharacter.id);

  if (!characterId) {
    throw new Error("Character id is required");
  }

  const visibility = normalizeString(rawCharacter.visibility, "player") || "player";
  const isPlayerVisible =
    typeof rawCharacter.isPlayerVisible === "boolean"
      ? rawCharacter.isPlayerVisible
      : visibility === "player";
  const ownerUserId = normalizeString(rawCharacter.ownerUserId);
  const now = new Date();

  return {
    campaignId,
    id: characterId,
    name: normalizeString(rawCharacter.name),
    level: normalizeNumber(rawCharacter.level, 1),
    visibility,
    isPlayerVisible,
    ownerUserId,
    data: {
      ...rawCharacter,
      id: characterId,
      visibility,
      isPlayerVisible,
      ownerUserId,
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
    const characterId = normalizeString(getQueryValue(req.query.characterId));
    // Normalize the app-safe campaign slug from the frontend to the Postgres campaign UUID.
    const campaign = await resolveCampaignBySlug(campaignSlug);

    if (req.method === "GET") {
      const membership = await requireCampaignMember({
        campaignId: campaign.id,
        userId: currentUser.id,
      });
      const isGm = membership.role === "gm";

      const visibilityFilter = isGm
        ? eq(characters.campaignId, campaign.id)
        : and(
            eq(characters.campaignId, campaign.id),
            or(
              eq(characters.visibility, "player"),
              eq(characters.isPlayerVisible, true),
              eq(characters.ownerUserId, currentUser.firebaseUid)
            )
          );

      const whereClause = characterId
        ? and(visibilityFilter, eq(characters.id, characterId))
        : visibilityFilter;

      const rows = await db.select().from(characters).where(whereClause);

      if (characterId) {
        return res.status(200).json({
          ok: true,
          campaignId: campaign.slug,
          character: rows[0] ? toCharacterPayload(rows[0], isGm) : null,
        });
      }

      return res.status(200).json({
        ok: true,
        campaignId: campaign.slug,
        characters: rows.map((row) => toCharacterPayload(row, isGm)),
      });
    }

    await requireCampaignGm({
      campaignId: campaign.id,
      userId: currentUser.id,
    });

    if (req.method === "PUT") {
      const rawCharacter =
        req.body && typeof req.body === "object"
          ? (req.body.character ?? req.body)
          : null;

      if (!rawCharacter || typeof rawCharacter !== "object") {
        return res
          .status(400)
          .json({ ok: false, error: "Character payload is required" });
      }

      const values = toCharacterValues(
        campaign.id,
        rawCharacter as Record<string, unknown>
      );
      const returnedRows = await db
        .insert(characters)
        .values(values)
        .onConflictDoUpdate({
          target: [characters.campaignId, characters.id],
          set: {
            name: values.name,
            level: values.level,
            visibility: values.visibility,
            isPlayerVisible: values.isPlayerVisible,
            ownerUserId: values.ownerUserId,
            data: values.data,
            updatedAt: values.updatedAt,
          },
        })
        .returning();

      return res.status(200).json({
        ok: true,
        character: toCharacterPayload(returnedRows[0], true),
      });
    }

    if (!characterId) {
      return res.status(400).json({ ok: false, error: "characterId is required" });
    }

    await db
      .delete(characters)
      .where(
        and(eq(characters.campaignId, campaign.id), eq(characters.id, characterId))
      );

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(401).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unauthorized",
    });
  }
}
