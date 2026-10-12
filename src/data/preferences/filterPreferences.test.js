import assert from "node:assert/strict";
import { test } from "vitest";
import {
  createFilterPreferenceScopeKey,
  getFilterPreferenceValues,
  mergeFilterPreference,
  normalizeFilterPreferenceDocument,
  normalizeFilterSelections,
} from "./filterPreferences.js";
import {
  filterPreferenceStorageKey,
  readFilterPreferences,
  writeFilterPreferences,
} from "./filterPreferenceStorage.js";

test("keeps preferences independent by workspace, campaign, mode, and functionality", () => {
  const gmContext = { workspaceId: "workspace-a", campaignId: "campaign-a", mode: "gm" };
  const playerContext = { ...gmContext, mode: "player" };
  const gmScope = createFilterPreferenceScopeKey(gmContext);
  const playerScope = createFilterPreferenceScopeKey(playerContext);

  let preferences = mergeFilterPreference({}, gmScope, "npcs", {
    type: "NPC",
    visibility: "gm-only",
  });
  preferences = mergeFilterPreference(preferences, gmScope, "items", { rarity: "Rare" });
  preferences = mergeFilterPreference(preferences, playerScope, "npcs", { type: "Monster" });

  assert.deepEqual(getFilterPreferenceValues(preferences, gmScope, "npcs"), {
    type: "NPC",
    visibility: "gm-only",
  });
  assert.deepEqual(getFilterPreferenceValues(preferences, gmScope, "items"), { rarity: "Rare" });
  assert.deepEqual(getFilterPreferenceValues(preferences, playerScope, "npcs"), { type: "Monster" });
  assert.notEqual(gmScope, playerScope);
  assert.notEqual(gmScope, createFilterPreferenceScopeKey({ ...gmContext, campaignId: "campaign-b" }));
  assert.notEqual(gmScope, createFilterPreferenceScopeKey({ ...gmContext, workspaceId: "workspace-b" }));
});

test("normalizes unsupported or removed values field-by-field while retaining valid choices", () => {
  assert.deepEqual(normalizeFilterSelections(
    { category: "Removed Category", visibility: "public" },
    {
      category: { defaultValue: "All", options: ["All", "City", "Other"] },
      visibility: { defaultValue: "All", options: ["All", "public", "gm-only"] },
    }
  ), { category: "All", visibility: "public" });
});

test("drops unknown schema versions and unknown or malformed preference fields", () => {
  assert.deepEqual(normalizeFilterPreferenceDocument({ version: 99, scopes: { x: {} } }), {
    version: 1,
    scopes: {},
  });
  assert.deepEqual(normalizeFilterPreferenceDocument({
    version: 1,
    scopes: {
      valid: { npcs: { type: "NPC", gmNotes: "hidden" }, unknownFeature: { status: "x" } },
      malformed: null,
    },
  }), {
    version: 1,
    scopes: { valid: { npcs: { type: "NPC" } } },
  });
});

test("stores preferences separately per user and keeps filtering usable when storage fails", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const firstUserPreferences = mergeFilterPreference({}, "scope", "npcs", { status: "missing" });
  const secondUserPreferences = mergeFilterPreference({}, "scope", "npcs", { status: "dead" });

  assert.equal(writeFilterPreferences("user-a", firstUserPreferences, storage), true);
  assert.equal(writeFilterPreferences("user-b", secondUserPreferences, storage), true);
  assert.equal(filterPreferenceStorageKey("user-a") === filterPreferenceStorageKey("user-b"), false);
  assert.deepEqual(readFilterPreferences("user-a", storage), firstUserPreferences);
  assert.deepEqual(readFilterPreferences("user-b", storage), secondUserPreferences);

  const failingStorage = {
    getItem() { throw new Error("storage disabled"); },
    setItem() { throw new Error("storage disabled"); },
  };
  assert.deepEqual(readFilterPreferences("user-a", failingStorage), { version: 1, scopes: {} });
  assert.equal(writeFilterPreferences("user-a", firstUserPreferences, failingStorage), false);
});
