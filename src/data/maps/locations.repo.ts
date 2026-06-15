import { apiFetch } from "../api/apiClient";

export type LocationVisibility = "public" | "gm-only";

export type LocationRecord = {
  id: string;
  campaignId?: string;
  name: string;
  category: string;
  visibility: LocationVisibility;
  summary?: string;
  description?: string;
  gmNotes?: string;
  imageUrl?: string;
  aliases?: string[];
  data?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

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

function normalizeCategory(value: unknown) {
  const category = String(value || "").trim();
  return LOCATION_CATEGORIES.has(category) ? category : "Other";
}

function normalizeAliases(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((alias) => String(alias || "").trim())
    .filter(Boolean);
}

function normalizeLocation(input: any = {}): LocationRecord {
  const data =
    input?.data && typeof input.data === "object" && !Array.isArray(input.data)
      ? input.data
      : {};

  return {
    ...input,
    id: String(input?.id || ""),
    name: String(input?.name || ""),
    category: normalizeCategory(input?.category ?? input?.type),
    visibility: input?.visibility === "public" ? "public" : "gm-only",
    summary: String(input?.summary || ""),
    description: String(input?.description || ""),
    gmNotes: String(input?.gmNotes || ""),
    imageUrl: String(input?.imageUrl || input?.thumbnail || ""),
    aliases: normalizeAliases(input?.aliases),
    data,
  };
}

function getLocationsEndpoint(campaignId: string, id?: string) {
  const params = new URLSearchParams({
    entity: "locations",
    campaignId,
  });

  if (id) {
    params.set("locationId", id);
  }

  return `/api/worldbuilding?${params.toString()}`;
}

export const locationsRepo = {
  async getAll(campaignId: string) {
    const response = await apiFetch<{
      ok: true;
      locations: unknown[];
    }>(getLocationsEndpoint(campaignId));

    return (response.locations ?? []).map(normalizeLocation);
  },

  async getById(campaignId: string, id: string) {
    const response = await apiFetch<{
      ok: true;
      location: unknown | null;
    }>(getLocationsEndpoint(campaignId, id));

    return response.location ? normalizeLocation(response.location) : null;
  },

  async upsert(campaignId: string, location: LocationRecord) {
    const response = await apiFetch<{ ok: true; location: unknown }>(
      getLocationsEndpoint(campaignId),
      {
        method: "PUT",
        body: JSON.stringify({ location }),
      }
    );

    return normalizeLocation(response.location || location);
  },

  async remove(campaignId: string, id: string) {
    await apiFetch(getLocationsEndpoint(campaignId, id), {
      method: "DELETE",
    });
  },
};
