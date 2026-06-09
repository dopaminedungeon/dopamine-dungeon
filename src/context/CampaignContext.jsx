import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useTenant } from "./TenantContext";
import { useAuth } from "./AuthContext";
import { createCampaignMember } from "../data/campaignMembers/campaignMembers.repo";
import { getApiMe } from "../data/api/apiClient";

const CampaignContext = createContext(null);
const CAMPAIGN_STORAGE_KEY = "dd_selectedCampaignId";

function getCampaignAppId(campaign) {
  return campaign?.campaignId ?? campaign?.slug ?? null;
}

export function CampaignProvider({ children }) {
  const { selectedTenantId, tenantStatus, membershipVersion } = useTenant();
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

  const findCampaignByAnyId = useCallback(
    (campaignId) => {
      if (!campaignId) return null;

      return (
        accessibleCampaigns.find(
          (campaign) =>
            campaign.campaignId === campaignId ||
            campaign.id === campaignId ||
            campaign.postgresCampaignId === campaignId
        ) ?? null
      );
    },
    [accessibleCampaigns]
  );

  const loadCampaigns = useCallback(async () => {
    if (!user?.uid) {
      setAccessibleCampaigns([]);
      setSelectedCampaignId(null);
      setCampaignRole(null);
      setCampaignStatus("unknown");
      return;
    }

    if (tenantStatus !== "ready") {
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
      const apiMe = await getApiMe();

      const selectedWorkspace = (apiMe.workspaces ?? []).find(
        (workspace) => workspace.slug === selectedTenantId
      );

      if (!selectedWorkspace) {
        setAccessibleCampaigns([]);
        setSelectedCampaignId(null);
        setCampaignRole(null);
        setCampaignStatus("empty");
        try {
          localStorage.removeItem(CAMPAIGN_STORAGE_KEY);
        } catch {
          // ignore storage failures
        }
        return;
      }

      const memberships = apiMe.campaignMemberships ?? [];

      const campaigns = (apiMe.campaigns ?? [])
        .filter((campaign) => campaign.workspaceId === selectedWorkspace.id)
        .map((campaign) => {
          const membership = memberships.find(
            (m) => m.campaignId === campaign.id
          );

          // Keep app state/localStorage on the legacy-safe campaign slug, while retaining the PG UUID for joins.
          return {
            ...campaign,
            campaignId: getCampaignAppId(campaign),
            postgresCampaignId: campaign.id,
            tenantId: selectedWorkspace.slug,
            postgresWorkspaceId: selectedWorkspace.id,
            role: membership?.role ?? null,
          };
        })
        .filter((campaign) => Boolean(campaign.campaignId && campaign.role));

      if (campaigns.length === 0) {
        setAccessibleCampaigns([]);
        setSelectedCampaignId(null);
        setCampaignRole(null);
        setCampaignStatus("empty");
        try {
          localStorage.removeItem(CAMPAIGN_STORAGE_KEY);
        } catch {
          // ignore storage failures
        }
        return;
      }

      setAccessibleCampaigns(campaigns);

      const validSelected = campaigns.find(
        (campaign) =>
          campaign.campaignId === selectedCampaignId ||
          campaign.postgresCampaignId === selectedCampaignId
      );

      const nextCampaignId = validSelected
        ? validSelected.campaignId
        : campaigns[0].campaignId;

      const selectedCampaign =
        campaigns.find((campaign) => campaign.campaignId === nextCampaignId) ?? null;

      setSelectedCampaignId(nextCampaignId);
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
  }, [membershipVersion, selectedCampaignId, selectedTenantId, tenantStatus, user]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);


  const selectCampaign = (campaignId) => {
    const selected = findCampaignByAnyId(campaignId);
    const normalizedCampaignId = selected?.campaignId ?? campaignId ?? null;

    setSelectedCampaignId(normalizedCampaignId);
    setCampaignRole(selected?.role ?? null);

    try {
      if (normalizedCampaignId) localStorage.setItem(CAMPAIGN_STORAGE_KEY, normalizedCampaignId);
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
