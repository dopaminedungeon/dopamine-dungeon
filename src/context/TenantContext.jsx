import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useAuth } from "./AuthContext";
import { createTenant as createTenantRepo } from "../data/tenants/tenant.repo";
import { createTenantMember } from "../data/tenantMembers/tenantMembers.repo";

const TenantContext = createContext(null);
const TENANT_STORAGE_KEY = "dd_selectedTenantId";

export function TenantProvider({ children }) {
  const { user } = useAuth();
  const [tenants, setTenants] = useState([]);
  const [tenantStatus, setTenantStatus] = useState("loading");
  const [workspaceRole, setWorkspaceRole] = useState(null);
  const [selectedTenantId, setSelectedTenantId] = useState(() => {
    try {
      return localStorage.getItem(TENANT_STORAGE_KEY) || null;
    } catch {
      return null;
    }
  });

  const loadTenants = useCallback(async () => {
    if (!user) {
      setTenants([]);
      setSelectedTenantId(null);
      setTenantStatus("unknown");
      setWorkspaceRole(null);
      return;
    }

    setTenantStatus("loading");

    try {
      const q = query(
        collection(db, "tenantMembers"),
        where("userId", "==", user.uid)
      );

      const snap = await getDocs(q);
      const memberships = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (snap.empty) {
        setTenants([]);
        setSelectedTenantId(null);
        setTenantStatus("empty");
        setWorkspaceRole(null);
        return;
      }

      const tenantIds = snap.docs.map((d) => d.data().tenantId).filter(Boolean);

      const tenantDocs = await Promise.all(
        tenantIds.map((id) => getDoc(doc(db, "tenants", id)))
      );

      const loaded = tenantDocs
        .filter((d) => d.exists())
        .map((d) => {
          const membership = memberships.find((m) => m.tenantId === d.id);

          return {
            tenantId: d.id,
            ...d.data(),
            role: membership?.role ?? null,
          };
        });

      setTenants(loaded);

      if (loaded.length === 0) {
        setSelectedTenantId(null);
        setTenantStatus("empty");
        setWorkspaceRole(null);
        return;
      }

      const validSelected = loaded.find((t) => t.tenantId === selectedTenantId);
      const nextTenantId = validSelected ? validSelected.tenantId : loaded[0].tenantId;
      const selectedTenant = loaded.find((t) => t.tenantId === nextTenantId) ?? null;

      setSelectedTenantId(nextTenantId);
      setWorkspaceRole(selectedTenant?.role ?? null);
      try {
        localStorage.setItem(TENANT_STORAGE_KEY, nextTenantId);
      } catch {
        // ignore storage failures
      }

      setTenantStatus("ready");
    } catch (error) {
      console.error("[TenantContext] Failed to load tenants", error);
      setWorkspaceRole(null);
      setTenantStatus("error");
    }
  }, [user, selectedTenantId]);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  const selectTenant = (tenantId) => {
    setSelectedTenantId(tenantId);
    const selectedTenant = tenants.find((t) => t.tenantId === tenantId) ?? null;
    setWorkspaceRole(selectedTenant?.role ?? null);
    try {
      if (tenantId) localStorage.setItem(TENANT_STORAGE_KEY, tenantId);
      else localStorage.removeItem(TENANT_STORAGE_KEY);
    } catch {
      // ignore storage failures
    }
  };

  const createTenant = async ({ name, description = "" }) => {
    if (!user) {
      throw new Error("You must be signed in to create a workspace.");
    }

    const trimmedName = String(name || "").trim();
    const trimmedDescription = String(description || "").trim();

    if (!trimmedName) {
      throw new Error("Workspace name is required.");
    }

    const created = await createTenantRepo({
      name: trimmedName,
      description: trimmedDescription,
      createdBy: user.uid,
    });

    const tenantId = created?.tenantId || created?.id;
    if (!tenantId) {
      throw new Error("Workspace was created without an id.");
    }

    await createTenantMember({
      tenantId,
      userId: user.uid,
      role: "owner",
      email: user.email || "",
      displayName: user.displayName || user.email || "",
      createdAt: new Date().toISOString(),
      addedBy: user.uid,
    });

    await loadTenants();
    selectTenant(tenantId);

    return {
      ...created,
      tenantId,
    };
  };

  return (
    <TenantContext.Provider
      value={{
        tenants,
        tenantStatus,
        selectedTenantId,
        workspaceRole,
        selectTenant,
        createTenant,
        refreshTenants: loadTenants,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export const useTenant = () => useContext(TenantContext);