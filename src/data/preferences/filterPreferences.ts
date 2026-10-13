export const FILTER_PREFERENCE_VERSION = 1;

export const FILTER_PREFERENCE_FIELDS = {
  npcs: ["type", "role", "status", "visibility"],
  sessions: ["status"],
  items: ["type", "rarity"],
  locations: ["category", "visibility"],
  lore: ["type", "visibility"],
  bag: ["type"],
} as const;

export type FilterFunctionality = keyof typeof FILTER_PREFERENCE_FIELDS;
export type FilterValues = Record<string, string>;
export type FilterPreferenceDocument = {
  version: typeof FILTER_PREFERENCE_VERSION;
  scopes: Record<string, Partial<Record<FilterFunctionality, FilterValues>>>;
};

export type FilterPreferenceContext = {
  workspaceId: string;
  campaignId: string;
  mode: "gm" | "player";
};

const EMPTY_PREFERENCES: FilterPreferenceDocument = {
  version: FILTER_PREFERENCE_VERSION,
  scopes: {},
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeValues(value: unknown, functionality: FilterFunctionality): FilterValues {
  if (!isRecord(value)) return {};

  const allowedFields = FILTER_PREFERENCE_FIELDS[functionality];
  return Object.fromEntries(
    allowedFields.flatMap((field) => {
      const storedValue = value[field];
      return typeof storedValue === "string" && storedValue.length <= 100
        ? [[field, storedValue]]
        : [];
    })
  );
}

export function normalizeFilterPreferenceDocument(value: unknown): FilterPreferenceDocument {
  if (!isRecord(value) || value.version !== FILTER_PREFERENCE_VERSION || !isRecord(value.scopes)) {
    return EMPTY_PREFERENCES;
  }

  const scopes: FilterPreferenceDocument["scopes"] = {};
  for (const [scopeKey, scopeValue] of Object.entries(value.scopes)) {
    if (!scopeKey || scopeKey.length > 512 || !isRecord(scopeValue)) continue;

    const functionalityValues: FilterPreferenceDocument["scopes"][string] = {};
    for (const functionality of Object.keys(FILTER_PREFERENCE_FIELDS) as FilterFunctionality[]) {
      if (!hasOwn(scopeValue, functionality)) continue;
      functionalityValues[functionality] = normalizeValues(scopeValue[functionality], functionality);
    }

    scopes[scopeKey] = functionalityValues;
  }

  return { version: FILTER_PREFERENCE_VERSION, scopes };
}

export function getFilterPreferenceValues(
  document: unknown,
  scopeKey: string,
  functionality: FilterFunctionality
): FilterValues {
  const normalized = normalizeFilterPreferenceDocument(document);
  return normalized.scopes[scopeKey]?.[functionality] ?? {};
}

export function mergeFilterPreference(
  document: unknown,
  scopeKey: string,
  functionality: FilterFunctionality,
  values: FilterValues
): FilterPreferenceDocument {
  const normalized = normalizeFilterPreferenceDocument(document);
  const normalizedValues = normalizeValues(values, functionality);
  return {
    version: FILTER_PREFERENCE_VERSION,
    scopes: {
      ...normalized.scopes,
      [scopeKey]: {
        ...normalized.scopes[scopeKey],
        [functionality]: normalizedValues,
      },
    },
  };
}

export function createFilterPreferenceScopeKey(context: FilterPreferenceContext): string {
  return JSON.stringify([context.workspaceId, context.campaignId, context.mode]);
}

export function normalizeFilterSelections(
  storedValues: unknown,
  definitions: Record<string, { defaultValue: string; options: readonly string[] }>
): FilterValues {
  const source = isRecord(storedValues) ? storedValues : {};
  return Object.fromEntries(
    Object.entries(definitions).map(([field, definition]) => {
      const candidate = source[field];
      return [field, typeof candidate === "string" && definition.options.includes(candidate)
        ? candidate
        : definition.defaultValue];
    })
  );
}
