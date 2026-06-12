import React, { useEffect, useRef } from "react";
import { AuthProvider } from "./AuthContext.jsx";
import { TenantProvider } from "./TenantContext.jsx";
import { CampaignProvider } from "./CampaignContext.jsx";
import { ModeProvider } from "./ModeContext.jsx";
import { useAuth } from "./AuthContext.jsx";
import { useTenant } from "./TenantContext.jsx";
import { useCampaign } from "./CampaignContext.jsx";
import { acceptPendingApiInvitations } from "../data/api/apiClient";

function InvitationAcceptanceBridge({ children }) {
  const { user } = useAuth();
  const { refreshTenants } = useTenant();
  const { refreshCampaigns } = useCampaign();
  const processedKeyRef = useRef(null);

  useEffect(() => {
    let isCancelled = false;

    async function run() {
      if (!user?.uid || !user?.email) {
        processedKeyRef.current = null;
        return;
      }

      const processingKey = `${user.uid}:${user.email.toLowerCase()}`;

      if (processedKeyRef.current === processingKey) {
        return;
      }

      processedKeyRef.current = processingKey;

      try {
        const { acceptedInvitations } = await acceptPendingApiInvitations();

        if (isCancelled || acceptedInvitations.length === 0) {
          return;
        }

        await refreshTenants();
        await refreshCampaigns();
      } catch (error) {
        console.error(
          "[InvitationAcceptanceBridge] Failed to accept pending invitations",
          error
        );
        processedKeyRef.current = null;
      }
    }

    run();

    return () => {
      isCancelled = true;
    };
  }, [user, refreshTenants, refreshCampaigns]);

  return children;
}

export default function AppProviders({ children }) {
  return (
    <AuthProvider>
      <TenantProvider>
        <CampaignProvider>
          <InvitationAcceptanceBridge>
            <ModeProvider>{children}</ModeProvider>
          </InvitationAcceptanceBridge>
        </CampaignProvider>
      </TenantProvider>
    </AuthProvider>
  );
}
