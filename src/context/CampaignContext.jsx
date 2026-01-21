import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import { useTenant } from "./TenantContext.jsx";

const CampaignContext = createContext(null);

const STORAGE_KEY = "dd_activeCampaignId";

// Tenant-scoped storage helpers (fixes multitenancy bleed)
function storageKeyForTenant(tenantId) {
  return tenantId ? `${STORAGE_KEY}:${tenantId}` : STORAGE_KEY;
}

function readStoredCampaignId(tenantId) {
  try {
    return localStorage.getItem(storageKeyForTenant(tenantId));
  } catch {
    return null;
  }
}

function writeStoredCampaignId(tenantId, campaignId) {
  try {
    const key = storageKeyForTenant(tenantId);
    if (campaignId) localStorage.setItem(key, campaignId);
    else localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

const MOCK_CAMPAIGNS_BY_TENANT = {
  "t-magdas-tables": [
    {
      tenantId: "t-magdas-tables",
      campaignId: "varionath",
      name: "Chronicles of Varionath",
      campaignRole: "CampaignGM", // <- this is what unlocks GM pages
    },
    {
      tenantId: "t-magdas-tables",
      campaignId: "oneshot",
      name: "One-shot Playground",
      campaignRole: "CampaignPlayer",
    },
  ],
  "t-chaos-inc": [
    {
      tenantId: "t-chaos-inc",
      campaignId: "chaos-demo",
      name: "Chaos Demo",
      campaignRole: "CampaignPlayer",
    },
  ],
};

export function CampaignProvider({ children }) {
  const { authStatus, user } = useAuth();
  const { tenantStatus, selectedTenantId, activeTenantId: activeTenantIdAlias } = useTenant();

  const activeTenantId = selectedTenantId ?? activeTenantIdAlias ?? null;

  const [campaignStatus, setCampaignStatus] = useState("loading");
  const [accessibleCampaigns, setAccessibleCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState(() => readStoredCampaignId(activeTenantId));

  useEffect(() => {
    const isAuthed = authStatus === "authed" && Boolean(user);
    const tenantReady = tenantStatus === "ready" && Boolean(activeTenantId);

    if (!isAuthed || !tenantReady) {
      setCampaignStatus(tenantReady ? "loading" : "blocked");
      setAccessibleCampaigns([]);
      return;
    }

    const list = MOCK_CAMPAIGNS_BY_TENANT[activeTenantId] ?? [];
    setAccessibleCampaigns(list);

    if (list.length === 0) {
      setSelectedCampaignId(null);
      writeStoredCampaignId(activeTenantId, null);
      setCampaignStatus("none");
      return;
    }

    const stored = readStoredCampaignId(activeTenantId);
    const preferred = selectedCampaignId ?? stored;
    const exists = preferred && list.some((c) => c.campaignId === preferred);

    if (exists) {
      setSelectedCampaignId(preferred);
      writeStoredCampaignId(activeTenantId, preferred);
      setCampaignStatus("ready");
      return;
    }

    if (list.length === 1) {
      const only = list[0].campaignId;
      setSelectedCampaignId(only);
      writeStoredCampaignId(activeTenantId, only);
      setCampaignStatus("ready");
      return;
    }

    setSelectedCampaignId(null);
    writeStoredCampaignId(activeTenantId, null);
    setCampaignStatus("none");
  }, [authStatus, user, tenantStatus, activeTenantId, selectedCampaignId]);

  const selectedCampaign = useMemo(() => {
    return accessibleCampaigns.find((c) => c.campaignId === selectedCampaignId) ?? null;
  }, [accessibleCampaigns, selectedCampaignId]);

  const campaignRole = selectedCampaign?.campaignRole ?? null;

  function selectCampaign(campaignId) {
    const next = campaignId || null;
    setSelectedCampaignId(next);
    writeStoredCampaignId(activeTenantId, next);
    setCampaignStatus(next ? "ready" : "none");
  }

  const value = useMemo(
    () => ({
      campaignStatus,
      accessibleCampaigns,
      selectedCampaignId,
      selectedCampaign,
      campaignRole,
      selectCampaign,

      // allow local editing in settings (Firebase later)
      setCampaigns: setAccessibleCampaigns,

      // aliases so old pages / TopBar code still works
      campaigns: (accessibleCampaigns || []).map((c) => ({
        ...c,
        id: c.id ?? c.campaignId,
      })),
      activeCampaignId: selectedCampaignId,
      setActiveCampaignId: selectCampaign,
    }),
    [campaignStatus, accessibleCampaigns, selectedCampaignId, selectedCampaign, campaignRole, selectCampaign, setAccessibleCampaigns]
  );

  return <CampaignContext.Provider value={value}>{children}</CampaignContext.Provider>;
}

export function useCampaign() {
  const ctx = useContext(CampaignContext);
  if (!ctx) throw new Error("useCampaign must be used within CampaignProvider");
  return ctx;
}