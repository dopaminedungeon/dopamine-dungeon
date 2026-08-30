import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, inArray } from "drizzle-orm";

import { getCurrentUser, normalizeEmail } from "../../src/server/access.js";
import { setCorsHeaders } from "../../src/server/cors.js";
import { db } from "../../src/server/db.js";
import { invitations } from "../../db/schema/invitations.js";
import {
  campaignMemberships,
  workspaceMemberships,
} from "../../db/schema/memberships.js";
import { characterAssignments } from "../../db/schema/characterAssignments.js";
import { characters } from "../../db/schema/characters.js";
import { campaigns } from "../../db/schema/campaigns.js";
import { workspaces } from "../../db/schema/workspaces.js";
import {
  getApiErrorMessage,
  getApiErrorStatus,
} from "../../src/server/apiErrors.js";
import { getInvitationCharacterIds } from "../../src/server/invitation-characters.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const currentUser = await getCurrentUser(req);
    const normalizedEmail = normalizeEmail(currentUser.email);

    if (!normalizedEmail) {
      return res.status(400).json({
        ok: false,
        error: "Authenticated user email is required to accept invitations.",
      });
    }

    const pendingInvitations = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.normalizedEmail, normalizedEmail),
          eq(invitations.status, "pending")
        )
      );

    if (pendingInvitations.length === 0) {
      return res.status(200).json({ ok: true, acceptedInvitations: [] });
    }

    const now = new Date();
    const acceptedInvitations = await db.transaction(async (tx) => {
      const accepted = [];

      for (const invitation of pendingInvitations) {
        // Re-read inside the transaction so a concurrent revoke, acceptance,
        // or expiry transition cannot create access from a stale read.
        const currentInvitationRows = await tx
          .select()
          .from(invitations)
          .where(eq(invitations.id, invitation.id))
          .limit(1);
        const currentInvitation = currentInvitationRows[0];

        if (!currentInvitation || currentInvitation.status !== "pending") {
          continue;
        }

        if (currentInvitation.expiresAt && currentInvitation.expiresAt <= now) {
          await tx
            .update(invitations)
            .set({ status: "expired" })
            .where(
              and(
                eq(invitations.id, currentInvitation.id),
                eq(invitations.status, "pending")
              )
            );
          continue;
        }

        const characterIds = await getInvitationCharacterIds(tx, currentInvitation);
        if (characterIds.length) {
          const matchingCharacters = await tx
            .select()
            .from(characters)
            .where(
              and(
                eq(characters.campaignId, currentInvitation.campaignId),
                inArray(characters.id, characterIds)
              )
            );

          if (matchingCharacters.length !== characterIds.length) {
            throw new Error("Invitation contains a character outside its campaign");
          }
        }

        await tx
          .insert(workspaceMemberships)
          .values({
            workspaceId: currentInvitation.workspaceId,
            userId: currentUser.id,
            role: currentInvitation.workspaceRole || "member",
          })
          .onConflictDoNothing();

        // Invitations may grant an initial role only. An established member's
        // role is changed solely by membership-management APIs.
        await tx
          .insert(campaignMemberships)
          .values({
            campaignId: currentInvitation.campaignId,
            userId: currentUser.id,
            role: currentInvitation.campaignRole || "player",
          })
          .onConflictDoNothing();

        for (const characterId of characterIds) {
          const existingAssignments = await tx
            .select()
            .from(characterAssignments)
            .where(
              and(
                eq(characterAssignments.campaignId, currentInvitation.campaignId),
                eq(characterAssignments.characterId, characterId)
              )
            )
            .limit(1);
          const existingAssignment = existingAssignments[0];

          if (existingAssignment) {
            if (existingAssignment.userId !== currentUser.id) {
              throw new Error("Character is already assigned to another player");
            }
            continue;
          }

          await tx.insert(characterAssignments).values({
            campaignId: currentInvitation.campaignId,
            characterId,
            userId: currentUser.id,
            createdByUserId: currentInvitation.invitedByUserId,
          });
        }

        const updatedInvitations = await tx
          .update(invitations)
          .set({
            status: "accepted",
            acceptedAt: now,
            acceptedByUserId: currentUser.id,
          })
          .where(
            and(
              eq(invitations.id, currentInvitation.id),
              eq(invitations.status, "pending")
            )
          )
          .returning();

        if (updatedInvitations[0]) accepted.push(updatedInvitations[0]);
      }

      return accepted;
    });

    const workspaceRows = await db.select().from(workspaces);
    const campaignRows = await db.select().from(campaigns);

    return res.status(200).json({
      ok: true,
      acceptedInvitations: acceptedInvitations.map((invitation) => {
        const workspace = workspaceRows.find(
          (row) => row.id === invitation.workspaceId
        );
        const campaign = campaignRows.find(
          (row) => row.id === invitation.campaignId
        );

        return {
          id: invitation.id,
          tenantId: workspace?.slug ?? invitation.workspaceId,
          campaignId: campaign?.slug ?? invitation.campaignId,
          workspaceRole: invitation.workspaceRole,
          campaignRole: invitation.campaignRole,
          status: invitation.status,
          acceptedAt: invitation.acceptedAt,
        };
      }),
    });
  } catch (error) {
    const status = getApiErrorStatus(error);

    if (status === 500) {
      console.error("[api/invitations/accept-pending] Request failed", error);
    }

    return res.status(status).json({
      ok: false,
      error: getApiErrorMessage(error),
    });
  }
}
