import { createContext, useContext, useEffect, useState } from "react";
import { collection, query, where, onSnapshot, addDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useTenant } from "./TenantContext";

const CampaignContext = createContext(null);
const CAMPAIGN_STORAGE_KEY = "dd_selectedCampaignId";

export function CampaignProvider({ children }) {
  const { selectedTenantId } = useTenant();
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

  useEffect(() => {
    if (!selectedTenantId) {
      setAccessibleCampaigns([]);
      setSelectedCampaignId(null);
      setCampaignRole(null);
      setCampaignStatus("unknown");
      return;
    }

    setCampaignStatus("loading");

    const q = query(
      collection(db, "campaigns"),
      where("tenantId", "==", selectedTenantId)
    );

    const unsubscribe = onSnapshot(q, async (snap) => {
      if (snap.empty) {
        await createDefaultCampaign();
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

      // v0.2 bootstrap: logged-in user acts as campaign owner until per-campaign membership is added.
      setCampaignRole("owner");

      try {
        localStorage.setItem(CAMPAIGN_STORAGE_KEY, nextCampaignId);
      } catch {}

      setCampaignStatus("ready");
    }, (error) => {
      console.error("[CampaignContext] Failed to listen to campaigns", error);
      setCampaignRole(null);
      setCampaignStatus("error");
    });

    return () => unsubscribe();
  }, [selectedTenantId]);

  const createDefaultCampaign = async () => {
    await addDoc(collection(db, "campaigns"), {
      tenantId: selectedTenantId,
      name: "Chronicles of Varionath",
      createdAt: Date.now(),
    });
  };

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
        campaignRole,
      }}
    >
      {children}
    </CampaignContext.Provider>
  );
}

export const useCampaign = () => useContext(CampaignContext);