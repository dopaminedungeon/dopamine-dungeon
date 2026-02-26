// src/data/links/links.repo.ts

import { Link, LinkVisibility } from "../../domain/links/link.types";

/**
 * In-memory link store.
 * Debug / localhost only.
 * Will be replaced by real persistence later.
 */
let links: Link[] = [];
let linkKeys = new Set<string>();

function getLinkKey(link: { entityA: { type: any; id: any; }; entityB: { type: any; id: any; }; label: any; visibility: any; }) {
  const a = `${link.entityA.type}:${link.entityA.id}`;
  const b = `${link.entityB.type}:${link.entityB.id}`;

  return [
    a,
    b,
    link.label,
    link.visibility,
  ].join("|");
}
/**
 * Add a link to the store.
 */
export function addLink(link: Link): void {
  const key = getLinkKey(link);

  if (linkKeys.has(key)) {
    throw new Error(
      `Duplicate link prevented: ${key}`
    );
  }

  linkKeys.add(key);
  links.push(link);
}

/**
 * Return all links (GM/debug use).
 */
export function getAllLinks(): Link[] {
  return [...links];
}

/**
 * Get links for a specific entity, filtered by visibility.
 */
export function getLinksForEntity(
  entityType: string,
  entityId: string,
  mode: "GM" | "Player"
): Link[] {
  return links.filter((link) => {
    const matchesEntity =
      (link.entityA.type === entityType &&
        link.entityA.id === entityId) ||
      (link.entityB.type === entityType &&
        link.entityB.id === entityId);

    if (!matchesEntity) return false;

    if (mode === "GM") return true;
    return link.visibility === "Player";
  });
}

/**
 * Clear all links (debug reset).
 */
export function clearLinks(): void {
  links = [];
  linkKeys.clear();
}
export function removeLink(linkId: string): void {
  const linkIndex = links.findIndex((l) => l.id === linkId);
  if (linkIndex === -1) return;

  const link = links[linkIndex];
  const key = getLinkKey(link);

  linkKeys.delete(key);
  links.splice(linkIndex, 1);
}