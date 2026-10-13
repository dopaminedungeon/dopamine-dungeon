import assert from "node:assert/strict";
import { test, vi } from "vitest";
vi.mock("../api/apiClient", () => ({ apiFetch: vi.fn() }));
import { bagRepo } from "./bag.repo.js";

test("linked worth is copied once and a bag override changes only that entry", () => {
  const profile = { id: "item-one", worthGp: 2.5 };
  const original = { currency: {}, looseItems: [], linkedEntries: [] };
  const firstBag = bagRepo.addLinkedItem(original, profile.id, { worth: profile.worthGp });
  const secondBag = bagRepo.addLinkedItem(original, profile.id, { worth: profile.worthGp });
  const changed = bagRepo.updateEntryWorth(firstBag, "linked", firstBag.linkedEntries[0].id, "3.75");

  assert.equal(changed.linkedEntries[0].worth, 3.75);
  assert.equal(firstBag.linkedEntries[0].worth, 2.5);
  assert.equal(secondBag.linkedEntries[0].worth, 2.5);
  assert.equal(profile.worthGp, 2.5);
});

test("missing profile worth stays missing; zero and loose overrides remain explicit", () => {
  const bag = { currency: {}, looseItems: [{ id: "loose", name: "Rope", worth: null }], linkedEntries: [] };
  const linked = bagRepo.addLinkedItem(bag, "item-without-worth", { worth: null });
  assert.equal(linked.linkedEntries[0].worth, null);
  const changed = bagRepo.updateEntryWorth(linked, "loose", "loose", "0");
  assert.equal(changed.looseItems[0].worth, 0);
  assert.equal(linked.looseItems[0].worth, null);
});
