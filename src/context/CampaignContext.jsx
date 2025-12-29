import React, { createContext, useContext, useMemo, useState, useEffect } from "react";

const MOCK_CAMPAIGNS = [
  { id: "varionath", name: "Chronicles of Varionath", status: "active" },
  { id: "oneshot", name: "One-shot Playground", status: "paused" },
];

const CampaignContext = createContext(null);

export function CampaignProvider({ children }) {
  const [campaigns, setCampaigns] = useState(MOCK_CAMPAIGNS);

const [activeCampaignId, setActiveCampaignId] = useState(() => {
  try {
    return localStorage.getItem("dd_activeCampaignId") || null;
  } catch {
    return null;
  }
});

useEffect(() => {
  try {
    if (activeCampaignId) localStorage.setItem("dd_activeCampaignId", activeCampaignId);
    else localStorage.removeItem("dd_activeCampaignId");
  } catch {
    // ignore
  }
}, [activeCampaignId]);

useEffect(() => {
  if (activeCampaignId) return;
  if (!Array.isArray(campaigns) || campaigns.length === 0) return;

  setActiveCampaignId(campaigns[0].id);
}, [activeCampaignId, campaigns]);

  const activeCampaign = useMemo(
    () => campaigns.find((c) => c.id === activeCampaignId) ?? null,
    [campaigns, activeCampaignId]
  );

  const addCampaign = ({ name, status = "active" }) => {
    const id = crypto.randomUUID();

    const newCampaign = {
      id,
      name,
      status,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setCampaigns((prev) => [...prev, newCampaign]);
    setActiveCampaignId(id);
  };

  const value = useMemo(
    () => ({
      campaigns,
  setCampaigns,
  activeCampaignId,
  setActiveCampaignId,
  setActiveCampaign: setActiveCampaignId,
    }),
    [campaigns, activeCampaignId, activeCampaign]
  );

  return (
    <CampaignContext.Provider value={value}>
      {children}
    </CampaignContext.Provider>
  );
}

export function useCampaign() {
  const ctx = useContext(CampaignContext);
  if (!ctx) throw new Error("useCampaign must be used inside <CampaignProvider>");
  return ctx;
}