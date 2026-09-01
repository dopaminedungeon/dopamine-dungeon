import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, gt, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";

import {
  getCurrentUser,
  normalizeEmail,
  requireCampaignMember,
  requireWorkspaceOwner,
  resolveCampaignByAppId,
  resolveWorkspaceByAppId,
} from "../../src/server/access.js";
import { canViewAsGm } from "../../src/server/viewer-mode.js";
import { setCorsHeaders } from "../../src/server/cors.js";
import { db } from "../../src/server/db.js";
import {
  invitationCharacterAssignments,
  invitations,
} from "../../db/schema/invitations.js";
import { characterAssignments } from "../../db/schema/characterAssignments.js";
import { characters } from "../../db/schema/characters.js";
import { buildInviteEmailHtml } from "../../src/domain/mail/inviteEmail.template.js";
import { getInvitationCharacterIdsByInvitationId } from "../../src/server/invitation-characters.js";
import { sendTransactionalEmail } from "../../src/server/transactionalMail.js";

function getFrontendOrigin(req: VercelRequest) {
  const requestOrigin = req.headers.origin;
  const headerOrigin = Array.isArray(requestOrigin)
    ? requestOrigin[0]
    : requestOrigin;

  // Invite links must point at the React app, not the API route origin.
  return (
    headerOrigin ||
    process.env.VITE_APP_ORIGIN ||
    process.env.APP_ORIGIN ||
    "http://localhost:5173"
  );
}

function formatMailbox(name: string, email: string) {
  const trimmedName = String(name || "").trim();
  const trimmedEmail = String(email || "").trim();

  return trimmedName ? `${trimmedName} <${trimmedEmail}>` : trimmedEmail;
}

const inviteEmailFrom = formatMailbox(
  process.env.INVITE_EMAIL_FROM_NAME || "Dopamine Dungeon Invites",
  process.env.INVITE_EMAIL_FROM || "invite@dopamine-dungeon.com"
);
const inviteEmailReplyTo = formatMailbox(
  process.env.INVITE_EMAIL_REPLY_TO_NAME || "Dopamine Dungeon",
  process.env.INVITE_EMAIL_REPLY_TO || "dopamine.dungeon.info@gmail.com"
);

const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const invitationRequestFields = new Set([
  "email",
  "tenantId",
  "campaignId",
  "campaignRole",
  "characterIds",
]);

function hasOnlyInvitationRequestFields(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  return Object.keys(body).every((key) => invitationRequestFields.has(key));
}

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
    if (!hasOnlyInvitationRequestFields(req.body)) {
      return res.status(400).json({ ok: false, error: "Unsupported invitation fields" });
    }
    const email = String(req.body?.email || "").trim();
    const tenantId = String(req.body?.tenantId || "").trim();
    const campaignId = String(req.body?.campaignId || "").trim();
    const campaignRole = req.body?.campaignRole === "gm" ? "gm" : "player";
    const characterIds: string[] = Array.isArray(req.body?.characterIds)
      ? Array.from(
          new Set<string>(
            (req.body.characterIds as unknown[])
              .map((id) => String(id).trim())
              .filter(Boolean)
          )
        )
      : [];
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return res.status(400).json({ ok: false, error: "Invite email is required" });
    }

    const workspace = await resolveWorkspaceByAppId(tenantId);
    const campaign = await resolveCampaignByAppId({
      campaignId,
      workspaceId: workspace.id,
    });

    await requireWorkspaceOwner({
      workspaceId: workspace.id,
      userId: currentUser.id,
    });
    const campaignMembership = await requireCampaignMember({
      campaignId: campaign.id,
      userId: currentUser.id,
    });
    if (!canViewAsGm(req, campaignMembership.role)) {
      return res.status(403).json({ ok: false, error: "Campaign GM mode required" });
    }

    const now = new Date();
    // Never let a stale pending invitation block a replacement. Accepted and
    // revoked rows are deliberately untouched.
    await db
      .update(invitations)
      .set({ status: "expired" })
      .where(
        and(
          eq(invitations.workspaceId, workspace.id),
          eq(invitations.campaignId, campaign.id),
          eq(invitations.normalizedEmail, normalizedEmail),
          eq(invitations.status, "pending"),
          isNotNull(invitations.expiresAt),
          lt(invitations.expiresAt, now)
        )
      );

    const existingPendingInvitations = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.normalizedEmail, normalizedEmail),
          eq(invitations.workspaceId, workspace.id),
          eq(invitations.campaignId, campaign.id),
          eq(invitations.status, "pending")
        )
      )
      .limit(1);

    if (existingPendingInvitations[0]) {
      return res.status(409).json({
        ok: false,
        error: "There is already a pending invite for this player in this campaign.",
      });
    }

    let matchingCharacters: Array<typeof characters.$inferSelect> = [];

    if (characterIds.length > 0) {
      const [fetchedCharacters, existingAssignments, pendingInvitations] = await Promise.all([
        db
          .select()
          .from(characters)
          .where(
            and(
              eq(characters.campaignId, campaign.id),
              inArray(characters.id, characterIds)
            )
          ),
        db
          .select()
          .from(characterAssignments)
          .where(
            and(
              eq(characterAssignments.campaignId, campaign.id),
              inArray(characterAssignments.characterId, characterIds)
            )
          ),
        db
          .select()
          .from(invitations)
          .where(
            and(
              eq(invitations.campaignId, campaign.id),
              eq(invitations.status, "pending"),
              or(isNull(invitations.expiresAt), gt(invitations.expiresAt, now))
            )
          ),
      ]);
      matchingCharacters = fetchedCharacters;

      if (matchingCharacters.length !== characterIds.length) {
        return res.status(400).json({
          ok: false,
          error: "One or more selected characters do not exist.",
        });
      }

      const pendingCharacterIdsByInvitationId =
        await getInvitationCharacterIdsByInvitationId(db, pendingInvitations);
      const pendingAssignedIds = new Set(
        Array.from(pendingCharacterIdsByInvitationId.values()).flat()
      );
      const blockedCharacterId =
        existingAssignments[0]?.characterId ||
        characterIds.find((characterId: string) => pendingAssignedIds.has(characterId));

      if (blockedCharacterId) {
        return res.status(409).json({
          ok: false,
          error: "One or more selected characters are already assigned.",
        });
      }
    }

    const expiresAt = new Date(now.getTime() + INVITATION_LIFETIME_MS);
    const invitation = await db.transaction(async (tx) => {
      const insertedInvitations = await tx
        .insert(invitations)
        .values({
          email,
          normalizedEmail,
          workspaceId: workspace.id,
          campaignId: campaign.id,
          workspaceRole: "member",
          campaignRole,
          // Deprecated compatibility column. New invitations are represented
          // exclusively by invitation_character_assignments.
          characterId: null,
          status: "pending",
          expiresAt,
          invitedByUserId: currentUser.id,
        })
        .returning();
      const insertedInvitation = insertedInvitations[0];

      if (!insertedInvitation) throw new Error("Invitation could not be created");

      if (characterIds.length) {
        await tx.insert(invitationCharacterAssignments).values(
          characterIds.map((characterId) => ({
            invitationId: insertedInvitation.id,
            characterId,
          }))
        );
      }

      return insertedInvitation;
    });

    const assignedCharacterNames = matchingCharacters
      .map((character) => String(character.name || "").trim())
      .filter(Boolean);

    await sendTransactionalEmail({
      to: email,
      from: inviteEmailFrom,
      replyTo: inviteEmailReplyTo,
      subject: "✨You’ve been summoned to a campaign✨",
      html: buildInviteEmailHtml({
          campaignName: campaign.name,
          workspaceName: workspace.name,
          inviteEmail: email,
          inviteLink: `${getFrontendOrigin(req)}/welcome?invited=true`,
          inviterName: "Dungeon Master",
          campaignRole,
          assignedCharacterNames,
      }),
    });

    return res.status(201).json({
      ok: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        normalizedEmail: invitation.normalizedEmail,
        tenantId: workspace.slug,
        campaignId: campaign.slug,
        workspaceRole: invitation.workspaceRole,
        campaignRole: invitation.campaignRole,
        characterIds,
        status: invitation.status,
        createdAt: invitation.createdAt,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (error) {
    return res.status(401).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unauthorized",
    });
  }
}
