import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, inArray } from "drizzle-orm";

import {
  getCurrentUser,
  requireCampaignGm,
  requireCampaignMember,
  resolveCampaignBySlug,
} from "../src/server/access.js";
import { setCorsHeaders } from "../src/server/cors.js";
import { db } from "../src/server/db.js";
import { characterAssignments } from "../db/schema/characterAssignments.js";
import { characters } from "../db/schema/characters.js";
import { invitations } from "../db/schema/invitations.js";

function getQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getBodyString(req: VercelRequest, key: string) {
  if (!req.body || typeof req.body !== "object") return "";
  const value = (req.body as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

function parseInvitationCharacterIds(value?: string | null) {
  return String(value || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function stripGmOnlyCharacterFields(data: Record<string, unknown>) {
  const { gmNotes, secrets, ...safeData } = data;
  void gmNotes;
  void secrets;
  return safeData;
}

async function getPendingAssignedCharacterIds(campaignId: string) {
  const pendingInvitations = await db
    .select()
    .from(invitations)
    .where(and(eq(invitations.campaignId, campaignId), eq(invitations.status, "pending")));

  return new Set(
    pendingInvitations.flatMap((invitation) =>
      parseInvitationCharacterIds(invitation.characterId)
    )
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, "GET, POST, DELETE, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (!["GET", "POST", "DELETE"].includes(req.method || "")) {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const currentUser = await getCurrentUser(req);
    const campaignSlug =
      getQueryValue(req.query.campaignId) ||
      (req.body && typeof req.body === "object"
        ? String((req.body as Record<string, unknown>).campaignId || "")
        : "");
    const campaign = await resolveCampaignBySlug(campaignSlug);

    const membership = await requireCampaignMember({
      campaignId: campaign.id,
      userId: currentUser.id,
    });
    const isGm = membership.role === "gm";

    if (req.method === "GET") {
      const assignments = isGm
        ? await db
            .select()
            .from(characterAssignments)
            .where(eq(characterAssignments.campaignId, campaign.id))
        : await db
            .select()
            .from(characterAssignments)
            .where(
              and(
                eq(characterAssignments.campaignId, campaign.id),
                eq(characterAssignments.userId, currentUser.id)
              )
            );

      const assignedCharacterIds = assignments.map((assignment) => assignment.characterId);
      const characterRows = assignedCharacterIds.length
        ? await db
            .select()
            .from(characters)
            .where(
              and(
                eq(characters.campaignId, campaign.id),
                inArray(characters.id, assignedCharacterIds)
              )
            )
        : [];
      const pendingAssignedCharacterIds = isGm
        ? Array.from(await getPendingAssignedCharacterIds(campaign.id))
        : [];

      return res.status(200).json({
        ok: true,
        assignments,
        assignedCharacterIds,
        pendingAssignedCharacterIds,
        characters: characterRows.map((row) =>
          isGm ? row.data : stripGmOnlyCharacterFields(row.data)
        ),
      });
    }

    await requireCampaignGm({
      campaignId: campaign.id,
      userId: currentUser.id,
    });

    if (req.method === "POST") {
      const userId = getBodyString(req, "userId");
      const characterId = getBodyString(req, "characterId");

      if (!userId || !characterId) {
        return res
          .status(400)
          .json({ ok: false, error: "userId and characterId are required" });
      }

      const pendingAssignedCharacterIds = await getPendingAssignedCharacterIds(campaign.id);
      if (pendingAssignedCharacterIds.has(characterId)) {
        return res.status(409).json({
          ok: false,
          error: "Character is already assigned to a pending invitation",
        });
      }

      const [matchingCharacters, existingAssignments] = await Promise.all([
        db
          .select()
          .from(characters)
          .where(
            and(eq(characters.campaignId, campaign.id), eq(characters.id, characterId))
          )
          .limit(1),
        db
          .select()
          .from(characterAssignments)
          .where(
            and(
              eq(characterAssignments.campaignId, campaign.id),
              eq(characterAssignments.characterId, characterId)
            )
          )
          .limit(1),
      ]);

      if (!matchingCharacters[0]) {
        return res.status(404).json({ ok: false, error: "Character not found" });
      }

      if (existingAssignments[0]) {
        return res.status(409).json({
          ok: false,
          error: "Character is already assigned to a player",
        });
      }

      const insertedRows = await db
        .insert(characterAssignments)
        .values({
          campaignId: campaign.id,
          characterId,
          userId,
          createdByUserId: currentUser.id,
        })
        .returning();

      return res.status(201).json({ ok: true, assignment: insertedRows[0] });
    }

    const assignmentId =
      getQueryValue(req.query.assignmentId) || getBodyString(req, "assignmentId");
    const characterId =
      getQueryValue(req.query.characterId) || getBodyString(req, "characterId");

    if (!assignmentId && !characterId) {
      return res
        .status(400)
        .json({ ok: false, error: "assignmentId or characterId is required" });
    }

    await db
      .delete(characterAssignments)
      .where(
        assignmentId
          ? and(
              eq(characterAssignments.campaignId, campaign.id),
              eq(characterAssignments.id, assignmentId)
            )
          : and(
              eq(characterAssignments.campaignId, campaign.id),
              eq(characterAssignments.characterId, characterId)
            )
      );

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(401).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unauthorized",
    });
  }
}
