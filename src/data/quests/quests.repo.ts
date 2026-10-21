import { apiFetch } from "../api/apiClient";
import type { QuestRecord } from "../../domain/quests/quest.types";

export type QuestReferences = {
  sessions: { id: string; name: string; sessionNumber: number }[];
  npcs: { id: string; name: string }[];
  characters: { id: string; name: string }[];
  items: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  lore: { id: string; name: string }[];
};

function endpoint(campaignId: string, questId?: string) {
  const params = new URLSearchParams({ resource: "quests", campaignId });
  if (questId) params.set("questId", questId);
  return `/api/worldbuilding?${params}`;
}

export const questsRepo = {
  all(campaignId: string) {
    return apiFetch<{ ok: true; quests: QuestRecord[]; references: QuestReferences }>(endpoint(campaignId));
  },
  one(campaignId: string, questId: string) {
    return apiFetch<{ ok: true; quest: QuestRecord | null; references: QuestReferences }>(endpoint(campaignId, questId));
  },
  save(campaignId: string, quest: QuestRecord) {
    return apiFetch<{ ok: true; quest: QuestRecord }>(endpoint(campaignId), {
      method: "PUT", body: JSON.stringify({ quest }),
    });
  },
};
