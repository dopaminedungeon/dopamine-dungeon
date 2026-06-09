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
import { characterAssignments } from "../db/schema/characterAssignments.js";
import { users } from "../db/schema/users.js";

type User = typeof users.$inferSelect;

function getCampaignIdParam(req: VercelRequest) {
  const value = req.query.campaignId;
  if (Array.isArray(value)) return value[0];
  if (value) return value;

  if (req.body && typeof req.body === "object") {
    const bodyValue = (req.body as Record<string, unknown>).campaignId;
    return typeof bodyValue === "string" ? bodyValue : undefined;
  }

  return undefined;
}

function getRequestValue(
  req: VercelRequest,
  key: "personType" | "personId" | "inviteId" | "memberId"
) {
  const queryValue = req.query[key];
  if (Array.isArray(queryValue)) return queryValue[0];
  if (queryValue) return queryValue;

  if (req.body && typeof req.body === "object") {
    const bodyValue = (req.body as Record<string, unknown>)[key];
    return typeof bodyValue === "string" ? bodyValue : undefined;
  }

  return undefined;
}

async function getWorkspaceRolesByUserId(campaign: {
  workspaceId: string;
}, userIds: string[]) {
  if (!userIds.length) return new Map<string, string>();

  const memberWorkspaceMemberships = await db
    .select()
    .from(workspaceMemberships)
    .where(
      and(
        eq(workspaceMemberships.workspaceId, campaign.workspaceId),
        inArray(workspaceMemberships.userId, userIds)
      )
    );

  const workspaceRolesByUserId = new Map<string, string>();
  memberWorkspaceMemberships.forEach((membership) => {
    workspaceRolesByUserId.set(membership.userId, membership.role);
  });

  return workspaceRolesByUserId;
}

async function revokePendingInvitation(params: {
  campaignId: string;
  invitationId: string;
}) {
  const matchingInvitations = await db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.id, params.invitationId),
        eq(invitations.campaignId, params.campaignId),
        eq(invitations.status, "pending")
      )
    )
    .limit(1);

  if (!matchingInvitations[0]) {
    throw new Error("Pending invitation not found");
  }

  await db
    .update(invitations)
    .set({ status: "revoked" })
    .where(eq(invitations.id, params.invitationId));
}

async function removeCampaignMember(params: {
  campaignId: string;
  workspaceId: string;
  membershipId: string;
}) {
  const targetRows = await db
    .select()
    .from(campaignMemberships)
    .where(
      and(
        eq(campaignMemberships.id, params.membershipId),
        eq(campaignMemberships.campaignId, params.campaignId)
      )
    )
    .limit(1);
  const targetMembership = targetRows[0];

  if (!targetMembership) {
    throw new Error("Campaign member not found");
  }

  const memberships = await db
    .select()
    .from(campaignMemberships)
    .where(eq(campaignMemberships.campaignId, params.campaignId));
  const userIds = memberships.map((membership) => membership.userId);
  const workspaceRolesByUserId = await getWorkspaceRolesByUserId(
    { workspaceId: params.workspaceId },
    userIds
  );
  const isAdminMembership = (membership: typeof campaignMemberships.$inferSelect) =>
    membership.role === "gm" ||
    workspaceRolesByUserId.get(membership.userId) === "owner";
  const adminMembershipCount = memberships.filter(isAdminMembership).length;

  if (isAdminMembership(targetMembership) && adminMembershipCount <= 1) {
    throw new Error("Cannot remove the last campaign GM or workspace owner");
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(characterAssignments)
      .where(
        and(
          eq(characterAssignments.campaignId, params.campaignId),
          eq(characterAssignments.userId, targetMembership.userId)
        )
      );
    await tx
      .delete(campaignMemberships)
      .where(
        and(
          eq(campaignMemberships.id, params.membershipId),
          eq(campaignMemberships.campaignId, params.campaignId)
        )
      );
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, "GET, DELETE, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (!["GET", "DELETE"].includes(req.method || "")) {
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

    if (req.method === "DELETE") {
      const personType = getRequestValue(req, "personType");
      const personId =
        getRequestValue(req, "personId") ||
        getRequestValue(req, "inviteId") ||
        getRequestValue(req, "memberId");

      if (!personId) {
        return res.status(400).json({ ok: false, error: "personId is required" });
      }

      if (personType === "invite" || getRequestValue(req, "inviteId")) {
        await revokePendingInvitation({
          campaignId: campaign.id,
          invitationId: personId,
        });

        return res.status(200).json({ ok: true });
      }

      if (personType === "member" || getRequestValue(req, "memberId")) {
        await removeCampaignMember({
          campaignId: campaign.id,
          workspaceId: campaign.workspaceId,
          membershipId: personId,
        });

        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ ok: false, error: "personType is required" });
    }

    const memberships = await db
      .select()
      .from(campaignMemberships)
      .where(eq(campaignMemberships.campaignId, campaign.id));

    const userIds = memberships.map((membership) => membership.userId);

    const [memberUsers, memberWorkspaceMemberships, pendingInvitations, assignments] =
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
        db
          .select()
          .from(characterAssignments)
          .where(eq(characterAssignments.campaignId, campaign.id)),
      ]);

    const usersById = new Map<string, User>();
    memberUsers.forEach((user) => {
      usersById.set(user.id, user);
    });

    const workspaceRolesByUserId = new Map<string, string>();
    memberWorkspaceMemberships.forEach((membership) => {
      workspaceRolesByUserId.set(membership.userId, membership.role);
    });
    const characterIdsByUserId = new Map<string, string[]>();
    assignments.forEach((assignment) => {
      const existing = characterIdsByUserId.get(assignment.userId) ?? [];
      existing.push(assignment.characterId);
      characterIdsByUserId.set(assignment.userId, existing);
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
        characterIds: characterIdsByUserId.get(membership.userId) ?? [],
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
      characterIds: String(invitation.characterId || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
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
