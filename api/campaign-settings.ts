import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";

import {
  getCurrentUser,
  requireCampaignGmOrWorkspaceOwner,
  resolveCampaignBySlug,
} from "../src/server/access.js";
import { setCorsHeaders } from "../src/server/cors.js";
import { db } from "../src/server/db.js";
import { campaigns } from "../db/schema/campaigns.js";

function normalizeString(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, "PATCH, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "PATCH") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const currentUser = await getCurrentUser(req);
    const campaignId = normalizeString(req.body?.campaignId);
    const campaign = await resolveCampaignBySlug(campaignId);

    await requireCampaignGmOrWorkspaceOwner({
      campaignId: campaign.id,
      workspaceId: campaign.workspaceId,
      userId: currentUser.id,
    });

    const updatedRows = await db
      .update(campaigns)
      .set({
        name: normalizeString(req.body?.name, campaign.name) || campaign.name,
        description: normalizeString(req.body?.description),
        status: normalizeString(req.body?.status, campaign.status) || campaign.status,
        system: normalizeString(req.body?.system),
      })
      .where(eq(campaigns.id, campaign.id))
      .returning();

    return res.status(200).json({
      ok: true,
      campaign: updatedRows[0] ?? campaign,
    });
  } catch (error) {
    return res.status(401).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unauthorized",
    });
  }
}
