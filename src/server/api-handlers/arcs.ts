import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";

import { getCurrentUser, requireCampaignGm, requireCampaignMember, resolveCampaignBySlug } from "../access.js";
import { setCorsHeaders } from "../cors.js";
import { db } from "../db.js";
import { canViewAsGm } from "../viewer-mode.js";
import { arcs, milestones } from "../../../db/schema/arcs.js";
import { ArcApiError, sendArcApiError } from "./arcApiErrors.js";

const ARC_STATUSES = new Set(["active", "progressing", "resolved", "waiting"]);

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

    if (req.method === "GET") {
      const arcId = string(value(req.query.arcId));
      const rows = await db.select().from(arcs).where(and(
        eq(arcs.campaignId, campaign.id),
        arcId ? eq(arcs.id, arcId) : undefined,
        isGm ? undefined : eq(arcs.visibility, "public")
      ));
      return res.status(200).json({ ok: true, campaignId: campaign.slug, arcs: rows });
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

    const [saved] = await db.insert(arcs).values({
      campaignId: campaign.id,
      id,
      name: string(arc.name, "Untitled Arc") || "Untitled Arc",
      summary: string(arc.summary),
      status,
      visibility: visibility(arc.visibility),
      createdByUserId: user.id,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: [arcs.campaignId, arcs.id],
      set: {
        name: string(arc.name, "Untitled Arc") || "Untitled Arc",
        summary: string(arc.summary),
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
