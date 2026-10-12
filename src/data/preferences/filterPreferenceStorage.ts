import {
  FILTER_PREFERENCE_VERSION,
  normalizeFilterPreferenceDocument,
  type FilterPreferenceDocument,
} from "./filterPreferences.js";

export const FILTER_PREFERENCE_STORAGE_PREFIX = "dd_filter_preferences_v1:";

function getDefaultStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function filterPreferenceStorageKey(userUid: string) {
  return `${FILTER_PREFERENCE_STORAGE_PREFIX}${encodeURIComponent(userUid)}`;
}

export function readFilterPreferences(
  userUid: string,
  storage: Pick<Storage, "getItem"> | null = getDefaultStorage()
): FilterPreferenceDocument {
  if (!userUid || !storage) return { version: FILTER_PREFERENCE_VERSION, scopes: {} };
  try {
    const serialized = storage.getItem(filterPreferenceStorageKey(userUid));
    return serialized
      ? normalizeFilterPreferenceDocument(JSON.parse(serialized))
      : { version: FILTER_PREFERENCE_VERSION, scopes: {} };
  } catch {
    return { version: FILTER_PREFERENCE_VERSION, scopes: {} };
  }
}

export function writeFilterPreferences(
  userUid: string,
  preferences: unknown,
  storage: Pick<Storage, "setItem"> | null = getDefaultStorage()
) {
  if (!userUid || !storage) return false;
  try {
    storage.setItem(
      filterPreferenceStorageKey(userUid),
      JSON.stringify(normalizeFilterPreferenceDocument(preferences))
    );
    return true;
  } catch {
    return false;
  }
}
