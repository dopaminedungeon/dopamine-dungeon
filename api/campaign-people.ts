import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, inArray } from "drizzle-orm";

import {
  getCurrentUser,
  requireCampaignGmOrWorkspaceOwner,
  resolveCampaignBySlug,
} from "../src/server/access.js";
import { setCorsHeaders } from "../src/server/cors.js";
import { db } from "../src/server/db.js";
import { invitations } from "../db/schema/invitations.js";
import {
  campaignMemberships,
  workspaceMemberships,
} from "../db/schema/memberships.js";
import { users } from "../db/schema/users.js";

type User = typeof users.$inferSelect;

function getCampaignIdParam(req: VercelRequest) {
  const value = req.query.campaignId;
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const currentUser = await getCurrentUser(req);
    const campaign = await resolveCampaignBySlug(getCampaignIdParam(req) || "");

    await requireCampaignGmOrWorkspaceOwner({
      campaignId: campaign.id,
      workspaceId: campaign.workspaceId,
      userId: currentUser.id,
    });

    const memberships = await db
      .select()
      .from(campaignMemberships)
      .where(eq(campaignMemberships.campaignId, campaign.id));

    const userIds = memberships.map((membership) => membership.userId);

    const [memberUsers, memberWorkspaceMemberships, pendingInvitations] =
      await Promise.all([
        userIds.length
          ? db.select().from(users).where(inArray(users.id, userIds))
          : [],
        userIds.length
          ? db
              .select()
              .from(workspaceMemberships)
              .where(
                and(
                  eq(workspaceMemberships.workspaceId, campaign.workspaceId),
                  inArray(workspaceMemberships.userId, userIds)
                )
              )
          : [],
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

    const usersById = new Map<string, User>();
    memberUsers.forEach((user) => {
      usersById.set(user.id, user);
    });

    const workspaceRolesByUserId = new Map<string, string>();
    memberWorkspaceMemberships.forEach((membership) => {
      workspaceRolesByUserId.set(membership.userId, membership.role);
    });

    const acceptedRows = memberships.map((membership) => {
      const user = usersById.get(membership.userId);
      const email = user?.email || "—";

      return {
        id: `member-${membership.id}`,
        docId: membership.id,
        type: "member",
        status: "accepted",
        email,
        label: email === "—" ? membership.userId : email,
        userId: membership.userId,
        workspaceRole: workspaceRolesByUserId.get(membership.userId) || "member",
        campaignRole: membership.role || "player",
        // Character assignment has not moved to Postgres/API yet.
        characterIds: [],
      };
    });

    const pendingRows = pendingInvitations.map((invitation) => ({
      id: `invite-${invitation.id}`,
      docId: invitation.id,
      type: "invite",
      status: invitation.status || "pending",
      email: invitation.email || "—",
      label: invitation.email || "Pending invite",
      userId: null,
      workspaceRole: invitation.workspaceRole || "member",
      campaignRole: invitation.campaignRole || "player",
      // Character assignment has not moved to Postgres/API yet.
      characterIds: [],
    }));

    return res.status(200).json({
      ok: true,
      campaignId: campaign.slug,
      people: [...acceptedRows, ...pendingRows],
    });
  } catch (error) {
    return res.status(401).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unauthorized",
    });
  }
}
