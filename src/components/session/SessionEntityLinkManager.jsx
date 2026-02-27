// src/components/session/SessionEntityLinkManager.jsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createLink } from "../../domain/links/link.service";
import {
  addLink,
  getLinksForEntity,
  removeLink,
} from "../../data/links/links.repo";

/**
 * Generic session ↔ entity link manager (in-memory repo for now).
 *
 * Props:
 * - sessionId: string
 * - entityType: "NPC" | "Quest" | "Item" | ...
 * - label: string (e.g. "present" for NPCs)
 * - allowedLabels: array of strings (optional, for dynamic labels)
 * - defaultLabel: string (optional, default label when linking)
 * - sectionTitle: string (e.g. "Notable NPCs")
 * - isGM: boolean
 * - editMode: boolean
 * - visibilityMode: "GM" | "Player" (current viewer mode)
 * - dataSource: object (id -> entity) OR array of entities
 * - getEntityLabel?: (entity) => string (defaults to entity.name)
 * - filterByTenant?: (entity) => boolean (optional)
 * - renderCard: (entity, link, helpers) => ReactNode
 * - onAddNew?: () => void (optional; later for quick add modal)
 */
export default function SessionEntityLinkManager({
  sessionId,
  entityType,
  label,                // optional fixed label
  allowedLabels,        // optional array of labels
  defaultLabel,         // optional default when linking
  sectionTitle,
  isGM,
  editMode,
  visibilityMode,
  dataSource,
  getEntityLabel,
  filterByTenant,
  renderCard,
  onAddNew,
}) {
  const navigate = useNavigate();

  // Force rerender when in-memory repo changes (until persistence/state store exists)
  const [, forceUpdate] = useState(0);
  const triggerRerender = () => forceUpdate((v) => v + 1);

  // UI state
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [newLinkVisibility, setNewLinkVisibility] = useState("Player"); // "GM" | "Player"
  const [error, setError] = useState(null);

  // Normalize data source into an array of entities
  const entities = useMemo(() => {
    if (!dataSource) return [];
    if (Array.isArray(dataSource)) return dataSource;
    return Object.values(dataSource);
  }, [dataSource]);

  // Links visible for this session in current mode (GM sees all, Player sees Player only)
  const scopedLinks = getLinksForEntity("Session", sessionId, visibilityMode);

  // Only links relevant to this manager: entityType + label(s)
  const relevantLinks = useMemo(() => {
    return scopedLinks.filter((linkObj) => {
      const other =
        linkObj.entityA.type === "Session" && linkObj.entityA.id === sessionId
          ? linkObj.entityB
          : linkObj.entityA;

      if (other.type !== entityType) return false;

      // If allowedLabels provided, include all of them
      if (Array.isArray(allowedLabels) && allowedLabels.length > 0) {
        return allowedLabels.includes(linkObj.label);
      }

      // Otherwise fallback to fixed label
      return linkObj.label === label;
    });
  }, [scopedLinks, entityType, label, allowedLabels, sessionId]);

  const linkedEntityIds = useMemo(() => {
    return relevantLinks
      .map((linkObj) => {
        const other =
          linkObj.entityA.type === "Session" && linkObj.entityA.id === sessionId
            ? linkObj.entityB
            : linkObj.entityA;
        return other.id;
      })
      .filter(Boolean);
  }, [relevantLinks, sessionId]);

  const labelFn =
    getEntityLabel ||
    ((e) => (e?.name ? String(e.name) : e?.title ? String(e.title) : e?.id));

  const filteredResults = useMemo(() => {
    const q = query.trim().toLowerCase();

    return entities
      .filter(Boolean)
      .filter((e) => {
        if (filterByTenant && !filterByTenant(e)) return false;
        if (!e?.id) return false;

        // Don’t show already-linked entities
        if (linkedEntityIds.includes(e.id)) return false;

        if (!q) return true;

        const text = String(labelFn(e) || "").toLowerCase();
        return text.includes(q);
      });
  }, [entities, query, linkedEntityIds, filterByTenant, labelFn]);

  function handleLink(entityId) {
    try {
      const linkObj = createLink({
        entityA: { type: "Session", id: String(sessionId) },
        entityB: { type: entityType, id: String(entityId) },
        label: defaultLabel || label,
        visibility: newLinkVisibility,
      });

      addLink(linkObj);
      setError(null);
      setQuery("");
      triggerRerender();
    } catch (err) {
      setError(err?.message || "Failed to add link");
    }
  }

  function handleRemove(linkId) {
    removeLink(linkId);
    triggerRerender();
  }

  function handleUpdateLabel(linkObj, newLabel) {
    // Remove old link
    removeLink(linkObj.id);

    // Recreate with new label (preserve visibility)
    const updated = createLink({
      entityA: { ...linkObj.entityA, id: String(linkObj.entityA.id) },
      entityB: { ...linkObj.entityB, id: String(linkObj.entityB.id) },
      label: newLabel,
      visibility: linkObj.visibility,
    });

    addLink(updated);
    triggerRerender();
  }

  const helpers = {
    isGM,
    editMode,
    navigate,
    handleRemove,
    handleUpdateLabel,
    allowedLabels,
  };

  return (
    <div className="bg-white/5 rounded-xl border border-white/10 p-5">
      <h2 className="text-lg font-semibold text-white mb-2">{sectionTitle}</h2>

      {/* Add controls (GM + edit only) */}
      {isGM && editMode && (
        <div className="mb-4">
          {!searchOpen ? (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="px-3 py-1 rounded-lg bg-white/10 text-xs text-zinc-300 hover:bg-white/20"
            >
              + Add {entityType}
            </button>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                placeholder={`Search ${entityType}...`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-transparent border border-white/15 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-500/60"
              />

              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setNewLinkVisibility("Player")}
                    className={`px-2 py-1 rounded-full ${
                      newLinkVisibility === "Player"
                        ? "bg-emerald-500 text-white"
                        : "bg-white/10 text-zinc-300"
                    }`}
                  >
                    Player-visible
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewLinkVisibility("GM")}
                    className={`px-2 py-1 rounded-full ${
                      newLinkVisibility === "GM"
                        ? "bg-red-500 text-white"
                        : "bg-white/10 text-zinc-300"
                    }`}
                  >
                    GM-only
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSearchOpen(false);
                    setQuery("");
                    setError(null);
                  }}
                  className="text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Close
                </button>
              </div>

              {error && <p className="text-red-400 text-xs">{error}</p>}

              <div className="max-h-40 overflow-auto border border-white/10 rounded-lg">
                {filteredResults.length === 0 ? (
                  <div className="p-2">
                    <p className="text-zinc-500 text-sm">
                      No results.
                    </p>
                    {onAddNew ? (
                      <button
                        type="button"
                        onClick={onAddNew}
                        className="mt-2 px-3 py-1 rounded-lg bg-white/10 text-xs text-zinc-300 hover:bg-white/20"
                      >
                        + Add new {entityType}
                      </button>
                    ) : (
                      <p className="text-zinc-500 text-xs mt-1">
                        (Quick add comes next.)
                      </p>
                    )}
                  </div>
                ) : (
                  filteredResults.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => handleLink(e.id)}
                      className="block w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-white/10"
                    >
                      {labelFn(e)}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Linked entities rendered as cards */}
      {relevantLinks.length === 0 ? (
        <p className="text-zinc-400 text-sm">No entries yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {relevantLinks.map((linkObj) => {
            const other =
              linkObj.entityA.type === "Session" &&
              linkObj.entityA.id === sessionId
                ? linkObj.entityB
                : linkObj.entityA;

            // resolve entity from dataSource
            const entity =
              Array.isArray(dataSource)
                ? dataSource.find((x) => x?.id === other.id)
                : dataSource?.[other.id];

            if (!entity) return null;

            return renderCard(entity, linkObj, helpers);
          })}
        </div>
      )}
    </div>
  );
}