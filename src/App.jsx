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
import BootstrapWorkspace from "./pages/BootstrapWorkspace.jsx";
import BootstrapCampaign from "./pages/BootstrapCampaign.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { useTenant } from "./context/TenantContext.jsx";
import { useCampaign } from "./context/CampaignContext.jsx";
import AppProviders from "./context/AppProviders.jsx";
import { features } from "./config/features";
import React from "react";

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
  const { authStatus, user, signInWithGoogle } = useAuth();
  const { tenantStatus } = useTenant();
  const { campaignStatus } = useCampaign();

  if (authStatus === "loading") return <LoadingScreen label="Loading…" />;

  // v0.2: real auth (Firebase)
  if (!user) {
    return (
      <LoginScreen
        onGoogle={() => signInWithGoogle?.()}
        debug={{ authStatus, hasUser: false }}
      />
    );
  }

  if (tenantStatus === "loading" || tenantStatus === "unknown") {
    return <LoadingScreen label="Loading workspaces…" />;
  }

  if (tenantStatus === "empty") {
    return <BootstrapWorkspace />;
  }

  const hasTenant = tenantStatus === "ready";

  if (!hasTenant) {
    return <TenantPickerScreen />;
  }

  if (campaignStatus === "loading" || campaignStatus === "unknown") {
    return <LoadingScreen label="Loading campaigns…" />;
  }

  if (campaignStatus === "empty") {
    return <BootstrapCampaign />;
  }

  const hasCampaign = campaignStatus === "ready";

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

        <Route path="/settings/profile" element={<Settings />} />
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

function LoginScreen({ debug, onGoogle }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-black text-white">
      <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-6">
        <h1 className="text-2xl font-bold mb-2">Login</h1>
        <p className="text-zinc-400 text-sm mb-4">
          Sign in to access your campaign. Your data will sync across devices.
        </p>

        <div className="text-xs font-mono text-zinc-400 mb-4">
          debug: authStatus={String(debug?.authStatus)} hasUser={String(debug?.hasUser)}
        </div>

        <button
          onClick={onGoogle}
          disabled={!onGoogle}
          className="w-full px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-50"
          title={!onGoogle ? "signInWithGoogle not wired in AuthContext yet" : ""}
        >
          Continue with Google
        </button>

        {!onGoogle && (
          <div className="opacity-70 mt-2 text-xs font-mono">
            Missing: useAuth().signInWithGoogle
          </div>
        )}
      </div>
    </main>
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
              {t.role ?? "member"} • {t.tenantId}
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
              {c.role ?? "gm"} • {c.campaignId}
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