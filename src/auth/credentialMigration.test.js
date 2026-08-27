import assert from "node:assert/strict";
import { afterEach, test, vi } from "vitest";

import {
  classifyCredentialMigrationError,
  getConnectedProviderIds,
  getConnectedProviderLabel,
  clearPendingCredentialMigration,
  isOptionalCredentialSetupCandidate,
  markPendingCredentialVerificationRequested,
  readPendingCredentialMigration,
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
