import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";

import { adminDb } from "../_lib/auth";
import {
  getCurrentUser,
  normalizeEmail,
  requireCampaignGm,
  requireWorkspaceOwner,
  resolveCampaignByAppId,
  resolveWorkspaceByAppId,
} from "../_lib/access";
import { setCorsHeaders } from "../_lib/cors";
import { db } from "../_lib/db";
import { invitations } from "../../db/schema/invitations";
import { buildInviteEmailHtml } from "../../src/domain/mail/inviteEmail.template";

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

    const insertedInvitations = await db
      .insert(invitations)
      .values({
        email,
        normalizedEmail,
        workspaceId: workspace.id,
        campaignId: campaign.id,
        workspaceRole: "member",
        campaignRole,
        // Phase 1 stores no character assignment. Existing Firestore assignment flows remain separate.
        characterId: null,
        status: "pending",
        invitedByUserId: currentUser.id,
      })
      .returning();

    const invitation = insertedInvitations[0];

    // Firestore mail delivery is intentionally retained temporarily until email sending moves server-side.
    await adminDb.collection("mail").add({
      to: [email],
      message: {
        subject: "✨You’ve been summoned to a campaign✨",
        html: buildInviteEmailHtml({
          campaignName: campaign.name,
          workspaceName: workspace.name,
          inviteEmail: email,
          inviteLink: `${getFrontendOrigin(req)}/welcome?invited=true`,
          inviterName: "Dungeon Master",
          campaignRole,
          assignedCharacterNames: [],
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
