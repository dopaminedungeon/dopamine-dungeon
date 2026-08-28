import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  credential: vi.fn(),
  credentialFromError: vi.fn(),
  linkWithPopup: vi.fn(),
  linkWithCredential: vi.fn(),
  reauthenticateWithCredential: vi.fn(),
  reauthenticateWithPopup: vi.fn(),
  googleProvider: { providerId: "google.com" },
}));

vi.mock("firebase/auth", () => ({
  EmailAuthProvider: { credential: mocks.credential },
  GoogleAuthProvider: class GoogleAuthProvider {
    constructor() {
      return mocks.googleProvider;
    }
    static credentialFromError(error) {
      return mocks.credentialFromError(error);
    }
  },
  linkWithPopup: mocks.linkWithPopup,
  linkWithCredential: mocks.linkWithCredential,
  reauthenticateWithCredential: mocks.reauthenticateWithCredential,
  reauthenticateWithPopup: mocks.reauthenticateWithPopup,
}));

import {
  getPendingGoogleCredentialFromError,
  linkGoogleToFirebaseUser,
  linkPasswordToFirebaseUser,
  linkPendingGoogleCredentialToFirebaseUser,
  reauthenticatePasswordUser,
  reauthenticateFirebaseUserWithGoogle,
} from "./firebaseCredentialMigration";

beforeEach(() => {
  vi.clearAllMocks();
});

test("password migration links an email credential to the existing Firebase user", async () => {
  const firebaseUser = { uid: "unchanged-firebase-uid" };
  const credential = { providerId: "password" };
  mocks.credential.mockReturnValue(credential);

  await linkPasswordToFirebaseUser(
    firebaseUser,
    "existing-google-user@example.test",
    "not-stored"
  );

  assert.deepEqual(mocks.credential.mock.calls, [
    ["existing-google-user@example.test", "not-stored"],
  ]);
  assert.deepEqual(mocks.linkWithCredential.mock.calls, [
    [firebaseUser, credential],
  ]);
});

test("duplicate password-link activation shares one Firebase linking attempt", async () => {
  const firebaseUser = { uid: "unchanged-firebase-uid" };
  const credential = { providerId: "password" };
  let finishLink;
  mocks.credential.mockReturnValue(credential);
  mocks.linkWithCredential.mockReturnValue(
    new Promise((resolve) => {
      finishLink = resolve;
    })
  );

  const first = linkPasswordToFirebaseUser(
    firebaseUser,
    "existing-google-user@example.test",
    "not-stored"
  );
  const duplicate = linkPasswordToFirebaseUser(
    firebaseUser,
    "existing-google-user@example.test",
    "not-stored"
  );
  await Promise.resolve();

  assert.equal(first, duplicate);
  assert.equal(mocks.credential.mock.calls.length, 1);
  assert.equal(mocks.linkWithCredential.mock.calls.length, 1);
  finishLink({ user: firebaseUser });
  await first;
});

test("reauthentication uses Google on the same Firebase user", async () => {
  const firebaseUser = { uid: "unchanged-firebase-uid" };
  await reauthenticateFirebaseUserWithGoogle(firebaseUser);
  assert.deepEqual(mocks.reauthenticateWithPopup.mock.calls, [
    [firebaseUser, mocks.googleProvider],
  ]);
});

test("Google linking uses the existing Firebase user without signing into another identity", async () => {
  const firebaseUser = { uid: "unchanged-firebase-uid" };
  mocks.linkWithPopup.mockResolvedValue({ user: firebaseUser });

  await linkGoogleToFirebaseUser(firebaseUser);

  assert.deepEqual(mocks.linkWithPopup.mock.calls, [
    [firebaseUser, mocks.googleProvider],
  ]);
  assert.equal(mocks.linkWithCredential.mock.calls.length, 0);
});

test("duplicate Google-link activation shares one Firebase linking attempt for the same UID", async () => {
  const firebaseUser = { uid: "unchanged-firebase-uid" };
  const remountedUser = { uid: "unchanged-firebase-uid" };
  let finishLink;
  mocks.linkWithPopup.mockReturnValue(
    new Promise((resolve) => {
      finishLink = resolve;
    })
  );

  const first = linkGoogleToFirebaseUser(firebaseUser);
  const duplicate = linkGoogleToFirebaseUser(remountedUser);

  assert.equal(first, duplicate);
  assert.equal(mocks.linkWithPopup.mock.calls.length, 1);
  finishLink({ user: firebaseUser });
  await first;
});

test("pending Google credentials are extracted only from the immediate Firebase error", () => {
  const error = { code: "auth/account-exists-with-different-credential" };
  const credential = { providerId: "google.com" };
  mocks.credentialFromError.mockReturnValue(credential);

  assert.equal(getPendingGoogleCredentialFromError(error), credential);
  assert.deepEqual(mocks.credentialFromError.mock.calls, [[error]]);
});

test("password confirmation reauthenticates the existing Firebase user", async () => {
  const firebaseUser = { uid: "unchanged-firebase-uid" };
  const credential = { providerId: "password" };
  mocks.credential.mockReturnValue(credential);

  await reauthenticatePasswordUser(
    firebaseUser,
    "password-user@example.test",
    "not-stored"
  );

  assert.deepEqual(mocks.credential.mock.calls, [
    ["password-user@example.test", "not-stored"],
  ]);
  assert.deepEqual(mocks.reauthenticateWithCredential.mock.calls, [
    [firebaseUser, credential],
  ]);
});

test("pending Google credential recovery links to the existing Firebase user", async () => {
  const firebaseUser = { uid: "unchanged-firebase-uid" };
  const googleCredential = { providerId: "google.com" };

  await linkPendingGoogleCredentialToFirebaseUser(firebaseUser, googleCredential);

  assert.deepEqual(mocks.linkWithCredential.mock.calls, [
    [firebaseUser, googleCredential],
  ]);
});
