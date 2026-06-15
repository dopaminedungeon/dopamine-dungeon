import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";

import {
  getCurrentUser,
  requireCampaignGm,
  requireCampaignMember,
  resolveCampaignBySlug,
} from "../access.js";
import { setCorsHeaders } from "../cors.js";
import { db } from "../db.js";
import { sessions } from "../../../db/schema/sessions.js";

type SessionRow = typeof sessions.$inferSelect;

function getQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeString(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeGmPrep(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function normalizeAttendees(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

function toSessionPayload(row: SessionRow, isGm: boolean) {
  const payload = {
    id: row.id,
    sessionNumber: row.sessionNumber,
    name: row.name,
    players: row.players,
    maxPlayers: row.maxPlayers,
    duration: row.duration,
    status: row.status,
    startTime: row.startTime,
    map: row.map,
    difficulty: row.difficulty,
    progress: row.progress,
    visibility: row.visibility,
    summary: row.summary,
    timeline: row.timeline,
    moments: row.moments,
    quotes: row.quotes,
    gmNotes: row.gmNotes,
    gmSecrets: row.gmSecrets,
    gmPrep: row.gmPrep,
    attendees: row.attendees,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };

  if (isGm) {
    return payload;
  }

  // Player visibility projection: public sessions never expose GM-only fields.
  const { gmNotes, gmSecrets, gmPrep, ...playerPayload } = payload;
  void gmNotes;
  void gmSecrets;
  void gmPrep;
  return playerPayload;
}

function toSessionInsert(campaignId: string, rawSession: Record<string, unknown>) {
  const sessionId = normalizeString(rawSession.id);

  if (!sessionId) {
    throw new Error("Session id is required");
  }

  return {
    campaignId,
    id: sessionId,
    sessionNumber: normalizeNumber(rawSession.sessionNumber, 1),
    name: normalizeString(rawSession.name, "Untitled session") || "Untitled session",
    players: normalizeNumber(rawSession.players, 0),
    maxPlayers: normalizeNumber(rawSession.maxPlayers, 0),
    duration: normalizeString(rawSession.duration, "—") || "—",
    status: normalizeString(rawSession.status, "scheduled") || "scheduled",
    startTime: normalizeString(rawSession.startTime),
    map: normalizeString(rawSession.map),
    difficulty: normalizeString(rawSession.difficulty, "Normal") || "Normal",
    progress: normalizeNumber(rawSession.progress, 0),
    visibility:
      normalizeString(rawSession.visibility, "public") === "gm-only"
        ? "gm-only"
        : "public",
    summary: normalizeString(rawSession.summary),
    timeline: normalizeString(rawSession.timeline),
    moments: normalizeString(rawSession.moments),
    quotes: normalizeString(rawSession.quotes),
    gmNotes: normalizeString(rawSession.gmNotes),
    gmSecrets: normalizeString(rawSession.gmSecrets),
    gmPrep: normalizeGmPrep(rawSession.gmPrep),
    attendees: normalizeAttendees(rawSession.attendees),
    updatedAt: new Date(),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, "GET, PUT, DELETE, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (!["GET", "PUT", "DELETE"].includes(req.method || "")) {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const currentUser = await getCurrentUser(req);
    const campaignSlug = getQueryValue(req.query.campaignId) || "";
    // Normalize the app-safe campaign slug from the frontend to the Postgres campaign UUID.
    const campaign = await resolveCampaignBySlug(campaignSlug);

    if (req.method === "GET") {
      const membership = await requireCampaignMember({
        campaignId: campaign.id,
        userId: currentUser.id,
      });
      const isGm = membership.role === "gm";

      const rows = await db
        .select()
        .from(sessions)
        .where(
          isGm
            ? eq(sessions.campaignId, campaign.id)
            : and(
                eq(sessions.campaignId, campaign.id),
                eq(sessions.visibility, "public")
              )
        );

      return res.status(200).json({
        ok: true,
        campaignId: campaign.slug,
        sessions: rows.map((row) => toSessionPayload(row, isGm)),
      });
    }

    await requireCampaignGm({
      campaignId: campaign.id,
      userId: currentUser.id,
    });

    if (req.method === "PUT") {
      const rawSession =
        req.body && typeof req.body === "object"
          ? (req.body.session ?? req.body)
          : null;

      if (!rawSession || typeof rawSession !== "object") {
        return res.status(400).json({ ok: false, error: "Session payload is required" });
      }

      const values = toSessionInsert(
        campaign.id,
        rawSession as Record<string, unknown>
      );
      const returnedRows = await db
        .insert(sessions)
        .values(values)
        .onConflictDoUpdate({
          target: [sessions.campaignId, sessions.id],
          set: {
            sessionNumber: values.sessionNumber,
            name: values.name,
            players: values.players,
            maxPlayers: values.maxPlayers,
            duration: values.duration,
            status: values.status,
            startTime: values.startTime,
            map: values.map,
            difficulty: values.difficulty,
            progress: values.progress,
            visibility: values.visibility,
            summary: values.summary,
            timeline: values.timeline,
            moments: values.moments,
            quotes: values.quotes,
            gmNotes: values.gmNotes,
            gmSecrets: values.gmSecrets,
            gmPrep: values.gmPrep,
            attendees: values.attendees,
            updatedAt: values.updatedAt,
          },
        })
        .returning();

      return res.status(200).json({
        ok: true,
        session: toSessionPayload(returnedRows[0], true),
      });
    }

    const sessionId = normalizeString(getQueryValue(req.query.sessionId));

    if (!sessionId) {
      return res.status(400).json({ ok: false, error: "sessionId is required" });
    }

    await db
      .delete(sessions)
      .where(and(eq(sessions.campaignId, campaign.id), eq(sessions.id, sessionId)));

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(401).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unauthorized",
    });
  }
}
