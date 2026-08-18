import assert from "node:assert/strict";
import test from "node:test";

import {
  AuthenticationError,
  getApiErrorMessage,
  getApiErrorStatus,
} from "./apiErrors.ts";

test("authentication failures remain 401 responses", () => {
  const error = new AuthenticationError("Invalid authentication token");

  assert.equal(getApiErrorStatus(error), 401);
  assert.equal(getApiErrorMessage(error), "Invalid authentication token");
});

test("database failures are sanitized 500 responses", () => {
  const error = Object.assign(new Error("duplicate key value"), { code: "23505" });

  assert.equal(getApiErrorStatus(error), 500);
  assert.equal(getApiErrorMessage(error), "Internal server error");
});
