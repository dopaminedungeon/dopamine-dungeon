

import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import type { Campaign } from "../../domain/campaigns/campaign.types";

const CAMPAIGNS_COLLECTION = "campaigns";

export async function createCampaign(campaign: Campaign): Promise<Campaign> {
  await setDoc(doc(db, CAMPAIGNS_COLLECTION, campaign.id), campaign);
  return campaign;
}

export async function getCampaignsForTenant(tenantId: string): Promise<Campaign[]> {
  const q = query(
    collection(db, CAMPAIGNS_COLLECTION),
    where("tenantId", "==", tenantId)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Omit<Campaign, "id">),
  }));
}

export async function getCampaignById(campaignId: string): Promise<Campaign | null> {
  const ref = doc(db, CAMPAIGNS_COLLECTION, campaignId);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) return null;

  return {
    id: snapshot.id,
    ...(snapshot.data() as Omit<Campaign, "id">),
  };
}