import assert from "node:assert/strict";
import { afterEach, test, vi } from "vitest";

import {
  clearPendingCredentialMigration,
  readPendingCredentialMigration,
  storePendingCredentialMigration,
} from "./credentialMigration";
import { createPendingCredentialVerificationRequests } from "./pendingCredentialVerification";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubSessionStorage() {
  const values = new Map();
  vi.stubGlobal("window", {
    sessionStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
  });
}

test("concurrent automatic verification requests share one request and release the single-flight entry", async () => {
  stubSessionStorage();
  storePendingCredentialMigration("firebase-uid", "neon-user-id");
  let resolveRequest;
  const sendVerificationEmail = vi.fn(
    () => new Promise((resolve) => {
      resolveRequest = resolve;
    })
  );
  const requests = createPendingCredentialVerificationRequests(sendVerificationEmail);
  const firebaseUser = { uid: "firebase-uid" };

  const first = requests.requestAutomatic(firebaseUser, false);
  const concurrent = requests.requestAutomatic(firebaseUser, false);
  await Promise.resolve();

  assert.equal(first, concurrent);
  assert.equal(sendVerificationEmail.mock.calls.length, 1);
  resolveRequest();
  const sentAt = await first;
  assert.equal(typeof sentAt, "number");

  clearPendingCredentialMigration();
  storePendingCredentialMigration("firebase-uid", "neon-user-id");
  sendVerificationEmail.mockResolvedValueOnce(undefined);
  await requests.requestAutomatic(firebaseUser, false);
  assert.equal(sendVerificationEmail.mock.calls.length, 2);
});

test("an initial-send marker prevents a remount from duplicating automatic delivery", async () => {
  stubSessionStorage();
  storePendingCredentialMigration(
    "firebase-uid",
    "neon-user-id",
    Date.now() - 120_000,
    Date.now() - 120_000
  );
  const sendVerificationEmail = vi.fn();

  const remountedRequests = createPendingCredentialVerificationRequests(
    sendVerificationEmail
  );
  const sentAt = await remountedRequests.requestAutomatic(
    { uid: "firebase-uid" },
    false
  );

  assert.equal(typeof sentAt, "number");
  assert.equal(sendVerificationEmail.mock.calls.length, 0);
});

test("a failed automatic request remains manually retryable without clearing continuity", async () => {
  stubSessionStorage();
  storePendingCredentialMigration("firebase-uid", "neon-user-id");
  const sendVerificationEmail = vi
    .fn()
    .mockRejectedValueOnce(new Error("temporary failure"))
    .mockResolvedValueOnce(undefined);
  const requests = createPendingCredentialVerificationRequests(sendVerificationEmail);
  const firebaseUser = { uid: "firebase-uid" };

  await assert.rejects(requests.requestAutomatic(firebaseUser, true));
  const afterFailure = readPendingCredentialMigration(firebaseUser.uid);
  assert.equal(afterFailure.firebaseUid, "firebase-uid");
  assert.equal(afterFailure.neonUserId, "neon-user-id");
  assert.equal(typeof afterFailure.verificationEmailRequestedAt, "number");
  assert.equal(afterFailure.verificationEmailSentAt, undefined);

  const sentAt = await requests.requestManual(firebaseUser, true);
  assert.equal(sendVerificationEmail.mock.calls.length, 2);
  assert.equal(typeof sentAt, "number");
  assert.deepEqual(
    {
      firebaseUid: readPendingCredentialMigration(firebaseUser.uid).firebaseUid,
      neonUserId: readPendingCredentialMigration(firebaseUser.uid).neonUserId,
    },
    { firebaseUid: "firebase-uid", neonUserId: "neon-user-id" }
  );
});

test("manual resend always makes a fresh allowed request and records only success", async () => {
  stubSessionStorage();
  storePendingCredentialMigration(
    "firebase-uid",
    "neon-user-id",
    Date.now() - 120_000,
    Date.now() - 120_000
  );
  const sendVerificationEmail = vi.fn().mockResolvedValue(undefined);
  const requests = createPendingCredentialVerificationRequests(sendVerificationEmail);

  const sentAt = await requests.requestManual({ uid: "firebase-uid" }, false);

  assert.equal(sendVerificationEmail.mock.calls.length, 1);
  assert.equal(typeof sentAt, "number");
  assert.equal(
    readPendingCredentialMigration("firebase-uid").verificationEmailSentAt,
    sentAt
  );
});
