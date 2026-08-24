import assert from "node:assert/strict";
import { test } from "vitest";

import { canViewAsGm, getSelectedMode } from "./viewer-mode.js";

function request(selectedMode?: string) {
  return {
    headers: selectedMode ? { "x-dd-mode": selectedMode } : {},
  } as any;
}

test("DD viewer mode: GM membership in Player mode receives Player visibility", () => {
  assert.equal(canViewAsGm(request("player"), "gm"), false);
});

test("DD viewer mode: missing and invalid mode headers fail closed to Player", () => {
  assert.equal(getSelectedMode(request()), "player");
  assert.equal(getSelectedMode(request("unexpected")), "player");
  assert.equal(canViewAsGm(request(), "gm"), false);
});

test("DD viewer mode: GM visibility requires membership and explicit GM mode", () => {
  assert.equal(canViewAsGm(request("gm"), "gm"), true);
  assert.equal(canViewAsGm(request("gm"), "player"), false);
});
