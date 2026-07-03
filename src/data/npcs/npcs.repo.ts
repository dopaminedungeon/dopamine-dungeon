import { apiFetch } from "../api/apiClient";

export type NpcRecord = {
  id: string;
  campaignId?: string;
  name: string;
  title?: string;
  type?: string;
  role?: string;
  status?: string;
  visibility?: "public" | "gm-only";
  summary?: string;
  description?: string;
  gmNotes?: string;
  imageUrl?: string;
  data?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

const LEGACY_ROLE_VALUES = new Set(["ally", "neutral", "antagonist", "unknown"]);
const NPC_TYPE_VALUES = new Set(["NPC", "Deity", "Monster", "Other"]);

function normalizeNpcType(value: unknown) {
  const raw = String(value || "").trim();
  if (NPC_TYPE_VALUES.has(raw)) return raw;

  const lower = raw.toLowerCase();
  if (lower === "deity") return "Deity";
  if (lower === "monster") return "Monster";
  if (lower === "other") return "Other";
  return "NPC";
}

function normalizeNpcRole(value: unknown) {
  const role = String(value || "").trim().toLowerCase();
  return LEGACY_ROLE_VALUES.has(role) ? role : "unknown";
}

function normalizeNpc(input: any = {}): NpcRecord {
  const legacyTypeRole = LEGACY_ROLE_VALUES.has(String(input?.type || "").trim().toLowerCase())
    ? input.type
    : undefined;
  const data = input?.data && typeof input.data === "object" && !Array.isArray(input.data)
    ? input.data
    : {};

  return {
    ...input,
    id: String(input?.id || ""),
    name: String(input?.name || ""),
    title: String(input?.title || ""),
    type: normalizeNpcType(input?.type),
    role: normalizeNpcRole(input?.role ?? data.role ?? legacyTypeRole),
    status: String(input?.status || "active"),
    visibility: input?.visibility === "gm-only" ? "gm-only" : "public",
    summary: String(input?.summary || ""),
    description: String(input?.description || ""),
    gmNotes: String(input?.gmNotes || ""),
    imageUrl: String(input?.imageUrl || ""),
    data,
  };
}

function getNpcsEndpoint(campaignId: string, id?: string) {
  const params = new URLSearchParams({
    entity: "npcs",
    campaignId,
  });

  if (id) {
    params.set("npcId", id);
  }

  return `/api/worldbuilding?${params.toString()}`;
}

export const npcsRepo = {
  async getAll(campaignId: string) {
    const response = await apiFetch<{
      ok: true;
      npcs: unknown[];
    }>(getNpcsEndpoint(campaignId));

    return (response.npcs ?? []).map(normalizeNpc);
  },

  async getById(campaignId: string, id: string) {
    const response = await apiFetch<{
      ok: true;
      npc: unknown | null;
    }>(
      getNpcsEndpoint(campaignId, id)
    );

    return response.npc ? normalizeNpc(response.npc) : null;
  },

  async upsert(campaignId: string, npc: NpcRecord) {
    const response = await apiFetch<{ ok: true; npc: unknown }>(
      getNpcsEndpoint(campaignId),
      {
        method: "PUT",
        body: JSON.stringify({ npc }),
      }
    );

    return normalizeNpc(response.npc || npc);
  },

  async remove(campaignId: string, id: string) {
    await apiFetch(getNpcsEndpoint(campaignId, id), {
      method: "DELETE",
    });
  },
};
