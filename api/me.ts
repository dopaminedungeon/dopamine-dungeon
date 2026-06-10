import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq, inArray } from "drizzle-orm";

import { verifyAuthHeader } from "../src/server/auth.js";
import { setCorsHeaders } from "../src/server/cors.js";
import { db } from "../src/server/db.js";
import { users } from "../db/schema/users.js";
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
    const decodedToken = await verifyAuthHeader(req.headers.authorization);

    const firebaseUid = decodedToken.uid;
    const email = decodedToken.email ?? null;
    const displayName =
      typeof decodedToken.name === "string" && decodedToken.name.trim()
        ? decodedToken.name.trim()
        : null;

    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.firebaseUid, firebaseUid))
      .limit(1);

    let user = existingUser[0];

    if (!user) {
      const insertedUsers = await db
        .insert(users)
        .values({
          firebaseUid,
          email,
          displayName,
        })
        .returning();

      user = insertedUsers[0];
    } else if (user.email !== email || user.displayName !== displayName) {
      const updatedUsers = await db
        .update(users)
        .set({
          email,
          displayName,
        })
        .where(eq(users.id, user.id))
        .returning();

      user = updatedUsers[0] ?? user;
    }

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
    return res.status(401).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unauthorized",
    });
  }
}
