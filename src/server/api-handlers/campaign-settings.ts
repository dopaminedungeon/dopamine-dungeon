import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";

import { campaigns } from "../../../db/schema/campaigns.js";
import {
  campaignMemberships,
  workspaceMemberships,
} from "../../../db/schema/memberships.js";
import { getCurrentUser, resolveCampaignBySlug } from "../access.js";
import { AuthenticationError } from "../apiErrors.js";
import { setCorsHeaders } from "../cors.js";
import { db } from "../db.js";
import { canViewAsGm } from "../viewer-mode.js";

const UPDATE_FIELDS = [
  "name",
  "description",
  "status",
  "system",
  "playerSummary",
  "gmNotes",
  "startDate",
  "endDate",
] as const;

type UpdateField = (typeof UPDATE_FIELDS)[number];

class CampaignSettingsError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

function getCampaignId(req: VercelRequest) {
  const queryValue = req.query.campaignId;
  if (Array.isArray(queryValue)) return queryValue[0] || "";
  if (typeof queryValue === "string") return queryValue;

  const body = req.body;
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const campaignId = (body as Record<string, unknown>).campaignId;
    return typeof campaignId === "string" ? campaignId : "";
  }

  return "";
}

function normalizeDate(value: unknown, field: "startDate" | "endDate") {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new CampaignSettingsError(`${field} must be an ISO calendar date`, 400);
  }

  return normalized;
}

function getUpdateValues(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new CampaignSettingsError("Campaign settings update is invalid", 400);
  }

  const values = body as Record<string, unknown>;
  const suppliedFields = Object.keys(values).filter((key) => key !== "campaignId");
  const unknownFields = suppliedFields.filter(
    (field) => !UPDATE_FIELDS.includes(field as UpdateField)
  );

  if (unknownFields.length) {
    throw new CampaignSettingsError("Campaign settings update contains unsupported fields", 400);
  }

  if (!suppliedFields.length) {
    throw new CampaignSettingsError("Campaign settings update is empty", 400);
  }

  const update: Partial<Record<UpdateField, string>> = {};
  for (const field of UPDATE_FIELDS) {
    if (!(field in values)) continue;

    if (field === "startDate" || field === "endDate") {
      update[field] = normalizeDate(values[field], field);
      continue;
    }

    if (typeof values[field] !== "string") {
      throw new CampaignSettingsError(`${field} must be a string`, 400);
    }

    update[field] = values[field].trim();
  }

  if ("name" in update && !update.name) {
    throw new CampaignSettingsError("Campaign name is required", 400);
  }

  if ("status" in update && !["active", "paused", "completed"].includes(update.status || "")) {
    throw new CampaignSettingsError("Campaign status is invalid", 400);
  }

  return update;
}

function toPlayerResponse(campaign: typeof campaigns.$inferSelect) {
  return {
    id: campaign.id,
    campaignId: campaign.slug,
    workspaceId: campaign.workspaceId,
    name: campaign.name,
    description: campaign.description ?? "",
    status: campaign.status,
    system: campaign.system,
    playerSummary: campaign.playerSummary,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    updatedAt: campaign.updatedAt,
  };
}

function toCampaignSettingsResponse(params: {
  campaign: typeof campaigns.$inferSelect;
  canViewGmFields: boolean;
}) {
  const response = toPlayerResponse(params.campaign);
  return params.canViewGmFields
    ? { ...response, gmNotes: params.campaign.gmNotes }
    : response;
}

async function getAuthorizedAccess(req: VercelRequest) {
  const currentUser = await getCurrentUser(req);
  const campaign = await resolveCampaignBySlug(getCampaignId(req));
  const [campaignMembershipRows, workspaceMembershipRows] = await Promise.all([
    db
      .select()
      .from(campaignMemberships)
      .where(
        and(
          eq(campaignMemberships.campaignId, campaign.id),
          eq(campaignMemberships.userId, currentUser.id)
        )
      )
      .limit(1),
    db
      .select()
      .from(workspaceMemberships)
      .where(
        and(
          eq(workspaceMemberships.workspaceId, campaign.workspaceId),
          eq(workspaceMemberships.userId, currentUser.id)
        )
      )
      .limit(1),
  ]);

  const campaignMembership = campaignMembershipRows[0];
  if (!campaignMembership || !workspaceMembershipRows[0]) {
    throw new CampaignSettingsError("Campaign access is not permitted", 403);
  }

  return { campaign, campaignMembership };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, "GET, PATCH, OPTIONS");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (!['GET', 'PATCH'].includes(req.method || "")) {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { campaign, campaignMembership } = await getAuthorizedAccess(req);
    const canViewGmFields = canViewAsGm(req, campaignMembership.role);

    if (req.method === "GET") {
      return res.status(200).json({
        ok: true,
        campaign: toCampaignSettingsResponse({ campaign, canViewGmFields }),
      });
    }

    if (!canViewGmFields) {
      throw new CampaignSettingsError("Campaign GM mode is required", 403);
    }

    const update = getUpdateValues(req.body);
    const updatedRows = await db
      .update(campaigns)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(campaigns.id, campaign.id))
      .returning();
    const updatedCampaign = updatedRows[0];

    if (!updatedCampaign) {
      throw new CampaignSettingsError("Campaign settings update could not be completed", 409);
    }

    return res.status(200).json({
      ok: true,
      campaign: toCampaignSettingsResponse({
        campaign: updatedCampaign,
        canViewGmFields: true,
      }),
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return res.status(401).json({ ok: false, error: "Authentication required" });
    }
    if (error instanceof CampaignSettingsError) {
      return res.status(error.status).json({ ok: false, error: error.message });
    }
    return res.status(500).json({ ok: false, error: "Campaign settings request failed" });
  }
}
