import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";

import { getCurrentUser, normalizeEmail } from "../../src/server/access";
import { setCorsHeaders } from "../../src/server/cors";
import { db } from "../../src/server/db";
import { invitations } from "../../db/schema/invitations";
import {
  campaignMemberships,
  workspaceMemberships,
} from "../../db/schema/memberships";
import { campaigns } from "../../db/schema/campaigns";
import { workspaces } from "../../db/schema/workspaces";

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
        await tx
          .insert(workspaceMemberships)
          .values({
            workspaceId: invitation.workspaceId,
            userId: currentUser.id,
            role: invitation.workspaceRole || "member",
          })
          .onConflictDoNothing();

        await tx
          .insert(campaignMemberships)
          .values({
            campaignId: invitation.campaignId,
            userId: currentUser.id,
            role: invitation.campaignRole || "player",
          })
          .onConflictDoNothing();

        const updatedInvitations = await tx
          .update(invitations)
          .set({
            status: "accepted",
            acceptedAt: now,
            acceptedByUserId: currentUser.id,
          })
          .where(eq(invitations.id, invitation.id))
          .returning();

        accepted.push(updatedInvitations[0] ?? invitation);
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
    return res.status(401).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unauthorized",
    });
  }
}
