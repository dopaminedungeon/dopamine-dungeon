import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext.jsx";

const TenantContext = createContext(null);

const STORAGE_KEY = "dd_activeTenantId";

// Mocked tenant memberships for local dev (2 tenants scenario)
const MOCK_TENANTS = [
  {
    tenantId: "t-magdas-tables",
    name: "Magda’s Tables",
    tenantPermissionLevel: "WorkspaceAdmin",
  },
  {
    tenantId: "t-chaos-inc",
    name: "Chaos Inc.",
    tenantPermissionLevel: "WorkspaceMember",
  },
];

function readStoredTenantId() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredTenantId(tenantId) {
  try {
    if (tenantId) localStorage.setItem(STORAGE_KEY, tenantId);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function TenantProvider({ children }) {
  const { authStatus, user } = useAuth();

  const [tenantStatus, setTenantStatus] = useState("loading");
  const [tenants, setTenants] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState(() => readStoredTenantId());

  useEffect(() => {
    const isAuthed = authStatus === "authed" && Boolean(user);
    if (!isAuthed) {
      setTenantStatus("loading");
      setTenants([]);
      return;
    }

    const available = [...MOCK_TENANTS];
    setTenants(available);

    if (available.length === 0) {
      setSelectedTenantId(null);
      writeStoredTenantId(null);
      setTenantStatus("none");
      return;
    }

    // keep stored tenant if valid
    const stored = readStoredTenantId();
    const preferred = selectedTenantId ?? stored;
    const exists = preferred && available.some((t) => t.tenantId === preferred);

    if (exists) {
      setSelectedTenantId(preferred);
      writeStoredTenantId(preferred);
      setTenantStatus("ready");
      return;
    }

    // auto-select if only one
    if (available.length === 1) {
      const only = available[0].tenantId;
      setSelectedTenantId(only);
      writeStoredTenantId(only);
      setTenantStatus("ready");
      return;
    }

    // multiple: require explicit selection
    setSelectedTenantId(null);
    writeStoredTenantId(null);
    setTenantStatus("none");
  }, [authStatus, user]);

  const selectedTenant = useMemo(() => {
    return tenants.find((t) => t.tenantId === selectedTenantId) ?? null;
  }, [tenants, selectedTenantId]);

  function selectTenant(tenantId) {
    const next = tenantId || null;
    setSelectedTenantId(next);
    writeStoredTenantId(next);
    setTenantStatus(next ? "ready" : "none");
  }

  const value = useMemo(
    () => ({
      tenantStatus,
      tenants,
      selectedTenantId,
      selectedTenant,
      selectTenant,

      // aliases for older code
      accessibleTenants: tenants,
      activeTenantId: selectedTenantId,
      setActiveTenantId: selectTenant,
    }),
    [tenantStatus, tenants, selectedTenantId, selectedTenant]
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
}