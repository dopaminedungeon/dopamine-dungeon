import { apiFetch } from "../api/apiClient";

export type LoreVisibility = "public" | "gm-only";

export type LoreRecord = {
  id: string;
  campaignId?: string;
  name: string;
  type: string;
  visibility: LoreVisibility;
  summary?: string;
  content?: string;
  gmNotes?: string;
  aliases?: string[];
  data?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

function normalizeAliases(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((alias) => String(alias || "").trim())
    .filter(Boolean);
}

function normalizeLore(input: any = {}): LoreRecord {
  return {
    ...input,
    id: String(input?.id || ""),
    name: String(input?.name || ""),
    type: String(input?.type || "Lore"),
    visibility: input?.visibility === "public" ? "public" : "gm-only",
    summary: String(input?.summary || ""),
    content: String(input?.content || ""),
    gmNotes: String(input?.gmNotes || ""),
    aliases: normalizeAliases(input?.aliases),
    data:
      input?.data && typeof input.data === "object" && !Array.isArray(input.data)
        ? input.data
        : {},
  };
}

function getLoreEndpoint(campaignId: string, id?: string) {
  const params = new URLSearchParams({
    entity: "lore",
    campaignId,
  });

  if (id) {
    params.set("loreId", id);
  }

  return `/api/worldbuilding?${params.toString()}`;
}

export const loreRepo = {
  async getAll(campaignId: string) {
    const response = await apiFetch<{
      ok: true;
      lore: unknown[];
    }>(getLoreEndpoint(campaignId));

    return (response.lore ?? []).map(normalizeLore);
  },

  async getById(campaignId: string, id: string) {
    const response = await apiFetch<{
      ok: true;
      lore: unknown | null;
    }>(getLoreEndpoint(campaignId, id));

    return response.lore ? normalizeLore(response.lore) : null;
  },

  async upsert(campaignId: string, lore: LoreRecord) {
    const response = await apiFetch<{ ok: true; lore: unknown }>(
      getLoreEndpoint(campaignId),
      {
        method: "PUT",
        body: JSON.stringify({ lore }),
      }
    );

    return normalizeLore(response.lore || lore);
  },

  async remove(campaignId: string, id: string) {
    await apiFetch(getLoreEndpoint(campaignId, id), {
      method: "DELETE",
    });
  },
};
