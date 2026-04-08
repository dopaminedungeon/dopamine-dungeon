import { collection, doc, getDocs, query, setDoc, where, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import type { CampaignMember } from "../../domain/campaigns/campaign.types";

const CAMPAIGN_MEMBERS_COLLECTION = "campaignMembers";

export async function createCampaignMember(member: CampaignMember): Promise<CampaignMember> {
  const memberId = String(
    member?.id ||
      (member?.campaignId && member?.userId
        ? `${member.campaignId}_${member.userId}`
        : doc(collection(db, CAMPAIGN_MEMBERS_COLLECTION)).id)
  );

  const memberToSave: CampaignMember = {
    ...member,
    id: memberId,
  };

  await setDoc(doc(db, CAMPAIGN_MEMBERS_COLLECTION, memberId), memberToSave);
  return memberToSave;
}

export async function removeCampaignMember(memberId: string): Promise<void> {
  const ref = doc(db, CAMPAIGN_MEMBERS_COLLECTION, memberId);
  await deleteDoc(ref);
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

export async function getCampaignMembershipsForUserInTenant(
  tenantId: string,
  userId: string
): Promise<CampaignMember[]> {
  const q = query(
    collection(db, CAMPAIGN_MEMBERS_COLLECTION),
    where("tenantId", "==", tenantId),
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

export async function getCampaignMembershipForUserInCampaign(
  tenantId: string,
  campaignId: string,
  userId: string
): Promise<CampaignMember | null> {
  const q = query(
    collection(db, CAMPAIGN_MEMBERS_COLLECTION),
    where("tenantId", "==", tenantId),
    where("campaignId", "==", campaignId),
    where("userId", "==", userId)
  );

  const snapshot = await getDocs(q);
  const docSnap = snapshot.docs[0];

  if (!docSnap) {
    return null;
  }

  return {
    id: docSnap.id,
    ...(docSnap.data() as Omit<CampaignMember, "id">),
  };
}

export async function getCampaignMembershipForUser(
  campaignId: string,
  userId: string
): Promise<CampaignMember | null> {
  const q = query(
    collection(db, CAMPAIGN_MEMBERS_COLLECTION),
    where("campaignId", "==", campaignId),
    where("userId", "==", userId)
  );

  const snapshot = await getDocs(q);
  const first = snapshot.docs[0];

  if (!first) {
    return null;
  }

  return {
    id: first.id,
    ...(first.data() as Omit<CampaignMember, "id">),
  };
}
