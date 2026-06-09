import type { VercelRequest } from "@vercel/node";
import { and, eq } from "drizzle-orm";

import { verifyAuthHeader } from "./auth.js";
import { db } from "./db.js";
import { users } from "../../db/schema/users.js";
import { workspaces } from "../../db/schema/workspaces.js";
import { campaigns } from "../../db/schema/campaigns.js";
import {
  campaignMemberships,
  workspaceMemberships,
} from "../../db/schema/memberships.js";

export type CurrentUser = typeof users.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;

export function normalizeEmail(email?: string | null) {
  return String(email || "").trim().toLowerCase();
}

export async function getCurrentUser(req: VercelRequest): Promise<CurrentUser> {
  const decodedToken = await verifyAuthHeader(req.headers.authorization);
  const firebaseUid = decodedToken.uid;
  const email = decodedToken.email ?? null;

  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.firebaseUid, firebaseUid))
    .limit(1);

  if (existingUser[0]) {
    return existingUser[0];
  }

  const insertedUsers = await db
    .insert(users)
    .values({
      firebaseUid,
      email,
    })
    .returning();

  return insertedUsers[0];
}

export async function resolveWorkspaceByAppId(
  tenantId: string
): Promise<Workspace> {
  const normalizedTenantId = String(tenantId || "").trim();

  if (!normalizedTenantId) {
    throw new Error("tenantId is required");
  }

  const matchingWorkspaces = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.slug, normalizedTenantId))
    .limit(1);

  const workspace = matchingWorkspaces[0];

  if (!workspace) {
    throw new Error("Workspace not found");
  }

  return workspace;
}

export async function resolveCampaignByAppId(params: {
  campaignId: string;
  workspaceId: string;
}): Promise<Campaign> {
  const normalizedCampaignId = String(params.campaignId || "").trim();

  if (!normalizedCampaignId) {
    throw new Error("campaignId is required");
  }

  const workspaceCampaigns = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.workspaceId, params.workspaceId));

  const campaign = workspaceCampaigns.find(
    (row) => row.slug === normalizedCampaignId || row.id === normalizedCampaignId
  );

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  return campaign;
}

export async function resolveCampaignBySlug(campaignId: string): Promise<Campaign> {
  const normalizedCampaignId = String(campaignId || "").trim();

  if (!normalizedCampaignId) {
    throw new Error("campaignId is required");
  }

  const matchingCampaigns = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.slug, normalizedCampaignId))
    .limit(1);

  const campaign = matchingCampaigns[0];

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  return campaign;
}

export async function requireWorkspaceOwner(params: {
  workspaceId: string;
  userId: string;
}) {
  const memberships = await db
    .select()
    .from(workspaceMemberships)
    .where(
      and(
        eq(workspaceMemberships.workspaceId, params.workspaceId),
        eq(workspaceMemberships.userId, params.userId)
      )
    )
    .limit(1);

  if (memberships[0]?.role !== "owner") {
    throw new Error("Workspace owner permission required");
  }
}

export async function requireCampaignGm(params: {
  campaignId: string;
  userId: string;
}) {
  const memberships = await db
    .select()
    .from(campaignMemberships)
    .where(
      and(
        eq(campaignMemberships.campaignId, params.campaignId),
        eq(campaignMemberships.userId, params.userId)
      )
    )
    .limit(1);

  if (memberships[0]?.role !== "gm") {
    throw new Error("Campaign GM permission required");
  }
}

export async function requireCampaignMember(params: {
  campaignId: string;
  userId: string;
}) {
  const memberships = await db
    .select()
    .from(campaignMemberships)
    .where(
      and(
        eq(campaignMemberships.campaignId, params.campaignId),
        eq(campaignMemberships.userId, params.userId)
      )
    )
    .limit(1);

  const membership = memberships[0];

  if (!membership) {
    throw new Error("Campaign membership required");
  }

  return membership;
}

export async function requireCampaignGmOrWorkspaceOwner(params: {
  campaignId: string;
  workspaceId: string;
  userId: string;
}) {
  const [campaignMembershipRows, workspaceMembershipRows] = await Promise.all([
    db
      .select()
      .from(campaignMemberships)
      .where(
        and(
          eq(campaignMemberships.campaignId, params.campaignId),
          eq(campaignMemberships.userId, params.userId)
        )
      )
      .limit(1),
    db
      .select()
      .from(workspaceMemberships)
      .where(
        and(
          eq(workspaceMemberships.workspaceId, params.workspaceId),
          eq(workspaceMemberships.userId, params.userId)
        )
      )
      .limit(1),
  ]);

  const isCampaignGm = campaignMembershipRows[0]?.role === "gm";
  const isWorkspaceOwner = workspaceMembershipRows[0]?.role === "owner";

  if (!isCampaignGm && !isWorkspaceOwner) {
    throw new Error("Campaign GM or workspace owner permission required");
  }
}
