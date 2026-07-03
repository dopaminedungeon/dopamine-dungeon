import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, Trash2 } from "lucide-react";
import { useMode } from "../context/ModeContext.jsx";
import { sessionsRepo } from "../data/sessions/sessions.repo";
import { itemsRepo } from "../data/items/items.repo";
import { npcsRepo } from "../data/npcs/npcs.repo";
import { loreRepo } from "../data/lore/lore.repo";
import { locationsRepo } from "../data/maps/locations.repo";
import { createLink } from "../domain/links/link.service";
import { addLink, getLinksForEntity, loadLinks, removeLink } from "../data/links/links.repo";
import { useCampaign } from "../context/CampaignContext";
import { getApiCampaignPeople, getApiCharacterAssignments } from "../data/api/apiClient.ts";
import { getAllCharacters } from "../data/characters/characters.repo";

const SESSION_STATUSES = ["scheduled", "active", "paused", "completed"];
const MAIN_LOCATION_LINK_NOTE = "auto:session-main-location";

function getSessionDateValue(value) {
  const rawDate = String(value || "").trim();
  if (!rawDate) return "";
  return rawDate.slice(0, 10);
}

function formatSessionDate(value) {
  const rawDate = getSessionDateValue(value);
  if (!rawDate) return "";

  const parsed = new Date(`${rawDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return rawDate;

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
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
    return <p className="text-zinc-500 text-sm italic">{placeholder}</p>;
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

  return (
    <div className="space-y-3 text-sm text-zinc-300">
      {nodes}
    </div>
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

function isSessionLocationLink(link, sessionId, locationId) {
  const other = getOtherEndpoint(link, "Session", sessionId);
  return other.type === "Map" && String(other.id) === String(locationId);
}

function isAutoMainLocationLink(link, sessionId, locationId) {
  return (
    isSessionLocationLink(link, sessionId, locationId) &&
    link.label === "visited" &&
    link.visibility === "Player" &&
    link.note === MAIN_LOCATION_LINK_NOTE
  );
}

function isVisitedPlayerSessionLocationLink(link, sessionId, locationId) {
  return (
    isSessionLocationLink(link, sessionId, locationId) &&
    link.label === "visited" &&
    link.visibility === "Player"
  );
}

function reconcileMainLocationLinks({ sessionId, originalLocationId, nextLocationId, links }) {
  let nextLinks = Array.isArray(links) ? [...links] : [];
  const previousLocationId = String(originalLocationId || "").trim();
  const selectedLocationId = String(nextLocationId || "").trim();

  if (previousLocationId && previousLocationId !== selectedLocationId) {
    nextLinks = nextLinks.filter(
      (link) => !isAutoMainLocationLink(link, sessionId, previousLocationId)
    );
  }

  if (!selectedLocationId) {
    nextLinks = nextLinks.filter(
      (link) => !isAutoMainLocationLink(link, sessionId, previousLocationId)
    );
    return nextLinks;
  }

  const alreadyLinked = nextLinks.some((link) =>
    isVisitedPlayerSessionLocationLink(link, sessionId, selectedLocationId)
  );
  if (alreadyLinked) return nextLinks;

  return [
    ...nextLinks,
    createLink({
      entityA: { type: "Session", id: String(sessionId) },
      entityB: { type: "Map", id: selectedLocationId },
      label: "visited",
      visibility: "Player",
      note: MAIN_LOCATION_LINK_NOTE,
    }),
  ];
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

function getLocationLabel(location) {
  return location?.name || "Untitled location";
}

function SelectInput({ value, onChange, disabled, children }) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="min-w-0 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-purple-500/60 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </select>
  );
}

function SessionLinkSection({
  title,
  emptyText,
  sessionId,
  entityType,
  addLabel,
  entities,
  links,
  allowedLabels,
  defaultLabel,
  defaultVisibility = "Player",
  isGM,
  editMode,
  isSaving,
  getEntityLabel,
  getEntityMeta,
  getEntityPath,
  onLinksChanged,
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedLabel, setSelectedLabel] = useState(defaultLabel);
  const [selectedVisibility, setSelectedVisibility] = useState(defaultVisibility);
  const [error, setError] = useState("");
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
        const other = getOtherEndpoint(link, "Session", sessionId);
        const entity = other.type === entityType ? entitiesById.get(String(other.id)) : null;

        if (!entity) return null;
        if (!allowedLabels.includes(link.label)) return null;
        if (!isGM && link.visibility !== "Player") return null;

        return { link, entity };
      })
      .filter(Boolean);
  }, [allowedLabels, entitiesById, entityType, isGM, links, sessionId]);

  const candidateEntities = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return entityList
      .filter((entity) => {
        const label = getEntityLabel(entity);
        if (normalizedQuery && !String(label || "").toLowerCase().includes(normalizedQuery)) {
          return false;
        }

        return !links.some((link) => {
          const other = getOtherEndpoint(link, "Session", sessionId);
          return other.type === entityType && String(other.id) === String(entity.id);
        });
      })
      .slice(0, 30);
  }, [entityList, entityType, getEntityLabel, links, query, sessionId]);

  function handleAdd(entityId) {
    if (isDisabled) return;
    const normalizedEntityId = String(entityId);

    const duplicate = links.some((link) => {
      const other = getOtherEndpoint(link, "Session", sessionId);
      return other.type === entityType && String(other.id) === normalizedEntityId;
    });

    if (duplicate) {
      setError("That entity is already linked.");
      return;
    }

    try {
      setError("");
      const link = createLink({
        entityA: { type: "Session", id: String(sessionId) },
        entityB: { type: entityType, id: normalizedEntityId },
        label: selectedLabel,
        visibility: selectedVisibility,
      });

      onLinksChanged([...links, link]);
      setQuery("");
      setSearchOpen(false);
    } catch (linkError) {
      console.error("[SessionProfile] Failed to stage link", linkError);
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

      const other = getOtherEndpoint(candidate, "Session", sessionId);
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
    <section className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {isGM && editMode ? (
          <button
            type="button"
            disabled={isDisabled}
            onClick={() => {
              if (isDisabled) return;
              setSearchOpen((current) => !current);
              setError("");
            }}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {searchOpen ? "Close" : `Add ${addLabel}`}
          </button>
        ) : null}
      </div>

      {isGM && editMode && searchOpen ? (
        <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-black/10 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_160px_140px]">
            <input
              value={query}
              disabled={isDisabled}
              onChange={(event) => {
                if (!isDisabled) setQuery(event.target.value);
              }}
              placeholder={`Search ${title.toLowerCase()}...`}
              className="min-w-0 rounded-xl border border-white/10 bg-transparent px-3 py-2 text-sm text-zinc-100 outline-none focus:border-purple-500/60 disabled:cursor-not-allowed disabled:opacity-50"
            />
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
              {isGM && editMode ? (
                <button
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleRemove(link.id)}
                  className="absolute right-3 top-3 text-[10px] text-red-400 opacity-0 transition hover:text-red-200 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Remove
                </button>
              ) : null}

              <Link
                to={getEntityPath(entity)}
                className="block max-w-full cursor-pointer text-left hover:text-purple-200"
              >
                <p className="pr-8 text-sm font-semibold text-white">{getEntityLabel(entity)}</p>
                {getEntityMeta ? (
                  <p className="mt-1 text-xs text-zinc-500">{getEntityMeta(entity)}</p>
                ) : null}
              </Link>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {isGM && editMode ? (
                  <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
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
                {isGM && !editMode ? (
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

export default function SessionProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isGM } = useMode();

  const { selectedCampaignId } = useCampaign();
  const [allSessions, setAllSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allItems, setAllItems] = useState([]);
  const [allNpcs, setAllNpcs] = useState([]);
  const [allLore, setAllLore] = useState([]);
  const [allLocations, setAllLocations] = useState([]);
  const [linksVersion, setLinksVersion] = useState(0);
  const [campaignPeople, setCampaignPeople] = useState([]);
  const [campaignCharacters, setCampaignCharacters] = useState([]);
  const [assignmentRows, setAssignmentRows] = useState([]);

  useEffect(() => {
      if (!selectedCampaignId) {
        setAllSessions([]);
        setAllItems([]);
        setAllNpcs([]);
        setAllLore([]);
        setAllLocations([]);
        setCampaignPeople([]);
      setCampaignCharacters([]);
      setAssignmentRows([]);
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      try {
        const [sessionData, itemData, npcData, loreData, locationData] = await Promise.all([
          sessionsRepo.getAll(selectedCampaignId),
          itemsRepo.getAll(selectedCampaignId),
          npcsRepo.getAll(selectedCampaignId),
          loreRepo.getAll(selectedCampaignId),
          locationsRepo.getAll(selectedCampaignId),
          loadLinks(selectedCampaignId),
        ]);
        setAllSessions(Array.isArray(sessionData) ? sessionData : []);
        setAllItems(Array.isArray(itemData) ? itemData : []);
        setAllNpcs(Array.isArray(npcData) ? npcData : []);
        setAllLore(Array.isArray(loreData) ? loreData : []);
        setAllLocations(Array.isArray(locationData) ? locationData : []);
        setLinksVersion((version) => version + 1);
      } catch (error) {
        console.error("[SessionProfile] Failed to load session data", error);
        setAllSessions([]);
        setAllItems([]);
        setAllNpcs([]);
        setAllLore([]);
        setAllLocations([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [selectedCampaignId]);

  useEffect(() => {
    if (!selectedCampaignId || !isGM) {
      setCampaignPeople([]);
      setCampaignCharacters([]);
      setAssignmentRows([]);
      return;
    }

    let cancelled = false;

    async function loadAttendanceOptions() {
      try {
        const [peopleData, charactersData, assignmentData] = await Promise.all([
          getApiCampaignPeople(selectedCampaignId),
          getAllCharacters(selectedCampaignId),
          getApiCharacterAssignments(selectedCampaignId),
        ]);

        if (cancelled) return;
        setCampaignPeople(peopleData.people || []);
        setCampaignCharacters(charactersData || []);
        setAssignmentRows(assignmentData.assignments || []);
      } catch (error) {
        if (cancelled) return;
        console.error("[SessionProfile] Failed to load attendance options", error);
        setCampaignPeople([]);
        setCampaignCharacters([]);
        setAssignmentRows([]);
      }
    }

    loadAttendanceOptions();

    return () => {
      cancelled = true;
    };
  }, [selectedCampaignId, isGM]);
  const session = useMemo(
    () => allSessions.find((s) => String(s.id) === String(id)),
    [allSessions, id]
  );

  const normalizedSession = useMemo(() => {
    if (!session) return null;
    const summary = session.summary ?? "";
    return {
      ...session,
      summary,
      timeline: session.timeline ?? "",
      moments: session.moments ?? "",
      quotes: session.quotes ?? "",
      gmNotes: session.gmNotes ?? "",
      gmSecrets: session.gmSecrets ?? "",
      gmPrep: Array.isArray(session.gmPrep) ? session.gmPrep : [],
      attendees: Array.isArray(session.attendees) ? session.attendees : [],
      startTime: getSessionDateValue(session.startTime),
    };
  }, [session]);

  const [editMode, setEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [draftLinks, setDraftLinks] = useState(null);
  const [linkDraftKey, setLinkDraftKey] = useState(0);
  const [editableSession, setEditableSession] = useState(() =>
    normalizedSession ? { ...normalizedSession } : null
  );

  useEffect(() => {
    if (normalizedSession && !editMode) setEditableSession({ ...normalizedSession });
  }, [normalizedSession, editMode]);

  const normalizedEditable = useMemo(() => {
    if (!editableSession) return null;
    const summary = editableSession.summary ?? "";
    return {
      ...editableSession,
      summary,
      timeline: editableSession.timeline ?? "",
      moments: editableSession.moments ?? "",
      quotes: editableSession.quotes ?? "",
      gmNotes: editableSession.gmNotes ?? "",
      gmSecrets: editableSession.gmSecrets ?? "",
      gmPrep: Array.isArray(editableSession.gmPrep) ? editableSession.gmPrep : [],
      attendees: Array.isArray(editableSession.attendees) ? editableSession.attendees : [],
      startTime: getSessionDateValue(editableSession.startTime),
    };
  }, [editableSession]);

  const [gmPrepText, setGmPrepText] = useState("");
  useEffect(() => {
    if (!normalizedSession) return;
    setGmPrepText(normalizedSession.gmPrep.join("\n"));
  }, [normalizedSession]);

  const attendeeOptions = useMemo(() => {
    const charactersById = new Map(
      (campaignCharacters || []).map((character) => [String(character.id), character])
    );
    const peopleByUserId = new Map(
      (campaignPeople || [])
        .filter((person) => person.type === "member" && person.status === "accepted")
        .map((person) => [String(person.userId || ""), person])
    );

    return (assignmentRows || [])
      .map((assignment) => {
        const character = charactersById.get(String(assignment.characterId));
        const person = peopleByUserId.get(String(assignment.userId || ""));
        const characterName = String(character?.name || "").trim();
        const playerName = String(person?.label || "").trim();
        if (!characterName || !playerName) return null;

        const label = `${characterName} — ${playerName}`;
        return { value: label, label };
      })
      .filter(Boolean)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [assignmentRows, campaignCharacters, campaignPeople]);

  const visibleItems = useMemo(() => {
    if (isGM) return allItems;
    return allItems.filter((item) => item?.visibility !== "gm-only");
  }, [allItems, isGM]);

  const visibleNpcs = useMemo(() => {
    if (isGM) return allNpcs;
    return allNpcs.filter((npc) => npc?.visibility !== "gm-only");
  }, [allNpcs, isGM]);

  const visibleLore = useMemo(() => {
    if (isGM) return allLore;
    return allLore.filter((lore) => lore?.visibility === "public");
  }, [allLore, isGM]);

  const visibleLocations = useMemo(() => {
    if (isGM) return allLocations;
    return allLocations.filter((location) => location?.visibility === "public");
  }, [allLocations, isGM]);
  const visibleLocationsById = useMemo(
    () => new Map(visibleLocations.map((location) => [String(location.id), location])),
    [visibleLocations]
  );

  const sessionLinks = useMemo(() => {
    void linksVersion;
    return normalizedSession
      ? getLinksForEntity("Session", String(normalizedSession.id), isGM ? "GM" : "Player")
      : [];
  }, [isGM, linksVersion, normalizedSession]);

  const visibleSessionLinks = editMode && draftLinks ? draftLinks : sessionLinks;

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

  function handleStartEdit() {
    if (!isGM || isSaving || isDeleting) return;

    setEditableSession(normalizedSession ? { ...normalizedSession } : null);
    setDraftLinks(sessionLinks);
    setLinkDraftKey((key) => key + 1);
    setEditMode(true);
  }

  function handleCancelEdit() {
    if (isSaving) return;

    setEditableSession(normalizedSession ? { ...normalizedSession } : null);
    setGmPrepText(normalizedSession?.gmPrep?.join("\n") || "");
    setDraftLinks(null);
    setLinkDraftKey((key) => key + 1);
    setEditMode(false);
  }

  async function handleSave() {
    if (!selectedCampaignId || !normalizedEditable || isSaving) return;

    const gmPrep = gmPrepText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const toSave = {
      ...normalizedEditable,
      summary: normalizedEditable.summary,
      timeline: normalizedEditable.timeline ?? "",
      moments: normalizedEditable.moments ?? "",
      quotes: normalizedEditable.quotes ?? "",
      startTime: getSessionDateValue(normalizedEditable.startTime),
      gmPrep,
      attendees: Array.isArray(normalizedEditable.attendees)
        ? normalizedEditable.attendees
        : [],
    };
    const nextLinks = reconcileMainLocationLinks({
      sessionId: String(toSave.id),
      originalLocationId: normalizedSession?.map,
      nextLocationId: toSave.map,
      links: draftLinks || sessionLinks,
    });

    try {
      setIsSaving(true);
      await sessionsRepo.upsert(selectedCampaignId, toSave);
      await applyDraftLinkChanges(sessionLinks, nextLinks);
      const data = await sessionsRepo.getAll(selectedCampaignId);
      setAllSessions(Array.isArray(data) ? data : []);
      setDraftLinks(null);
      setLinkDraftKey((key) => key + 1);
      setEditMode(false);
    } finally {
      setIsSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex-1 overflow-auto flex items-center justify-center">
        <div className="text-zinc-400">Loading session...</div>
      </main>
    );
  }
  // No such session at all
  if (!normalizedSession) {
    return (
      <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 text-white">
        <h1 className="text-3xl font-bold">Session Not Found</h1>
        <p className="text-zinc-400 mt-2">
          There is no session with this ID.
        </p>
        <button
          onClick={() => navigate("/sessions")}
          className="mt-4 px-4 py-2 bg-white/10 rounded-xl text-zinc-300 hover:bg-white/20"
        >
          Back to Sessions
        </button>
      </main>
    );
  }

  // GM restriction guard: prevent players from viewing GM-only sessions
  if (normalizedSession?.visibility === "gm-only" && !isGM) {
    return (
      <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
        <button
          className="mb-5 inline-flex items-center gap-2 text-sm text-zinc-300 hover:text-white"
          onClick={() => navigate("/sessions")}
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Sessions
        </button>
        <div className="max-w-xl mx-auto bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">DM Eyes Only</h1>
          <p className="text-zinc-400 text-sm mb-4">
            This session is marked GM-only. Players don’t get to see it until it’s revealed in play. 💜
          </p>
          <button
            className="mt-2 px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20"
            onClick={() => navigate("/sessions")}
          >
            Back to Sessions
          </button>
        </div>
      </main>
    );
  }

  const viewSession = editMode ? (normalizedEditable ?? normalizedSession) : normalizedSession;
  const isGmOnlyCurrent = viewSession?.visibility === "gm-only";
  const mainLocationId = String(viewSession?.map || "").trim();
  const mainLocation = mainLocationId ? visibleLocationsById.get(mainLocationId) : null;

  const handleFieldChange = (field, value) => {
    setEditableSession((prev) => {
      const base = prev ?? (normalizedSession ? { ...normalizedSession } : {});
      return { ...base, [field]: value };
    });
  };

  const handleVisibilityChange = (visibility) => {
    if (!isGM || !editMode) return;
    setEditableSession((prev) => ({
      ...prev,
      visibility,
    }));
  };

  const toggleAttendee = (attendeeValue) => {
    setEditableSession((prev) => {
      const base = prev ?? (normalizedSession ? { ...normalizedSession } : {});
      const current = Array.isArray(base.attendees) ? base.attendees : [];
      const next = current.includes(attendeeValue)
        ? current.filter((value) => value !== attendeeValue)
        : [...current, attendeeValue];

      return { ...base, attendees: next };
    });
  };

  return (
    <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <button
          className="mb-5 inline-flex items-center gap-2 text-sm text-zinc-300 hover:text-white"
          onClick={() => navigate("/sessions")}
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Sessions
        </button>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-6 lg:p-8 backdrop-blur-sm space-y-5 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white flex flex-wrap items-center gap-2">
              {viewSession?.name || "Untitled session"}
              {isGmOnlyCurrent && (
                <span className="px-2 py-1 text-[10px] rounded-full bg-red-500/20 text-red-300 border border-red-500/40">
                  GM ONLY
                </span>
              )}
            </h1>
            <p className="text-zinc-400 text-sm">
              {mainLocation ? (
                <Link
                  to={`/maps/${mainLocation.id}`}
                  className="text-zinc-300 hover:text-purple-200"
                >
                  {getLocationLabel(mainLocation)}
                </Link>
              ) : (
                "No location"
              )}
              {viewSession.sessionNumber !== undefined &&
                viewSession.sessionNumber !== null &&
                viewSession.sessionNumber !== "" && (
                <> • Session #{viewSession.sessionNumber}</>
              )}
              {viewSession.startTime && <> • {formatSessionDate(viewSession.startTime)}</>}
            </p>
          </div>

          {isGM && (
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 self-start">
              <div className="flex flex-wrap items-center gap-1 bg-white/5 border border-white/10 rounded-full p-1">
	                <button
	                  type="button"
	                  disabled={!editMode || isSaving}
                  onClick={() => handleVisibilityChange("public")}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${viewSession.visibility === "public"
                    ? "bg-emerald-500 text-white"
                    : "text-zinc-300 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-zinc-400"
                    }`}
                >
                  Player-visible
                </button>
	                <button
	                  type="button"
	                  disabled={!editMode || isSaving}
                  onClick={() => handleVisibilityChange("gm-only")}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${viewSession.visibility === "gm-only"
                    ? "bg-red-500 text-white"
                    : "text-zinc-300 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-zinc-400"
                    }`}
                >
                  GM-only
                </button>
              </div>
              {editMode ? (
                <>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleCancelEdit}
                    className="px-3 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-zinc-300 hover:bg-white/10 transition disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSave}
                    className="px-3 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-purple-500 text-xs font-medium text-white hover:bg-purple-400 transition disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={isSaving || isDeleting}
                  onClick={handleStartEdit}
                  className="px-3 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-zinc-300 hover:bg-white/10 transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Edit
                </button>
              )}
	              <button
	                type="button"
	                disabled={isDeleting || isSaving}
	                onClick={async () => {
	                  if (isDeleting || isSaving) return;
                  const ok = window.confirm("Delete this session? This cannot be undone.");
                  if (!ok) return;

                  try {
                    setIsDeleting(true);
                    await sessionsRepo.remove(selectedCampaignId, String(id));
                    navigate("/sessions");
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-red-500/15 border border-red-500/40 text-xs text-red-200 hover:bg-red-500/25 transition flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-red-500/15"
                title="Delete session"
              >
                <Trash2 className="w-4 h-4" />
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          )}
        </div>

	        <fieldset disabled={isSaving} className="contents disabled:opacity-60">
	        {isGM && editMode ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
            <h2 className="text-lg font-semibold text-white mb-4">Session details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs uppercase tracking-wide text-zinc-500 mb-1">Name</span>
                <input
                  className="w-full bg-transparent border border-white/15 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-500/60"
                  value={editableSession?.name ?? ""}
                  onChange={(e) => handleFieldChange("name", e.target.value)}
                />
              </label>
              <label className="block">
                <span className="block text-xs uppercase tracking-wide text-zinc-500 mb-1">Session number</span>
                <input
                  type="number"
                  min={0}
                  className="w-full bg-transparent border border-white/15 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-500/60"
                  value={editableSession?.sessionNumber ?? 0}
                  onChange={(e) =>
                    handleFieldChange(
                      "sessionNumber",
                      Number.isFinite(Number(e.target.value)) ? Number(e.target.value) : 0
                    )
                  }
                />
              </label>
              <label className="block">
                <span className="block text-xs uppercase tracking-wide text-zinc-500 mb-1">Date</span>
                <input
                  type="date"
                  className="w-full bg-transparent border border-white/15 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-500/60"
                  value={getSessionDateValue(editableSession?.startTime)}
                  onChange={(e) => handleFieldChange("startTime", getSessionDateValue(e.target.value))}
                />
              </label>
              <label className="block">
                <span className="block text-xs uppercase tracking-wide text-zinc-500 mb-1">Main Location</span>
                <select
                  className="w-full bg-zinc-950 border border-white/15 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-500/60"
                  value={editableSession?.map ?? ""}
                  onChange={(e) => handleFieldChange("map", e.target.value)}
                >
                  <option value="">No location</option>
                  {allLocations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name || "Untitled location"}
                      {location.category ? ` (${location.category})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-xs uppercase tracking-wide text-zinc-500 mb-1">Status</span>
                <select
                  className="w-full bg-zinc-950 border border-white/15 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-500/60"
                  value={editableSession?.status ?? "scheduled"}
                  onChange={(e) => handleFieldChange("status", e.target.value)}
                >
                  {SESSION_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-xs uppercase tracking-wide text-zinc-500 mb-1">Visibility</span>
                <select
                  className="w-full bg-zinc-950 border border-white/15 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-500/60"
                  value={editableSession?.visibility ?? "public"}
                  onChange={(e) => handleFieldChange("visibility", e.target.value)}
                >
                  <option value="public">Player-visible</option>
                  <option value="gm-only">GM-only</option>
                </select>
              </label>
            </div>
          </div>
        ) : null}

        {/* Player & GM layout */}
        <div className={`grid grid-cols-1 ${isGM ? "lg:grid-cols-2" : ""} gap-4 sm:gap-6 pt-2`}>
          {/* LEFT: Player overview */}
          <div className="space-y-4">
            {/* Recap */}
            <div className="bg-white/5 rounded-xl border border-white/10 p-4 sm:p-5">
              <h2 className="text-lg font-semibold text-white mb-2">Session recap</h2>
              {isGM && editMode ? (
                <textarea
                  className="w-full bg-transparent border border-white/15 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-500/60"
                  rows={4}
                  value={editableSession?.summary ?? ""}
                  onChange={(e) => handleFieldChange("summary", e.target.value)}
                />
              ) : (
                renderMarkdownBlock(viewSession?.summary, "No player-facing recap yet.")
              )}
            </div>

            {/* Linked entities (Session cross-links) */}

            {/* Attendance */}
            <div className="bg-white/5 rounded-xl border border-white/10 p-4 sm:p-5">
              <h2 className="text-lg font-semibold text-white mb-2">Attendance</h2>
              {isGM && editMode ? (
                <div className="space-y-2">
                  {attendeeOptions.length === 0 ? (
                    <p className="text-sm text-zinc-500">No assigned characters available for attendance yet.</p>
                  ) : (
                    attendeeOptions.map((option) => {
                      const checked = (editableSession?.attendees || []).includes(option.value);
                      return (
                        <label
                          key={option.value}
                          className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2 text-sm text-zinc-200"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAttendee(option.value)}
                            className="h-4 w-4 accent-purple-500"
                          />
                          <span>{option.label}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              ) : (viewSession?.attendees || []).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {viewSession.attendees.map((attendee) => (
                    <span
                      key={attendee}
                      className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100"
                    >
                      {attendee}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">No attendance recorded yet.</p>
              )}
            </div>

            <SessionLinkSection
              key={`session-npcs-${linkDraftKey}`}
              title="Notable NPCs"
              emptyText="No notable NPCs yet."
              sessionId={String(id)}
              entityType="NPC"
              addLabel="NPC"
              entities={visibleNpcs}
              links={visibleSessionLinks}
              allowedLabels={["present", "mentioned", "antagonist", "ally"]}
              defaultLabel="present"
              isGM={isGM}
              editMode={editMode}
              isSaving={isSaving}
              getEntityLabel={getNpcLabel}
              getEntityMeta={(npc) => npc?.title || npc?.role || ""}
              getEntityPath={(npc) => `/npcs/${npc.id}`}
              onLinksChanged={handleLinksChanged}
            />

            <SessionLinkSection
              key={`session-items-${linkDraftKey}`}
              title="Items discovered"
              emptyText="No linked items yet."
              sessionId={String(id)}
              entityType="Item"
              addLabel="Item"
              entities={visibleItems}
              links={visibleSessionLinks}
              allowedLabels={["introduced", "used", "consumed", "lost"]}
              defaultLabel="introduced"
              isGM={isGM}
              editMode={editMode}
              isSaving={isSaving}
              getEntityLabel={getItemLabel}
              getEntityMeta={(item) => item?.rarity || item?.type || ""}
              getEntityPath={(item) => `/items/${item.id}`}
              onLinksChanged={handleLinksChanged}
            />

            <SessionLinkSection
              key={`session-lore-${linkDraftKey}`}
              title="Lore"
              emptyText="No linked lore yet."
              sessionId={String(id)}
              entityType="Lore"
              addLabel="Lore"
              entities={visibleLore}
              links={visibleSessionLinks}
              allowedLabels={["revealed", "hinted"]}
              defaultLabel="revealed"
              isGM={isGM}
              editMode={editMode}
              isSaving={isSaving}
              getEntityLabel={getLoreLabel}
              getEntityMeta={(lore) => lore?.type || ""}
              getEntityPath={(lore) => `/lore/${lore.id}`}
              onLinksChanged={handleLinksChanged}
            />

            <SessionLinkSection
              key={`session-locations-${linkDraftKey}`}
              title="Locations"
              emptyText="No linked locations yet."
              sessionId={String(id)}
              entityType="Map"
              addLabel="Location"
              entities={visibleLocations}
              links={visibleSessionLinks}
              allowedLabels={["visited", "revealed"]}
              defaultLabel="visited"
              isGM={isGM}
              editMode={editMode}
              isSaving={isSaving}
              getEntityLabel={getLocationLabel}
              getEntityMeta={(location) => location?.category || ""}
              getEntityPath={(location) => `/maps/${location.id}`}
              onLinksChanged={handleLinksChanged}
            />

            {/* Session timeline */}
            {(editMode || (viewSession?.timeline && viewSession.timeline.trim().length > 0)) && (
              <div className="bg-white/5 rounded-xl border border-white/10 p-4 sm:p-5">
                <h2 className="text-lg font-semibold text-white mb-2">Session timeline</h2>

                {isGM && editMode ? (
                  <textarea
                    className="w-full bg-transparent border border-white/15 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-500/60"
                    rows={3}
                    value={editableSession?.timeline ?? ""}
                    onChange={(e) => handleFieldChange("timeline", e.target.value)}
                    placeholder="Key beats in order…"
                  />
                ) : (
                  renderMarkdownBlock(viewSession?.timeline)
                )}
              </div>
            )}

            {/* Moments */}
            {(editMode || (viewSession?.moments && viewSession.moments.trim().length > 0)) && (
              <div className="bg-white/5 rounded-xl border border-white/10 p-4 sm:p-5">
                <h2 className="text-lg font-semibold text-white mb-2">Moments</h2>

                {isGM && editMode ? (
                  <textarea
                    className="w-full bg-transparent border border-white/15 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-500/60"
                    rows={3}
                    value={editableSession?.moments ?? ""}
                    onChange={(e) => handleFieldChange("moments", e.target.value)}
                    placeholder="Cinematic highlights, emotional gut-punches…"
                  />
                ) : (
                  renderMarkdownBlock(viewSession?.moments)
                )}
              </div>
            )}

            {/* Quotes of the day */}
            {(editMode || (viewSession?.quotes && viewSession.quotes.trim().length > 0)) && (
              <div className="bg-white/5 rounded-xl border border-white/10 p-4 sm:p-5">
                <h2 className="text-lg font-semibold text-white mb-2">Quotes of the day</h2>

                {isGM && editMode ? (
                  <textarea
                    className="w-full bg-transparent border border-white/15 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-500/60"
                    rows={3}
                    value={editableSession?.quotes ?? ""}
                    onChange={(e) => handleFieldChange("quotes", e.target.value)}
                    placeholder="Best one-liners, table memes…"
                  />
                ) : (
                  renderMarkdownBlock(viewSession?.quotes)
                )}
              </div>
            )}
          </div>

          {/* RIGHT: GM-only zone */}
          {isGM && (
            <div className="space-y-4">
              {/* Off-screen events / GM notes / secrets */}
              <div className="bg-white/5 rounded-xl border border-purple-500/40 p-4 sm:p-5">
                <h2 className="text-lg font-semibold text-purple-200 mb-2">
                  Off-screen events & GM notes
                </h2>
                {isGM && editMode ? (
                  <div>
                    <label className="block text-xs uppercase tracking-wide text-purple-200 mb-1">
                      GM notes
                    </label>
                    <textarea
                      className="w-full bg-transparent border border-purple-500/40 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-400/80"
                      rows={3}
                      value={editableSession?.gmNotes ?? ""}
                      onChange={(e) => handleFieldChange("gmNotes", e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="mb-4">
                    <p className="text-xs uppercase tracking-wide text-purple-200 mb-1">
                      GM notes
                    </p>
                    {renderMarkdownBlock(viewSession.gmNotes, "No GM notes yet.")}
                  </div>
                )}
                {isGM && editMode ? (
                  <div className="mt-4">
                    <label className="block text-xs uppercase tracking-wide text-purple-200 mb-1">
                      Secrets &amp; twists
                    </label>
                    <textarea
                      className="w-full bg-transparent border border-purple-500/25 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-400/80"
                      rows={3}
                      value={editableSession?.gmSecrets ?? ""}
                      onChange={(e) => handleFieldChange("gmSecrets", e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="mb-4">
                    <p className="text-xs uppercase tracking-wide text-purple-200 mb-1">
                      Secrets &amp; twists
                    </p>
                    {renderMarkdownBlock(viewSession.gmSecrets, "No secrets or twists yet.")}
                  </div>
                )}
                {isGM && editMode ? (
                  <div className="mt-4">
                    <label className="block text-xs uppercase tracking-wide text-purple-200 mb-1">
                      Prep notes
                    </label>
                    <textarea
                      className="w-full bg-transparent border border-purple-500/25 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-400/80"
                      rows={3}
                      value={gmPrepText}
                      onChange={(e) => setGmPrepText(e.target.value)}
                    />
                  </div>
                ) : (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-purple-200 mb-1">
                      Prep notes
                    </p>
                    {renderMarkdownBlock(
                      Array.isArray(viewSession.gmPrep) ? viewSession.gmPrep.join("\n") : "",
                      "No prep notes yet."
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
	        </div>
	        </fieldset>

	        {/* Metadata strip */}
        <div className="grid grid-cols-1 gap-3 sm:gap-4 text-sm text-zinc-400 pt-2">
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-zinc-500" />
            <span>
              Status: {viewSession?.status || "—"} • Visibility: {isGmOnlyCurrent ? "GM-only" : "Player-visible"}
            </span>
          </div>
        </div>
        </div>
      </div>
    </main>
  );
}
