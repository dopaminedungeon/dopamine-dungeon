import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";

import { getCurrentUser, requireCampaignGm, requireCampaignMember, resolveCampaignBySlug } from "../access.js";
import { setCorsHeaders } from "../cors.js";
import { db } from "../db.js";
import { canViewAsGm } from "../viewer-mode.js";
import { arcs, milestones } from "../../../db/schema/arcs.js";
import { ArcApiError, sendArcApiError } from "./arcApiErrors.js";

const MILESTONE_STATUSES = new Set(["active", "progressing", "resolved", "waiting"]);
function value(input: unknown) { return Array.isArray(input) ? input[0] : input; }
function string(input: unknown, fallback = "") { return String(input ?? fallback).trim(); }
function visibility(input: unknown) { return input === "public" ? "public" : "gm-only"; }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, "GET, PUT, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!["GET", "PUT"].includes(req.method || "")) return res.status(405).json({ ok: false, error: "Method not allowed" });

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

    if (!isGm) throw new ArcApiError("GM mode is required to access Milestones", 403);

    if (req.method === "GET") {
      const arcId = string(value(req.query.arcId));
      const milestoneId = string(value(req.query.milestoneId));
      const rows = await db.select().from(milestones).where(and(
        eq(milestones.campaignId, campaign.id),
        arcId ? eq(milestones.arcId, arcId) : undefined,
        milestoneId ? eq(milestones.id, milestoneId) : undefined
      ));
      return res.status(200).json({ ok: true, campaignId: campaign.slug, milestones: rows });
    }

    try {
      await requireCampaignGm({ campaignId: campaign.id, userId: user.id });
    } catch (error) {
      if (error instanceof Error && error.message === "Campaign GM permission required") {
        throw new ArcApiError("Campaign GM permission required", 403);
      }
      throw error;
    }
    if (!isGm) throw new ArcApiError("GM mode is required to edit Milestones", 403);
    const raw = req.body && typeof req.body === "object" ? ((req.body as Record<string, unknown>).milestone ?? req.body) : null;
    if (!raw || typeof raw !== "object") return res.status(400).json({ ok: false, error: "Milestone payload is required" });
    const milestone = raw as Record<string, unknown>;
    const id = string(milestone.id);
    const hasArcId = Object.prototype.hasOwnProperty.call(milestone, "arcId");
    let arcId: string | null = hasArcId ? string(milestone.arcId) || null : null;
    if (!id) return res.status(400).json({ ok: false, error: "Milestone id is required" });
    const status = string(milestone.status, "active");
    if (!MILESTONE_STATUSES.has(status)) return res.status(400).json({ ok: false, error: "Invalid milestone status" });
    const progress = Number(milestone.progress ?? 0);
    if (!Number.isInteger(progress) || progress < 0 || progress > 100) return res.status(400).json({ ok: false, error: "Milestone progress must be a whole number from 0 to 100" });
    if (!hasArcId) {
      const [existing] = await db.select({ arcId: milestones.arcId }).from(milestones).where(and(
        eq(milestones.campaignId, campaign.id), eq(milestones.id, id)
      )).limit(1);
      arcId = existing?.arcId ?? null;
    }
    if (arcId) {
      const [parent] = await db.select({ id: arcs.id }).from(arcs).where(and(
        eq(arcs.campaignId, campaign.id), eq(arcs.id, arcId)
      )).limit(1);
      if (!parent) return res.status(400).json({ ok: false, error: "Arc is unavailable in this campaign" });
    }

    const [saved] = await db.insert(milestones).values({
      campaignId: campaign.id,
      id,
      arcId,
      title: string(milestone.title, "Untitled milestone") || "Untitled milestone",
      description: string(milestone.description),
      progress,
      conditionsForLevelUp: string(milestone.conditionsForLevelUp),
      intendedLevelProgression: string(milestone.intendedLevelProgression),
      status,
      visibility: visibility(milestone.visibility),
      position: Number.isFinite(Number(milestone.position)) ? Number(milestone.position) : 0,
      createdByUserId: user.id,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: [milestones.campaignId, milestones.id],
      set: {
        arcId,
        title: string(milestone.title, "Untitled milestone") || "Untitled milestone",
        description: string(milestone.description),
        progress,
        conditionsForLevelUp: string(milestone.conditionsForLevelUp),
        intendedLevelProgression: string(milestone.intendedLevelProgression),
        status,
        visibility: visibility(milestone.visibility),
        position: Number.isFinite(Number(milestone.position)) ? Number(milestone.position) : 0,
        updatedAt: new Date(),
      },
    }).returning();
    return res.status(200).json({ ok: true, milestone: saved });
  } catch (error) {
    return sendArcApiError(res, error);
  }
}
