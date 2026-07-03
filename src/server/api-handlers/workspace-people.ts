import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, inArray } from "drizzle-orm";

import {
  getCurrentUser,
  requireWorkspaceOwner,
  resolveWorkspaceByAppId,
} from "../access.js";
import { setCorsHeaders } from "../cors.js";
import { db } from "../db.js";
import { campaigns } from "../../../db/schema/campaigns.js";
import {
  campaignMemberships,
  workspaceMemberships,
} from "../../../db/schema/memberships.js";
import { characterAssignments } from "../../../db/schema/characterAssignments.js";
import { users } from "../../../db/schema/users.js";

type WorkspaceMembership = typeof workspaceMemberships.$inferSelect;
type CampaignMembership = typeof campaignMemberships.$inferSelect;
type User = typeof users.$inferSelect;

function getReadablePersonLabel(params: {
  displayName?: string | null;
  email?: string | null;
  fallback?: string | null;
}) {
  const displayName = String(params.displayName || "").trim();
  if (displayName) return displayName;

  const email = String(params.email || "").trim();
  if (email && email !== "—") {
    return email.split("@")[0].replace(/[._-]+/g, " ").trim() || email;
  }

  return String(params.fallback || "Unknown person").trim();
}

function getWorkspaceIdParam(req: VercelRequest) {
  const value = req.query.tenantId ?? req.query.workspaceId;
  if (Array.isArray(value)) return value[0];
  if (value) return value;

  if (req.body && typeof req.body === "object") {
    const body = req.body as Record<string, unknown>;
    const bodyValue = body.tenantId ?? body.workspaceId;
    return typeof bodyValue === "string" ? bodyValue : undefined;
  }

  return undefined;
}

function getRequestValue(req: VercelRequest, key: "memberId" | "role") {
  const queryValue = req.query[key];
  if (Array.isArray(queryValue)) return queryValue[0];
  if (queryValue) return queryValue;

  if (req.body && typeof req.body === "object") {
    const bodyValue = (req.body as Record<string, unknown>)[key];
    return typeof bodyValue === "string" ? bodyValue : undefined;
  }

  return undefined;
}

function normalizeWorkspaceRole(role?: string) {
  if (role === "owner" || role === "admin") return role;
  return "member";
}

async function loadWorkspacePeople(workspaceId: string) {
  const workspaceMembershipRows = await db
    .select()
    .from(workspaceMemberships)
    .where(eq(workspaceMemberships.workspaceId, workspaceId));
  const campaignRows = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.workspaceId, workspaceId));
  const campaignIds = campaignRows.map((campaign) => campaign.id);
  const campaignMembershipRows = campaignIds.length
    ? await db
        .select()
        .from(campaignMemberships)
        .where(inArray(campaignMemberships.campaignId, campaignIds))
    : [];
  const userIds = Array.from(
    new Set([
      ...workspaceMembershipRows.map((membership) => membership.userId),
      ...campaignMembershipRows.map((membership) => membership.userId),
    ])
  );
  const userRows = userIds.length
    ? await db.select().from(users).where(inArray(users.id, userIds))
    : [];

  return {
    campaignRows,
    campaignMembershipRows,
    userRows,
    workspaceMembershipRows,
  };
}

function mapWorkspacePeople(params: {
  campaignMembershipRows: CampaignMembership[];
  userRows: User[];
  workspaceMembershipRows: WorkspaceMembership[];
}) {
  const usersById = new Map(params.userRows.map((user) => [user.id, user]));
  const workspaceMembershipByUserId = new Map(
    params.workspaceMembershipRows.map((membership) => [membership.userId, membership])
  );
  const campaignMembershipsByUserId = new Map<string, CampaignMembership[]>();

  params.campaignMembershipRows.forEach((membership) => {
    const existing = campaignMembershipsByUserId.get(membership.userId) ?? [];
    existing.push(membership);
    campaignMembershipsByUserId.set(membership.userId, existing);
  });

  const userIds = Array.from(
    new Set([
      ...params.workspaceMembershipRows.map((membership) => membership.userId),
      ...params.campaignMembershipRows.map((membership) => membership.userId),
    ])
  );

  return userIds
    .map((userId) => {
      const workspaceMembership = workspaceMembershipByUserId.get(userId);
      const campaignMemberships = campaignMembershipsByUserId.get(userId) ?? [];
      const user = usersById.get(userId);
      const email = user?.email || "—";
      const label = getReadablePersonLabel({
        displayName: user?.displayName,
        email,
        fallback: userId,
      });

      return {
        id: workspaceMembership?.id ?? `campaign-only-${userId}`,
        membershipId: workspaceMembership?.id ?? null,
        type: workspaceMembership ? "workspace" : "campaign-only",
        userId,
        firebaseUid: user?.firebaseUid ?? null,
        displayName: user?.displayName || null,
        label,
        email,
        role: workspaceMembership?.role ?? "member",
        campaignMembershipCount: campaignMemberships.length,
        campaignRoles: campaignMemberships.map((membership) => membership.role),
        createdAt: workspaceMembership?.createdAt ?? null,
      };
    })
    .sort((a, b) => {
      if (a.role === "owner" && b.role !== "owner") return -1;
      if (a.role !== "owner" && b.role === "owner") return 1;
      return a.label.localeCompare(b.label);
    });
}

async function updateWorkspaceMemberRole(params: {
  memberId: string;
  nextRole: string;
  workspaceId: string;
}) {
  const nextRole = normalizeWorkspaceRole(params.nextRole);
  const people = await loadWorkspacePeople(params.workspaceId);
  const rows = mapWorkspacePeople(people);
  const target = rows.find((row) => row.id === params.memberId);

  if (!target) {
    throw new Error("Workspace member not found");
  }

  const ownerCount = rows.filter((row) => row.role === "owner").length;
  if (target.role === "owner" && nextRole !== "owner" && ownerCount <= 1) {
    throw new Error("Cannot demote the last workspace owner");
  }

  if (target.membershipId) {
    await db
      .update(workspaceMemberships)
      .set({ role: nextRole })
      .where(
        and(
          eq(workspaceMemberships.id, target.membershipId),
          eq(workspaceMemberships.workspaceId, params.workspaceId)
        )
      );
    return;
  }

  await db.insert(workspaceMemberships).values({
    workspaceId: params.workspaceId,
    userId: target.userId,
    role: nextRole,
  });
}

async function removeWorkspaceMember(params: {
  currentUserId: string;
  memberId: string;
  workspaceId: string;
}) {
  const people = await loadWorkspacePeople(params.workspaceId);
  const rows = mapWorkspacePeople(people);
  const target = rows.find((row) => row.id === params.memberId);

  if (!target) {
    throw new Error("Workspace member not found");
  }

  if (target.userId === params.currentUserId) {
    throw new Error("You cannot remove yourself from the workspace here");
  }

  const ownerCount = rows.filter((row) => row.role === "owner").length;
  if (target.role === "owner" && ownerCount <= 1) {
    throw new Error("Cannot remove the last workspace owner");
  }

  const workspaceCampaignIds = people.campaignRows.map((campaign) => campaign.id);
  const targetCampaignMembershipIds = people.campaignMembershipRows
    .filter((membership) => membership.userId === target.userId)
    .map((membership) => membership.id);

  await db.transaction(async (tx) => {
    if (target.membershipId) {
      await tx
        .delete(workspaceMemberships)
        .where(
          and(
            eq(workspaceMemberships.id, target.membershipId),
            eq(workspaceMemberships.workspaceId, params.workspaceId)
          )
        );
    }

    if (workspaceCampaignIds.length && targetCampaignMembershipIds.length) {
      await tx
        .delete(characterAssignments)
        .where(
          and(
            inArray(characterAssignments.campaignId, workspaceCampaignIds),
            eq(characterAssignments.userId, target.userId)
          )
        );
      await tx
        .delete(campaignMemberships)
        .where(
          and(
            inArray(campaignMemberships.campaignId, workspaceCampaignIds),
            inArray(campaignMemberships.id, targetCampaignMembershipIds)
          )
        );
    }
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, "GET, PATCH, DELETE, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (!["GET", "PATCH", "DELETE"].includes(req.method || "")) {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const currentUser = await getCurrentUser(req);
    const workspace = await resolveWorkspaceByAppId(getWorkspaceIdParam(req) || "");

    await requireWorkspaceOwner({
      workspaceId: workspace.id,
      userId: currentUser.id,
    });

    if (req.method === "PATCH") {
      const memberId = getRequestValue(req, "memberId");
      const role = getRequestValue(req, "role");

      if (!memberId || !role) {
        return res
          .status(400)
          .json({ ok: false, error: "memberId and role are required" });
      }

      await updateWorkspaceMemberRole({
        memberId,
        nextRole: role,
        workspaceId: workspace.id,
      });

      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      const memberId = getRequestValue(req, "memberId");

      if (!memberId) {
        return res.status(400).json({ ok: false, error: "memberId is required" });
      }

      await removeWorkspaceMember({
        currentUserId: currentUser.id,
        memberId,
        workspaceId: workspace.id,
      });

      return res.status(200).json({ ok: true });
    }

    const people = await loadWorkspacePeople(workspace.id);

    return res.status(200).json({
      ok: true,
      tenantId: workspace.slug,
      workspaceId: workspace.id,
      members: mapWorkspacePeople(people),
    });
  } catch (error) {
    return res.status(401).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unauthorized",
    });
  }
}
