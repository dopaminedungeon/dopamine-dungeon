export const GOOGLE_PROVIDER_ID = "google.com";
export const PASSWORD_PROVIDER_ID = "password";
const CREDENTIAL_MIGRATION_STORAGE_KEY = "dd_credentialMigrationContinuity";

export function getConnectedProviderIds(user) {
  return Array.from(
    new Set(
      (user?.providerData || [])
        .map((provider) => provider?.providerId)
        .filter((providerId) => typeof providerId === "string" && providerId)
    )
  );
}

export function hasConnectedProvider(user, providerId) {
  return getConnectedProviderIds(user).includes(providerId);
}

export function requiresCredentialMigration(user) {
  if (!user?.emailVerified) return false;

  const providerIds = getConnectedProviderIds(user);
  return (
    providerIds.includes(GOOGLE_PROVIDER_ID) &&
    !providerIds.includes(PASSWORD_PROVIDER_ID)
  );
}

export function getConnectedProviderLabel(providerId) {
  if (providerId === GOOGLE_PROVIDER_ID) return "Google";
  if (providerId === PASSWORD_PROVIDER_ID) return "Email / Password";
  if (providerId === "emailLink") return "Email Link";
  return providerId || "Unknown";
}

export function classifyCredentialMigrationError(error) {
  const code = typeof error?.code === "string" ? error.code : "";

  if (code === "auth/requires-recent-login") return "reauthentication-required";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
    return "reauthentication-cancelled";
  }
  if (
    code === "auth/credential-already-in-use" ||
    code === "auth/email-already-in-use" ||
    code === "auth/account-exists-with-different-credential"
  ) {
    return "identity-conflict";
  }
  if (code === "auth/provider-already-linked") return "already-linked";
  return "retryable";
}

export function readPendingCredentialMigration(firebaseUid) {
  try {
    const value = JSON.parse(
      window.sessionStorage.getItem(CREDENTIAL_MIGRATION_STORAGE_KEY) || "null"
    );
    if (
      value?.firebaseUid === firebaseUid &&
      typeof value?.neonUserId === "string" &&
      value.neonUserId
    ) {
      return value;
    }
  } catch {
    // A missing session store falls back to the current in-memory migration latch.
  }
  return null;
}

export function storePendingCredentialMigration(firebaseUid, neonUserId) {
  try {
    window.sessionStorage.setItem(
      CREDENTIAL_MIGRATION_STORAGE_KEY,
      JSON.stringify({ firebaseUid, neonUserId })
    );
  } catch {
    // A missing session store falls back to the current in-memory migration latch.
  }
}

export function clearPendingCredentialMigration() {
  try {
    window.sessionStorage.removeItem(CREDENTIAL_MIGRATION_STORAGE_KEY);
  } catch {
    // Nothing else needs clearing when session storage is unavailable.
  }
}
