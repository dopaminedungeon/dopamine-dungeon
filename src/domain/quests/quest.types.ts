export const QUEST_TYPES = [
  { id: "fetch", label: "Fetch / Retrieval" },
  { id: "delivery", label: "Delivery / Escort" },
  { id: "combat", label: "Destroy / Eliminate / Combat" },
  { id: "investigation", label: "Investigation / Mystery" },
  { id: "negotiation", label: "Negotiation / Diplomacy" },
  { id: "survival", label: "Survival / Escape" },
  { id: "discovery", label: "Obtain / Explore / Discovery" },
] as const;

export const QUEST_STATUSES = ["Active", "Abandoned", "Completed", "Planned"] as const;
export const QUEST_SECTIONS = ["shortDescription", "hook", "journey", "mainObjectives", "secondaryObjectives", "aftermath"] as const;
export type QuestType = typeof QUEST_TYPES[number]["id"];
export type QuestStatus = typeof QUEST_STATUSES[number];
export type QuestSection = typeof QUEST_SECTIONS[number];
export type QuestVisibility = "public" | "gm-only";

export type QuestObjective = {
  id: string;
  type: QuestType;
  description: string;
  visibility: QuestVisibility;
};

export type QuestRecord = {
  id: string;
  name: string;
  type: QuestType;
  status: QuestStatus;
  progress: number;
  visibility: QuestVisibility;
  startSessionId: string;
  endSessionId: string;
  endDate: string;
  giverId: string;
  receiverIds: string[];
  shortDescription: string;
  hook: string;
  journey: string;
  aftermath: string;
  sectionVisibility: Record<QuestSection, QuestVisibility>;
  mainObjectives: QuestObjective[];
  secondaryObjectives: QuestObjective[];
};

export function questTypeIsValid(value: unknown): value is QuestType {
  return QUEST_TYPES.some((type) => type.id === value);
}
