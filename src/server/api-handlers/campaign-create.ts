import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";

import { campaigns } from "../../../db/schema/campaigns.js";
import { workspaceMemberships, campaignMemberships } from "../../../db/schema/memberships.js";
import { workspaces } from "../../../db/schema/workspaces.js";
import { getCurrentUser } from "../access.js";
import { AuthenticationError } from "../apiErrors.js";
import { setCorsHeaders } from "../cors.js";
import { db } from "../db.js";

const IDEMPOTENCY_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class CampaignCreationError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "CampaignCreationError";
  }
}

function getCreateCampaignInput(req: VercelRequest) {
  const body = req.body;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new CampaignCreationError("Campaign name is required", 400);
  }

  const values = body as Record<string, unknown>;
  const workspaceId = String(values.workspaceId || "").trim();
  const name = String(values.name || "").trim();
  const description = String(values.description || "").trim();
  const system = String(values.system || "").trim();
  const idempotencyKey = String(values.idempotencyKey || "").trim();

  if (!workspaceId || !name || name.length > 160) {
    throw new CampaignCreationError("Campaign name is required", 400);
  }

  if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
    throw new CampaignCreationError("Campaign creation request is invalid", 400);
  }

  return { description, idempotencyKey, name, system, workspaceId };
}

function getCampaignSlug() {
  return `campaign-${randomUUID()}`;
}

function toCampaignResponse(campaign: typeof campaigns.$inferSelect) {
  return {
    id: campaign.id,
    name: campaign.name,
    slug: campaign.slug,
  };
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
    const { description, idempotencyKey, name, system, workspaceId } =
      getCreateCampaignInput(req);
    const campaign = await db.transaction(async (tx) => {
      const workspaceRows = await tx
        .select()
        .from(workspaces)
        .where(eq(workspaces.slug, workspaceId))
        .limit(1);
      const workspace = workspaceRows[0];

      if (!workspace) {
        throw new CampaignCreationError("Campaign creation request cannot be completed", 403);
      }

      const membershipRows = await tx
        .select()
        .from(workspaceMemberships)
        .where(
          and(
            eq(workspaceMemberships.workspaceId, workspace.id),
            eq(workspaceMemberships.userId, currentUser.id)
          )
        )
        .limit(1);

      if (membershipRows[0]?.role !== "owner") {
        throw new CampaignCreationError("Campaign creation request cannot be completed", 403);
      }

      const existingRows = await tx
        .select()
        .from(campaigns)
        .where(
          and(
            eq(campaigns.workspaceId, workspace.id),
            eq(campaigns.createdByUserId, currentUser.id),
            eq(campaigns.creationRequestKey, idempotencyKey)
          )
        )
        .limit(1);
      let existingCampaign = existingRows[0];
      let created = false;

      if (!existingCampaign) {
        const insertedRows = await tx
          .insert(campaigns)
          .values({
            workspaceId: workspace.id,
            createdByUserId: currentUser.id,
            creationRequestKey: idempotencyKey,
            name,
            slug: getCampaignSlug(),
            description,
            system,
            status: "active",
          })
          .onConflictDoNothing({
            target: [
              campaigns.workspaceId,
              campaigns.createdByUserId,
              campaigns.creationRequestKey,
            ],
          })
          .returning();

        existingCampaign = insertedRows[0];
        created = Boolean(existingCampaign);

        if (!existingCampaign) {
          const concurrentRows = await tx
            .select()
            .from(campaigns)
            .where(
              and(
                eq(campaigns.workspaceId, workspace.id),
                eq(campaigns.createdByUserId, currentUser.id),
                eq(campaigns.creationRequestKey, idempotencyKey)
              )
            )
            .limit(1);
          existingCampaign = concurrentRows[0];
        }
      }

      if (
        !existingCampaign ||
        existingCampaign.workspaceId !== workspace.id ||
        existingCampaign.createdByUserId !== currentUser.id
      ) {
        throw new CampaignCreationError("Campaign creation request cannot be completed", 409);
      }

      const campaignMembershipRows = await tx
        .select()
        .from(campaignMemberships)
        .where(
          and(
            eq(campaignMemberships.campaignId, existingCampaign.id),
            eq(campaignMemberships.userId, currentUser.id)
          )
        )
        .limit(1);

      if (campaignMembershipRows[0]?.role === "gm") {
        return existingCampaign;
      }

      if (!created) {
        throw new CampaignCreationError("Campaign creation request cannot be completed", 409);
      }

      const insertedMembershipRows = await tx
        .insert(campaignMemberships)
        .values({
          campaignId: existingCampaign.id,
          userId: currentUser.id,
          role: "gm",
        })
        .returning();

      if (!insertedMembershipRows[0]) {
        throw new CampaignCreationError("Campaign creation failed", 500);
      }

      return existingCampaign;
    });

    return res.status(201).json({
      ok: true,
      campaign: toCampaignResponse(campaign),
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return res.status(401).json({ ok: false, error: "Authentication required" });
    }

    if (error instanceof CampaignCreationError) {
      return res.status(error.status).json({ ok: false, error: error.message });
    }

    return res.status(500).json({
      ok: false,
      error: "Campaign creation failed",
    });
  }
}
