import assert from "node:assert/strict";
import { test } from "vitest";
import { formatCopperGp, parseWorthGp, worthGpFromCopper } from "./worth.js";

test("worth keeps missing distinct from zero and converts gp to integer copper", () => {
  assert.equal(parseWorthGp(null), null);
  assert.equal(parseWorthGp(""), null);
  assert.equal(parseWorthGp("0"), 0);
  assert.equal(parseWorthGp("12.34"), 1234);
  assert.equal(worthGpFromCopper(1234), 12.34);
  assert.equal(formatCopperGp(1234), "12.34");
});

test("worth rejects fractional copper, negative, and overflowing values", () => {
  for (const value of ["1.234", "-1", "NaN", "21474836.48"]) {
    assert.throws(() => parseWorthGp(value));
  }
});
