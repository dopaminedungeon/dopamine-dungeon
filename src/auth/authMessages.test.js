import assert from "node:assert/strict";
import { test } from "vitest";

import {
  formatRetryAfterSeconds,
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

test("verification rate limits provide a cooldown message", () => {
  assert.equal(
    getAuthErrorMessage({ status: 429 }, "verification"),
    "Please wait before requesting another verification email."
  );
  assert.equal(
    getAuthErrorMessage(
      { status: 429, retryAfterSeconds: 3_661 },
      "verification"
    ),
    "Verification email limit reached. Try again in 1h 1m 1s."
  );
  assert.equal(formatRetryAfterSeconds(125), "2m 5s");
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
