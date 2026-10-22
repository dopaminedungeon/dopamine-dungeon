import assert from "node:assert/strict";
import { test } from "vitest";
import { getAllowedLabelsForPair, isAllowedEntityPair, isAllowedLabelForPair } from "./link.rules.js";

test("Arcs keep supported typed relationships while Milestones remain structurally standalone", () => {
  assert.equal(isAllowedEntityPair("Session", "Arc"), true);
  assert.deepEqual(getAllowedLabelsForPair("Session", "Arc"), ["advanced", "pivoted"]);
  for (const type of ["Session", "Arc", "Quest", "Lore", "Map", "NPC", "PC", "Item", "Condition", "BagOfHolding"]) {
    assert.equal(isAllowedEntityPair(type, "Milestone"), false, `${type} cannot link to a Milestone`);
    assert.equal(isAllowedEntityPair("Milestone", type), false, `Milestone cannot link to ${type}`);
    assert.deepEqual(getAllowedLabelsForPair("Milestone", type), []);
    assert.deepEqual(getAllowedLabelsForPair(type, "Milestone"), []);
  }
  assert.equal(isAllowedLabelForPair("Milestone", "Lore", "rooted_in"), false);
  assert.equal(isAllowedEntityPair("Arc", "Milestone"), false);
  assert.equal(isAllowedEntityPair("Arc", "Quest"), true);
  assert.deepEqual(getAllowedLabelsForPair("Arc", "Quest"), ["advances", "belongs_to"]);
});
