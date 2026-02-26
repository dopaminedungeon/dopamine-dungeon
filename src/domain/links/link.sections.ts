import { EntityType } from "./link.types";

/**
 * Maps (entityType + label) → section title.
 * This mirrors the v1 UI spec.
 */
export const LINK_SECTIONS: Record<
  EntityType,
  Record<string, string>
> = {
  Session: {
    present: "NPCs / PCs Present",
    mentioned: "NPCs Mentioned",
    antagonist: "Antagonists",
    ally: "Allies",

    started: "Quests Started",
    advanced: "Quests / Arcs Advanced",
    completed: "Quests Completed",
    failed: "Quests Failed",

    introduced: "Items Introduced",
    used: "Items Used",
    consumed: "Items Consumed",
    lost: "Items Lost",

    applied: "Conditions Applied",
    worsened: "Conditions Worsened",
    improved: "Conditions Improved",
    removed: "Conditions Removed",

    visited: "Locations Visited",
    revealed: "Locations / Lore Revealed",

    inventory_changed: "Inventory Changes",
    pivoted: "Arc Pivots",
  },

  NPC: {},
  PC: {},
  Item: {},
  Quest: {},
  Arc: {},
  Lore: {},
  Map: {},
  Condition: {},
  BagOfHolding: {},
};
import { Link } from "./link.types";

export function groupLinksBySection(
  entityType: EntityType,
  links: Link[]
): Record<string, Link[]> {
  const sections = LINK_SECTIONS[entityType] ?? {};
  const result: Record<string, Link[]> = {};

  for (const link of links) {
    const sectionTitle = sections[link.label];
    if (!sectionTitle) continue;

    if (!result[sectionTitle]) {
      result[sectionTitle] = [];
    }

    result[sectionTitle].push(link);
  }

  return result;
}