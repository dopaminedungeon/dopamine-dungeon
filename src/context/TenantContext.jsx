import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useAuth } from "./AuthContext";

const TenantContext = createContext(null);
const TENANT_STORAGE_KEY = "dd_selectedTenantId";

export function TenantProvider({ children }) {
  const { user } = useAuth();
  const [tenants, setTenants] = useState([]);
  const [tenantStatus, setTenantStatus] = useState("loading");
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
      return;
    }

    setTenantStatus("loading");

    try {
      const q = query(
        collection(db, "tenantMembers"),
        where("userId", "==", user.uid)
      );

      const snap = await getDocs(q);

      if (snap.empty) {
        setTenants([]);
        setSelectedTenantId(null);
        setTenantStatus("empty");
        return;
      }

      const tenantIds = snap.docs.map((d) => d.data().tenantId).filter(Boolean);

      const tenantDocs = await Promise.all(
        tenantIds.map((id) => getDoc(doc(db, "tenants", id)))
      );

      const loaded = tenantDocs
        .filter((d) => d.exists())
        .map((d) => ({
          tenantId: d.id,
          ...d.data(),
        }));

      setTenants(loaded);

      if (loaded.length === 0) {
        setSelectedTenantId(null);
        setTenantStatus("empty");
        return;
      }

      const validSelected = loaded.find((t) => t.tenantId === selectedTenantId);
      const nextTenantId = validSelected ? validSelected.tenantId : loaded[0].tenantId;

      setSelectedTenantId(nextTenantId);
      try {
        localStorage.setItem(TENANT_STORAGE_KEY, nextTenantId);
      } catch {
        // ignore storage failures
      }

      setTenantStatus("ready");
    } catch (error) {
      console.error("[TenantContext] Failed to load tenants", error);
      setTenantStatus("error");
    }
  }, [user, selectedTenantId]);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  const selectTenant = (tenantId) => {
    setSelectedTenantId(tenantId);
    try {
      if (tenantId) localStorage.setItem(TENANT_STORAGE_KEY, tenantId);
      else localStorage.removeItem(TENANT_STORAGE_KEY);
    } catch {
      // ignore storage failures
    }
  };

  return (
    <TenantContext.Provider
      value={{
        tenants,
        tenantStatus,
        selectedTenantId,
        selectTenant,
        refreshTenants: loadTenants,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export const useTenant = () => useContext(TenantContext);