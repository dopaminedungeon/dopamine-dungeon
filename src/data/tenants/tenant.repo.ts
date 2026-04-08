import { collection, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import type { Tenant } from "../../domain/tenants/tenant.types";

const TENANTS_COLLECTION = "tenants";

export async function createTenant(tenant: Tenant): Promise<Tenant> {
  const tenantId = String(tenant?.id || doc(collection(db, TENANTS_COLLECTION)).id);

  const tenantToSave: Tenant = {
    ...tenant,
    id: tenantId,
  };

  await setDoc(doc(db, TENANTS_COLLECTION, tenantId), tenantToSave);
  return tenantToSave;
}

export async function getTenantById(tenantId: string): Promise<Tenant | null> {
  const snapshot = await getDoc(doc(db, TENANTS_COLLECTION, tenantId));

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...(snapshot.data() as Omit<Tenant, "id">),
  };
}