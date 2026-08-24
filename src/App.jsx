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
import Welcome from "./pages/Welcome";
import AuthScreen from "./components/auth/AuthScreen.jsx";
import VerificationScreen from "./components/auth/VerificationScreen.jsx";

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
  const {
    authStatus,
    user,
    verificationUser,
    profileInitializationFailed,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    resendVerification,
    checkEmailVerification,
    retryProfileInitialization,
    logout,
  } = useAuth();
  const tenantContext = useTenant();
  const campaignContext = useCampaign();

  if (!tenantContext || !campaignContext) {
    return <LoadingScreen label="Loading…" />;
  }

  const { tenantStatus, refreshTenants } = tenantContext;
  const { campaignStatus } = campaignContext;

  if (authStatus === "loading") return <LoadingScreen label="Loading…" />;

  if (verificationUser) {
    return (
      <VerificationScreen
        email={verificationUser.email ?? "your email address"}
        onCheckVerification={checkEmailVerification}
        onResendVerification={resendVerification}
        onLogout={logout}
      />
    );
  }

  if (profileInitializationFailed) {
    return (
      <ProfileInitializationErrorScreen
        onRetry={retryProfileInitialization}
        onLogout={logout}
      />
    );
  }

  if (!user) {
    return (
      <AuthScreen
        onGoogle={signInWithGoogle}
        onEmailSignIn={signInWithEmail}
        onEmailRegistration={registerWithEmail}
      />
    );
  }

  if (tenantStatus === "loading" || tenantStatus === "unknown") {
    return <LoadingScreen label="Loading workspaces…" />;
  }

  if (tenantStatus === "error") {
    return <IdentityProvisioningErrorScreen onRetry={refreshTenants} />;
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
        <Route index element={<RootRedirect />} />
        <Route path="/welcome" element={<Welcome />} />

        {features.dashboard && <Route path="/home" element={<Dashboard />} />}

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

        {features.conditions && (
          <>
            <Route path="/conditions" element={<Conditions />} />
            <Route path="/conditions/:id" element={<ConditionProfile />} />
          </>
        )}

        <Route path="/settings/profile" element={<Settings />} />
        <Route path="/campaigns/settings" element={<CampaignSettings />} />

        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<NotFoundScreen />} />
      </Route>
    </Routes>
  );
}

function RootRedirect() {
  const params = new URLSearchParams(window.location.search);
  const invited = params.get("invited") === "true";
  const homePath = features.dashboard ? "/home" : "/sessions";

  return <Navigate to={invited ? "/welcome" : homePath} replace />;
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

function IdentityProvisioningErrorScreen({ onRetry }) {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontSize: 18, fontWeight: 600 }}>Account setup unavailable</div>
      <div style={{ opacity: 0.7, marginTop: 8 }}>
        We could not finish setting up your account. Try again before continuing.
      </div>
      <button type="button" onClick={onRetry} style={{ marginTop: 16 }}>
        Try again
      </button>
    </div>
  );
}

function ProfileInitializationErrorScreen({ onRetry, onLogout }) {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontSize: 18, fontWeight: 600 }}>Account profile unavailable</div>
      <div style={{ opacity: 0.7, marginTop: 8 }}>
        We could not initialize your account profile. Try again before continuing.
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <button type="button" onClick={onRetry}>
          Try again
        </button>
        <button type="button" onClick={onLogout}>
          Use a different account
        </button>
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
