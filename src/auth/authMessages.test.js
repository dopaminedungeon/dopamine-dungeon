import assert from "node:assert/strict";
import { test } from "vitest";

import {
  GENERIC_SIGN_IN_ERROR,
  getAuthErrorMessage,
  getPasswordRequirements,
} from "./authMessages.js";

test("sign-in errors do not distinguish missing users from wrong passwords", () => {
  assert.equal(
    getAuthErrorMessage({ code: "auth/user-not-found" }, "sign-in"),
    GENERIC_SIGN_IN_ERROR
  );
  assert.equal(
    getAuthErrorMessage({ code: "auth/wrong-password" }, "sign-in"),
    GENERIC_SIGN_IN_ERROR
  );
  assert.equal(
    getAuthErrorMessage({ code: "auth/invalid-credential" }, "sign-in"),
    GENERIC_SIGN_IN_ERROR
  );
});

test("temporary service errors have a distinct non-identifying message", () => {
  assert.equal(
    getAuthErrorMessage({ code: "auth/network-request-failed" }, "sign-in"),
    "Authentication is temporarily unavailable. Please try again later."
  );
});

test("registration errors do not reveal that an email is already registered", () => {
  assert.equal(
    getAuthErrorMessage({ code: "auth/email-already-in-use" }, "register"),
    "We couldn't create your account. Check your details and try again."
  );
});

test("password requirements are derived from the Firebase policy", () => {
  const requirements = getPasswordRequirements({
    meetsMinPasswordLength: true,
    containsUppercaseLetter: false,
    containsNumericCharacter: true,
    passwordPolicy: {
      customStrengthOptions: {
        minPasswordLength: 10,
        containsUppercaseLetter: true,
        containsNumericCharacter: true,
      },
    },
  });

  assert.deepEqual(requirements, [
    { key: "min-length", label: "At least 10 characters", met: true },
    { key: "uppercase", label: "An uppercase letter", met: false },
    { key: "number", label: "A number", met: true },
  ]);
});
