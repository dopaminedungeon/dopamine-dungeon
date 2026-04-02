

import { collection, doc, getDocs, query, setDoc, where } from "firebase/firestore";
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