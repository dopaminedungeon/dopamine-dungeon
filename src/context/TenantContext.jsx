import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { getApiMe } from "../data/api/apiClient";
import { createTenant as createTenantRepo } from "../data/tenants/tenant.repo";
import { createTenantMember } from "../data/tenantMembers/tenantMembers.repo";

const TenantContext = createContext(null);
const TENANT_STORAGE_KEY = "dd_selectedTenantId";

function getWorkspaceAppId(workspace) {
  return workspace?.tenantId ?? workspace?.slug ?? null;
}

function readStoredTenantId() {
  try {
    return localStorage.getItem(TENANT_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

function writeStoredTenantId(tenantId) {
  try {
    if (tenantId) localStorage.setItem(TENANT_STORAGE_KEY, tenantId);
    else localStorage.removeItem(TENANT_STORAGE_KEY);
  } catch {
    // ignore storage failures
  }
}

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

  const findTenantByAnyId = useCallback(
    (tenantId) => {
      if (!tenantId) return null;

      return (
        tenants.find(
          (tenant) =>
            tenant.tenantId === tenantId ||
            tenant.id === tenantId ||
            tenant.postgresWorkspaceId === tenantId
        ) ?? null
      );
    },
    [tenants]
  );

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
      const apiMe = await getApiMe();

      const memberships = apiMe.workspaceMemberships ?? [];
      const workspaces = apiMe.workspaces ?? [];

      if (memberships.length === 0 || workspaces.length === 0) {
        setTenants([]);
        setSelectedTenantId(null);
        setTenantStatus("empty");
        setWorkspaceRole(null);
        writeStoredTenantId(null);
        return;
      }

      const loaded = workspaces.map((workspace) => {
        const membership = memberships.find(
          (m) => m.workspaceId === workspace.id
        );

        // Keep app state/localStorage on the legacy-safe slug, while retaining the PG UUID for joins.
        return {
          ...workspace,
          tenantId: getWorkspaceAppId(workspace),
          postgresWorkspaceId: workspace.id,
          role: membership?.role ?? null,
        };
      }).filter((workspace) => Boolean(workspace.tenantId));

      setTenants(loaded);

      if (loaded.length === 0) {
        setSelectedTenantId(null);
        setTenantStatus("empty");
        setWorkspaceRole(null);
        writeStoredTenantId(null);
        return;
      }

      const storedTenantId = readStoredTenantId();
      const preferredTenantId = storedTenantId;
      const validSelected = loaded.find(
        (tenant) =>
          tenant.tenantId === preferredTenantId ||
          tenant.postgresWorkspaceId === preferredTenantId
      );
      const nextTenantId = validSelected ? validSelected.tenantId : loaded[0].tenantId;
      const selectedTenant = loaded.find((t) => t.tenantId === nextTenantId) ?? null;

      setSelectedTenantId(nextTenantId);
      setWorkspaceRole(selectedTenant?.role ?? null);
      writeStoredTenantId(nextTenantId);

      setTenantStatus("ready");
    } catch (error) {
      console.error("[TenantContext] Failed to load tenants", error);
      setWorkspaceRole(null);
      setTenantStatus("error");
    }
  }, [user]);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  const selectTenant = (tenantId) => {
    const selectedTenant = findTenantByAnyId(tenantId);
    const normalizedTenantId = selectedTenant?.tenantId ?? tenantId ?? null;

    setSelectedTenantId(normalizedTenantId);
    setWorkspaceRole(selectedTenant?.role ?? null);
    writeStoredTenantId(normalizedTenantId);
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
