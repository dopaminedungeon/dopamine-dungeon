import { apiFetch } from "../api/apiClient";

export const itemsRepo = {
  async getAll(campaignId: string) {
    const response = await apiFetch<{
      ok: true;
      items: unknown[];
    }>(
      `/api/worldbuilding?resource=items&campaignId=${encodeURIComponent(campaignId)}`
    );

    return response.items ?? [];
  },

  async getById(campaignId: string, id: string) {
    const response = await apiFetch<{
      ok: true;
      item: unknown | null;
    }>(
      `/api/worldbuilding?resource=items&campaignId=${encodeURIComponent(
        campaignId
      )}&itemId=${encodeURIComponent(id)}`
    );

    return response.item ?? null;
  },

  async upsert(campaignId: string, item: any) {
    const response = await apiFetch<{ ok: true; item: unknown }>(
      `/api/worldbuilding?resource=items&campaignId=${encodeURIComponent(campaignId)}`,
      {
      method: "PUT",
      body: JSON.stringify({ item }),
      }
    );

    return response.item ?? item;
  },

  async remove(campaignId: string, id: string) {
    await apiFetch(
      `/api/worldbuilding?resource=items&campaignId=${encodeURIComponent(
        campaignId
      )}&itemId=${encodeURIComponent(id)}`,
      {
        method: "DELETE",
      }
    );
  },
};
