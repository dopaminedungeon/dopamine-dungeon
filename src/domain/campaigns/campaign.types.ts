

export type CampaignRole = "gm" | "player";

export type Campaign = {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  system?: string;
  status: "active" | "archived";
  createdAt: number;
  createdBy: string;
  updatedAt: number;
};

export type CampaignMember = {
  id: string;
  campaignId: string;
  tenantId: string;
  userId: string;
  role: CampaignRole;
  characterId?: string | null;
  createdAt: number;
  createdBy: string;
};