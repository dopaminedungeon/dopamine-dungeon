import { Crown, Skull, Users } from "lucide-react";

export const NPC_TYPES = ["NPC", "Deity", "Monster", "Other"];

export const NPC_TYPE_LABELS = {
  NPC: "NPC",
  Deity: "Deity",
  Monster: "Monster",
  Other: "Other",
};

export const npcTypeIconMap = {
  NPC: Users,
  Deity: Crown,
  Monster: Skull,
  Other: Users,
};

export function normalizeNpcType(value) {
  const type = String(value || "").trim();
  return NPC_TYPES.includes(type) ? type : "NPC";
}

export function getNpcTypeIcon(type) {
  return npcTypeIconMap[normalizeNpcType(type)] || npcTypeIconMap.NPC;
}
