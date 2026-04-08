import { collection, doc, getDocs, query, setDoc, where, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import type { TenantMember } from "../../domain/tenants/tenant.types";

const TENANT_MEMBERS_COLLECTION = "tenantMembers";

export async function createTenantMember(member: TenantMember): Promise<TenantMember> {
  const memberId = String(
    member?.id ||
      (member?.tenantId && member?.userId
        ? `${member.tenantId}_${member.userId}`
        : doc(collection(db, TENANT_MEMBERS_COLLECTION)).id)
  );

  const memberToSave: TenantMember = {
    ...member,
    id: memberId,
  };

  await setDoc(doc(db, TENANT_MEMBERS_COLLECTION, memberId), memberToSave);
  return memberToSave;
}

export async function updateTenantMemberRole(
  memberId: string,
  role: TenantMember["role"]
): Promise<void> {
  const ref = doc(db, TENANT_MEMBERS_COLLECTION, memberId);
  await updateDoc(ref, { role });
}

export async function getTenantMembershipsForUser(userId: string): Promise<TenantMember[]> {
  const q = query(
    collection(db, TENANT_MEMBERS_COLLECTION),
    where("userId", "==", userId)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Omit<TenantMember, "id">),
  }));
}

export async function getMembersForTenant(tenantId: string): Promise<TenantMember[]> {
  const q = query(
    collection(db, TENANT_MEMBERS_COLLECTION),
    where("tenantId", "==", tenantId)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Omit<TenantMember, "id">),
  }));
}

export async function getTenantMembershipForUser(
  tenantId: string,
  userId: string
): Promise<TenantMember | null> {
  const q = query(
    collection(db, TENANT_MEMBERS_COLLECTION),
    where("tenantId", "==", tenantId),
    where("userId", "==", userId)
  );

  const snapshot = await getDocs(q);
  const first = snapshot.docs[0];

  if (!first) {
    return null;
  }

  return {
    id: first.id,
    ...(first.data() as Omit<TenantMember, "id">),
  };
}

export async function removeTenantMember(memberId: string): Promise<void> {
  const ref = doc(db, TENANT_MEMBERS_COLLECTION, memberId);
  await deleteDoc(ref);
}