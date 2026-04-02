import { collection, doc, getDocs, query, setDoc, where } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import type { CampaignMember } from "../../domain/campaigns/campaign.types";

const CAMPAIGN_MEMBERS_COLLECTION = "campaignMembers";

export async function createCampaignMember(member: CampaignMember): Promise<CampaignMember> {
  await setDoc(doc(db, CAMPAIGN_MEMBERS_COLLECTION, member.id), member);
  return member;
}

export async function getCampaignMembershipsForUser(userId: string): Promise<CampaignMember[]> {
  const q = query(
    collection(db, CAMPAIGN_MEMBERS_COLLECTION),
    where("userId", "==", userId)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Omit<CampaignMember, "id">),
  }));
}

export async function getMembersForCampaign(campaignId: string): Promise<CampaignMember[]> {
  const q = query(
    collection(db, CAMPAIGN_MEMBERS_COLLECTION),
    where("campaignId", "==", campaignId)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Omit<CampaignMember, "id">),
  }));
}
