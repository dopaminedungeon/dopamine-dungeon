import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq, inArray } from "drizzle-orm";

import { getCurrentUser } from "../src/server/access.js";
import {
  getApiErrorMessage,
  getApiErrorStatus,
} from "../src/server/apiErrors.js";
import { setCorsHeaders } from "../src/server/cors.js";
import { db } from "../src/server/db.js";
import { workspaces } from "../db/schema/workspaces.js";
import { campaigns } from "../db/schema/campaigns.js";
import {
  workspaceMemberships,
  campaignMemberships,
} from "../db/schema/memberships.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    const user = await getCurrentUser(req);

    const workspaceMembershipsData = await db
      .select()
      .from(workspaceMemberships)
      .where(eq(workspaceMemberships.userId, user.id));

    const workspaceIds = workspaceMembershipsData.map(
      (membership) => membership.workspaceId
    );

    const workspacesData = workspaceIds.length
      ? await db.select().from(workspaces).where(inArray(workspaces.id, workspaceIds))
      : [];

    const campaignMembershipsData = await db
      .select()
      .from(campaignMemberships)
      .where(eq(campaignMemberships.userId, user.id));

    const campaignIds = campaignMembershipsData.map(
      (membership) => membership.campaignId
    );

    const campaignsData = campaignIds.length
      ? await db.select().from(campaigns).where(inArray(campaigns.id, campaignIds))
      : [];

    return res.status(200).json({
      ok: true,
      user,
      workspaces: workspacesData,
      workspaceMemberships: workspaceMembershipsData,
      campaigns: campaignsData,
      campaignMemberships: campaignMembershipsData,
    });
  } catch (error) {
    const status = getApiErrorStatus(error);

    if (status === 500) {
      console.error("[api/me] Failed to provision authenticated user", error);
    }

    return res.status(status).json({
      ok: false,
      error: getApiErrorMessage(error),
    });
  }
}
