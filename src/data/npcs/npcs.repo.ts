import { apiFetch } from "../api/apiClient";

export type NpcRecord = {
  id: string;
  campaignId?: string;
  name: string;
  title?: string;
  type?: string;
  status?: string;
  visibility?: "public" | "gm-only";
  summary?: string;
  description?: string;
  gmNotes?: string;
  imageUrl?: string;
  createdAt?: string;
  updatedAt?: string;
};

function normalizeNpc(input: any = {}): NpcRecord {
  return {
    ...input,
    id: String(input?.id || ""),
    name: String(input?.name || ""),
    title: String(input?.title || ""),
    type: String(input?.type || "unknown"),
    status: String(input?.status || "active"),
    visibility: input?.visibility === "gm-only" ? "gm-only" : "public",
    summary: String(input?.summary || ""),
    description: String(input?.description || ""),
    gmNotes: String(input?.gmNotes || ""),
    imageUrl: String(input?.imageUrl || ""),
  };
}

export const npcsRepo = {
  async getAll(campaignId: string) {
    const response = await apiFetch<{
      ok: true;
      npcs: unknown[];
    }>(`/api/npcs?campaignId=${encodeURIComponent(campaignId)}`);

    return (response.npcs ?? []).map(normalizeNpc);
  },

  async getById(campaignId: string, id: string) {
    const response = await apiFetch<{
      ok: true;
      npc: unknown | null;
    }>(
      `/api/npcs?campaignId=${encodeURIComponent(campaignId)}&npcId=${encodeURIComponent(id)}`
    );

    return response.npc ? normalizeNpc(response.npc) : null;
  },

  async upsert(campaignId: string, npc: NpcRecord) {
    const response = await apiFetch<{ ok: true; npc: unknown }>(
      `/api/npcs?campaignId=${encodeURIComponent(campaignId)}`,
      {
        method: "PUT",
        body: JSON.stringify({ npc }),
      }
    );

    return normalizeNpc(response.npc || npc);
  },

  async remove(campaignId: string, id: string) {
    await apiFetch(
      `/api/npcs?campaignId=${encodeURIComponent(campaignId)}&npcId=${encodeURIComponent(id)}`,
      {
        method: "DELETE",
      }
    );
  },
};
