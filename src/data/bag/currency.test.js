import assert from "node:assert/strict";
import { test, vi } from "vitest";
vi.mock("../api/apiClient", () => ({ apiFetch: vi.fn() }));
import { spendCurrency } from "./bag.repo";

const value = { pp: 1000, gp: 100, ep: 50, sp: 10, cp: 1 };
const total = (coins) => Object.entries(value).reduce((sum, [key, worth]) => sum + (coins[key] || 0) * worth, 0);

test("spends silver from existing coins before changing one gold", () => {
  assert.deepEqual(
    spendCurrency({ pp: 1, gp: 1, sp: 2, cp: 4 }, { sp: 4 }),
    { pp: 1, gp: 0, ep: 0, sp: 8, cp: 4 }
  );
});

test("exact-denomination spending preserves unrelated balances including electrum", () => {
  assert.deepEqual(
    spendCurrency({ pp: 2, gp: 3, ep: 4, sp: 5, cp: 6 }, { ep: 2, cp: 3 }),
    { pp: 2, gp: 3, ep: 2, sp: 5, cp: 3 }
  );
});

test("converts only one higher coin when several are available", () => {
  assert.deepEqual(
    spendCurrency({ gp: 4, sp: 1 }, { sp: 3 }),
    { pp: 0, gp: 3, ep: 0, sp: 8, cp: 0 }
  );
});

test("prefers the nearest available higher denomination", () => {
  assert.deepEqual(
    spendCurrency({ pp: 1, gp: 1, ep: 1 }, { sp: 2 }),
    { pp: 1, gp: 1, ep: 0, sp: 3, cp: 0 }
  );
});

test("converts across levels when intermediate denominations are absent", () => {
  assert.deepEqual(
    spendCurrency({ pp: 1 }, { sp: 4 }),
    { pp: 0, gp: 0, ep: 0, sp: 96, cp: 0 }
  );
});

test("uses lower coins for a higher request and rejects insufficient funds without mutation", () => {
  assert.deepEqual(
    spendCurrency({ ep: 1, sp: 4, cp: 10 }, { gp: 1 }),
    { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 }
  );
  const available = { gp: 1, ep: 1, sp: 2, cp: 4 };
  const requested = { gp: 2 };
  assert.throws(() => spendCurrency(available, requested), /Not enough funds/);
  assert.deepEqual(available, { gp: 1, ep: 1, sp: 2, cp: 4 });
  assert.deepEqual(requested, { gp: 2 });
});

test("mixed spends conserve value and never produce negative or fractional coins", () => {
  const cases = [
    [{ pp: 1, gp: 2, ep: 1, sp: 3, cp: 4 }, { gp: 1, sp: 7, cp: 6 }],
    [{ gp: 1, ep: 1, sp: 3, cp: 9 }, { sp: 8, cp: 2 }],
    [{ pp: 1, cp: 5 }, { cp: 7 }],
  ];
  for (const [available, requested] of cases) {
    const result = spendCurrency(available, requested);
    assert.equal(total(result), total(available) - total(requested));
    for (const amount of Object.values(result)) assert.ok(Number.isSafeInteger(amount) && amount >= 0);
  }
});
