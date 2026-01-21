import React from "react";
import { AuthProvider } from "./AuthContext.jsx";
import { TenantProvider } from "./TenantContext.jsx";
import { CampaignProvider } from "./CampaignContext.jsx";
import { ModeProvider } from "./ModeContext.jsx";

export default function AppProviders({ children }) {
  return (
    <AuthProvider>
      <TenantProvider>
        <CampaignProvider>
          <ModeProvider>{children}</ModeProvider>
        </CampaignProvider>
      </TenantProvider>
    </AuthProvider>
  );
}