import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { collection, query, where, getDocs, doc, setDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useTenant } from "./TenantContext";
import { useAuth } from "./AuthContext";
import { createCampaignMember } from "../data/campaignMembers/campaignMembers.repo";

const CampaignContext = createContext(null);
const CAMPAIGN_STORAGE_KEY = "dd_selectedCampaignId";

export function CampaignProvider({ children }) {
  const { selectedTenantId, tenantStatus } = useTenant();
  const { user } = useAuth();
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
    if (!user?.uid) {
      setAccessibleCampaigns([]);
      setSelectedCampaignId(null);
      setCampaignRole(null);
      setCampaignStatus("unknown");
      return;
    }
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

      // Fetch campaign memberships for this user (across tenants), filter in app
      const membershipsSnap = await getDocs(
        query(collection(db, "campaignMembers"), where("userId", "==", user.uid))
      );
      const memberships = membershipsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (snap.empty) {
        setAccessibleCampaigns([]);
        setSelectedCampaignId(null);
        setCampaignRole(null);
        setCampaignStatus("empty");
        return;
      }

      const campaigns = snap.docs.map((d) => {
        const data = d.data();
        const membership = memberships.find(
          (m) => m.campaignId === d.id && m.tenantId === selectedTenantId
        );

        return {
          campaignId: d.id,
          ...data,
          role: membership?.role ?? null,
        };
      });

      setAccessibleCampaigns(campaigns);

      const validSelected = campaigns.find(
        (c) => c.campaignId === selectedCampaignId
      );

      const nextCampaignId = validSelected
        ? validSelected.campaignId
        : campaigns[0].campaignId;

      setSelectedCampaignId(nextCampaignId);

      const selectedCampaign = campaigns.find((c) => c.campaignId === nextCampaignId) ?? null;
      setCampaignRole(selectedCampaign?.role ?? null);

      try {
        localStorage.setItem(CAMPAIGN_STORAGE_KEY, nextCampaignId);
      } catch {
        // ignore storage failures
      }

      setCampaignStatus("ready");
    } catch (error) {
      console.error("[CampaignContext] Failed to load campaigns", error);
      setAccessibleCampaigns([]);
      setCampaignRole(null);
      setCampaignStatus("error");
    }
  }, [selectedTenantId, selectedCampaignId, tenantStatus, user]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);


  const selectCampaign = (campaignId) => {
    setSelectedCampaignId(campaignId);
    const selected = accessibleCampaigns.find((c) => c.campaignId === campaignId) ?? null;
    setCampaignRole(selected?.role ?? null);
    try {
      if (campaignId) localStorage.setItem(CAMPAIGN_STORAGE_KEY, campaignId);
      else localStorage.removeItem(CAMPAIGN_STORAGE_KEY);
    } catch {
      // ignore storage failures
    }
  };

  const createCampaign = async ({ name, description = "", system = "" }) => {
    if (!user?.uid) {
      throw new Error("You must be signed in to create a campaign.");
    }

    if (!selectedTenantId) {
      throw new Error("Select a workspace first.");
    }

    const trimmedName = String(name || "").trim();
    const trimmedDescription = String(description ?? "").trim();
    const trimmedSystem = String(system ?? "").trim();

    if (!trimmedName) {
      throw new Error("Campaign name is required.");
    }

    const campaignId = crypto.randomUUID();
    const now = Date.now();

    const campaign = {
      id: campaignId,
      tenantId: selectedTenantId,
      name: trimmedName,
      description: trimmedDescription,
      system: trimmedSystem,
      status: "active",
      createdAt: now,
      createdBy: user.uid,
      updatedAt: now,
    };

    await setDoc(doc(db, "campaigns", campaignId), campaign);

    await createCampaignMember({
      id: `${campaignId}_${user.uid}`,
      campaignId,
      tenantId: selectedTenantId,
      userId: user.uid,
      role: "gm",
      characterId: null,
      createdAt: now,
      createdBy: user.uid,
    });

    await loadCampaigns();
    selectCampaign(campaignId);

    return {
      ...campaign,
      campaignId,
    };
  };

  return (
    <CampaignContext.Provider
      value={{
        campaigns: accessibleCampaigns,
        accessibleCampaigns,
        campaignStatus,
        selectedCampaignId,
        selectCampaign,
        createCampaign,
        refreshCampaigns: loadCampaigns,
        campaignRole,
      }}
    >
      {children}
    </CampaignContext.Provider>
  );
}

export const useCampaign = () => useContext(CampaignContext);