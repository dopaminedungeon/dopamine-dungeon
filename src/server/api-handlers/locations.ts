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
import { locations } from "../../../db/schema/locations.js";

type LocationRow = typeof locations.$inferSelect;

const LOCATION_CATEGORIES = new Set([
  "City",
  "District",
  "Building",
  "Region",
  "Landmark",
  "Wilderness",
  "Dungeon",
  "Other",
]);

function getQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeString(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizeCategory(value: unknown) {
  const category = normalizeString(value, "Other");
  return LOCATION_CATEGORIES.has(category) ? category : "Other";
}

function normalizeAliases(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((alias) => normalizeString(alias))
        .filter(Boolean)
    )
  );
}

function normalizeData(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stripGmOnlyLocationFields(data: Record<string, unknown>): Record<string, unknown> {
  const { gmNotes, data: nestedData, ...safeData } = data;
  void gmNotes;
  const safeNestedData: unknown =
    nestedData && typeof nestedData === "object" && !Array.isArray(nestedData)
      ? stripGmOnlyLocationFields(nestedData as Record<string, unknown>)
      : nestedData;

  return {
    ...safeData,
    ...(safeNestedData ? { data: safeNestedData } : {}),
  };
}

function toLocationPayload(row: LocationRow, isGm: boolean) {
  const payload = {
    ...row.data,
    data: row.data,
    id: row.id,
    campaignId: row.campaignId,
    name: row.name,
    category: row.category,
    visibility: row.visibility,
    summary: row.summary,
    description: row.description,
    imageUrl: row.imageUrl,
    aliases: row.aliases,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };

  if (isGm) {
    return {
      ...payload,
      gmNotes: row.gmNotes,
    };
  }

  return stripGmOnlyLocationFields(payload);
}

function toLocationValues(campaignId: string, rawLocation: Record<string, unknown>) {
  const locationId = normalizeString(rawLocation.id);

  if (!locationId) {
    throw new Error("Location id is required");
  }

  const sourceData = normalizeData(rawLocation.data);
  const category = normalizeCategory(rawLocation.category ?? rawLocation.type);
  const visibility =
    normalizeString(rawLocation.visibility, "gm-only") === "public"
      ? "public"
      : "gm-only";
  const aliases = normalizeAliases(rawLocation.aliases);
  const name = normalizeString(rawLocation.name);
  const summary = normalizeString(rawLocation.summary);
  const description = normalizeString(rawLocation.description);
  const gmNotes = normalizeString(rawLocation.gmNotes);
  const imageUrl = normalizeString(rawLocation.imageUrl ?? rawLocation.thumbnail);
  const now = new Date();

  return {
    campaignId,
    id: locationId,
    name,
    category,
    visibility,
    summary,
    description,
    gmNotes,
    imageUrl,
    aliases,
    data: {
      ...sourceData,
      id: locationId,
      name,
      category,
      type: category,
      visibility,
      summary,
      description,
      gmNotes,
      imageUrl,
      aliases,
    },
    updatedAt: now,
  };
}

async function handleLocations(req: VercelRequest, res: VercelResponse) {
  if (!["GET", "PUT", "DELETE"].includes(req.method || "")) {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const currentUser = await getCurrentUser(req);
  const campaignSlug = getQueryValue(req.query.campaignId) || "";
  const locationId = normalizeString(
    getQueryValue(req.query.locationId) || getQueryValue(req.query.id)
  );
  const campaign = await resolveCampaignBySlug(campaignSlug);

  if (req.method === "GET") {
    const membership = await requireCampaignMember({
      campaignId: campaign.id,
      userId: currentUser.id,
    });
    const isGm = membership.role === "gm";

    const visibilityFilter = isGm
      ? eq(locations.campaignId, campaign.id)
      : and(eq(locations.campaignId, campaign.id), eq(locations.visibility, "public"));
    const whereClause = locationId
      ? and(visibilityFilter, eq(locations.id, locationId))
      : visibilityFilter;

    const rows = await db.select().from(locations).where(whereClause);

    if (locationId) {
      return res.status(200).json({
        ok: true,
        campaignId: campaign.slug,
        location: rows[0] ? toLocationPayload(rows[0], isGm) : null,
      });
    }

    return res.status(200).json({
      ok: true,
      campaignId: campaign.slug,
      locations: rows.map((row) => toLocationPayload(row, isGm)),
    });
  }

  await requireCampaignGm({
    campaignId: campaign.id,
    userId: currentUser.id,
  });

  if (req.method === "PUT") {
    const rawLocation =
      req.body && typeof req.body === "object"
        ? ((req.body as Record<string, unknown>).location ?? req.body)
        : null;

    if (!rawLocation || typeof rawLocation !== "object") {
      return res.status(400).json({ ok: false, error: "Location payload is required" });
    }

    const values = toLocationValues(campaign.id, rawLocation as Record<string, unknown>);
    const returnedRows = await db
      .insert(locations)
      .values(values)
      .onConflictDoUpdate({
        target: [locations.campaignId, locations.id],
        set: {
          name: values.name,
          category: values.category,
          visibility: values.visibility,
          summary: values.summary,
          description: values.description,
          gmNotes: values.gmNotes,
          imageUrl: values.imageUrl,
          aliases: values.aliases,
          data: values.data,
          updatedAt: values.updatedAt,
        },
      })
      .returning();

    return res.status(200).json({
      ok: true,
      location: toLocationPayload(returnedRows[0], true),
    });
  }

  if (!locationId) {
    return res.status(400).json({ ok: false, error: "locationId is required" });
  }

  await db
    .delete(locations)
    .where(and(eq(locations.campaignId, campaign.id), eq(locations.id, locationId)));

  return res.status(200).json({ ok: true });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, "GET, PUT, DELETE, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    const entity = normalizeString(getQueryValue(req.query.entity));

    if (entity === "locations") {
      return await handleLocations(req, res);
    }

    return res.status(404).json({ ok: false, error: "Worldbuilding entity not found" });
  } catch (error) {
    return res.status(401).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unauthorized",
    });
  }
}
