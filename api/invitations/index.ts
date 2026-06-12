import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, inArray } from "drizzle-orm";

import { adminDb } from "../../src/server/auth.js";
import {
  getCurrentUser,
  normalizeEmail,
  requireCampaignGm,
  requireWorkspaceOwner,
  resolveCampaignByAppId,
  resolveWorkspaceByAppId,
} from "../../src/server/access.js";
import { setCorsHeaders } from "../../src/server/cors.js";
import { db } from "../../src/server/db.js";
import { invitations } from "../../db/schema/invitations.js";
import { characterAssignments } from "../../db/schema/characterAssignments.js";
import { characters } from "../../db/schema/characters.js";
import { buildInviteEmailHtml } from "../../src/domain/mail/inviteEmail.template.js";

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
  process.env.INVITE_EMAIL_FROM_NAME || "Dopamine Dungeon",
  process.env.INVITE_EMAIL_FROM || "invite@dopamine-dungeon.com"
);
const inviteEmailReplyTo = formatMailbox(
  process.env.INVITE_EMAIL_REPLY_TO_NAME || "Dopamine Dungeon",
  process.env.INVITE_EMAIL_REPLY_TO || "dopamine.dungeon.info@gmail.com"
);

function parseInvitationCharacterIds(value?: string | null) {
  return String(value || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
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
    const email = String(req.body?.email || "").trim();
    const tenantId = String(req.body?.tenantId || "").trim();
    const campaignId = String(req.body?.campaignId || "").trim();
    const campaignRole = req.body?.campaignRole === "gm" ? "gm" : "player";
    const characterIds = Array.isArray(req.body?.characterIds)
      ? req.body.characterIds.map((id: unknown) => String(id)).filter(Boolean)
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
    await requireCampaignGm({
      campaignId: campaign.id,
      userId: currentUser.id,
    });

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
              eq(invitations.status, "pending")
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

      const pendingAssignedIds = new Set(
        pendingInvitations.flatMap((invitation) =>
          parseInvitationCharacterIds(invitation.characterId)
        )
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

    const insertedInvitations = await db
      .insert(invitations)
      .values({
        email,
        normalizedEmail,
        workspaceId: workspace.id,
        campaignId: campaign.id,
        workspaceRole: "member",
        campaignRole,
        characterId: characterIds.join(",") || null,
        status: "pending",
        invitedByUserId: currentUser.id,
      })
      .returning();

    const invitation = insertedInvitations[0];
    const assignedCharacterNames = matchingCharacters
      .map((character) => String(character.name || "").trim())
      .filter(Boolean);

    // Firestore mail delivery is intentionally retained temporarily until email sending moves server-side.
    await adminDb.collection("mail").add({
      to: [email],
      from: inviteEmailFrom,
      replyTo: inviteEmailReplyTo,
      message: {
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
      },
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
        characterId: invitation.characterId,
        status: invitation.status,
        createdAt: invitation.createdAt,
      },
    });
  } catch (error) {
    return res.status(401).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unauthorized",
    });
  }
}
