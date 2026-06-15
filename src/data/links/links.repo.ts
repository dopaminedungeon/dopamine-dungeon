// src/data/links/links.repo.ts

import { apiFetch } from "../api/apiClient";
import { Link } from "../../domain/links/link.types";

let links: Link[] = [];
let linkKeys = new Set<string>();
let loadedCampaignId: string | null = null;

function getSelectedCampaignId(): string {
  try {
    return localStorage.getItem("dd_selectedCampaignId") || "default";
  } catch {
    return "default";
  }
}

function rebuildKeys(nextLinks: Link[]) {
  linkKeys = new Set(nextLinks.map(getLinkKey));
}

function getLinkKey(link: {
  entityA: { type: any; id: any };
  entityB: { type: any; id: any };
  label: any;
  visibility: any;
}) {
  const a = `${link.entityA.type}:${link.entityA.id}`;
  const b = `${link.entityB.type}:${link.entityB.id}`;

  return [a, b, link.label, link.visibility].join("|");
}

export async function loadLinks(campaignId = getSelectedCampaignId()): Promise<Link[]> {
  if (!campaignId) {
    links = [];
    loadedCampaignId = null;
    rebuildKeys(links);
    return [];
  }

  const response = await apiFetch<{ ok: true; links: Link[] }>(
    `/api/worldbuilding?resource=entityLinks&campaignId=${encodeURIComponent(campaignId)}`
  );

  links = Array.isArray(response.links) ? response.links : [];
  loadedCampaignId = campaignId;
  rebuildKeys(links);
  return [...links];
}

async function ensureLoaded(campaignId = getSelectedCampaignId()) {
  if (loadedCampaignId !== campaignId) {
    await loadLinks(campaignId);
  }
}

/**
 * Existing localStorage links require a browser export/import migration.
 * Node scripts cannot read browser localStorage, so the API cache is now source of truth.
 */
export async function addLink(
  link: Link,
  campaignId = getSelectedCampaignId()
): Promise<void> {
  await ensureLoaded(campaignId);
  const key = getLinkKey(link);

  if (linkKeys.has(key)) {
    throw new Error(`Duplicate link prevented: ${key}`);
  }

  const response = await apiFetch<{ ok: true; link: Link }>(
    `/api/worldbuilding?resource=entityLinks&campaignId=${encodeURIComponent(campaignId)}`,
    {
      method: "PUT",
      body: JSON.stringify({ link }),
    }
  );
  const nextLink = response.link ?? link;

  links.push(nextLink);
  rebuildKeys(links);
}

/**
 * Return all cached links (GM/debug use). Call loadLinks(campaignId) first.
 */
export function getAllLinks(): Link[] {
  return [...links];
}

/**
 * Get cached links for a specific entity, filtered by visibility.
 * Call loadLinks(campaignId) before this synchronous read.
 */
export function getLinksForEntity(
  entityType: string,
  entityId: string,
  mode: "GM" | "Player"
): Link[] {
  return links.filter((link) => {
    const matchesEntity =
      (link.entityA.type === entityType && link.entityA.id === entityId) ||
      (link.entityB.type === entityType && link.entityB.id === entityId);

    if (!matchesEntity) return false;

    if (mode === "GM") return true;
    return link.visibility === "Player";
  });
}

export async function clearLinks(campaignId = getSelectedCampaignId()): Promise<void> {
  await ensureLoaded(campaignId);
  const linkIds = links.map((link) => link.id);

  for (const linkId of linkIds) {
    await removeLink(linkId, campaignId);
  }
}

export async function removeLink(
  linkId: string,
  campaignId = getSelectedCampaignId()
): Promise<void> {
  await ensureLoaded(campaignId);
  const link = links.find((candidate) => candidate.id === linkId);

  if (!link) return;

  await apiFetch(
    `/api/worldbuilding?resource=entityLinks&campaignId=${encodeURIComponent(
      campaignId
    )}&linkId=${encodeURIComponent(linkId)}`,
    {
      method: "DELETE",
    }
  );

  links = links.filter((candidate) => candidate.id !== linkId);
  rebuildKeys(links);
}

/**
 * Forces a cache reload (useful after a scope switch if you need it).
 */
export async function refreshLinksCache(campaignId = getSelectedCampaignId()): Promise<void> {
  loadedCampaignId = null;
  await loadLinks(campaignId);
}
