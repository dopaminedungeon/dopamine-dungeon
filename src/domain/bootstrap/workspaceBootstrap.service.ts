import { doc, writeBatch } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import type { Campaign, CampaignMember } from "../campaigns/campaign.types";
import type { Tenant, TenantMember } from "../tenants/tenant.types";

type CreateWorkspaceInput = {
  name: string;
  userId: string;
};

type CreateCampaignInput = {
  tenantId: string;
  name: string;
  userId: string;
  description?: string;
  system?: string;
};

export async function createWorkspaceWithOwner({
  name,
  userId,
}: CreateWorkspaceInput): Promise<{
  tenant: Tenant;
  tenantMember: TenantMember;
}> {
  const tenantId = crypto.randomUUID();
  const tenantMemberId = crypto.randomUUID();
  const now = Date.now();

  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error("Workspace name cannot be empty.");
  }

  const tenant: Tenant = {
    id: tenantId,
    name: trimmedName,
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
  };

  const tenantMember: TenantMember = {
    id: tenantMemberId,
    tenantId,
    userId,
    role: "owner",
    createdAt: now,
    createdBy: userId,
  };

  const batch = writeBatch(db);

  batch.set(doc(db, "tenants", tenantId), tenant);
  batch.set(doc(db, "tenantMembers", tenantMemberId), tenantMember);

  await batch.commit();

  return { tenant, tenantMember };
}

export async function createCampaignWithGm({
  tenantId,
  name,
  userId,
  description,
  system,
}: CreateCampaignInput): Promise<{
  campaign: Campaign;
  campaignMember: CampaignMember;
}> {
  const campaignId = crypto.randomUUID();
  const campaignMemberId = crypto.randomUUID();
  const now = Date.now();

  const trimmedName = name.trim();
  const trimmedDescription = description?.trim();
  const trimmedSystem = system?.trim();

  if (!trimmedName) {
    throw new Error("Campaign name cannot be empty.");
  }

  const campaign: Campaign = {
    id: campaignId,
    tenantId,
    name: trimmedName,
    description: trimmedDescription || "",
    system: trimmedSystem || "",
    status: "active",
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
  };

  const campaignMember: CampaignMember = {
    id: campaignMemberId,
    campaignId,
    tenantId,
    userId,
    role: "gm",
    characterId: null,
    createdAt: now,
    createdBy: userId,
  };

  const batch = writeBatch(db);

  batch.set(doc(db, "campaigns", campaignId), campaign);
  batch.set(doc(db, "campaignMembers", campaignMemberId), campaignMember);

  await batch.commit();

  return { campaign, campaignMember };
}