import { apiFetch } from "../api/apiClient";

export const itemsRepo = {
  async getAll(campaignId: string) {
    const response = await apiFetch<{
      ok: true;
      items: unknown[];
    }>(
      `/api/items?campaignId=${encodeURIComponent(campaignId)}`
    );

    return response.items ?? [];
  },

  async upsert(campaignId: string, item: any) {
    await apiFetch(`/api/items?campaignId=${encodeURIComponent(campaignId)}`, {
      method: "PUT",
      body: JSON.stringify({ item }),
    });
  },

  async remove(campaignId: string, id: string) {
    await apiFetch(
      `/api/items?campaignId=${encodeURIComponent(
        campaignId
      )}&itemId=${encodeURIComponent(id)}`,
      {
        method: "DELETE",
      }
    );
  },
};
