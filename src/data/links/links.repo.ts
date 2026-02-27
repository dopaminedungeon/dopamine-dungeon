// src/data/links/links.repo.ts

import { Link } from "../../domain/links/link.types";

// --- v0.1 persistence -------------------------------------------------
// We keep links in localStorage, scoped by (tenantId, campaignId).
// This lets you ship now, and swap to Firebase later without rewriting UI.

function getActiveTenantId(): string {
  try {
    return localStorage.getItem("dd_activeTenantId") || "default";
  } catch {
    return "default";
  }
}

function getActiveCampaignId(): string {
  const tenantId = getActiveTenantId();
  try {
    return (
      localStorage.getItem(`dd_activeCampaignId:${tenantId}`) ||
      localStorage.getItem("dd_activeCampaignId") ||
      "default"
    );
  } catch {
    return "default";
  }
}

function storageKey(): string {
  const tenantId = getActiveTenantId();
  const campaignId = getActiveCampaignId();
  return `dd_links_v1:${tenantId}:${campaignId}`;
}

function safeParseLinks(raw: string | null): Link[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Link[]) : [];
  } catch {
    return [];
  }
}

/**
 * LocalStorage-backed link store (v0.1).
 *
 * Notes:
 * - Still “just a repo”, so swapping to Firebase later is a storage concern.
 * - We keep an in-memory cache for speed, and persist on write.
 * - Cache is automatically refreshed when tenant/campaign scope changes.
 */
let links: Link[] = [];
let linkKeys = new Set<string>();
let lastKey: string | null = null;

function rebuildKeys(nextLinks: Link[]) {
  linkKeys = new Set(nextLinks.map(getLinkKey));
}

function loadIfScopeChanged() {
  const key = storageKey();
  if (key === lastKey) return;

  lastKey = key;
  const raw = (() => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  })();

  links = safeParseLinks(raw);
  rebuildKeys(links);
}

function persist() {
  const key = storageKey();
  try {
    localStorage.setItem(key, JSON.stringify(links));
  } catch {
    // ignore (private mode / quota)
  }
}

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
  loadIfScopeChanged();
  const key = getLinkKey(link);

  if (linkKeys.has(key)) {
    throw new Error(
      `Duplicate link prevented: ${key}`
    );
  }

  linkKeys.add(key);
  links.push(link);
  persist();
}

/**
 * Return all links (GM/debug use).
 */
export function getAllLinks(): Link[] {
  loadIfScopeChanged();
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
  loadIfScopeChanged();
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
  loadIfScopeChanged();
  links = [];
  linkKeys.clear();
  persist();
}
export function removeLink(linkId: string): void {
  loadIfScopeChanged();
  const linkIndex = links.findIndex((l) => l.id === linkId);
  if (linkIndex === -1) return;

  const link = links[linkIndex];
  const key = getLinkKey(link);

  linkKeys.delete(key);
  links.splice(linkIndex, 1);
  persist();
}

/**
 * Forces a cache reload (useful after a scope switch if you need it).
 */
export function refreshLinksCache(): void {
  lastKey = null;
  loadIfScopeChanged();
}