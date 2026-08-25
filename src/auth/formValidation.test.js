import assert from "node:assert/strict";
import { test } from "vitest";

import {
  isValidEmailAddress,
  normalizeEmailAddress,
} from "./formValidation.js";

test("normalizes surrounding whitespace without changing the address", () => {
  assert.equal(normalizeEmailAddress("  user@example.com  "), "user@example.com");
});

test("accepts ordinary email addresses and rejects malformed values", () => {
  assert.equal(isValidEmailAddress("user@example.com"), true);
  assert.equal(isValidEmailAddress(" user+tabletop@example.co.uk "), true);
  assert.equal(isValidEmailAddress("user@example"), false);
  assert.equal(isValidEmailAddress("user @example.com"), false);
  assert.equal(isValidEmailAddress("not-an-email"), false);
  assert.equal(isValidEmailAddress(""), false);
});
