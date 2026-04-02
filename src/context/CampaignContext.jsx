import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useTenant } from "./TenantContext";

const CampaignContext = createContext(null);
const CAMPAIGN_STORAGE_KEY = "dd_selectedCampaignId";

export function CampaignProvider({ children }) {
  const { selectedTenantId, tenantStatus } = useTenant();
  const [campaignStatus, setCampaignStatus] = useState("loading");
  const [accessibleCampaigns, setAccessibleCampaigns] = useState([]);
  const [campaignRole, setCampaignRole] = useState(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState(() => {
    try {
      return localStorage.getItem(CAMPAIGN_STORAGE_KEY) || null;
    } catch {
      return null;
    }
  });

  const loadCampaigns = useCallback(async () => {
    if (!selectedTenantId) {
      setAccessibleCampaigns([]);
      setSelectedCampaignId(null);
      setCampaignRole(null);
      setCampaignStatus("unknown");
      return;
    }

    setCampaignStatus("loading");

    try {
      const q = query(
        collection(db, "campaigns"),
        where("tenantId", "==", selectedTenantId)
      );

      const snap = await getDocs(q);

      if (snap.empty) {
        setAccessibleCampaigns([]);
        setSelectedCampaignId(null);
        setCampaignRole(null);
        setCampaignStatus("empty");
        return;
      }

      const campaigns = snap.docs.map((d) => ({
        campaignId: d.id,
        ...d.data(),
      }));

      setAccessibleCampaigns(campaigns);

      const validSelected = campaigns.find(
        (c) => c.campaignId === selectedCampaignId
      );

      const nextCampaignId = validSelected
        ? validSelected.campaignId
        : campaigns[0].campaignId;

      setSelectedCampaignId(nextCampaignId);

      try {
        localStorage.setItem(CAMPAIGN_STORAGE_KEY, nextCampaignId);
      } catch {
        // ignore storage failures
      }

      // Temporary until campaign membership records are introduced in this sprint.
      setCampaignRole("owner");
      setCampaignStatus("ready");
    } catch (error) {
      console.error("[CampaignContext] Failed to load campaigns", error);
      setAccessibleCampaigns([]);
      setCampaignRole(null);
      setCampaignStatus("error");
    }
  }, [selectedTenantId, selectedCampaignId, tenantStatus]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);


  const selectCampaign = (campaignId) => {
    setSelectedCampaignId(campaignId);
    try {
      if (campaignId) localStorage.setItem(CAMPAIGN_STORAGE_KEY, campaignId);
      else localStorage.removeItem(CAMPAIGN_STORAGE_KEY);
    } catch {
      // ignore storage failures
    }
  };

  return (
    <CampaignContext.Provider
      value={{
        campaigns: accessibleCampaigns,
        accessibleCampaigns,
        campaignStatus,
        selectedCampaignId,
        selectCampaign,
        refreshCampaigns: loadCampaigns,
        campaignRole,
      }}
    >
      {children}
    </CampaignContext.Provider>
  );
}

export const useCampaign = () => useContext(CampaignContext);