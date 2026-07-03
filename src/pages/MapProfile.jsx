import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Castle,
  Landmark,
  Map as MapIcon,
  Mountain,
  Trash2,
  Trees,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useMode } from "../context/ModeContext.jsx";
import { useCampaign } from "../context/CampaignContext";
import { locationsRepo } from "../data/maps/locations.repo";
import { npcsRepo } from "../data/npcs/npcs.repo";
import { sessionsRepo } from "../data/sessions/sessions.repo";
import { itemsRepo } from "../data/items/items.repo";
import { loreRepo } from "../data/lore/lore.repo";
import { createLink } from "../domain/links/link.service";
import { addLink, getLinksForEntity, loadLinks, removeLink } from "../data/links/links.repo";

const IMAGE_MAX_BYTES = 1024 * 1024;
const LOCATION_CATEGORIES = [
  "City",
  "District",
  "Building",
  "Region",
  "Landmark",
  "Wilderness",
  "Dungeon",
  "Other",
];

const CATEGORY_META = {
  City: { icon: Building2, badge: "border-sky-400/25 bg-sky-500/10 text-sky-200", iconWrap: "bg-sky-500/15 text-sky-200" },
  District: { icon: MapIcon, badge: "border-indigo-400/25 bg-indigo-500/10 text-indigo-200", iconWrap: "bg-indigo-500/15 text-indigo-200" },
  Building: { icon: Castle, badge: "border-stone-400/25 bg-stone-500/10 text-stone-200", iconWrap: "bg-stone-500/15 text-stone-200" },
  Region: { icon: Mountain, badge: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200", iconWrap: "bg-emerald-500/15 text-emerald-200" },
  Landmark: { icon: Landmark, badge: "border-amber-400/25 bg-amber-500/10 text-amber-200", iconWrap: "bg-amber-500/15 text-amber-200" },
  Wilderness: { icon: Trees, badge: "border-green-400/25 bg-green-500/10 text-green-200", iconWrap: "bg-green-500/15 text-green-200" },
  Dungeon: { icon: Castle, badge: "border-rose-400/25 bg-rose-500/10 text-rose-200", iconWrap: "bg-rose-500/15 text-rose-200" },
  Other: { icon: MapIcon, badge: "border-zinc-400/20 bg-zinc-500/10 text-zinc-200", iconWrap: "bg-zinc-500/15 text-zinc-200" },
};

function getCategoryMeta(category) {
  return CATEGORY_META[category] || CATEGORY_META.Other;
}

function normalizeAliases(value) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((alias) => String(alias || "").trim())
        .filter(Boolean)
    )
  );
}

function normalizeLocation(location = {}) {
  return {
    ...location,
    id: String(location.id || ""),
    name: String(location.name || ""),
    category: LOCATION_CATEGORIES.includes(location.category) ? location.category : "Other",
    visibility: location.visibility === "public" ? "public" : "gm-only",
    aliases: normalizeAliases(location.aliases),
    summary: String(location.summary || ""),
    description: String(location.description || ""),
    gmNotes: String(location.gmNotes || ""),
    imageUrl: String(location.imageUrl || ""),
    data:
      location.data && typeof location.data === "object" && !Array.isArray(location.data)
        ? location.data
        : {},
  };
}

function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read image file."));
    reader.readAsDataURL(file);
  });
}

function renderInlineMarkdown(text) {
  const raw = String(text || "");
  const parts = [];
  const pattern = /(\*\*[^*]+\*\*|_[^_]+_|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      parts.push(raw.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={parts.length}>{token.slice(2, -2)}</strong>);
    } else {
      parts.push(<em key={parts.length}>{token.slice(1, -1)}</em>);
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < raw.length) {
    parts.push(raw.slice(lastIndex));
  }

  return parts.map((part, index) =>
    typeof part === "string" ? <React.Fragment key={index}>{part}</React.Fragment> : part
  );
}

function renderMarkdownBlock(value, placeholder = "") {
  const text = String(value || "").trim();
  if (!text) {
    return placeholder ? <p className="text-sm italic text-zinc-500">{placeholder}</p> : null;
  }

  const nodes = [];
  let paragraphLines = [];
  let listItems = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    const content = paragraphLines.join("\n");
    nodes.push(
      <p key={`p-${nodes.length}`} className="whitespace-pre-line leading-6">
        {renderInlineMarkdown(content)}
      </p>
    );
    paragraphLines = [];
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    nodes.push(
      <ul key={`ul-${nodes.length}`} className="list-disc space-y-1 pl-5">
        {listItems.map((item, index) => (
          <li key={index}>{renderInlineMarkdown(item)}</li>
        ))}
      </ul>
    );
    listItems = [];
  };

  text.split("\n").forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      const className =
        level === 1
          ? "text-xl font-semibold text-white"
          : level === 2
            ? "text-lg font-semibold text-white"
            : "text-base font-semibold text-zinc-100";
      nodes.push(
        <h3 key={`h-${nodes.length}`} className={className}>
          {renderInlineMarkdown(heading[2])}
        </h3>
      );
      return;
    }

    const listItem = trimmed.match(/^[-*]\s+(.+)$/);
    if (listItem) {
      flushParagraph();
      listItems.push(listItem[1]);
      return;
    }

    flushList();
    paragraphLines.push(line.trimEnd());
  });

  flushParagraph();
  flushList();

  return <div className="space-y-3 text-sm text-zinc-300">{nodes}</div>;
}

function Card({ title, children }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

function formatLinkLabel(label) {
  return String(label || "").replaceAll("_", " ");
}

function getOtherEndpoint(link, baseType, baseId) {
  return link.entityA.type === baseType && String(link.entityA.id) === String(baseId)
    ? link.entityB
    : link.entityA;
}

function getLinkSignature(link) {
  return [
    `${link.entityA.type}:${link.entityA.id}`,
    `${link.entityB.type}:${link.entityB.id}`,
    link.label,
    link.visibility,
  ].join("|");
}

function getSessionLabel(session) {
  const number = session?.sessionNumber ? `Session ${session.sessionNumber}: ` : "";
  return `${number}${session?.name || session?.title || "Untitled session"}`;
}

function getItemLabel(item) {
  return item?.name || "Untitled item";
}

function getLoreLabel(lore) {
  return lore?.name || "Untitled lore";
}

function getNpcLabel(npc) {
  return npc?.name || "Unnamed NPC";
}

function SelectInput({ value, onChange, disabled, children }) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="min-w-0 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-indigo-300 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </select>
  );
}

function MapLinkSection({
  title,
  emptyText,
  mapId,
  entityType,
  addLabel,
  entities,
  links,
  allowedLabels,
  defaultLabel,
  defaultVisibility = "GM",
  isGM,
  isEditing,
  isSaving,
  getEntityLabel,
  getEntityMeta,
  getEntityPath,
  onLinksChanged,
}) {
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedLabel, setSelectedLabel] = useState(defaultLabel);
  const [selectedVisibility, setSelectedVisibility] = useState(defaultVisibility);
  const [error, setError] = useState("");
  const canChangeLabel = allowedLabels.length > 1;
  const isDisabled = Boolean(isSaving);

  const entityList = useMemo(
    () => (Array.isArray(entities) ? entities.filter((entity) => entity?.id) : []),
    [entities]
  );

  const entitiesById = useMemo(
    () => new Map(entityList.map((entity) => [String(entity.id), entity])),
    [entityList]
  );

  const relevantLinks = useMemo(() => {
    return links
      .map((link) => {
        const other = getOtherEndpoint(link, "Map", mapId);
        const entity = other.type === entityType ? entitiesById.get(String(other.id)) : null;

        if (!entity) return null;
        if (!allowedLabels.includes(link.label)) return null;
        if (!isGM && link.visibility !== "Player") return null;

        return { link, entity };
      })
      .filter(Boolean);
  }, [allowedLabels, entitiesById, entityType, isGM, links, mapId]);

  const candidateEntities = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return entityList
      .filter((entity) => {
        const label = getEntityLabel(entity);
        if (normalizedQuery && !String(label || "").toLowerCase().includes(normalizedQuery)) {
          return false;
        }

        return !links.some((link) => {
          const other = getOtherEndpoint(link, "Map", mapId);

          return other.type === entityType && String(other.id) === String(entity.id);
        });
      })
      .slice(0, 30);
  }, [entityList, entityType, getEntityLabel, links, mapId, query]);

  function handleAdd(entityId) {
    if (isDisabled) return;
    const normalizedEntityId = String(entityId);

    const duplicate = links.some((link) => {
      const other = getOtherEndpoint(link, "Map", mapId);
      return other.type === entityType && String(other.id) === normalizedEntityId;
    });

    if (duplicate) {
      setError("That entity is already linked.");
      return;
    }

    try {
      setError("");
      const link = createLink({
        entityA: { type: "Map", id: String(mapId) },
        entityB: { type: entityType, id: normalizedEntityId },
        label: selectedLabel,
        visibility: selectedVisibility,
      });

      onLinksChanged([...links, link]);
      setQuery("");
      setSearchOpen(false);
    } catch (linkError) {
      console.error("[MapProfile] Failed to stage link", linkError);
      setError("Unable to add this link right now.");
    }
  }

  function handleRemove(linkId) {
    if (isDisabled) return;

    setError("");
    onLinksChanged(links.filter((link) => link.id !== linkId));
  }

  function handleUpdateLink(link, entity, changes) {
    if (isDisabled) return;

    const nextLabel = changes.label ?? link.label;
    const nextVisibility = changes.visibility ?? link.visibility;

    if (nextLabel === link.label && nextVisibility === link.visibility) return;

    const duplicate = links.some((candidate) => {
      if (candidate.id === link.id) return false;

      const other = getOtherEndpoint(candidate, "Map", mapId);
      return other.type === entityType && String(other.id) === String(entity.id);
    });

    if (duplicate) {
      setError("That entity is already linked.");
      return;
    }

    setError("");
    onLinksChanged(
      links.map((candidate) =>
        candidate.id === link.id
          ? { ...candidate, label: nextLabel, visibility: nextVisibility }
          : candidate
      )
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
          {title}
        </h2>
        {isGM && isEditing ? (
          <button
            type="button"
            disabled={isDisabled}
            onClick={() => {
              if (isDisabled) return;
              setSearchOpen((current) => !current);
              setError("");
            }}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {searchOpen ? "Close" : `Add ${addLabel}`}
          </button>
        ) : null}
      </div>

      {isGM && isEditing && searchOpen ? (
        <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-black/10 p-4">
          <div
            className={`grid grid-cols-1 gap-3 ${
              canChangeLabel
                ? "sm:grid-cols-[minmax(0,1fr)_160px_140px]"
                : "sm:grid-cols-[minmax(0,1fr)_140px]"
            }`}
          >
            <input
              value={query}
              disabled={isDisabled}
              onChange={(event) => {
                if (!isDisabled) setQuery(event.target.value);
              }}
              placeholder={`Search ${title.toLowerCase()}...`}
              className="min-w-0 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-indigo-300 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {canChangeLabel ? (
              <SelectInput
                disabled={isDisabled}
                value={selectedLabel}
                onChange={setSelectedLabel}
              >
                {allowedLabels.map((label) => (
                  <option key={label} value={label}>
                    {formatLinkLabel(label)}
                  </option>
                ))}
              </SelectInput>
            ) : null}
            <SelectInput
              disabled={isDisabled}
              value={selectedVisibility}
              onChange={setSelectedVisibility}
            >
              <option value="GM">GM-only</option>
              <option value="Player">Player-visible</option>
            </SelectInput>
          </div>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <div className="max-h-48 overflow-auto rounded-xl border border-white/10">
            {candidateEntities.length === 0 ? (
              <p className="px-3 py-2 text-sm text-zinc-500">No results.</p>
            ) : (
              candidateEntities.map((entity) => (
                <button
                  key={entity.id}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleAdd(entity.id)}
                  className="block w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {getEntityLabel(entity)}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}

      {relevantLinks.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">{emptyText}</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {relevantLinks.map(({ link, entity }) => (
            <div
              key={link.id}
              className="group relative rounded-xl border border-white/10 bg-black/15 p-4"
            >
              {isGM && isEditing ? (
                <button
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleRemove(link.id)}
                  className="absolute right-3 top-3 rounded-full border border-rose-400/30 bg-rose-500/10 p-1.5 text-rose-100 opacity-0 transition hover:bg-rose-500/20 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Remove link"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => navigate(getEntityPath(entity))}
                className="block max-w-full cursor-pointer text-left hover:text-purple-200"
              >
                <p className="pr-8 text-sm font-semibold text-white">{getEntityLabel(entity)}</p>
                {getEntityMeta ? (
                  <p className="mt-1 text-xs text-zinc-500">{getEntityMeta(entity)}</p>
                ) : null}
              </button>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {isGM && isEditing ? (
                  <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
                    {canChangeLabel ? (
                      <SelectInput
                        disabled={isDisabled}
                        value={link.label}
                        onChange={(label) => handleUpdateLink(link, entity, { label })}
                      >
                        {allowedLabels.map((label) => (
                          <option key={label} value={label}>
                            {formatLinkLabel(label)}
                          </option>
                        ))}
                      </SelectInput>
                    ) : (
                      <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-300">
                        {formatLinkLabel(link.label)}
                      </span>
                    )}
                    <SelectInput
                      disabled={isDisabled}
                      value={link.visibility}
                      onChange={(visibility) => handleUpdateLink(link, entity, { visibility })}
                    >
                      <option value="GM">GM-only</option>
                      <option value="Player">Player-visible</option>
                    </SelectInput>
                  </div>
                ) : (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-300">
                    {formatLinkLabel(link.label)}
                  </span>
                )}
                {isGM && !isEditing ? (
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                      link.visibility === "Player"
                        ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                        : "border-red-500/40 bg-red-500/20 text-red-300"
                    }`}
                  >
                    {link.visibility === "Player" ? "Player-visible" : "GM-only"}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TextArea({ label, value, onChange, rows = 5, disabled }) {
  return (
    <label className="space-y-1 text-sm text-zinc-300">
      {label}
      <textarea
        rows={rows}
        value={value || ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-indigo-300 disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}

export default function MapProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isGM } = useMode();
  const { selectedCampaignId } = useCampaign();

  const [location, setLocation] = useState(null);
  const [draft, setDraft] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [imageError, setImageError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [npcs, setNpcs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [items, setItems] = useState([]);
  const [loreEntries, setLoreEntries] = useState([]);
  const [linksVersion, setLinksVersion] = useState(0);
  const [draftLinks, setDraftLinks] = useState(null);
  const [linkDraftKey, setLinkDraftKey] = useState(0);
  const [isImageOpen, setIsImageOpen] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);
  const [imagePan, setImagePan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const isSavingRef = useRef(false);
  const panStartRef = useRef({ pointerId: null, startX: 0, startY: 0, panX: 0, panY: 0 });

  useEffect(() => {
    let cancelled = false;

    async function loadLocation() {
      if (!selectedCampaignId || !id) {
        setLocation(null);
        setNpcs([]);
        setSessions([]);
        setItems([]);
        setLoreEntries([]);
        setDraftLinks(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError("");
        const [loadedLocation, npcData, sessionData, itemData, loreData] = await Promise.all([
          locationsRepo.getById(selectedCampaignId, id),
          npcsRepo.getAll(selectedCampaignId),
          sessionsRepo.getAll(selectedCampaignId),
          itemsRepo.getAll(selectedCampaignId),
          loreRepo.getAll(selectedCampaignId),
          loadLinks(selectedCampaignId),
        ]);
        if (!cancelled) {
          const normalized = loadedLocation ? normalizeLocation(loadedLocation) : null;
          setLocation(normalized);
          setDraft(normalized);
          setNpcs(Array.isArray(npcData) ? npcData : []);
          setSessions(Array.isArray(sessionData) ? sessionData : []);
          setItems(Array.isArray(itemData) ? itemData : []);
          setLoreEntries(Array.isArray(loreData) ? loreData : []);
          setLinksVersion((version) => version + 1);
        }
      } catch (loadError) {
        console.error("[LocationProfile] Failed to load location", loadError);
        if (!cancelled) {
          setLocation(null);
          setNpcs([]);
          setSessions([]);
          setItems([]);
          setLoreEntries([]);
          setDraftLinks(null);
          setError("Unable to load this Location.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadLocation();

    return () => {
      cancelled = true;
    };
  }, [selectedCampaignId, id]);

  useEffect(() => {
    if (!isImageOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsImageOpen(false);
        setImageZoom(1);
        setImagePan({ x: 0, y: 0 });
        setIsPanning(false);
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isImageOpen]);

  useEffect(() => {
    if (imageZoom <= 1) {
      setImagePan({ x: 0, y: 0 });
      setIsPanning(false);
    }
  }, [imageZoom]);

  const viewLocation = isEditing ? draft : location;
  const canView = Boolean(viewLocation) && (isGM || viewLocation.visibility === "public");
  const meta = getCategoryMeta(viewLocation?.category);
  const Icon = meta.icon;
  const hasPlayerContent = Boolean(
    viewLocation?.summary?.trim() ||
      viewLocation?.description?.trim() ||
      viewLocation?.imageUrl
  );
  const visibleNpcs = useMemo(() => {
    if (isGM) return npcs;
    return npcs.filter((npc) => npc?.visibility !== "gm-only");
  }, [isGM, npcs]);

  const visibleSessions = useMemo(() => {
    if (isGM) return sessions;
    return sessions.filter((session) => session?.visibility !== "gm-only");
  }, [isGM, sessions]);

  const visibleItems = useMemo(() => {
    if (isGM) return items;
    return items.filter((item) => item?.visibility !== "gm-only");
  }, [isGM, items]);

  const visibleLoreEntries = useMemo(() => {
    if (isGM) return loreEntries;
    return loreEntries.filter((entry) => entry?.visibility === "public");
  }, [isGM, loreEntries]);

  const mapLinks = useMemo(() => {
    void linksVersion;
    return location ? getLinksForEntity("Map", String(location.id), isGM ? "GM" : "Player") : [];
  }, [isGM, linksVersion, location]);

  const visibleMapLinks = isEditing && draftLinks ? draftLinks : mapLinks;

  const handleLinksChanged = (nextLinks) => {
    setDraftLinks(nextLinks);
  };

  async function applyDraftLinkChanges(originalLinks, nextLinks) {
    if (!selectedCampaignId) return;

    const originalById = new Map(originalLinks.map((link) => [link.id, link]));
    const nextById = new Map(nextLinks.map((link) => [link.id, link]));

    for (const originalLink of originalLinks) {
      if (!nextById.has(originalLink.id)) {
        await removeLink(originalLink.id, selectedCampaignId);
      }
    }

    for (const nextLink of nextLinks) {
      const originalLink = originalById.get(nextLink.id);

      if (!originalLink) {
        await addLink(nextLink, selectedCampaignId);
        continue;
      }

      if (getLinkSignature(originalLink) !== getLinkSignature(nextLink)) {
        await removeLink(originalLink.id, selectedCampaignId);
        await addLink(nextLink, selectedCampaignId);
      }
    }

    await loadLinks(selectedCampaignId);
    setLinksVersion((version) => version + 1);
  }

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function updateAlias(index, value) {
    setDraft((current) => {
      const aliases = [...(current?.aliases || [])];
      aliases[index] = value;
      return { ...current, aliases };
    });
  }

  async function handleImageFile(file) {
    setImageError("");

    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImageError("Please choose an image file.");
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      setImageError("Image is too large. Please choose an image under 1 MB.");
      return;
    }

    try {
      const imageUrl = await readImageAsDataUrl(file);
      updateDraft("imageUrl", imageUrl);
    } catch (readError) {
      console.error("[LocationProfile] Failed to read image", readError);
      setImageError("Unable to read that image file.");
    }
  }

  async function handleSave() {
    if (!selectedCampaignId || !draft || isSavingRef.current) return;

    try {
      isSavingRef.current = true;
      setIsSaving(true);
      const payload = {
        ...draft,
        name: draft.name.trim(),
        category: draft.category,
        visibility: draft.visibility === "public" ? "public" : "gm-only",
        aliases: normalizeAliases(draft.aliases),
        summary: draft.summary.trim(),
        description: draft.description.trim(),
        gmNotes: draft.gmNotes.trim(),
        imageUrl: draft.imageUrl,
        data: {
          ...(draft.data || {}),
          aliases: normalizeAliases(draft.aliases),
        },
      };
      const savedLocation = normalizeLocation(
        await locationsRepo.upsert(selectedCampaignId, payload)
      );
      if (draftLinks) {
        await applyDraftLinkChanges(mapLinks, draftLinks);
      }
      setLocation(savedLocation);
      setDraft(savedLocation);
      setDraftLinks(null);
      setLinkDraftKey((key) => key + 1);
      setIsEditing(false);
      setImageError("");
    } catch (saveError) {
      console.error("[LocationProfile] Failed to save location", saveError);
      setError("Unable to save this Location.");
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedCampaignId || !location || isDeleting || isSaving) return;
    if (!window.confirm(`Delete ${location.name || "this Location"}?`)) return;

    try {
      setIsDeleting(true);
      await locationsRepo.remove(selectedCampaignId, location.id);
      navigate("/maps");
    } catch (deleteError) {
      console.error("[LocationProfile] Failed to delete location", deleteError);
      setError("Unable to delete this Location.");
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex-1 overflow-auto p-8">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-300">
          Loading Location...
        </div>
      </main>
    );
  }

  if (!canView) {
    return (
      <main className="flex-1 overflow-auto p-8">
        <button
          type="button"
          onClick={() => navigate("/maps")}
          className="mb-4 inline-flex items-center gap-2 text-sm text-zinc-300 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Locations
        </button>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-lg font-semibold text-white">Location not available</h1>
          <p className="mt-1 text-sm text-zinc-400">
            This Location does not exist or is not visible in the current mode.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      <button
        type="button"
        disabled={isSaving || isDeleting}
        onClick={() => navigate("/maps")}
        className="mb-5 inline-flex items-center gap-2 text-sm text-zinc-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Locations
      </button>

      {error && (
        <div className="mb-4 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <header className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${meta.iconWrap}`}>
              <Icon className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              {isEditing ? (
                <fieldset disabled={isSaving} className="space-y-4 disabled:opacity-60">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(11rem,0.8fr)_minmax(11rem,0.8fr)]">
                    <label className="space-y-1 text-sm text-zinc-300">
                      Name
                      <input
                        value={draft.name}
                        onChange={(event) => updateDraft("name", event.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-indigo-300"
                      />
                    </label>
                    <label className="space-y-1 text-sm text-zinc-300">
                      Category
                      <select
                        value={draft.category}
                        onChange={(event) => updateDraft("category", event.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-indigo-300"
                      >
                        {LOCATION_CATEGORIES.map((category) => (
                          <option key={category}>{category}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 text-sm text-zinc-300">
                      Visibility
                      <select
                        value={draft.visibility}
                        onChange={(event) => updateDraft("visibility", event.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-indigo-300"
                      >
                        <option value="gm-only">GM-only</option>
                        <option value="public">Player-visible</option>
                      </select>
                    </label>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-zinc-300">Aliases</p>
                    {(draft.aliases || []).map((alias, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          value={alias}
                          onChange={(event) => updateAlias(index, event.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-indigo-300"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setDraft((current) => ({
                              ...current,
                              aliases: current.aliases.filter((_, aliasIndex) => aliasIndex !== index),
                            }))
                          }
                          className="rounded-xl border border-white/10 px-3 text-zinc-300 hover:bg-white/10"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          aliases: [...(current.aliases || []), ""],
                        }))
                      }
                      className="rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/10"
                    >
                      + Add Alias
                    </button>
                  </div>
                </fieldset>
              ) : (
                <>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${meta.badge}`}>
                      {viewLocation.category}
                    </span>
                    {isGM ? (
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                          viewLocation.visibility === "public"
                            ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                            : "border-rose-400/30 bg-rose-500/10 text-rose-200"
                        }`}
                      >
                        {viewLocation.visibility === "public" ? "Player-visible" : "GM-only"}
                      </span>
                    ) : null}
                  </div>
                  <h1 className="text-3xl font-bold text-white">
                    {viewLocation.name || "Untitled Location"}
                  </h1>
                  {viewLocation.aliases?.length ? (
                    <div className="mt-3 text-sm">
                      <p className="font-medium text-zinc-300">Aliases:</p>
                      <p className="mt-1 text-zinc-400">{viewLocation.aliases.join(" • ")}</p>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>

          {isGM && (
            <div className="flex shrink-0 flex-wrap gap-2">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => {
                      setDraft(location);
                      setDraftLinks(null);
                      setLinkDraftKey((key) => key + 1);
                      setIsEditing(false);
                      setImageError("");
                    }}
                    className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSaving || !draft?.name?.trim()}
                    onClick={handleSave}
                    className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => {
                      setDraft(location);
                      setDraftLinks(mapLinks);
                      setLinkDraftKey((key) => key + 1);
                      setImageError("");
                      setIsEditing(true);
                    }}
                    className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleDelete}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-400/20 px-4 py-2 text-sm text-red-200 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    {isDeleting ? "Deleting..." : "Delete"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      <div className={`grid gap-6 ${isGM ? "lg:grid-cols-2" : "grid-cols-1"}`}>
        <div className="space-y-6">
          {(viewLocation.imageUrl || isEditing) && (
            <Card title="Reference Image">
              {viewLocation.imageUrl ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!isEditing) {
                      setIsImageOpen(true);
                      setImageZoom(1);
                      setImagePan({ x: 0, y: 0 });
                    }
                  }}
                  className="block w-full overflow-hidden rounded-2xl border border-white/10 bg-black/30 text-left"
                >
                  <img src={viewLocation.imageUrl} alt="" className="max-h-[34rem] w-full object-contain" />
                </button>
              ) : (
                <p className="text-sm italic text-zinc-500">No reference image uploaded yet.</p>
              )}

              {isEditing ? (
                <div className="mt-4 space-y-3">
                  <p className="text-xs text-zinc-500">
                    Temporary data URL storage. Images over 1 MB are rejected.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer items-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300 hover:bg-white/10">
                      Upload replacement
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={isSaving}
                        onChange={(event) => handleImageFile(event.target.files?.[0])}
                      />
                    </label>
                    {draft?.imageUrl ? (
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => updateDraft("imageUrl", "")}
                        className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Remove image
                      </button>
                    ) : null}
                  </div>
                  {imageError ? <p className="text-sm text-red-200">{imageError}</p> : null}
                </div>
              ) : null}
            </Card>
          )}

          <Card title="Overview">
            {isEditing ? (
              <fieldset disabled={isSaving} className="space-y-4 disabled:opacity-60">
                <TextArea
                  label="Summary"
                  rows={3}
                  value={draft.summary}
                  onChange={(value) => updateDraft("summary", value)}
                />
                <TextArea
                  label="What players know"
                  rows={8}
                  value={draft.description}
                  onChange={(value) => updateDraft("description", value)}
                />
              </fieldset>
            ) : hasPlayerContent ? (
              <div className="space-y-5">
                {viewLocation.summary ? (
                  <div>
                    <h3 className="mb-1 text-sm font-semibold text-zinc-200">Summary</h3>
                    {renderMarkdownBlock(viewLocation.summary)}
                  </div>
                ) : null}
                {viewLocation.description ? (
                  <div>
                    <h3 className="mb-1 text-sm font-semibold text-zinc-200">What players know</h3>
                    {renderMarkdownBlock(viewLocation.description)}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm italic text-zinc-500">No Location details added yet.</p>
            )}
          </Card>

          <MapLinkSection
            key={`map-sessions-${linkDraftKey}`}
            title="Sessions"
            emptyText="No linked sessions yet."
            mapId={viewLocation.id}
            entityType="Session"
            addLabel="Session"
            entities={visibleSessions}
            links={visibleMapLinks}
            allowedLabels={["visited", "revealed"]}
            defaultLabel="visited"
            isGM={isGM}
            isEditing={isEditing}
            isSaving={isSaving}
            getEntityLabel={getSessionLabel}
            getEntityMeta={(session) => session?.date || session?.status || ""}
            getEntityPath={(session) => `/sessions/${session.id}`}
            onLinksChanged={handleLinksChanged}
          />

          <MapLinkSection
            key={`map-npcs-${linkDraftKey}`}
            title="NPCs"
            emptyText="No related NPCs yet."
            mapId={viewLocation.id}
            entityType="NPC"
            addLabel="NPC"
            entities={visibleNpcs}
            links={visibleMapLinks}
            allowedLabels={["connected", "resides_in", "controls"]}
            defaultLabel="connected"
            isGM={isGM}
            isEditing={isEditing}
            isSaving={isSaving}
            getEntityLabel={getNpcLabel}
            getEntityMeta={(npc) => npc?.title || npc?.role || ""}
            getEntityPath={(npc) => `/npcs/${npc.id}`}
            onLinksChanged={handleLinksChanged}
          />

          <MapLinkSection
            key={`map-lore-${linkDraftKey}`}
            title="Lore"
            emptyText="No linked lore yet."
            mapId={viewLocation.id}
            entityType="Lore"
            addLabel="Lore"
            entities={visibleLoreEntries}
            links={visibleMapLinks}
            allowedLabels={["describes", "historical_site"]}
            defaultLabel="describes"
            isGM={isGM}
            isEditing={isEditing}
            isSaving={isSaving}
            getEntityLabel={getLoreLabel}
            getEntityMeta={(entry) => entry?.type || entry?.category || ""}
            getEntityPath={(entry) => `/lore/${entry.id}`}
            onLinksChanged={handleLinksChanged}
          />

          <MapLinkSection
            key={`map-items-${linkDraftKey}`}
            title="Items"
            emptyText="No linked items yet."
            mapId={viewLocation.id}
            entityType="Item"
            addLabel="Item"
            entities={visibleItems}
            links={visibleMapLinks}
            allowedLabels={["found_in", "hidden_in"]}
            defaultLabel="found_in"
            isGM={isGM}
            isEditing={isEditing}
            isSaving={isSaving}
            getEntityLabel={getItemLabel}
            getEntityMeta={(item) => item?.type || item?.rarity || ""}
            getEntityPath={(item) => `/items/${item.id}`}
            onLinksChanged={handleLinksChanged}
          />
        </div>

        {isGM && (
          <aside className="space-y-6">
            <Card title="GM Notes">
              {isEditing ? (
                <fieldset disabled={isSaving} className="disabled:opacity-60">
                  <TextArea
                    label="GM Notes"
                    rows={12}
                    value={draft.gmNotes}
                    onChange={(value) => updateDraft("gmNotes", value)}
                  />
                </fieldset>
              ) : (
                renderMarkdownBlock(viewLocation.gmNotes, "No GM notes yet.")
              )}
            </Card>
          </aside>
        )}
      </div>

      {isImageOpen && viewLocation.imageUrl && typeof document !== "undefined" ? createPortal((
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-3 backdrop-blur-sm sm:p-4"
          onClick={() => {
            setIsImageOpen(false);
            setImageZoom(1);
            setImagePan({ x: 0, y: 0 });
            setIsPanning(false);
          }}
        >
          <div
            className="flex h-full max-h-[calc(100dvh-1rem)] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 p-3">
              <div className="min-w-0 flex-1 pr-2">
                <p className="break-words text-sm font-medium leading-5 text-white">
                  {viewLocation.name || "Location image"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setImageZoom((current) => {
                      const next = Math.max(0.5, current - 0.25);
                      if (next <= 1) setImagePan({ x: 0, y: 0 });
                      return next;
                    })
                  }
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-zinc-300 hover:bg-white/10"
                  aria-label="Zoom out"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImageZoom(1);
                    setImagePan({ x: 0, y: 0 });
                    setIsPanning(false);
                  }}
                  className="rounded-xl border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/10"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => setImageZoom((current) => Math.min(3, current + 0.25))}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-zinc-300 hover:bg-white/10"
                  aria-label="Zoom in"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsImageOpen(false);
                    setImageZoom(1);
                    setImagePan({ x: 0, y: 0 });
                    setIsPanning(false);
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-zinc-300 hover:bg-white/10"
                  aria-label="Close image viewer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div
              className={`relative min-h-0 flex-1 overflow-hidden bg-black/30 touch-none select-none ${
                imageZoom > 1 ? (isPanning ? "cursor-grabbing" : "cursor-grab") : "cursor-default"
              }`}
              onPointerDown={(event) => {
                if (imageZoom <= 1) return;
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                panStartRef.current = {
                  pointerId: event.pointerId,
                  startX: event.clientX,
                  startY: event.clientY,
                  panX: imagePan.x,
                  panY: imagePan.y,
                };
                setIsPanning(true);
              }}
              onPointerMove={(event) => {
                if (!isPanning || panStartRef.current.pointerId !== event.pointerId) return;
                event.preventDefault();
                const deltaX = event.clientX - panStartRef.current.startX;
                const deltaY = event.clientY - panStartRef.current.startY;
                setImagePan({
                  x: panStartRef.current.panX + deltaX,
                  y: panStartRef.current.panY + deltaY,
                });
              }}
              onPointerUp={(event) => {
                if (panStartRef.current.pointerId === event.pointerId) {
                  setIsPanning(false);
                  panStartRef.current.pointerId = null;
                }
              }}
              onPointerCancel={() => {
                setIsPanning(false);
                panStartRef.current.pointerId = null;
              }}
            >
              <div className="flex h-full w-full items-center justify-center p-4 sm:p-6">
                <img
                  src={viewLocation.imageUrl}
                  alt=""
                  draggable={false}
                  className="max-h-full max-w-full object-contain will-change-transform"
                  style={{
                    transform: `translate3d(${imagePan.x}px, ${imagePan.y}px, 0) scale(${imageZoom})`,
                    transition: isPanning ? "none" : "transform 120ms ease-out",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      ), document.body) : null}
    </main>
  );
}
