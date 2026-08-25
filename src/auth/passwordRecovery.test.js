import assert from "node:assert/strict";
import { test } from "vitest";

import {
  getPasswordResetFailureState,
  PASSWORD_RESET_CONFIRMATION,
  readPasswordResetAction,
  shouldShowPasswordResetConfirmation,
} from "./passwordRecovery.js";

test("uses the required non-identifying recovery confirmation", () => {
  assert.equal(
    PASSWORD_RESET_CONFIRMATION,
    "If an account can use password authentication with that email address, we've sent instructions to reset its password."
  );
});

test("account-related reset request errors still use the generic confirmation", () => {
  for (const code of [
    "auth/user-not-found",
    "auth/user-disabled",
    "auth/invalid-email",
    "auth/missing-email",
  ]) {
    assert.equal(shouldShowPasswordResetConfirmation({ code }), true);
  }

  assert.equal(
    shouldShowPasswordResetConfirmation({ code: "auth/network-request-failed" }),
    false
  );
});

test("password reset actions require Firebase reset mode and a code", () => {
  assert.deepEqual(
    readPasswordResetAction("?mode=resetPassword&oobCode=reset-123"),
    { valid: true, oobCode: "reset-123" }
  );
  assert.deepEqual(
    readPasswordResetAction("?mode=verifyEmail&oobCode=reset-123"),
    { valid: false, oobCode: "" }
  );
  assert.deepEqual(readPasswordResetAction("?mode=resetPassword"), {
    valid: false,
    oobCode: "",
  });
});

test("expired, invalid, malformed, used, and missing-user codes fail safely", () => {
  assert.equal(
    getPasswordResetFailureState({ code: "auth/expired-action-code" }),
    "expired"
  );
  for (const code of [
    "auth/invalid-action-code",
    "auth/missing-action-code",
    "auth/user-disabled",
    "auth/user-not-found",
  ]) {
    assert.equal(getPasswordResetFailureState({ code }), "invalid");
  }
  assert.equal(
    getPasswordResetFailureState({ code: "auth/network-request-failed" }),
    "failure"
  );
});

test("production Firebase invalid-credential response for a used reset code is recoverable", () => {
  assert.equal(
    getPasswordResetFailureState({
      code: "auth/invalid-credential",
      message: "Firebase: Error (auth/invalid-credential).",
    }),
    "invalid"
  );
});
