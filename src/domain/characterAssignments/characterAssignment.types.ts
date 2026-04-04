export type CharacterAssignment = {
  id: string;
  tenantId: string;
  campaignId: string;
  characterId: string;
  userId: string;
  createdAt: number;
  removedAt?: number;
  createdBy: string;
};