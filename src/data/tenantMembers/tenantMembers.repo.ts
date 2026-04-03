import { collection, doc, getDocs, query, setDoc, where } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import type { TenantMember } from "../../domain/tenants/tenant.types";

const TENANT_MEMBERS_COLLECTION = "tenantMembers";

export async function createTenantMember(member: TenantMember): Promise<TenantMember> {
  await setDoc(doc(db, TENANT_MEMBERS_COLLECTION, member.id), member);
  return member;
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