import assert from "node:assert/strict";
import { test } from "vitest";

import { getApplicationUser, requiresEmailVerification } from "./authState.js";

test("unverified password users are held outside the application", () => {
  assert.equal(
    requiresEmailVerification({
      emailVerified: false,
      providerData: [{ providerId: "password" }],
    }),
    true
  );
});

test("only Firebase-verified users may continue regardless of provider", () => {
  assert.equal(
    requiresEmailVerification({
      emailVerified: true,
      providerData: [{ providerId: "password" }],
    }),
    false
  );
  assert.equal(
    requiresEmailVerification({
      emailVerified: false,
      providerData: [{ providerId: "google.com" }],
    }),
    true
  );
});

test("workspace onboarding remains gated until profile initialization succeeds", () => {
  const verifiedUser = {
    uid: "new-firebase-uid",
    emailVerified: true,
    providerData: [{ providerId: "password" }],
  };

  assert.equal(getApplicationUser(verifiedUser, "pending"), null);
  assert.equal(getApplicationUser(verifiedUser, "error"), null);
  assert.equal(getApplicationUser(verifiedUser, "ready"), verifiedUser);
  assert.equal(getApplicationUser(verifiedUser, "skipped", true), verifiedUser);
});
