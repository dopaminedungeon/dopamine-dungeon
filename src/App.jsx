// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./layouts/AppLayout.jsx";
import Dashboard from "./pages/DopamineDungeonDashboard.jsx";
import Npcs from "./pages/Npcs";
import NpcProfile from "./pages/NpcProfile";
import Items from "./pages/Items";
import ItemProfile from "./pages/ItemProfile";
import Sessions from "./pages/Sessions";
import SessionProfile from "./pages/SessionProfile";
import Maps from "./pages/Maps";
import MapProfile from "./pages/MapProfile";
import Settings from "./pages/Settings";
import Lore from "./pages/Lore";
import LoreProfile from "./pages/LoreProfile";
import Arcs from "./pages/Arcs";
import ArcProfile from "./pages/ArcProfile";
import Quests from "./pages/Quests.jsx";
import QuestProfile from "./pages/QuestProfile.jsx";
import Relationships from "./pages/Relationships";
import RelationshipProfile from "./pages/RelationshipProfile";
import Conditions from "./pages/Conditions";
import ConditionProfile from "./pages/ConditionProfile";
import PCs from "./pages/PCs";
import PCProfile from "./pages/PCProfile";
import BagOfHolding from "./pages/BagOfHolding";
import CampaignSettings from "./pages/CampaignSettings.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { useTenant } from "./context/TenantContext.jsx";
import { useCampaign } from "./context/CampaignContext.jsx";
import AppProviders from "./context/AppProviders.jsx";
import { features } from "./config/features";

function App() {
  return (
  <AppProviders>
    <BrowserRouter>
      <AppGate />
    </BrowserRouter>
  </AppProviders>
);
}

function AppGate() {
  const { authStatus, user } = useAuth();
  const { tenantStatus } = useTenant();
  const { campaignStatus } = useCampaign();

  if (authStatus === "loading") return <div>Loading auth...</div>;
  const isAuthed = true; // v0.1: no auth
  if (!isAuthed) return <div>Login (mocked)</div>;

  if (tenantStatus === "loading" || tenantStatus === "unknown") {
    return <LoadingScreen label="Loading workspaces…" />;
  }

  const hasTenant =
    tenantStatus === "selected" ||
    tenantStatus === "ready" ||
    tenantStatus === "resolved" ||
    tenantStatus === "ok";

  if (!hasTenant) {
    return <TenantPickerScreen />;
  }

  if (campaignStatus === "loading" || campaignStatus === "unknown") {
    return <LoadingScreen label="Loading campaigns…" />;
  }

  const hasCampaign =
    campaignStatus === "selected" ||
    campaignStatus === "ready" ||
    campaignStatus === "resolved" ||
    campaignStatus === "ok";

  if (!hasCampaign) {
    return <CampaignChooser />;
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        {features.dashboard && (
          <>
        <Route index element={<Dashboard />} />
        <Route path="/" element={<Navigate to="/" replace />} />
        </>
        )}

        {features.sessions && (
          <>
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/sessions/:id" element={<SessionProfile />} />
          </>
        )}

        {features.items && (
          <>
            <Route path="/items" element={<Items />} />
            <Route path="/items/:id" element={<ItemProfile />} />
          </>
        )}

        {features.pcs && (
          <>
            <Route path="/pcs" element={<PCs />} />
            <Route path="/pcs/bag" element={<BagOfHolding />} />
            <Route path="/pcs/:pcId" element={<PCProfile />} />
          </>
        )}

        {/* Future modules (kept for later toggles) */}
        {features.npcs && (
          <>
            <Route path="/npcs" element={<Npcs />} />
            <Route path="/npcs/:id" element={<NpcProfile />} />
          </>
        )}

        {features.maps && (
          <>
            <Route path="/maps" element={<Maps />} />
            <Route path="/maps/:id" element={<MapProfile />} />
          </>
        )}

        {features.lore && (
          <>
            <Route path="/lore" element={<Lore />} />
            <Route path="/lore/:id" element={<LoreProfile />} />
          </>
        )}

        {features.arcs && (
          <>
            <Route path="/arcs" element={<Arcs />} />
            <Route path="/arcs/:id" element={<ArcProfile />} />
          </>
        )}

        {features.quests && (
          <>
            <Route path="/quests" element={<Quests />} />
            <Route path="/quests/:id" element={<QuestProfile />} />
          </>
        )}

        {features.relationships && (
          <>
            <Route path="/relationships" element={<Relationships />} />
            <Route path="/relationships/:id" element={<RelationshipProfile />} />
          </>
        )}

        {features.conditions && (
          <>
            <Route path="/conditions" element={<Conditions />} />
            <Route path="/conditions/:id" element={<ConditionProfile />} />
          </>
        )}

        <Route path="/settings" element={<Settings />} />
        <Route path="/campaigns/settings" element={<CampaignSettings />} />

        <Route path="*" element={<NotFoundScreen />} />
      </Route>
    </Routes>
  );
}

function LoadingScreen({ label }) {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontSize: 18, fontWeight: 600 }}>{label}</div>
      <div style={{ opacity: 0.7, marginTop: 8 }}>
        (Temporary gate screen — we’ll replace this with proper pages + styling.)
      </div>
    </div>
  );
}

function LoginScreen({ debug }) {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontSize: 18, fontWeight: 600 }}>Login</div>
      <div style={{ opacity: 0.8, marginTop: 8, fontFamily: "monospace", fontSize: 12 }}>
        debug: authStatus={String(debug?.authStatus)} hasUser={String(debug?.hasUser)}
      </div>
      <div style={{ opacity: 0.7, marginTop: 8 }}>
        Auth is currently mocked. Once Firebase Auth is wired, this becomes a real login UI.
      </div>
    </div>
  );
}

function TenantPickerScreen() {
  const { tenants, selectTenant } = useTenant();

  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontSize: 18, fontWeight: 600 }}>Choose workspace</div>

      <div style={{ marginTop: 12, display: "grid", gap: 8, maxWidth: 420 }}>
        {tenants.map((t) => (
          <button
            key={t.tenantId}
            onClick={() => selectTenant(t.tenantId)}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #333",
              background: "#111",
              color: "#fff",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <div style={{ fontWeight: 600 }}>{t.name}</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>
              {t.tenantPermissionLevel} • {t.tenantId}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function CampaignChooser() {
  const { accessibleCampaigns, selectCampaign } = useCampaign();

  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontSize: 18, fontWeight: 600 }}>Choose campaign</div>
      <div style={{ opacity: 0.7, marginTop: 8 }}>
        Campaign is required before routes are accessible.
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 8, maxWidth: 420 }}>
        {(accessibleCampaigns ?? []).map((c) => (
          <button
            key={c.campaignId}
            onClick={() => selectCampaign(c.campaignId)}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #333",
              background: "#111",
              color: "#fff",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <div style={{ fontWeight: 600 }}>{c.name}</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>
              {c.campaignRole} • {c.campaignId}
            </div>
          </button>
        ))}

        {(accessibleCampaigns ?? []).length === 0 && (
          <div style={{ opacity: 0.7, marginTop: 8 }}>
            No campaigns available for this workspace (yet).
          </div>
        )}
      </div>
    </div>
  );
}

function NotFoundScreen() {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontSize: 18, fontWeight: 600 }}>Not Found</div>
      <div style={{ opacity: 0.7, marginTop: 8 }}>
        That page doesn’t exist (or you don’t have access yet). Use the sidebar or go back to the dashboard.
      </div>
    </div>
  );
}

export default App;