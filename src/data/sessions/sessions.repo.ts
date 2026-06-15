import { apiFetch } from "../api/apiClient";

export const sessionsRepo = {
  async getAll(campaignId: string) {
    const response = await apiFetch<{
      ok: true;
      sessions: unknown[];
    }>(`/api/worldbuilding?resource=sessions&campaignId=${encodeURIComponent(campaignId)}`);

    return response.sessions;
  },

  async upsert(campaignId: string, session: any) {
    await apiFetch(`/api/worldbuilding?resource=sessions&campaignId=${encodeURIComponent(campaignId)}`, {
      method: "PUT",
      body: JSON.stringify({ session }),
    });
  },

  async remove(campaignId: string, id: string) {
    await apiFetch(
      `/api/worldbuilding?resource=sessions&campaignId=${encodeURIComponent(
        campaignId
      )}&sessionId=${encodeURIComponent(id)}`,
      {
        method: "DELETE",
      }
    );
  },
};
