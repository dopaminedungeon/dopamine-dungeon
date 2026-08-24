import assert from "node:assert/strict";
import { test } from "vitest";

import { getStoredSelectedMode } from "./selectedMode.ts";

function storage(values) {
  return {
    getItem(key) {
      return values[key] ?? null;
    },
  };
}

test("selected API mode prefers the active tenant and campaign scope", () => {
  assert.equal(
    getStoredSelectedMode(
      storage({
        dd_selectedTenantId: "workspace-alpha",
        dd_selectedCampaignId: "campaign-alpha",
        "dd:mode:workspace-alpha:campaign-alpha": "player",
        "dd-mode": "gm",
      })
    ),
    "player"
  );
});

test("selected API mode fails closed for missing, invalid, or unreadable state", () => {
  assert.equal(getStoredSelectedMode(storage({})), "player");
  assert.equal(getStoredSelectedMode(storage({ "dd-mode": "invalid" })), "player");
  assert.equal(
    getStoredSelectedMode({
      getItem() {
        throw new Error("Storage unavailable");
      },
    }),
    "player"
  );
});

test("selected API mode may request GM view but does not grant membership", () => {
  assert.equal(getStoredSelectedMode(storage({ "dd-mode": "gm" })), "gm");
});
