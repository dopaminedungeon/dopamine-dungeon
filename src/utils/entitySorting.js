const collator = new Intl.Collator(undefined, {
  sensitivity: "base",
  numeric: true,
});

const RARITY_RANKS = new Map([
  ["common", 0],
  ["uncommon", 1],
  ["rare", 2],
  ["very rare", 3],
  ["epic", 4],
  ["legendary", 5],
]);

function normalizeRarity(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function getCreatedAtMs(entity) {
  const rawValue = entity?.createdAt ?? entity?.created_at ?? entity?.dateAdded;
  if (!rawValue) return null;

  const parsed =
    rawValue instanceof Date
      ? rawValue.getTime()
      : typeof rawValue === "number"
        ? rawValue
        : Date.parse(String(rawValue));

  return Number.isFinite(parsed) ? parsed : null;
}

export function compareEntityNames(a, b) {
  const byName = collator.compare(String(a?.name || ""), String(b?.name || ""));
  if (byName !== 0) return byName;

  return collator.compare(String(a?.id || ""), String(b?.id || ""));
}

export function compareCreatedAt(a, b, direction = "asc") {
  const aTime = getCreatedAtMs(a);
  const bTime = getCreatedAtMs(b);
  const aHasDate = aTime !== null;
  const bHasDate = bTime !== null;

  if (aHasDate && bHasDate && aTime !== bTime) {
    return direction === "desc" ? bTime - aTime : aTime - bTime;
  }

  if (aHasDate !== bHasDate) {
    return aHasDate ? -1 : 1;
  }

  return compareEntityNames(a, b);
}

export function compareVisibility(a, b, direction = "public-first") {
  const aIsGmOnly = a?.visibility === "gm-only";
  const bIsGmOnly = b?.visibility === "gm-only";

  if (aIsGmOnly !== bIsGmOnly) {
    if (direction === "gm-first") return aIsGmOnly ? -1 : 1;
    return aIsGmOnly ? 1 : -1;
  }

  return compareEntityNames(a, b);
}

export function compareItemRarity(a, b, direction = "asc") {
  const aRank = RARITY_RANKS.get(normalizeRarity(a?.rarity));
  const bRank = RARITY_RANKS.get(normalizeRarity(b?.rarity));
  const aKnown = aRank !== undefined;
  const bKnown = bRank !== undefined;

  if (aKnown !== bKnown) {
    return direction === "desc"
      ? aKnown ? 1 : -1
      : aKnown ? -1 : 1;
  }

  if (aKnown && bKnown && aRank !== bRank) {
    return direction === "desc" ? bRank - aRank : aRank - bRank;
  }

  return compareEntityNames(a, b);
}

export function stableSort(items, compare) {
  return [...items]
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const result = compare(a.item, b.item);
      return result || a.index - b.index;
    })
    .map(({ item }) => item);
}
