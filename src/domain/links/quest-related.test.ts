import assert from "node:assert/strict";
import { test } from "vitest";
import { createLink } from "./link.service.js";
import { getAllowedLabelsForPair } from "./link.rules.js";

test("Quest links accept Related while historical labels remain valid", () => {
  for (const type of ["Session", "NPC", "Item", "Map"] as const) {
    const link = createLink({ entityA: { type: "Quest", id: "quest-one" },
      entityB: { type, id: `target-${type}` }, label: "related" });
    assert.equal(link.label, "related");
  }
  assert.ok(getAllowedLabelsForPair("Quest", "Map").includes("takes_place_in"));
  assert.ok(getAllowedLabelsForPair("Quest", "Item").includes("unlocks"));
  assert.equal(getAllowedLabelsForPair("Session", "Item").includes("related"), false);
});
