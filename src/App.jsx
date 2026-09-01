// src/App.jsx
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link,
  useNavigate,
} from "react-router-dom";
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
import PCs from "./pages/PCs";
import PCProfile from "./pages/PCProfile";
import BagOfHolding from "./pages/BagOfHolding";
import CampaignSettings from "./pages/CampaignSettings.jsx";
import BootstrapWorkspace from "./pages/BootstrapWorkspace.jsx";
import BootstrapCampaign from "./pages/BootstrapCampaign.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { useTenant } from "./context/TenantContext.jsx";
import { useCampaign } from "./context/CampaignContext.jsx";
import AppProviders, { useAccessResolution } from "./context/AppProviders.jsx";
import { features } from "./config/features";
import React, { useEffect } from "react";
import Welcome from "./pages/Welcome";
import AuthScreen from "./components/auth/AuthScreen.jsx";
import VerificationScreen from "./components/auth/VerificationScreen.jsx";
import VerificationActionScreen from "./components/auth/VerificationActionScreen.jsx";
import PasswordRecoveryRequestScreen from "./components/auth/PasswordRecoveryRequestScreen.jsx";
import PasswordResetActionScreen from "./components/auth/PasswordResetActionScreen.jsx";
import PublicSiteShell, {
  PublicComingSoonPage,
  PublicFeatures,
  PublicHome,
  PublicSocialsPage,
} from "./layouts/PublicSiteShell.jsx";

function App() {
  if (window.location.pathname === "/auth/recover") {
    return <PasswordRecoveryRequestScreen />;
  }

  if (window.location.pathname === "/auth/reset-password") {
    return <PasswordResetActionScreen />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicSiteShell />}>
          <Route index element={<PublicEntryRoute />} />
          <Route path="/about" element={<PublicComingSoonPage title="About Us" />} />
          <Route path="/features" element={<PublicFeatures />} />
          <Route path="/pricing" element={<PublicComingSoonPage title="Pricing" />} />
          <Route path="/resources" element={<PublicComingSoonPage title="Resources" />} />
          <Route path="/socials" element={<PublicSocialsPage />} />
        </Route>
        <Route path="/login" element={<PublicAuthEntry initialView="choices" />} />
        <Route path="/get-started" element={<PublicAuthEntry initialView="register" />} />
        <Route path="*" element={<ApplicationBoundary />} />
      </Routes>
    </BrowserRouter>
  );
}

function PublicEntryRoute() {
  const invited = new URLSearchParams(window.location.search).get("invited") === "true";

  return invited ? (
    <Navigate to="/welcome?invited=true" replace />
  ) : (
    <PublicHome />
  );
}

function PublicAuthEntry({ initialView }) {
  const navigate = useNavigate();
  const {
    authStatus,
    user,
    verificationUser,
    profileInitializationFailed,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
  } = useAuth();

  useEffect(() => {
    if (user || verificationUser || profileInitializationFailed) {
      navigate("/home", { replace: true });
    }
  }, [navigate, profileInitializationFailed, user, verificationUser]);

  if (authStatus === "loading") {
    return <LoadingScreen label="Loading…" />;
  }

  return (
    <div className="relative min-h-screen bg-zinc-950">
      <AuthScreen
        onGoogle={signInWithGoogle}
        onEmailSignIn={signInWithEmail}
        onEmailRegistration={registerWithEmail}
        initialView={initialView}
      />
      <BackToPublicLink />
    </div>
  );
}

function ApplicationBoundary() {
  return (
    <AppProviders>
      <AppGate />
    </AppProviders>
  );
}

function AppGate() {
  const {
    authStatus,
    user,
    verificationUser,
    profileInitializationFailed,
    verificationEmailSentAt,
    verificationEmailAutoError,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    resendVerification,
    checkEmailVerification,
    continueVerifiedSession,
    retryProfileInitialization,
    logout,
  } = useAuth();
  const tenantContext = useTenant();
  const campaignContext = useCampaign();
  const { accessResolutionStatus, retryAccessResolution } = useAccessResolution();

  if (window.location.pathname === "/auth/verify-email") {
    return (
      <VerificationActionScreen
        accessResolutionStatus={accessResolutionStatus}
        onContinueVerifiedSession={continueVerifiedSession}
        onRetryAccessResolution={retryAccessResolution}
        onSignOut={logout}
      />
    );
  }

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
        verificationEmailSentAt={verificationEmailSentAt}
        initialError={verificationEmailAutoError}
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
      <div className="relative min-h-screen bg-zinc-950">
        <AuthScreen
          onGoogle={signInWithGoogle}
          onEmailSignIn={signInWithEmail}
          onEmailRegistration={registerWithEmail}
        />
        <BackToPublicLink />
      </div>
    );
  }

  if (tenantStatus === "loading" || tenantStatus === "unknown") {
    return <LoadingScreen label="Loading workspaces…" />;
  }

  if (tenantStatus === "error") {
    return <IdentityProvisioningErrorScreen onRetry={refreshTenants} onLogout={logout} />;
  }

  if (accessResolutionStatus === "error") {
    return (
      <IdentityProvisioningErrorScreen
        onRetry={retryAccessResolution}
        onLogout={logout}
      />
    );
  }

  if (
    accessResolutionStatus === "resolving" ||
    accessResolutionStatus === "refreshingMemberships"
  ) {
    return <LoadingScreen label="Loading access…" />;
  }

  if (tenantStatus === "empty") {
    return <BootstrapWorkspace onLogout={logout} />;
  }

  const hasTenant = tenantStatus === "ready";

  if (!hasTenant) {
    return <TenantPickerScreen />;
  }

  if (campaignStatus === "loading" || campaignStatus === "unknown") {
    return <LoadingScreen label="Loading campaigns…" />;
  }

  if (campaignStatus === "empty") {
    return <BootstrapCampaign onLogout={logout} />;
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

        <Route path="/settings/profile" element={<Settings />} />
        <Route path="/campaigns/settings" element={<CampaignSettings />} />

        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<NotFoundScreen />} />
      </Route>
    </Routes>
  );
}

function BackToPublicLink() {
  return (
    <Link
      to="/"
      className="fixed left-6 top-6 z-[100] inline-flex min-h-11 items-center rounded-md border border-zinc-700 bg-zinc-900/80 px-4 text-sm font-semibold text-zinc-200 shadow-sm transition hover:border-zinc-500 hover:bg-zinc-800 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300"
      data-testid="back-to-public"
    >
      Back to public site
    </Link>
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
    </div>
  );
}

function IdentityProvisioningErrorScreen({ onRetry, onLogout }) {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontSize: 18, fontWeight: 600 }}>Account setup unavailable</div>
      <div style={{ opacity: 0.7, marginTop: 8 }}>
        We could not finish setting up your account. Try again before continuing.
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <button type="button" onClick={onRetry}>
          Try again
        </button>
        {onLogout && (
          <button type="button" onClick={onLogout}>
            Use a different account
          </button>
        )}
      </div>
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
