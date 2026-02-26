// src/domain/links/link.rules.ts

import { EntityType } from "./link.types";

/**
 * Canonical list of allowed entity pairings for cross-links (v1).
 * Pairs are symmetric.
 */
export const ALLOWED_ENTITY_LINKS: Record<EntityType, EntityType[]> = {
  Session: [
    "Quest",
    "Arc",
    "Lore",
    "Map",
    "NPC",
    "PC",
    "Item",
    "Condition",
    "BagOfHolding",
  ],

  Quest: [
    "Session",
    "NPC",
    "PC",
    "Item",
    "Map",
    "Lore",
    "Condition",
    "Arc",
  ],

  Arc: [
    "Session",
    "Quest",
    "NPC",
    "PC",
    "Item",
    "Map",
    "Lore",
    "Condition",
  ],

  Lore: [
    "Session",
    "Quest",
    "Arc",
    "NPC",
    "PC",
    "Item",
    "Map",
    "Condition",
  ],

  Map: [
    "Session",
    "Quest",
    "Arc",
    "NPC",
    "PC",
    "Item",
    "Lore",
  ],

  NPC: [
    "Session",
    "Quest",
    "Arc",
    "Lore",
    "Map",
    "Item",
    "Condition",
    "NPC",
    "PC",
  ],

  PC: [
    "Session",
    "Quest",
    "Arc",
    "Lore",
    "Map",
    "Item",
    "Condition",
    "NPC",
  ],

  Item: [
    "Session",
    "Quest",
    "Arc",
    "Lore",
    "Map",
    "NPC",
    "PC",
    "Condition",
    "BagOfHolding",
  ],

  Condition: [
    "Session",
    "Quest",
    "Arc",
    "Lore",
    "Item",
    "NPC",
    "PC",
  ],

  BagOfHolding: [
    "Item",
    "Session",
  ],
};
/**
 * Returns true if two entity types are allowed to be linked.
 * Order does not matter.
 */
export function isAllowedEntityPair(
  a: EntityType,
  b: EntityType
): boolean {
  return (
    ALLOWED_ENTITY_LINKS[a]?.includes(b) === true &&
    ALLOWED_ENTITY_LINKS[b]?.includes(a) === true
  );
}/**
 * Throws if an entity pair is not allowed.
 */
export function assertAllowedEntityPair(
  a: EntityType,
  b: EntityType
): void {
  if (!isAllowedEntityPair(a, b)) {
    throw new Error(
      `Linking ${a} ↔ ${b} is not allowed in v1`
    );
  }
}
/**
 * Allowed relationship labels per entity pair (v1).
 * Key format: "EntityA|EntityB"
 * Pairs are symmetric.
 */
export const ALLOWED_LINK_LABELS: Record<string, string[]> = {
  // ─────────────────────────
  // Session
  // ─────────────────────────
  "Session|NPC": ["present", "mentioned", "antagonist", "ally"],
  "Session|PC": ["present", "spotlighted"],
  "Session|Item": ["introduced", "used", "consumed", "lost"],
  "Session|Map": ["visited", "revealed"],
  "Session|Lore": ["revealed", "hinted"],
  "Session|Quest": ["related", "started", "advanced", "progressed", "completed", "failed"],
  "Session|Arc": ["advanced", "pivoted"],
  "Session|Condition": ["applied", "worsened", "improved", "removed"],
  "Session|BagOfHolding": ["inventory_changed"],

  // ─────────────────────────
  // Quest
  // ─────────────────────────
  "Quest|NPC": ["given_by", "target", "ally"],
  "Quest|PC": ["assigned_to", "personal"],
  "Quest|Item": ["requires", "rewards", "unlocks"],
  "Quest|Map": ["takes_place_in", "leads_to"],
  "Quest|Lore": ["based_on", "reveals"],
  "Quest|Condition": ["applies", "resolves"],
  "Quest|Arc": ["advances", "belongs_to"],

  // ─────────────────────────
  // Arc
  // ─────────────────────────
  "Arc|NPC": ["involved", "antagonist", "ally"],
  "Arc|PC": ["central_to", "affected_by"],
  "Arc|Item": ["key_item"],
  "Arc|Map": ["set_in"],
  "Arc|Lore": ["rooted_in"],
  "Arc|Condition": ["driven_by"],

  // ─────────────────────────
  // Lore
  // ─────────────────────────
  "Lore|NPC": ["describes", "origin_of"],
  "Lore|PC": ["connected_to"],
  "Lore|Item": ["explains", "origin_of"],
  "Lore|Map": ["describes", "historical_site"],
  "Lore|Condition": ["origin_of"],

  // ─────────────────────────
  // Map
  // ─────────────────────────
  "Map|NPC": ["resides_in", "controls"],
  "Map|PC": ["home", "current_location"],
  "Map|Item": ["found_in", "hidden_in"],

  // ─────────────────────────
  // NPC
  // ─────────────────────────
  "NPC|NPC": ["ally", "enemy", "family", "associate"],
  "NPC|PC": ["ally", "enemy", "mentor", "patron", "romantic"],
  "NPC|Item": ["owns", "uses"],
  "NPC|Condition": ["affected_by"],

  // ─────────────────────────
  // PC
  // ─────────────────────────
  "PC|Item": ["equipped", "carried", "attuned"],
  "PC|Condition": ["affected_by"],

  // ─────────────────────────
  // Item
  // ─────────────────────────
  "Item|Condition": ["applies", "prevents", "cures"],
  "Item|BagOfHolding": ["contained_in", "removed_from"],
};

/**
 * Returns allowed labels for an entity pair.
 * Order does not matter.
 */
export function getAllowedLabelsForPair(
  a: EntityType,
  b: EntityType
): string[] {
  return (
    ALLOWED_LINK_LABELS[`${a}|${b}`] ??
    ALLOWED_LINK_LABELS[`${b}|${a}`] ??
    []
  );
}

/**
 * Returns true if a label is allowed for the given entity pair.
 */
export function isAllowedLabelForPair(
  a: EntityType,
  b: EntityType,
  label: string
): boolean {
  return getAllowedLabelsForPair(a, b).includes(label);
}

/**
 * Throws if the label is not valid for the entity pair.
 */
export function assertAllowedLabelForPair(
  a: EntityType,
  b: EntityType,
  label: string
): void {
  if (!isAllowedLabelForPair(a, b, label)) {
    throw new Error(
      `Label "${label}" is not allowed for ${a} ↔ ${b}`
    );
  }
}