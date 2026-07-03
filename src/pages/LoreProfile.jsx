import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  Flag,
  Globe2,
  Landmark,
  Library,
  ScrollText,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useCampaign } from "../context/CampaignContext";
import { useMode } from "../context/ModeContext.jsx";
import { loreRepo } from "../data/lore/lore.repo";
import { npcsRepo } from "../data/npcs/npcs.repo";
import { sessionsRepo } from "../data/sessions/sessions.repo";
import { itemsRepo } from "../data/items/items.repo";
import { locationsRepo } from "../data/maps/locations.repo";
import { createLink } from "../domain/links/link.service";
import { addLink, getLinksForEntity, loadLinks, removeLink } from "../data/links/links.repo";

const LORE_TYPES = [
  "Religion",
  "Faction",
  "Country",
  "Event",
  "Magic",
  "Concept / Ritual",
  "Lore",
];

const TYPE_META = {
  Religion: {
    icon: Landmark,
    badge: "border-amber-400/25 bg-amber-500/10 text-amber-200",
    iconWrap: "bg-amber-500/15 text-amber-200",
  },
  Faction: {
    icon: Flag,
    badge: "border-rose-400/25 bg-rose-500/10 text-rose-200",
    iconWrap: "bg-rose-500/15 text-rose-200",
  },
  Country: {
    icon: Globe2,
    badge: "border-sky-400/25 bg-sky-500/10 text-sky-200",
    iconWrap: "bg-sky-500/15 text-sky-200",
  },
  Event: {
    icon: ScrollText,
    badge: "border-violet-400/25 bg-violet-500/10 text-violet-200",
    iconWrap: "bg-violet-500/15 text-violet-200",
  },
  Magic: {
    icon: Sparkles,
    badge: "border-cyan-400/25 bg-cyan-500/10 text-cyan-200",
    iconWrap: "bg-cyan-500/15 text-cyan-200",
  },
  "Concept / Ritual": {
    icon: BookOpen,
    badge: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
    iconWrap: "bg-emerald-500/15 text-emerald-200",
  },
  Lore: {
    icon: Library,
    badge: "border-zinc-400/20 bg-zinc-500/10 text-zinc-200",
    iconWrap: "bg-zinc-500/15 text-zinc-200",
  },
};

const TEMPLATE_FIELDS = {
  Religion: [
    ["coreBeliefs", "Core Beliefs"],
    ["practicesRituals", "Practices & Rituals"],
    ["symbols", "Symbols"],
    ["afterlifeCosmology", "Afterlife / Cosmology"],
  ],
  Faction: [
    ["goals", "Goals"],
    ["methods", "Methods"],
    ["structure", "Structure"],
    ["knownAllies", "Known Allies"],
    ["knownEnemies", "Known Enemies"],
  ],
  Country: [
    ["government", "Government"],
    ["culture", "Culture"],
    ["history", "History"],
    ["currentSituation", "Current Situation"],
  ],
  Event: [
    ["dateEra", "Date / Era"],
    ["whatHappened", "What Happened"],
    ["consequences", "Consequences"],
    ["legacy", "Legacy"],
  ],
  Magic: [
    ["howItWorks", "How It Works"],
    ["limitations", "Limitations"],
    ["risks", "Risks"],
    ["knownExamples", "Known Examples"],
  ],
  "Concept / Ritual": [
    ["purpose", "Purpose"],
    ["requirements", "Requirements"],
    ["process", "Process"],
    ["consequences", "Consequences"],
  ],
  Lore: [],
};

function getTypeMeta(type) {
  return TYPE_META[type] || TYPE_META.Lore;
}

function normalizeType(value) {
  return LORE_TYPES.includes(value) ? value : "Lore";
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

function normalizeLore(input = {}) {
  return {
    ...input,
    id: String(input.id || ""),
    name: String(input.name || ""),
    type: normalizeType(input.type),
    visibility: input.visibility === "public" ? "public" : "gm-only",
    summary: String(input.summary || ""),
    content: String(input.content || ""),
    gmNotes: String(input.gmNotes || ""),
    aliases: normalizeAliases(input.aliases),
    data:
      input.data && typeof input.data === "object" && !Array.isArray(input.data)
        ? input.data
        : {},
  };
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

function getNpcLabel(npc) {
  return npc?.name || "Unnamed NPC";
}

function getLocationLabel(location) {
  return location?.name || "Untitled location";
}

function SelectInput({ value, onChange, disabled, children }) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="min-w-0 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-violet-300 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </select>
  );
}

function LoreLinkSection({
  title,
  emptyText,
  loreId,
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
        const other = getOtherEndpoint(link, "Lore", loreId);
        const entity = other.type === entityType ? entitiesById.get(String(other.id)) : null;

        if (!entity) return null;
        if (!allowedLabels.includes(link.label)) return null;
        if (!isGM && link.visibility !== "Player") return null;

        return { link, entity };
      })
      .filter(Boolean);
  }, [allowedLabels, entitiesById, entityType, isGM, links, loreId]);

  const candidateEntities = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return entityList
      .filter((entity) => {
        const label = getEntityLabel(entity);
        if (normalizedQuery && !String(label || "").toLowerCase().includes(normalizedQuery)) {
          return false;
        }

        return !links.some((link) => {
          const other = getOtherEndpoint(link, "Lore", loreId);
          return other.type === entityType && String(other.id) === String(entity.id);
        });
      })
      .slice(0, 30);
  }, [entityList, entityType, getEntityLabel, links, loreId, query]);

  function handleAdd(entityId) {
    if (isDisabled) return;
    const normalizedEntityId = String(entityId);

    const duplicate = links.some((link) => {
      const other = getOtherEndpoint(link, "Lore", loreId);
      return other.type === entityType && String(other.id) === normalizedEntityId;
    });

    if (duplicate) {
      setError("That entity is already linked.");
      return;
    }

    try {
      setError("");
      const link = createLink({
        entityA: { type: "Lore", id: String(loreId) },
        entityB: { type: entityType, id: normalizedEntityId },
        label: selectedLabel,
        visibility: selectedVisibility,
      });

      onLinksChanged([...links, link]);
      setQuery("");
      setSearchOpen(false);
    } catch (linkError) {
      console.error("[LoreProfile] Failed to stage link", linkError);
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

      const other = getOtherEndpoint(candidate, "Lore", loreId);
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
              className="min-w-0 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-violet-300 disabled:cursor-not-allowed disabled:opacity-50"
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

function TextField({ label, value, onChange, rows = 4, disabled }) {
  return (
    <label className="space-y-1 text-sm text-zinc-300">
      {label}
      <textarea
        rows={rows}
        value={value || ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-violet-300 disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}

export default function LoreProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isGM } = useMode();
  const { selectedCampaignId } = useCampaign();

  const [lore, setLore] = useState(null);
  const [draft, setDraft] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [npcs, setNpcs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [items, setItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [linksVersion, setLinksVersion] = useState(0);
  const [draftLinks, setDraftLinks] = useState(null);
  const [linkDraftKey, setLinkDraftKey] = useState(0);
  const isSavingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadLore() {
      if (!selectedCampaignId || !id) {
        setLore(null);
        setNpcs([]);
        setSessions([]);
        setItems([]);
        setLocations([]);
        setDraftLinks(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError("");
        const [loadedLore, npcData, sessionData, itemData, locationData] = await Promise.all([
          loreRepo.getById(selectedCampaignId, id),
          npcsRepo.getAll(selectedCampaignId),
          sessionsRepo.getAll(selectedCampaignId),
          itemsRepo.getAll(selectedCampaignId),
          locationsRepo.getAll(selectedCampaignId),
          loadLinks(selectedCampaignId),
        ]);
        if (!cancelled) {
          setLore(loadedLore ? normalizeLore(loadedLore) : null);
          setDraft(loadedLore ? normalizeLore(loadedLore) : null);
          setNpcs(Array.isArray(npcData) ? npcData : []);
          setSessions(Array.isArray(sessionData) ? sessionData : []);
          setItems(Array.isArray(itemData) ? itemData : []);
          setLocations(Array.isArray(locationData) ? locationData : []);
          setLinksVersion((version) => version + 1);
        }
      } catch (loadError) {
        console.error("[LoreProfile] Failed to load Lore", loadError);
        if (!cancelled) {
          setLore(null);
          setNpcs([]);
          setSessions([]);
          setItems([]);
          setLocations([]);
          setDraftLinks(null);
          setError("Unable to load this Lore entry.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadLore();

    return () => {
      cancelled = true;
    };
  }, [selectedCampaignId, id]);

  const viewLore = isEditing ? draft : lore;
  const canView = Boolean(viewLore) && (isGM || viewLore.visibility === "public");
  const meta = getTypeMeta(viewLore?.type);
  const Icon = meta.icon;
  const templateFields = useMemo(
    () => TEMPLATE_FIELDS[normalizeType(viewLore?.type)] || [],
    [viewLore?.type]
  );
  const hasTemplateContent = templateFields.some(([key]) =>
    String(viewLore?.data?.[key] || "").trim()
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

  const visibleLocations = useMemo(() => {
    if (isGM) return locations;
    return locations.filter((location) => location?.visibility === "public");
  }, [isGM, locations]);

  const loreLinks = useMemo(() => {
    void linksVersion;
    return lore ? getLinksForEntity("Lore", String(lore.id), isGM ? "GM" : "Player") : [];
  }, [isGM, linksVersion, lore]);

  const visibleLoreLinks = isEditing && draftLinks ? draftLinks : loreLinks;

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

  function updateDraftField(field, value) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateDraftDataField(field, value) {
    setDraft((current) => ({
      ...current,
      data: {
        ...(current?.data || {}),
        [field]: value,
      },
    }));
  }

  function updateAlias(index, value) {
    setDraft((current) => {
      const aliases = [...(current?.aliases || [])];
      aliases[index] = value;
      return { ...current, aliases };
    });
  }

  async function handleSave() {
    if (!selectedCampaignId || !draft || isSavingRef.current) return;

    try {
      isSavingRef.current = true;
      setIsSaving(true);
      const normalizedAliases = normalizeAliases(draft.aliases);
      const payload = {
        ...draft,
        type: normalizeType(draft.type),
        visibility: draft.visibility === "public" ? "public" : "gm-only",
        name: draft.name.trim(),
        summary: draft.summary.trim(),
        content: draft.content.trim(),
        gmNotes: draft.gmNotes.trim(),
        aliases: normalizedAliases,
        data: {
          ...(draft.data || {}),
          aliases: normalizedAliases,
        },
      };
      const savedLore = normalizeLore(await loreRepo.upsert(selectedCampaignId, payload));
      if (draftLinks) {
        await applyDraftLinkChanges(loreLinks, draftLinks);
      }
      setLore(savedLore);
      setDraft(savedLore);
      setDraftLinks(null);
      setLinkDraftKey((key) => key + 1);
      setIsEditing(false);
    } catch (saveError) {
      console.error("[LoreProfile] Failed to save Lore", saveError);
      setError("Unable to save this Lore entry.");
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedCampaignId || !lore || isDeleting || isSaving) return;
    if (!window.confirm(`Delete ${lore.name || "this Lore entry"}?`)) return;

    try {
      setIsDeleting(true);
      await loreRepo.remove(selectedCampaignId, lore.id);
      navigate("/lore");
    } catch (deleteError) {
      console.error("[LoreProfile] Failed to delete Lore", deleteError);
      setError("Unable to delete this Lore entry.");
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex-1 overflow-auto p-8">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-300">
          Loading Lore...
        </div>
      </main>
    );
  }

  if (!canView) {
    return (
      <main className="flex-1 overflow-auto p-8">
        <button
          type="button"
          onClick={() => navigate("/lore")}
          className="mb-4 inline-flex items-center gap-2 text-sm text-zinc-300 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Lore
        </button>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-lg font-semibold text-white">Lore not available</h1>
          <p className="mt-1 text-sm text-zinc-400">
            This entry does not exist or is not visible in the current mode.
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
        onClick={() => navigate("/lore")}
        className="mb-5 inline-flex items-center gap-2 text-sm text-zinc-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Lore
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
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(11rem,0.8fr)_minmax(11rem,0.8fr)]">
                    <label className="space-y-1 text-sm text-zinc-300">
                      Name
                      <input
                        value={draft.name}
                        onChange={(event) => updateDraftField("name", event.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-violet-300"
                      />
                    </label>
                    <label className="space-y-1 text-sm text-zinc-300">
                      Type
                      <select
                        value={draft.type}
                        onChange={(event) => updateDraftField("type", event.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-violet-300"
                      >
                        {LORE_TYPES.map((type) => (
                          <option key={type}>{type}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 text-sm text-zinc-300">
                      Visibility
                      <select
                        value={draft.visibility}
                        onChange={(event) => updateDraftField("visibility", event.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-violet-300"
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
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-violet-300"
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
                      {viewLore.type}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                        viewLore.visibility === "public"
                          ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                          : "border-rose-400/30 bg-rose-500/10 text-rose-200"
                      }`}
                    >
                      {viewLore.visibility === "public" ? "Player-visible" : "GM-only"}
                    </span>
                  </div>
                  <h1 className="text-3xl font-bold text-white">{viewLore.name || "Untitled Lore"}</h1>
                  {viewLore.aliases?.length ? (
                    <div className="mt-3 text-sm">
                      <p className="font-medium text-zinc-300">Aliases:</p>
                      <p className="mt-1 text-zinc-400">{viewLore.aliases.join(" • ")}</p>
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
                      setDraft(lore);
                      setDraftLinks(null);
                      setLinkDraftKey((key) => key + 1);
                      setIsEditing(false);
                    }}
                    className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSaving || !draft?.name?.trim()}
                    onClick={handleSave}
                    className="rounded-xl bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
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
                      setDraft(lore);
                      setDraftLinks(loreLinks);
                      setLinkDraftKey((key) => key + 1);
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
          <Card title="Overview">
            {isEditing ? (
              <fieldset disabled={isSaving} className="space-y-4 disabled:opacity-60">
                <TextField
                  label="Summary"
                  rows={3}
                  disabled={isSaving}
                  value={draft.summary}
                  onChange={(value) => updateDraftField("summary", value)}
                />
                <TextField
                  label="Content"
                  rows={8}
                  disabled={isSaving}
                  value={draft.content}
                  onChange={(value) => updateDraftField("content", value)}
                />
              </fieldset>
            ) : viewLore.summary || viewLore.content ? (
              <div className="space-y-5">
                {viewLore.summary ? (
                  <div>
                    <h3 className="mb-1 text-sm font-semibold text-zinc-200">Summary</h3>
                    {renderMarkdownBlock(viewLore.summary)}
                  </div>
                ) : null}
                {viewLore.content ? (
                  <div>
                    <h3 className="mb-1 text-sm font-semibold text-zinc-200">Content</h3>
                    {renderMarkdownBlock(viewLore.content)}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm italic text-zinc-500">No Lore details added yet.</p>
            )}
          </Card>

          {(isEditing || hasTemplateContent) && (
            <Card title={`${viewLore.type} Details`}>
              {templateFields.length === 0 ? (
                <p className="text-sm italic text-zinc-500">
                  This Lore type has no extra template fields.
                </p>
              ) : isEditing ? (
                <fieldset disabled={isSaving} className="space-y-4 disabled:opacity-60">
                  {templateFields.map(([key, label]) => (
                    <TextField
                      key={key}
                      label={label}
                      rows={4}
                      disabled={isSaving}
                      value={draft.data?.[key] || ""}
                      onChange={(value) => updateDraftDataField(key, value)}
                    />
                  ))}
                </fieldset>
              ) : hasTemplateContent ? (
                <div className="space-y-5">
                  {templateFields.map(([key, label]) => {
                    const value = viewLore.data?.[key];
                    if (!String(value || "").trim()) return null;

                    return (
                      <div key={key}>
                        <h3 className="mb-1 text-sm font-semibold text-zinc-200">{label}</h3>
                        {renderMarkdownBlock(value)}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </Card>
          )}

          <LoreLinkSection
            key={`lore-sessions-${linkDraftKey}`}
            title="Sessions"
            emptyText="No linked sessions yet."
            loreId={viewLore.id}
            entityType="Session"
            addLabel="Session"
            entities={visibleSessions}
            links={visibleLoreLinks}
            allowedLabels={["revealed", "hinted"]}
            defaultLabel="revealed"
            isGM={isGM}
            isEditing={isEditing}
            isSaving={isSaving}
            getEntityLabel={getSessionLabel}
            getEntityMeta={(session) => session?.date || session?.status || ""}
            getEntityPath={(session) => `/sessions/${session.id}`}
            onLinksChanged={handleLinksChanged}
          />

          <LoreLinkSection
            key={`lore-items-${linkDraftKey}`}
            title="Items"
            emptyText="No linked items yet."
            loreId={viewLore.id}
            entityType="Item"
            addLabel="Item"
            entities={visibleItems}
            links={visibleLoreLinks}
            allowedLabels={["explains", "origin_of"]}
            defaultLabel="explains"
            isGM={isGM}
            isEditing={isEditing}
            isSaving={isSaving}
            getEntityLabel={getItemLabel}
            getEntityMeta={(item) => item?.type || item?.rarity || ""}
            getEntityPath={(item) => `/items/${item.id}`}
            onLinksChanged={handleLinksChanged}
          />

          <LoreLinkSection
            key={`lore-npcs-${linkDraftKey}`}
            title="NPCs"
            emptyText="No related NPCs yet."
            loreId={viewLore.id}
            entityType="NPC"
            addLabel="NPC"
            entities={visibleNpcs}
            links={visibleLoreLinks}
            allowedLabels={["connected", "describes", "origin_of"]}
            defaultLabel="connected"
            isGM={isGM}
            isEditing={isEditing}
            isSaving={isSaving}
            getEntityLabel={getNpcLabel}
            getEntityMeta={(npc) => npc?.title || npc?.role || ""}
            getEntityPath={(npc) => `/npcs/${npc.id}`}
            onLinksChanged={handleLinksChanged}
          />

          <LoreLinkSection
            key={`lore-locations-${linkDraftKey}`}
            title="Locations"
            emptyText="No linked locations yet."
            loreId={viewLore.id}
            entityType="Map"
            addLabel="Location"
            entities={visibleLocations}
            links={visibleLoreLinks}
            allowedLabels={["describes", "historical_site"]}
            defaultLabel="describes"
            isGM={isGM}
            isEditing={isEditing}
            isSaving={isSaving}
            getEntityLabel={getLocationLabel}
            getEntityMeta={(location) => location?.category || ""}
            getEntityPath={(location) => `/maps/${location.id}`}
            onLinksChanged={handleLinksChanged}
          />
        </div>

        {isGM && (
          <aside className="space-y-6">
            <Card title="GM Notes">
              {isEditing ? (
                <fieldset disabled={isSaving} className="disabled:opacity-60">
                  <TextField
                    label="GM Notes"
                    rows={10}
                    disabled={isSaving}
                    value={draft.gmNotes}
                    onChange={(value) => updateDraftField("gmNotes", value)}
                  />
                </fieldset>
              ) : (
                renderMarkdownBlock(viewLore.gmNotes, "No GM notes yet.")
              )}
            </Card>
          </aside>
        )}
      </div>
    </main>
  );
}
