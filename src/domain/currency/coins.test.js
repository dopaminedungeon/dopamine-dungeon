import assert from "node:assert/strict";
import { test } from "vitest";
import { currencyToCopper } from "./coins.js";

test("coin totals use exact copper values across every supported denomination", () => {
  assert.equal(currencyToCopper({ pp: 1, gp: 1, ep: 1, sp: 2, cp: 4 }), 1174);
  assert.equal(currencyToCopper({ gp: 27, sp: 3, cp: 5 }), 2735);
});

test("coin totals reject fractions and unsafe integers", () => {
  assert.throws(() => currencyToCopper({ sp: 1.5 }), /whole coins/);
  assert.throws(() => currencyToCopper({ pp: Number.MAX_SAFE_INTEGER }), /too large/);
});
