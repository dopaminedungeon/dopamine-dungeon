// src/data/links/links.repo.ts

import { apiFetch } from "../api/apiClient";
import { Link } from "../../domain/links/link.types";

let links: Link[] = [];
let loadedCampaignId: string | null = null;
let latestLoad = 0;

function getSelectedCampaignId(): string {
  try {
    return localStorage.getItem("dd_selectedCampaignId") || "default";
  } catch {
    return "default";
  }
}

function getLinkKey(link: {
  entityA: { type: any; id: any };
  entityB: { type: any; id: any };
  label: any;
  visibility: any;
}) {
  const a = `${link.entityA.type}:${link.entityA.id}`;
  const b = `${link.entityB.type}:${link.entityB.id}`;

  return [...[a, b].sort(), link.label].join("|");
}

export async function loadLinks(campaignId = getSelectedCampaignId()): Promise<Link[]> {
  const loadId = ++latestLoad;
  if (!campaignId) {
    links = [];
    loadedCampaignId = null;
    return [];
  }

  const response = await apiFetch<{ ok: true; links: Link[] }>(
    `/api/worldbuilding?resource=entityLinks&campaignId=${encodeURIComponent(campaignId)}`
  );

  const nextLinks = Array.isArray(response.links) ? response.links : [];
  // A slower response from a prior campaign or selected mode must not replace
  // the active view's links after a switch.
  if (loadId === latestLoad) {
    links = nextLinks;
    loadedCampaignId = campaignId;
  }
  return [...nextLinks];
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
  // Let the API reconcile stale or reciprocal endpoint drafts against the
  // canonical campaign record. A cache hit is not proof the write is redundant.
  const key = getLinkKey(link);
  const existing = links.find((candidate) => getLinkKey(candidate) === key);
  const payload = existing ? { ...link, id: existing.id } : link;

  const response = await apiFetch<{ ok: true; link: Link }>(
    `/api/worldbuilding?resource=entityLinks&campaignId=${encodeURIComponent(campaignId)}`,
    {
      method: "PUT",
      body: JSON.stringify({ link: payload }),
    }
  );
  const nextLink = response.link ?? link;

  links = links.filter((candidate) => candidate.id !== nextLink.id && getLinkKey(candidate) !== getLinkKey(nextLink));
  links.push(nextLink);
}

/** Update the canonical row in place so edits retain its stable id. */
export async function updateLink(
  link: Link,
  campaignId = getSelectedCampaignId()
): Promise<void> {
  await ensureLoaded(campaignId);
  const response = await apiFetch<{ ok: true; link: Link }>(
    `/api/worldbuilding?resource=entityLinks&campaignId=${encodeURIComponent(campaignId)}`,
    { method: "PUT", body: JSON.stringify({ link }) }
  );
  links = links.filter((candidate) => candidate.id !== link.id && candidate.id !== response.link.id && getLinkKey(candidate) !== getLinkKey(response.link));
  links.push(response.link);
}

function sameEndpoints(a: Link, b: Link) {
  return getLinkKey({ ...a, label: "" }) === getLinkKey({ ...b, label: "" });
}

export async function saveLinkDraft(
  campaignId: string,
  endpointType: string,
  endpointId: string,
  desired: Link[],
  original: Link[],
  isProtected: (link: Link) => boolean = () => false
): Promise<Link[]> {
  const current = (await loadLinks(campaignId)).filter((link) =>
    ((link.entityA.type === endpointType && String(link.entityA.id) === String(endpointId)) ||
      (link.entityB.type === endpointType && String(link.entityB.id) === String(endpointId))) && !isProtected(link));
  const editableDesired = desired.filter((link) => !isProtected(link));
  const sameRelationship = (a: Link, b: Link) => sameEndpoints(a, b) && a.label === b.label;
  const desiredFor = (link: Link) => editableDesired.some((candidate) =>
    candidate.id === link.id || sameRelationship(candidate, link));

  for (const prior of original.filter((link) => !isProtected(link))) {
    if (desiredFor(prior)) continue;
    const persisted = current.find((link) => link.id === prior.id) || current.find((link) => sameRelationship(link, prior));
    if (persisted) await removeLink(persisted.id, campaignId);
  }

  for (const draft of editableDesired) {
    const persisted = current.find((link) => link.id === draft.id) || current.find((link) => sameRelationship(link, draft));
    if (!persisted) await addLink(draft, campaignId);
    else if (persisted.label !== draft.label || persisted.visibility !== draft.visibility ||
      (persisted.note || "") !== (draft.note || "") || (persisted.createdInSession || "") !== (draft.createdInSession || "")) {
      await updateLink({ ...draft, id: persisted.id }, campaignId);
    }
  }
  return loadLinks(campaignId);
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
}

/**
 * Forces a cache reload (useful after a scope switch if you need it).
 */
export async function refreshLinksCache(campaignId = getSelectedCampaignId()): Promise<void> {
  loadedCampaignId = null;
  await loadLinks(campaignId);
}
