// src/domain/links/link.types.ts

/**
 * All entity types that can participate in cross-links.
 * This is a closed set for v1.
 */
export type EntityType =
  | "Session"
  | "Quest"
  | "Arc"
  | "Lore"
  | "Map"
  | "NPC"
  | "PC"
  | "Item"
  | "Condition"
  | "BagOfHolding";

/**
 * A reference to one end of a link.
 */
export interface LinkEndpoint {
  type: EntityType;
  id: string;
}

/**
 * Visibility of a link.
 * GM links are completely hidden from players.
 */
export type LinkVisibility = "GM" | "Player";

/**
 * Canonical, symmetric link between two entities.
 */
export interface Link {
  id: string;

  entityA: LinkEndpoint;
  entityB: LinkEndpoint;

  /**
   * Semantic relationship label.
   * Must be validated against allowed labels for the entity pair.
   */
  label: string;

  visibility: LinkVisibility;

  /**
   * Session in which this link was created (if any).
   */
  createdInSession?: string;

  /**
   * Optional short note.
   */
  note?: string;

  /**
   * ISO timestamp.
   */
  createdAt: string;
}