import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";

import {
  getCurrentUser,
  requireCampaignGm,
  requireCampaignMember,
  resolveCampaignBySlug,
} from "../src/server/access.js";
import { setCorsHeaders } from "../src/server/cors.js";
import { db } from "../src/server/db.js";
import { characters } from "../db/schema/characters.js";
import { characterAssignments } from "../db/schema/characterAssignments.js";
import { invitations } from "../db/schema/invitations.js";

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

function parseInvitationCharacterIds(value?: string | null) {
  return String(value || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
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

function mergePlayerEditableCharacterFields(
  existingCharacter: Record<string, unknown>,
  rawCharacter: Record<string, unknown>
) {
  const nextClass = normalizeString(rawCharacter.class);
  const nextSubclass = normalizeString(rawCharacter.subclass);
  const nextLevel = Math.max(1, normalizeNumber(rawCharacter.level, 1));

  return {
    ...existingCharacter,
    name: normalizeString(rawCharacter.name),
    race: normalizeString(rawCharacter.race),
    class: nextClass,
    subclass: nextSubclass,
    level: nextLevel,
    alignment: normalizeString(rawCharacter.alignment),
    background: normalizeString(rawCharacter.background),
    publicNotes: normalizeString(rawCharacter.publicNotes),
    classes: Array.isArray(existingCharacter.classes)
      ? existingCharacter.classes.map((entry, index) =>
          index === 0 && entry && typeof entry === "object"
            ? {
                ...(entry as Record<string, unknown>),
                className: nextClass,
                level: nextLevel,
                subclass: nextSubclass,
              }
            : entry
        )
      : existingCharacter.classes,
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
        : eq(characters.campaignId, campaign.id);

      const whereClause = characterId
        ? and(visibilityFilter, eq(characters.id, characterId))
        : visibilityFilter;

      let rows = await db.select().from(characters).where(whereClause);
      let assignedCharacterIds = new Set<string>();

      if (!isGm) {
        const assignments = await db
          .select()
          .from(characterAssignments)
          .where(
            and(
              eq(characterAssignments.campaignId, campaign.id),
              eq(characterAssignments.userId, currentUser.id)
            )
          );
        assignedCharacterIds = new Set(
          assignments.map((assignment) => assignment.characterId)
        );
        rows = rows.filter((row) => assignedCharacterIds.has(row.id));
      }

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

    if (req.method === "PUT") {
      const membership = await requireCampaignMember({
        campaignId: campaign.id,
        userId: currentUser.id,
      });
      const isGm = membership.role === "gm";
      const rawCharacter =
        req.body && typeof req.body === "object"
          ? (req.body.character ?? req.body)
          : null;

      if (!rawCharacter || typeof rawCharacter !== "object") {
        return res
          .status(400)
          .json({ ok: false, error: "Character payload is required" });
      }

      if (!isGm) {
        const rawCharacterRecord = rawCharacter as Record<string, unknown>;
        const playerCharacterId = normalizeString(rawCharacterRecord.id);

        if (!playerCharacterId) {
          return res.status(400).json({ ok: false, error: "Character id is required" });
        }

        const [assignment] = await db
          .select()
          .from(characterAssignments)
          .where(
            and(
              eq(characterAssignments.campaignId, campaign.id),
              eq(characterAssignments.characterId, playerCharacterId),
              eq(characterAssignments.userId, currentUser.id)
            )
          )
          .limit(1);

        if (!assignment) {
          return res.status(403).json({
            ok: false,
            error: "Assigned character permission required",
          });
        }

        const [existingCharacter] = await db
          .select()
          .from(characters)
          .where(
            and(
              eq(characters.campaignId, campaign.id),
              eq(characters.id, playerCharacterId)
            )
          )
          .limit(1);

        if (!existingCharacter) {
          return res.status(404).json({ ok: false, error: "Character not found" });
        }

        const existingData =
          existingCharacter.data && typeof existingCharacter.data === "object"
            ? (existingCharacter.data as Record<string, unknown>)
            : {};
        const existingVisibility = normalizeString(
          existingData.visibility ?? existingCharacter.visibility,
          "player"
        );
        const existingIsPlayerVisible =
          typeof existingData.isPlayerVisible === "boolean"
            ? existingData.isPlayerVisible
            : existingCharacter.isPlayerVisible;

        if (existingVisibility !== "player" || existingIsPlayerVisible !== true) {
          return res.status(403).json({
            ok: false,
            error: "Player-visible character permission required",
          });
        }

        const mergedCharacter = mergePlayerEditableCharacterFields(
          existingData,
          rawCharacterRecord
        );
        const values = toCharacterValues(campaign.id, mergedCharacter);

        const returnedRows = await db
          .update(characters)
          .set({
            name: values.name,
            level: values.level,
            data: values.data,
            updatedAt: values.updatedAt,
          })
          .where(
            and(
              eq(characters.campaignId, campaign.id),
              eq(characters.id, values.id)
            )
          )
          .returning();

        return res.status(200).json({
          ok: true,
          character: toCharacterPayload(returnedRows[0], false),
        });
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

    await requireCampaignGm({
      campaignId: campaign.id,
      userId: currentUser.id,
    });

    if (!characterId) {
      return res.status(400).json({ ok: false, error: "characterId is required" });
    }

    const pendingInvitations = await db
      .select()
      .from(invitations)
      .where(
        and(eq(invitations.campaignId, campaign.id), eq(invitations.status, "pending"))
      );
    const isAssignedToPendingInvitation = pendingInvitations.some((invitation) =>
      parseInvitationCharacterIds(invitation.characterId).includes(characterId)
    );

    if (isAssignedToPendingInvitation) {
      return res.status(409).json({
        ok: false,
        error:
          "Unable to delete this character because it is assigned to a pending invitation.",
      });
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(characterAssignments)
        .where(
          and(
            eq(characterAssignments.campaignId, campaign.id),
            eq(characterAssignments.characterId, characterId)
          )
        );
      await tx
        .delete(characters)
        .where(
          and(eq(characters.campaignId, campaign.id), eq(characters.id, characterId))
        );
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(401).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unauthorized",
    });
  }
}
