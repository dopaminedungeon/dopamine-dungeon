import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMode } from "../context/ModeContext.jsx";
import { ArrowLeft, Swords, Shield, Sparkles, Trash2 } from "lucide-react";
import { itemsRepo } from "../data/items/items.repo";
import { sessionsRepo } from "../data/sessions/sessions.repo";
import { useCampaign } from "../context/CampaignContext";
import { getLinksForEntity, loadLinks } from "../data/links/links.repo";
import { getApiCampaignPeople, getApiCharacterAssignments } from "../data/api/apiClient";
import { getAllCharacters } from "../data/characters/characters.repo";

const ITEM_TYPES = [
  "Weapon",
  "Armor",
  "Shield",
  "Consumable",
  "Potion",
  "Scroll",
  "Wand",
  "Staff",
  "Rod",
  "Ring",
  "Wondrous Item",
  "Artifact",
  "Tool",
  "Adventuring Gear",
  "Mount / Vehicle",
  "Other",
];

const rarityColors = {
  Legendary: "from-amber-500 to-orange-600",
  Epic: "from-purple-500 to-violet-600",
  Rare: "from-blue-500 to-cyan-600",
  "Very Rare": "from-indigo-500 to-blue-600",
  Uncommon: "from-emerald-500 to-green-600",
  Common: "from-zinc-500 to-zinc-600",
};

const typeIcons = {
  Weapon: Swords,
  Armor: Shield,
  Shield: Shield,
  Consumable: Sparkles,
  Potion: Sparkles,
  Scroll: Sparkles,
  Wand: Sparkles,
  Staff: Sparkles,
  Rod: Sparkles,
  Ring: Sparkles,
  "Wondrous Item": Sparkles,
  Artifact: Sparkles,
  Tool: Sparkles,
  "Adventuring Gear": Sparkles,
  "Mount / Vehicle": Sparkles,
  Other: Sparkles,
};
const formatSigned = (value) => {
  const n = Number(value) || 0;
  return n >= 0 ? `+${n}` : `${n}`;
};

function formatPersonName(value) {
  const raw = String(value || "").trim();
  if (!raw || raw === "—") return "Player";
  const localPart = raw.includes("@") ? raw.split("@")[0] : raw;
  const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(localPart);
  if (looksLikeUuid) return "Player";

  return localPart
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Player";
}

function formatOwnerDisplay(value) {
  const raw = String(value || "").trim();
  if (!raw) return "Unassigned";
  if (raw.includes("@")) return formatPersonName(raw);
  return raw;
}

export default function ItemProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isGM } = useMode();

  const { selectedCampaignId } = useCampaign();
  const [item, setItem] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isItemSaving, setIsItemSaving] = useState(false);
  const [isItemDeleting, setIsItemDeleting] = useState(false);
  const isItemSavingRef = useRef(false);
  const [linksVersion, setLinksVersion] = useState(0);
  const [ownerOptions, setOwnerOptions] = useState([{ value: "", label: "Unassigned" }]);

  const rawItem = item && String(item.id) === String(id) ? item : null;

  const [formData, setFormData] = useState(null);

  useEffect(() => {
    if (!selectedCampaignId) {
      setItem(null);
      setSessions([]);
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      try {
        const [
          itemData,
          sessionData,
          _links,
          campaignPeopleResponse,
          characters,
          assignmentData,
        ] = await Promise.all([
          itemsRepo.getById(selectedCampaignId, String(id)),
          sessionsRepo.getAll(selectedCampaignId),
          loadLinks(selectedCampaignId),
          isGM ? getApiCampaignPeople(selectedCampaignId) : Promise.resolve({ people: [] }),
          isGM ? getAllCharacters(selectedCampaignId) : Promise.resolve([]),
          isGM
            ? getApiCharacterAssignments(selectedCampaignId)
            : Promise.resolve({ assignments: [] }),
        ]);
        void _links;
        setItem(itemData || null);
        setSessions(Array.isArray(sessionData) ? sessionData : []);
        setLinksVersion((version) => version + 1);

        const characterById = new Map(
          (characters || []).map((character) => [String(character.id), character])
        );
        const peopleByUserId = new Map(
          (campaignPeopleResponse.people || [])
            .filter((person) => person.type === "member" && person.status === "accepted")
            .map((person) => [String(person.userId || ""), person])
        );
        const nextOwnerOptions = new Map([["", { value: "", label: "Unassigned" }]]);
        const addOwnerOption = (value, label, aliases = []) => {
          const trimmedLabel = String(label || "").trim();
          const trimmedValue = String(value || "").trim();
          if (!trimmedValue || !trimmedLabel || nextOwnerOptions.has(trimmedValue)) return;
          nextOwnerOptions.set(trimmedValue, {
            value: trimmedValue,
            label: trimmedLabel,
            aliases: aliases.map((alias) => String(alias || "").trim()).filter(Boolean),
          });
        };

        (assignmentData.assignments || []).forEach((assignment) => {
          const character = characterById.get(String(assignment.characterId));
          const characterName = String(character?.name || "").trim();
          const person = peopleByUserId.get(String(assignment.userId || ""));
          if (!characterName || !person) return;

          const playerName = formatPersonName(person.label || person.email || person.userId);
          const label = `${characterName} — ${playerName}`;
          addOwnerOption(label, label, [
            assignment.characterId,
            assignment.userId,
            characterName,
          ]);
        });

        setOwnerOptions(Array.from(nextOwnerOptions.values()));
      } catch (error) {
        console.error("[ItemProfile] Failed to load items", error);
        setItem(null);
        setSessions([]);
        setOwnerOptions([{ value: "", label: "Unassigned" }]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [selectedCampaignId, id, isGM]);

  useEffect(() => {
    setFormData(rawItem || null);
  }, [rawItem]);
  useEffect(() => {
    if (!formData?.owner) return;

    const ownerOption = ownerOptions.find((entry) =>
      (entry.aliases || []).includes(String(formData.owner))
    );

    if (ownerOption && ownerOption.value !== formData.owner) {
      setFormData((prev) => (prev ? { ...prev, owner: ownerOption.value } : prev));
    }
  }, [formData?.owner, ownerOptions]);
  const [isEditing, setIsEditing] = useState(false);
  const itemLinks = useMemo(
    () => getLinksForEntity("Item", String(id), isGM ? "GM" : "Player"),
    [id, isGM, linksVersion]
  );
  const sessionsById = useMemo(
    () => new Map(sessions.map((session) => [String(session?.id), session])),
    [sessions]
  );
  const getEndpointLabel = (endpoint) => {
    if (endpoint.type === "BagOfHolding") return "Bag of Holding";
    if (endpoint.type !== "Session") return endpoint.id;

    const session = sessionsById.get(String(endpoint.id));
    return session?.name || session?.title || endpoint.id;
  };
  const getEndpointTypeLabel = (endpoint) => {
    if (endpoint.type === "BagOfHolding") return "";
    return `${endpoint.type}: `;
  };
  const getLinkLabel = (label) => {
    if (label === "contained_in") return "contained in";
    return String(label || "").replaceAll("_", " ");
  };
  const getOwnerLabel = (ownerValue) => {
    const normalized = String(ownerValue || "").trim();
    if (!normalized) return "Unassigned";
    const option = ownerOptions.find(
      (entry) =>
        entry.value === normalized ||
        entry.label === normalized ||
        (entry.aliases || []).includes(normalized)
    );
    return option?.label || formatOwnerDisplay(normalized);
  };

  if (loading) {
    return (
      <div className="p-8 text-white">
        <div className="text-zinc-400">Loading item...</div>
      </div>
    );
  }

  if (!formData) {
    return (
      <div className="p-8 text-white">
        <h1 className="text-3xl font-bold">Item Not Found</h1>
        <p className="mt-2 text-zinc-400">There is no item with this ID.</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 bg-white/10 rounded-xl text-zinc-300 hover:bg-white/20"
        >
          Go Back
        </button>
      </div>
    );
  }

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleStatChange = (statKey, value) => {
    setFormData(prev => ({
      ...prev,
      stats: {
        ...(prev.stats || {}),
        [statKey]: Number.isNaN(Number(value)) ? (prev.stats || {})[statKey] : Number(value),
      },
    }));
  };

  const handleVisibilityChange = (visibility) => {
    setFormData(prev => ({ ...prev, visibility }));
  };

  const rarityBg = rarityColors[formData?.rarity] || rarityColors.Common;
  const Icon = typeIcons[formData?.type] || Sparkles;
  const visibility = formData?.visibility || "public";



  // Hard gate: players should not be able to open GM-only items via direct URL.
  if (!isGM && visibility === "gm-only") {
    return (
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-xl mx-auto bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">DM Eyes Only</h1>
          <p className="text-zinc-400 text-sm mb-4">
            This item is marked GM-only. Players don’t get to see it until it’s discovered at the table. 💜
          </p>
          <button
            className="mt-2 px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20"
            onClick={() => navigate("/items")}
          >
            Back to Items
          </button>
        </div>
      </main>
    );
  }

  return (
    <>
      {/* Page title (since TopBar is now provided by AppLayout) */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-white">
          {formData.name}
        </h1>
        <p className="mt-1 text-xs md:text-sm text-zinc-400">
          {formData.type} • <span className="font-medium">{formData.rarity}</span>
        </p>
      </div>

      <div className="flex items-center justify-between mb-6">
        <button
          className="flex items-center gap-2 text-zinc-400 hover:text-white"
          onClick={() => navigate("/items")}
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Items
        </button>
        {isGM && (
          <div className="flex w-full sm:w-auto flex-col sm:flex-row gap-2">
            <button
              onClick={async () => {
	                if (isItemSavingRef.current || isItemDeleting) return;
                if (isEditing && formData && selectedCampaignId) {
                  try {
                    isItemSavingRef.current = true;
                    setIsItemSaving(true);
                    const savedItem = await itemsRepo.upsert(selectedCampaignId, formData);
                    setItem(savedItem || formData);
                  } finally {
                    isItemSavingRef.current = false;
                    setIsItemSaving(false);
                  }
                }
                setIsEditing((prev) => !prev);
              }}
	              disabled={isItemSaving || isItemDeleting}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-white/10 text-zinc-200 hover:bg-white/20 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isItemSaving ? "Saving..." : isEditing ? "Done" : "Edit"}
            </button>

            <button
              type="button"
              onClick={async () => {
	                if (isItemSaving || isItemDeleting || !selectedCampaignId || !formData?.id) return;
	                const ok = window.confirm("Delete this item? This cannot be undone.");
	                if (!ok) return;

	                try {
                    setIsItemDeleting(true);
	                  await itemsRepo.remove(selectedCampaignId, String(formData.id));
	                  navigate("/items");
	                } catch (error) {
	                  console.error("[ItemProfile] Failed to delete item", error);
	                  alert("Could not delete item. Please try again.");
                  } finally {
                    setIsItemDeleting(false);
	                }
	              }}
	              disabled={isItemSaving || isItemDeleting}
	              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/40 text-red-200 hover:bg-red-500/25 text-sm font-medium inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
	            >
	              <Trash2 className="w-4 h-4" />
	              {isItemDeleting ? "Deleting..." : "Delete"}
	            </button>
          </div>
        )}
      </div>

	      <fieldset disabled={isItemSaving} className="contents disabled:opacity-60">
	      {/* Header / identity */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-4">
            <div
              className={`w-20 h-20 rounded-2xl bg-linear-to-br ${rarityBg} flex items-center justify-center text-white`}
            >
              <Icon className="w-10 h-10" />
            </div>
            <div>
              {isEditing && isGM ? (
                <input
                  className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-2xl font-bold text-white"
                  value={formData.name}
                  onChange={(e) => handleFieldChange("name", e.target.value)}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-3xl font-bold text-white">{formData.name}</h2>
                  {isGM && visibility === "gm-only" && (
                    <span className="px-2 py-0.5 text-[10px] rounded-full bg-red-500/20 text-red-300 border border-red-500/40 uppercase tracking-wide">
                      GM ONLY
                    </span>
                  )}
                </div>
              )}
              <div className="flex gap-2 mt-1">
                {isEditing && isGM ? (
                  <>
                    <select
                      className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-sm text-white"
                      value={formData.type}
                      onChange={(e) => handleFieldChange("type", e.target.value)}
                    >
                      {ITEM_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    <select
                      className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-sm text-white"
                      value={formData.rarity}
                      onChange={(e) => handleFieldChange("rarity", e.target.value)}
                    >
                      <option value="Legendary">Legendary</option>
                      <option value="Epic">Epic</option>
                      <option value="Rare">Rare</option>
                      <option value="Very Rare">Very Rare</option>
                      <option value="Uncommon">Uncommon</option>
                      <option value="Common">Common</option>
                    </select>
                  </>
                ) : (
                  <p className="text-zinc-400 text-sm">
                    {formData.type} • <span className="font-medium">{formData.rarity}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div className="bg-white/5 rounded-xl border border-white/10 px-4 py-3">
              <p className="text-zinc-500 text-xs uppercase tracking-wide">Bonus</p>
              {isEditing && isGM ? (
                <input
                  type="number"
                  className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-xl font-bold text-white w-20"
                  value={formData.bonus}
                  onChange={(e) => handleFieldChange("bonus", Number(e.target.value))}
                />
              ) : (
                <p className="text-white text-xl font-bold">{formatSigned(formData.bonus)}</p>
              )}
            </div>
            <div className="bg-white/5 rounded-xl border border-white/10 px-4 py-3">
              <p className="text-zinc-500 text-xs uppercase tracking-wide">Attunement</p>
              {isEditing && isGM ? (
                <select
                  className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-white"
                  value={formData.attunement}
                  onChange={(e) => handleFieldChange("attunement", e.target.value)}
                >
                  <option value="Required">Required</option>
                  <option value="None">None</option>
                </select>
              ) : (
                <p className="text-white font-medium">{formData.attunement || "None"}</p>
              )}
            </div>
            <div className="bg-white/5 rounded-xl border border-white/10 px-4 py-3">
              <p className="text-zinc-500 text-xs uppercase tracking-wide">Visibility</p>
              {isEditing && isGM ? (
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => handleVisibilityChange("public")}
                    className={`px-3 py-1 rounded-full text-xs font-medium border ${visibility === "public"
                      ? "bg-emerald-500/20 border-emerald-400 text-emerald-200"
                      : "bg-white/5 border-white/10 text-zinc-300"
                      }`}
                  >
                    Player-visible
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVisibilityChange("gm-only")}
                    className={`px-3 py-1 rounded-full text-xs font-medium border ${visibility === "gm-only"
                      ? "bg-red-500/20 border-red-400 text-red-200"
                      : "bg-white/5 border-white/10 text-zinc-300"
                      }`}
                  >
                    GM only
                  </button>
                </div>
              ) : (
                <p className="text-white font-medium">
                  {visibility === "gm-only" ? "GM-only" : "Player-visible"}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Player vs GM columns */}
      <div className={`grid grid-cols-1 gap-6 ${isGM ? "lg:grid-cols-2" : ""}`}>
        {/* Player-safe column */}
        <div className="space-y-4">
          {/* Description */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h2 className="text-lg font-semibold text-white mb-2">Item description</h2>
            {isEditing && isGM ? (
              <textarea
                className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-zinc-200 w-full min-h-20"
                value={formData.description}
                onChange={(e) => handleFieldChange("description", e.target.value)}
              />
            ) : (
              <p className="text-zinc-400">{formData.description || ""}</p>
            )}
          </section>

          {/* Core stats */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h2 className="text-lg font-semibold text-white mb-3">Core stats</h2>
            <div className="flex flex-wrap gap-2 mb-3">
              {isEditing && isGM ? (
                <>
                  <select
                    className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-xs text-white"
                    value={formData.type}
                    onChange={(e) => handleFieldChange("type", e.target.value)}
                  >
                    {ITEM_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <select
                    className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-xs text-white"
                    value={formData.rarity}
                    onChange={(e) => handleFieldChange("rarity", e.target.value)}
                  >
                    <option value="Legendary">Legendary</option>
                    <option value="Epic">Epic</option>
                    <option value="Rare">Rare</option>
                    <option value="Very Rare">Very Rare</option>
                    <option value="Uncommon">Uncommon</option>
                    <option value="Common">Common</option>
                  </select>
                  <span className="px-3 py-1 rounded-lg bg-white/5 text-zinc-300 text-xs uppercase tracking-wide">
                    Bonus {formatSigned(formData.bonus)}
                  </span>
                </>
              ) : (
                <>
                  <span className="px-3 py-1 rounded-lg bg-white/5 text-zinc-300 text-xs uppercase tracking-wide">
                    {formData.type}
                  </span>
                  <span className="px-3 py-1 rounded-lg bg-white/5 text-zinc-300 text-xs uppercase tracking-wide">
                    {formData.rarity}
                  </span>
                  <span className="px-3 py-1 rounded-lg bg-white/5 text-zinc-300 text-xs uppercase tracking-wide">
                    Bonus {formatSigned(formData.bonus)}
                  </span>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {isEditing && isGM
                ? Object.entries(formData.stats || {}).map(([key, value]) => (
                  <span
                    key={key}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 text-zinc-300 text-sm"
                  >
                    <span>{key}:</span>
                    <input
                      type="number"
                      className="bg-transparent border border-white/20 rounded px-1 py-0.5 w-16 text-zinc-100"
                      value={value}
                      onChange={(e) => handleStatChange(key, e.target.value)}
                    />
                  </span>
                ))
                : Object.entries(formData.stats || {}).map(([key, value]) => (
                  <span
                    key={key}
                    className="px-3 py-1 rounded-lg bg-white/5 text-zinc-300 text-sm"
                  >
                    {key}: {value}
                  </span>
                ))}
            </div>
          </section>

          {/* Ownership & usage */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h2 className="text-lg font-semibold text-white mb-2">Ownership & usage</h2>
            <p className="text-zinc-400 text-sm mb-1 flex items-center gap-2">
              <span className="text-zinc-500">Current owner:</span>
              {isEditing && isGM ? (
                <select
                  className="bg-zinc-950 border border-white/20 rounded-lg px-2 py-1 text-white font-medium"
                  value={
                    ownerOptions.some((entry) => entry.value === formData.owner)
                      ? formData.owner
                      : getOwnerLabel(formData.owner) === "Unassigned"
                        ? ""
                        : getOwnerLabel(formData.owner)
                  }
                  onChange={(e) => handleFieldChange("owner", e.target.value)}
                >
                  {ownerOptions
                    .concat(
                      formData.owner &&
                        !ownerOptions.some(
                          (entry) =>
                            entry.value === formData.owner ||
                            entry.label === formData.owner ||
                            (entry.aliases || []).includes(formData.owner)
                        )
                        ? [{ value: formData.owner, label: getOwnerLabel(formData.owner) }]
                        : []
                    )
                    .map((option) => (
                      <option key={option.value || "unassigned"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                </select>
              ) : (
                <span className="text-white font-medium">{getOwnerLabel(formData.owner)}</span>
              )}
            </p>
            <p className="text-zinc-400 text-sm mb-1 flex items-center gap-2">
              <span className="text-zinc-500">Typical location:</span>
              {isEditing && isGM ? (
                <input
                  className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-white/90"
                  value={formData.location || ""}
                  onChange={(e) => handleFieldChange("location", e.target.value)}
                />
              ) : (
                <span className="text-white/90">{formData.location || "—"}</span>
              )}
            </p>
            <p className="text-zinc-500 text-xs mt-2">
              Later this card will auto-link to PCs, sessions and maps that reference this item.
            </p>
          </section>

          {/* v0.1: cross-links */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h2 className="text-lg font-semibold text-white mb-2">Where it showed up</h2>
            {itemLinks.length === 0 ? (
              <p className="text-zinc-400 text-sm">No visible links yet.</p>
            ) : (
              <div className="space-y-2">
                {itemLinks.map((link) => {
                  // Bidirectional display: show the endpoint on the other side of this Item link.
                  const other =
                    link.entityA.type === "Item" && link.entityA.id === String(id)
                      ? link.entityB
                      : link.entityA;

                  return (
                    <div
                      key={link.id}
                      className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-300"
                    >
                      <span className="text-white">{getEndpointTypeLabel(other)}{getEndpointLabel(other)}</span>
                      <span className="mx-2 text-zinc-600">•</span>
                      {getLinkLabel(link.label)}
                      {isGM ? (
                        <span className="ml-2 text-xs text-zinc-500">[{link.visibility}]</span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h2 className="text-lg font-semibold text-white mb-2">Bag of Holding</h2>
            <p className="text-sm text-zinc-400">
              Bag integration will return after Firestore bag migration.
            </p>
          </section>
        </div>

        {/* GM-only column */}
        {isGM && (
          <div className="space-y-4">
            <section className="bg-white/5 border border-purple-500/30 rounded-2xl p-5">
              <h2 className="text-lg font-semibold text-white mb-2">Hidden properties (GM only)</h2>
              {isEditing && isGM ? (
                <textarea
                  className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-zinc-200 w-full min-h-15"
                  value={formData.hiddenEffects}
                  onChange={(e) => handleFieldChange("hiddenEffects", e.target.value)}
                />
              ) : (
                <p className="text-zinc-400">
                  {formData.hiddenEffects ||
                    "Space for secret mechanics, extra damage riders, or conditional bonuses the players haven't discovered yet."}
                </p>
              )}
            </section>

            <section className="bg-white/5 border border-red-500/30 rounded-2xl p-5">
              <h2 className="text-lg font-semibold text-white mb-2">Curses & drawbacks</h2>
              {isEditing && isGM ? (
                <textarea
                  className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-zinc-200 w-full min-h-15"
                  value={formData.curse}
                  onChange={(e) => handleFieldChange("curse", e.target.value)}
                />
              ) : (
                <p className="text-zinc-400">
                  {formData.curse && formData.curse !== "—"
                    ? formData.curse
                    : "If this item has a curse or downside, park it here so you remember to actually use it at the table."}
                </p>
              )}
            </section>

            <section className="bg-white/5 border border-emerald-500/30 rounded-2xl p-5">
              <h2 className="text-lg font-semibold text-white mb-2">Upgrade path / evolution</h2>
              {isEditing && isGM ? (
                <textarea
                  className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-zinc-200 w-full min-h-15"
                  value={formData.upgradePath}
                  onChange={(e) => handleFieldChange("upgradePath", e.target.value)}
                />
              ) : (
                <p className="text-zinc-400">
                  {formData.upgradePath ||
                    "Ideas for how this item can grow with the party: reforging, absorbing shards, unlocking attunement tiers, etc."}
                </p>
              )}
            </section>

            <section className="bg-white/5 border border-blue-500/30 rounded-2xl p-5">
              <h2 className="text-lg font-semibold text-white mb-2">Story hooks & links</h2>
              {isEditing && isGM ? (
                <textarea
                  className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-zinc-200 w-full min-h-15"
                  value={formData.storyHooks}
                  onChange={(e) => handleFieldChange("storyHooks", e.target.value)}
                />
              ) : (
                <>
                  <p className="text-zinc-400 mb-2">
                    {formData.storyHooks ||
                      "Notes on which NPCs, factions, maps or future sessions this item is tied to."}
                  </p>
                  <p className="text-zinc-500 text-xs">Later this will connect to Sessions, NPCs and Maps automatically.</p>
                </>
              )}
            </section>
          </div>
        )}
	      </div>
        </fieldset>
	    </>
  );
}
