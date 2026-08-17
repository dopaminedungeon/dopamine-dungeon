import test from "node:test";
import assert from "node:assert/strict";

import { requiresEmailVerification } from "./authState.js";

test("unverified password users are held outside the application", () => {
  assert.equal(
    requiresEmailVerification({
      emailVerified: false,
      providerData: [{ providerId: "password" }],
    }),
    true
  );
});

test("verified password and Google users may continue", () => {
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
    false
  );
});
