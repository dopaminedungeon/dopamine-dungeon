import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AuthProvider } from "./AuthContext.jsx";
import { TenantProvider } from "./TenantContext.jsx";
import { CampaignProvider } from "./CampaignContext.jsx";
import { ModeProvider } from "./ModeContext.jsx";
import { useAuth } from "./AuthContext.jsx";
import { useTenant } from "./TenantContext.jsx";
import { useCampaign } from "./CampaignContext.jsx";
import { acceptPendingApiInvitations } from "../data/api/apiClient";
import {
  clearInvitationContext,
  hasPendingInvitationContext,
} from "../auth/invitationContext";
import CredentialMigration from "../components/auth/CredentialMigration.jsx";

const AccessResolutionContext = createContext({
  accessResolutionStatus: "idle",
  retryAccessResolution: () => {},
});

const invitationResolutionRecords = new Map();
const INVITATION_RESOLUTION_STORAGE_PREFIX = "dd_invitationResolution:";

function CredentialMigrationBoundary({ children }) {
  const {
    authStatus,
    credentialMigrationUser,
    completeCredentialMigration,
    logout,
  } = useAuth();

  if (authStatus === "loading") {
    return (
      <main className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 text-zinc-300" role="status">
        Checking authentication…
      </main>
    );
  }

  if (credentialMigrationUser) {
    return (
      <CredentialMigration
        firebaseUser={credentialMigrationUser}
        onComplete={completeCredentialMigration}
        onLogout={logout}
        standalone
      />
    );
  }

  return children;
}

function hasStoredInvitationResolution(key) {
  try {
    return window.sessionStorage.getItem(`${INVITATION_RESOLUTION_STORAGE_PREFIX}${key}`) === "done";
  } catch {
    return false;
  }
}

function storeInvitationResolution(key) {
  try {
    window.sessionStorage.setItem(`${INVITATION_RESOLUTION_STORAGE_PREFIX}${key}`, "done");
  } catch {
    // Session storage can be unavailable; the in-memory guard still protects the current page.
  }
}

function clearStoredInvitationResolution(key) {
  try {
    window.sessionStorage.removeItem(`${INVITATION_RESOLUTION_STORAGE_PREFIX}${key}`);
  } catch {
    // Session storage can be unavailable; the in-memory record is cleared separately.
  }
}

function resolvePendingInvitationsOnce(key, run) {
  const existing = invitationResolutionRecords.get(key);

  if (existing) {
    return existing.promise;
  }

  const promise = run().catch((error) => {
    invitationResolutionRecords.delete(key);
    throw error;
  });

  invitationResolutionRecords.set(key, { promise });
  return promise;
}

function isSameAccessResolution(current, next) {
  return (
    current.status === next.status &&
    current.key === next.key &&
    current.acceptedInvitations === next.acceptedInvitations &&
    current.tenantRefreshStatus === next.tenantRefreshStatus
  );
}

function InvitationAcceptanceBridge({ children }) {
  const { user } = useAuth();
  const { refreshTenants, tenantStatus } = useTenant();
  const { campaignStatus } = useCampaign();
  const activeKeyRef = useRef(null);
  const [accessResolution, setAccessResolution] = useState({
    status: "idle",
    key: null,
    acceptedInvitations: 0,
    tenantRefreshStatus: null,
  });
  const [retryNonce, setRetryNonce] = useState(0);
  const updateAccessResolution = useCallback((next) => {
    setAccessResolution((current) =>
      isSameAccessResolution(current, next) ? current : next
    );
  }, []);

  const retryAccessResolution = () => {
    if (activeKeyRef.current) {
      invitationResolutionRecords.delete(activeKeyRef.current);
      clearStoredInvitationResolution(activeKeyRef.current);
    }

    setAccessResolution({
      status: "idle",
      key: null,
      acceptedInvitations: 0,
      tenantRefreshStatus: null,
    });
    setRetryNonce((value) => value + 1);
  };

  useEffect(() => {
    let isCancelled = false;

    async function run() {
      if (!user?.uid || !user?.email) {
        activeKeyRef.current = null;
        updateAccessResolution({
          status: "idle",
          key: null,
          acceptedInvitations: 0,
          tenantRefreshStatus: null,
        });
        return;
      }

      if (
        tenantStatus === "loading" ||
        tenantStatus === "unknown"
      ) {
        return;
      }

      const processingKey = user.uid;
      activeKeyRef.current = processingKey;
      const hasInvitationContinuation = hasPendingInvitationContext();

      const isCurrentResolutionInProgress =
        accessResolution.key === processingKey &&
        (accessResolution.status === "resolving" ||
          accessResolution.status === "refreshingMemberships");

      if (tenantStatus === "error") {
        updateAccessResolution({
          status: "error",
          key: processingKey,
          acceptedInvitations: 0,
          tenantRefreshStatus: null,
        });
        return;
      }

      if (
        accessResolution.key === processingKey &&
        accessResolution.status === "refreshingMemberships"
      ) {
        if (tenantStatus !== "ready") {
          updateAccessResolution({
            status: "error",
            key: processingKey,
            acceptedInvitations: accessResolution.acceptedInvitations,
            tenantRefreshStatus: accessResolution.tenantRefreshStatus,
          });
          return;
        }

        if (campaignStatus === "loading" || campaignStatus === "unknown") {
          return;
        }

        if (campaignStatus !== "ready") {
          updateAccessResolution({
            status: "error",
            key: processingKey,
            acceptedInvitations: accessResolution.acceptedInvitations,
            tenantRefreshStatus: accessResolution.tenantRefreshStatus,
          });
          return;
        }

        clearInvitationContext();
        storeInvitationResolution(processingKey);
        invitationResolutionRecords.delete(processingKey);
        updateAccessResolution({
          status: "resolved",
          key: processingKey,
          acceptedInvitations: accessResolution.acceptedInvitations,
          tenantRefreshStatus: accessResolution.tenantRefreshStatus,
        });
        return;
      }

      if (
        hasStoredInvitationResolution(processingKey) &&
        !isCurrentResolutionInProgress &&
        !hasInvitationContinuation
      ) {
        updateAccessResolution({
          status: "resolved",
          key: processingKey,
          acceptedInvitations: 0,
          tenantRefreshStatus: null,
        });
        return;
      }

      if (
        accessResolution.key === processingKey &&
        accessResolution.status === "resolved"
      ) {
        return;
      }

      if (
        accessResolution.key === processingKey &&
        accessResolution.status === "error"
      ) {
        return;
      }

      updateAccessResolution({
        status: "resolving",
        key: processingKey,
        acceptedInvitations: 0,
        tenantRefreshStatus: null,
      });

      try {
        const { acceptedInvitations } =
          await resolvePendingInvitationsOnce(processingKey, async () => {
            const result = await acceptPendingApiInvitations();

            if (
              result.acceptedInvitations.length > 0 ||
              hasInvitationContinuation
            ) {
              await refreshTenants();
            }

            return result;
          });

        if (isCancelled) {
          return;
        }

        if (acceptedInvitations.length > 0 || hasInvitationContinuation) {
          updateAccessResolution({
            status: "refreshingMemberships",
            key: processingKey,
            acceptedInvitations: acceptedInvitations.length,
            tenantRefreshStatus: null,
          });
          return;
        }

        storeInvitationResolution(processingKey);
        invitationResolutionRecords.delete(processingKey);
        updateAccessResolution({
          status: "resolved",
          key: processingKey,
          acceptedInvitations: 0,
          tenantRefreshStatus: null,
        });
      } catch (error) {
        console.error(
          "[InvitationAcceptanceBridge] Failed to accept pending invitations",
          error
        );
        updateAccessResolution({
          status: "error",
          key: processingKey,
          acceptedInvitations: 0,
          tenantRefreshStatus: null,
        });
      }
    }

    run();

    return () => {
      isCancelled = true;
    };
  }, [
    user,
    tenantStatus,
    campaignStatus,
    refreshTenants,
    updateAccessResolution,
    accessResolution,
    retryNonce,
  ]);

  return (
    <AccessResolutionContext.Provider
      value={{
        accessResolutionStatus:
          user?.uid &&
          tenantStatus === "empty" &&
          accessResolution.status === "idle"
            ? "resolving"
            : accessResolution.status,
        retryAccessResolution,
      }}
    >
      {children}
    </AccessResolutionContext.Provider>
  );
}

export default function AppProviders({ children }) {
  return (
    <AuthProvider>
      <CredentialMigrationBoundary>
        <TenantProvider>
          <CampaignProvider>
            <InvitationAcceptanceBridge>
              <ModeProvider>{children}</ModeProvider>
            </InvitationAcceptanceBridge>
          </CampaignProvider>
        </TenantProvider>
      </CredentialMigrationBoundary>
    </AuthProvider>
  );
}

// The provider and hook intentionally share this module as the access-gate API.
// eslint-disable-next-line react-refresh/only-export-components
export const useAccessResolution = () => useContext(AccessResolutionContext);
