import assert from "node:assert/strict";
import { test } from "vitest";
import { getAllowedLabelsForPair, isAllowedEntityPair, isAllowedLabelForPair } from "./link.rules.js";

test("Arcs and Milestones use typed, intentional relationships without generic tags", () => {
  assert.equal(isAllowedEntityPair("Session", "Arc"), true);
  assert.deepEqual(getAllowedLabelsForPair("Session", "Arc"), ["advanced", "pivoted"]);
  assert.equal(isAllowedEntityPair("Session", "Milestone"), true);
  assert.deepEqual(getAllowedLabelsForPair("Milestone", "Session"), ["advanced", "reached", "mentioned"]);
  assert.equal(isAllowedLabelForPair("Milestone", "Lore", "rooted_in"), true);
  assert.equal(isAllowedLabelForPair("Milestone", "Lore", "misc"), false);
  assert.equal(isAllowedEntityPair("Arc", "Milestone"), false);
});
