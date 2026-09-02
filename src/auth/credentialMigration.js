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

/**
 * Returns the credential capabilities reported by the authenticated Firebase
 * user. A missing provider snapshot is deliberately represented by null so
 * callers never render an inferred "not connected" state.
 */
export function getSignInMethodState(user) {
  if (!user?.uid || !Array.isArray(user.providerData)) return null;

  return {
    hasGoogle: hasConnectedProvider(user, GOOGLE_PROVIDER_ID),
    hasPassword: hasConnectedProvider(user, PASSWORD_PROVIDER_ID),
  };
}

export function isOptionalCredentialSetupCandidate(user) {
  if (!user?.emailVerified) return false;

  const providerIds = getConnectedProviderIds(user);
  return (
    providerIds.includes(GOOGLE_PROVIDER_ID) &&
    !providerIds.includes(PASSWORD_PROVIDER_ID)
  );
}

export function isOptionalGoogleLinkingCandidate(user) {
  if (!user?.emailVerified) return false;

  const providerIds = getConnectedProviderIds(user);
  return (
    providerIds.includes(PASSWORD_PROVIDER_ID) &&
    !providerIds.includes(GOOGLE_PROVIDER_ID)
  );
}

export function shouldShowOptionalCredentialSetup(user) {
  if (!user?.emailVerified || !hasConnectedProvider(user, GOOGLE_PROVIDER_ID)) {
    return false;
  }

  return (
    !hasConnectedProvider(user, PASSWORD_PROVIDER_ID) ||
    Boolean(readPendingCredentialMigration(user.uid))
  );
}

export function shouldShowOptionalGoogleLinking(user) {
  return isOptionalGoogleLinkingCandidate(user);
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

export function classifyGoogleLinkingError(error, { hasPendingCredential = false } = {}) {
  const code = typeof error?.code === "string" ? error.code : "";

  if (code === "auth/requires-recent-login") return "password-reauthentication-required";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
    return "cancelled";
  }
  if (code === "auth/account-exists-with-different-credential") {
    return hasPendingCredential ? "password-reauthentication-required" : "identity-conflict";
  }
  if (code === "auth/provider-already-linked") return "already-linked";
  if (
    code === "auth/credential-already-in-use" ||
    code === "auth/email-already-in-use" ||
    code === "auth/invalid-credential" ||
    code === "auth/user-mismatch"
  ) {
    return "identity-conflict";
  }
  if (code === "auth/wrong-password" || code === "auth/invalid-login-credentials") {
    return "password-reauthentication-failed";
  }
  return "retryable";
}

export function isIdentityContinuityResponseValid(
  result,
  originalFirebaseUid,
  expectedNeonUserId = ""
) {
  if (
    !result ||
    typeof result.neonUserId !== "string" ||
    !result.neonUserId ||
    !result.neonUserId.trim()
  ) {
    return false;
  }
  if (
    typeof result.firebaseUid === "string" &&
    result.firebaseUid !== originalFirebaseUid
  ) {
    return false;
  }
  return !expectedNeonUserId || result.neonUserId === expectedNeonUserId;
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

export function storePendingCredentialMigration(
  firebaseUid,
  neonUserId,
  verificationEmailRequestedAt = null,
  verificationEmailSentAt = null
) {
  try {
    window.sessionStorage.setItem(
      CREDENTIAL_MIGRATION_STORAGE_KEY,
      JSON.stringify({
        firebaseUid,
        neonUserId,
        ...(Number.isFinite(verificationEmailRequestedAt)
          ? { verificationEmailRequestedAt }
          : {}),
        ...(Number.isFinite(verificationEmailSentAt)
          ? { verificationEmailSentAt }
          : {}),
      })
    );
  } catch {
    // A missing session store falls back to the current in-memory migration latch.
  }
}

export function markPendingCredentialVerificationRequested(firebaseUid) {
  const pending = readPendingCredentialMigration(firebaseUid);
  if (!pending) return null;

  const verificationEmailRequestedAt = Date.now();
  storePendingCredentialMigration(
    pending.firebaseUid,
    pending.neonUserId,
    verificationEmailRequestedAt,
    pending.verificationEmailSentAt
  );
  return verificationEmailRequestedAt;
}

export function markPendingCredentialVerificationSent(firebaseUid) {
  const pending = readPendingCredentialMigration(firebaseUid);
  if (!pending) return null;

  const verificationEmailSentAt = Date.now();
  storePendingCredentialMigration(
    pending.firebaseUid,
    pending.neonUserId,
    pending.verificationEmailRequestedAt,
    verificationEmailSentAt
  );
  return verificationEmailSentAt;
}

export function clearPendingCredentialMigration() {
  try {
    window.sessionStorage.removeItem(CREDENTIAL_MIGRATION_STORAGE_KEY);
  } catch {
    // Nothing else needs clearing when session storage is unavailable.
  }
}
