import assert from "node:assert/strict";
import { test } from "vitest";

import {
  getVerificationFailureState,
  readVerificationAction,
} from "./verificationAction.js";

test("verification actions require the Firebase mode and action code", () => {
  assert.deepEqual(
    readVerificationAction("?mode=verifyEmail&oobCode=code-123"),
    { valid: true, oobCode: "code-123" }
  );
  assert.deepEqual(readVerificationAction("?mode=resetPassword&oobCode=code-123"), {
    valid: false,
    oobCode: "",
  });
  assert.deepEqual(readVerificationAction("?mode=verifyEmail"), {
    valid: false,
    oobCode: "",
  });
});

test("Firebase action failures map to non-identifying result states", () => {
  assert.equal(
    getVerificationFailureState({ code: "auth/expired-action-code" }),
    "expired"
  );
  assert.equal(
    getVerificationFailureState({ code: "auth/invalid-action-code" }),
    "invalid"
  );
  assert.equal(getVerificationFailureState({ code: "auth/internal-error" }), "failure");
  assert.equal(
    getVerificationFailureState({ code: "auth/invalid-action-code" }, true),
    "already-verified"
  );
});
