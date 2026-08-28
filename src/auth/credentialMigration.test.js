import assert from "node:assert/strict";
import { afterEach, test, vi } from "vitest";

import {
  classifyCredentialMigrationError,
  classifyGoogleLinkingError,
  getConnectedProviderIds,
  getConnectedProviderLabel,
  clearPendingCredentialMigration,
  isIdentityContinuityResponseValid,
  isOptionalGoogleLinkingCandidate,
  isOptionalCredentialSetupCandidate,
  markPendingCredentialVerificationRequested,
  readPendingCredentialMigration,
  shouldShowOptionalGoogleLinking,
  shouldShowOptionalCredentialSetup,
  storePendingCredentialMigration,
} from "./credentialMigration";

afterEach(() => {
  vi.unstubAllGlobals();
});

function user(providerIds, overrides = {}) {
  return {
    uid: "firebase-uid",
    emailVerified: true,
    providerData: providerIds.map((providerId) => ({ providerId })),
    ...overrides,
  };
}

test("optional credential setup candidacy inspects the complete provider list", () => {
  assert.equal(isOptionalCredentialSetupCandidate(user(["google.com"])), true);
  assert.equal(isOptionalCredentialSetupCandidate(user(["google.com", "password"])), false);
  assert.equal(isOptionalCredentialSetupCandidate(user(["password", "google.com"])), false);
  assert.equal(isOptionalCredentialSetupCandidate(user(["password"])), false);
  assert.equal(isOptionalCredentialSetupCandidate(user(["github.com"])), false);
  assert.equal(
    isOptionalCredentialSetupCandidate(user(["google.com"], { emailVerified: false })),
    false
  );
  assert.equal(isOptionalCredentialSetupCandidate(null), false);
});

test("optional Google linking candidacy is only for verified password accounts without Google", () => {
  assert.equal(isOptionalGoogleLinkingCandidate(user(["password"])), true);
  assert.equal(isOptionalGoogleLinkingCandidate(user(["password", "google.com"])), false);
  assert.equal(isOptionalGoogleLinkingCandidate(user(["google.com", "password"])), false);
  assert.equal(isOptionalGoogleLinkingCandidate(user(["google.com"])), false);
  assert.equal(isOptionalGoogleLinkingCandidate(user(["github.com"])), false);
  assert.equal(
    isOptionalGoogleLinkingCandidate(user(["password"], { emailVerified: false })),
    false
  );
  assert.equal(isOptionalGoogleLinkingCandidate(null), false);
  assert.equal(shouldShowOptionalGoogleLinking(user(["password"])), true);
  assert.equal(shouldShowOptionalGoogleLinking(user(["password", "google.com"])), false);
});

test("connected provider display de-duplicates and labels every provider", () => {
  const connected = getConnectedProviderIds(
    user(["google.com", "password", "google.com"])
  );
  assert.deepEqual(connected, ["google.com", "password"]);
  assert.deepEqual(connected.map(getConnectedProviderLabel), [
    "Google",
    "Email / Password",
  ]);
});

test("credential migration errors are classified without exposing Firebase messages", () => {
  assert.equal(
    classifyCredentialMigrationError({ code: "auth/requires-recent-login" }),
    "reauthentication-required"
  );
  assert.equal(
    classifyCredentialMigrationError({ code: "auth/popup-closed-by-user" }),
    "reauthentication-cancelled"
  );
  assert.equal(
    classifyCredentialMigrationError({ code: "auth/email-already-in-use" }),
    "identity-conflict"
  );
  assert.equal(
    classifyCredentialMigrationError({ code: "auth/provider-already-linked" }),
    "already-linked"
  );
  assert.equal(
    classifyCredentialMigrationError(new Error("protected detail")),
    "retryable"
  );
});

test("Google linking errors are classified without exposing Firebase details", () => {
  assert.equal(
    classifyGoogleLinkingError({ code: "auth/requires-recent-login" }),
    "password-reauthentication-required"
  );
  assert.equal(
    classifyGoogleLinkingError({ code: "auth/popup-closed-by-user" }),
    "cancelled"
  );
  assert.equal(
    classifyGoogleLinkingError(
      { code: "auth/account-exists-with-different-credential" },
      { hasPendingCredential: true }
    ),
    "password-reauthentication-required"
  );
  assert.equal(
    classifyGoogleLinkingError({ code: "auth/account-exists-with-different-credential" }),
    "identity-conflict"
  );
  assert.equal(
    classifyGoogleLinkingError({ code: "auth/credential-already-in-use" }),
    "identity-conflict"
  );
  assert.equal(
    classifyGoogleLinkingError({ code: "auth/provider-already-linked" }),
    "already-linked"
  );
  assert.equal(
    classifyGoogleLinkingError({ code: "auth/wrong-password" }),
    "password-reauthentication-failed"
  );
  assert.equal(
    classifyGoogleLinkingError(new Error("protected detail")),
    "retryable"
  );
});

test("identity continuity responses fail closed on malformed or changed identity", () => {
  assert.equal(
    isIdentityContinuityResponseValid(
      { neonUserId: "neon-user-id" },
      "firebase-uid"
    ),
    true
  );
  assert.equal(
    isIdentityContinuityResponseValid(
      { firebaseUid: "firebase-uid", neonUserId: "neon-user-id" },
      "firebase-uid",
      "neon-user-id"
    ),
    true
  );
  assert.equal(isIdentityContinuityResponseValid(null, "firebase-uid"), false);
  assert.equal(
    isIdentityContinuityResponseValid(
      { firebaseUid: "different-firebase-uid", neonUserId: "neon-user-id" },
      "firebase-uid",
      "neon-user-id"
    ),
    false
  );
  assert.equal(
    isIdentityContinuityResponseValid(
      { firebaseUid: "firebase-uid", neonUserId: "different-neon-user-id" },
      "firebase-uid",
      "neon-user-id"
    ),
    false
  );
  assert.equal(
    isIdentityContinuityResponseValid(
      { firebaseUid: "firebase-uid", neonUserId: "" },
      "firebase-uid"
    ),
    false
  );
  assert.equal(
    isIdentityContinuityResponseValid(
      { firebaseUid: "firebase-uid", neonUserId: "   " },
      "firebase-uid"
    ),
    false
  );
  assert.equal(
    isIdentityContinuityResponseValid(
      { firebaseUid: "firebase-uid", neonUserId: 42 },
      "firebase-uid"
    ),
    false
  );
  assert.equal(
    isIdentityContinuityResponseValid(
      { firebaseUid: "firebase-uid", neonUserId: " neon-user-id " },
      "firebase-uid",
      "neon-user-id"
    ),
    false
  );
});

test("pending continuity stores only the UID and Neon ID for interrupted-session revalidation", () => {
  const values = new Map();
  vi.stubGlobal("window", {
    sessionStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
  });

  storePendingCredentialMigration("firebase-uid", "neon-user-id");
  assert.deepEqual(readPendingCredentialMigration("firebase-uid"), {
    firebaseUid: "firebase-uid",
    neonUserId: "neon-user-id",
  });
  assert.equal(readPendingCredentialMigration("different-firebase-uid"), null);

  const requestedAt = markPendingCredentialVerificationRequested("firebase-uid");
  assert.equal(typeof requestedAt, "number");
  assert.deepEqual(readPendingCredentialMigration("firebase-uid"), {
    firebaseUid: "firebase-uid",
    neonUserId: "neon-user-id",
    verificationEmailRequestedAt: requestedAt,
  });
  assert.equal(
    [...values.values()].some((value) => /password|token|credential/i.test(value)),
    false
  );

  clearPendingCredentialMigration();
  assert.equal(readPendingCredentialMigration("firebase-uid"), null);
});

test("optional setup card remains visible for pending continuity without becoming an auth gate", () => {
  const values = new Map();
  vi.stubGlobal("window", {
    sessionStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
  });

  assert.equal(shouldShowOptionalCredentialSetup(user(["google.com"])), true);
  assert.equal(
    shouldShowOptionalCredentialSetup(user(["google.com", "password"])),
    false
  );

  storePendingCredentialMigration("firebase-uid", "neon-user-id");
  assert.equal(
    shouldShowOptionalCredentialSetup(user(["google.com", "password"])),
    true
  );
  assert.equal(shouldShowOptionalCredentialSetup(user(["password"])), false);
  assert.equal(
    shouldShowOptionalCredentialSetup(
      user(["google.com"], { emailVerified: false })
    ),
    false
  );
  assert.equal(shouldShowOptionalCredentialSetup(null), false);
});
