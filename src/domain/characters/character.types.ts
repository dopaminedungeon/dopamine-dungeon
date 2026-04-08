export type CharacterType = "pc" | "npc";

export type CharacterStatus = "active" | "inactive" | "retired" | "dead";

export type CharacterVisibility = "player" | "gm" | "restricted";

export type Character = {
  id: string;
  tenantId: string;
  campaignId: string;

  name: string;
  type: CharacterType;
  status: CharacterStatus;
  visibility: CharacterVisibility;

  ownerUserId?: string;
  playerName?: string;
  dndBeyondUrl?: string;
  imageUrl?: string;

  publicNotes?: string;
  gmNotes?: string;
  secrets?: string;

  isPlayerVisible?: boolean;

  createdAt: number;
  createdBy: string;
  updatedAt?: number;
};