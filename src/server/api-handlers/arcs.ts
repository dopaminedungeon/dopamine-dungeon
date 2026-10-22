import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, inArray, or } from "drizzle-orm";

import { getCurrentUser, requireCampaignGm, requireCampaignMember, resolveCampaignBySlug } from "../access.js";
import { setCorsHeaders } from "../cors.js";
import { db } from "../db.js";
import { canViewAsGm } from "../viewer-mode.js";
import { arcs, milestones } from "../../../db/schema/arcs.js";
import { entityLinks } from "../../../db/schema/entityLinks.js";
import { ArcApiError, sendArcApiError } from "./arcApiErrors.js";

const ARC_STATUSES = new Set(["active", "progressing", "resolved", "waiting"]);
const ARC_TYPES = new Set(["character_arc", "main_story", "supporting_arc", "milestone_progression"]);

function value(input: unknown) { return Array.isArray(input) ? input[0] : input; }
function string(input: unknown, fallback = "") { return String(input ?? fallback).trim(); }
function visibility(input: unknown) { return input === "public" ? "public" : "gm-only"; }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, "GET, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!["GET", "PUT", "DELETE"].includes(req.method || "")) return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const user = await getCurrentUser(req);
    const campaign = await resolveCampaignBySlug(string(value(req.query.campaignId)));
    let membership;
    try {
      membership = await requireCampaignMember({ campaignId: campaign.id, userId: user.id });
    } catch (error) {
      if (error instanceof Error && error.message === "Campaign membership required") {
        throw new ArcApiError("Campaign membership required", 403);
      }
      throw error;
    }
    const isGm = canViewAsGm(req, membership.role);

    if (!isGm) throw new ArcApiError("GM mode is required to access Arcs", 403);

    if (req.method === "GET") {
      const arcId = string(value(req.query.arcId));
      const rows = await db.select().from(arcs).where(and(
        eq(arcs.campaignId, campaign.id),
        arcId ? eq(arcs.id, arcId) : undefined
      ));
      return res.status(200).json({ ok: true, campaignId: campaign.slug, arcs: rows });
    }

    if (req.method === "DELETE") {
      const arcId = string(value(req.query.arcId));
      if (!arcId) return res.status(400).json({ ok: false, error: "Arc id is required" });
      await requireCampaignGm({ campaignId: campaign.id, userId: user.id });
      await db.transaction(async (tx) => {
        const childRows = await tx.select({ id: milestones.id }).from(milestones).where(and(
          eq(milestones.campaignId, campaign.id), eq(milestones.arcId, arcId)
        ));
        const linkConditions = [
          and(eq(entityLinks.entityAType, "Arc"), eq(entityLinks.entityAId, arcId)),
          and(eq(entityLinks.entityBType, "Arc"), eq(entityLinks.entityBId, arcId)),
        ];
        if (childRows.length) {
          const ids = childRows.map((row) => row.id);
          linkConditions.push(
            and(eq(entityLinks.entityAType, "Milestone"), inArray(entityLinks.entityAId, ids)),
            and(eq(entityLinks.entityBType, "Milestone"), inArray(entityLinks.entityBId, ids))
          );
        }
        await tx.delete(entityLinks).where(and(eq(entityLinks.campaignId, campaign.id), or(...linkConditions)));
        await tx.delete(arcs).where(and(eq(arcs.campaignId, campaign.id), eq(arcs.id, arcId)));
      });
      return res.status(200).json({ ok: true, deleted: true });
    }

    try {
      await requireCampaignGm({ campaignId: campaign.id, userId: user.id });
    } catch (error) {
      if (error instanceof Error && error.message === "Campaign GM permission required") {
        throw new ArcApiError("Campaign GM permission required", 403);
      }
      throw error;
    }
    if (!isGm) throw new ArcApiError("GM mode is required to edit Arcs", 403);
    const raw = req.body && typeof req.body === "object" ? ((req.body as Record<string, unknown>).arc ?? req.body) : null;
    if (!raw || typeof raw !== "object") return res.status(400).json({ ok: false, error: "Arc payload is required" });
    const arc = raw as Record<string, unknown>;
    const id = string(arc.id);
    if (!id) return res.status(400).json({ ok: false, error: "Arc id is required" });
    const status = string(arc.status, "active");
    if (!ARC_STATUSES.has(status)) return res.status(400).json({ ok: false, error: "Invalid Arc status" });
    const type = string(arc.type, "main_story");
    if (!ARC_TYPES.has(type)) return res.status(400).json({ ok: false, error: "Invalid Arc type" });
    const progress = Number(arc.progress ?? 0);
    if (!Number.isInteger(progress) || progress < 0 || progress > 100) return res.status(400).json({ ok: false, error: "Arc progress must be a whole number from 0 to 100" });

    const [saved] = await db.insert(arcs).values({
      campaignId: campaign.id,
      id,
      type,
      name: string(arc.name, "Untitled Arc") || "Untitled Arc",
      summary: string(arc.summary),
      progress,
      plotHook: string(arc.plotHook),
      grimPortentsFrontiers: string(arc.grimPortentsFrontiers),
      arcStructure: string(arc.arcStructure),
      climaxConditions: string(arc.climaxConditions),
      resolutionFallout: string(arc.resolutionFallout),
      status,
      visibility: visibility(arc.visibility),
      createdByUserId: user.id,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: [arcs.campaignId, arcs.id],
      set: {
        type,
        name: string(arc.name, "Untitled Arc") || "Untitled Arc",
        summary: string(arc.summary),
        progress,
        plotHook: string(arc.plotHook),
        grimPortentsFrontiers: string(arc.grimPortentsFrontiers),
        arcStructure: string(arc.arcStructure),
        climaxConditions: string(arc.climaxConditions),
        resolutionFallout: string(arc.resolutionFallout),
        status,
        visibility: visibility(arc.visibility),
        updatedAt: new Date(),
      },
    }).returning();
    return res.status(200).json({ ok: true, arc: saved });
  } catch (error) {
    return sendArcApiError(res, error);
  }
}
