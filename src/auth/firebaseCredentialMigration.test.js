import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  credential: vi.fn(),
  linkWithCredential: vi.fn(),
  reauthenticateWithPopup: vi.fn(),
  googleProvider: { providerId: "google.com" },
}));

vi.mock("firebase/auth", () => ({
  EmailAuthProvider: { credential: mocks.credential },
  GoogleAuthProvider: class GoogleAuthProvider {
    constructor() {
      return mocks.googleProvider;
    }
  },
  linkWithCredential: mocks.linkWithCredential,
  reauthenticateWithPopup: mocks.reauthenticateWithPopup,
}));

import {
  linkPasswordToFirebaseUser,
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
