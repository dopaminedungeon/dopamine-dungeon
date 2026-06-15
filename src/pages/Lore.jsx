import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  Flag,
  Globe2,
  Landmark,
  Library,
  Plus,
  ScrollText,
  Search,
  Sparkles,
} from "lucide-react";
import { useMode } from "../context/ModeContext.jsx";
import { useCampaign } from "../context/CampaignContext";
import { loreRepo } from "../data/lore/lore.repo";

export const LORE_TYPES = [
  "Religion",
  "Faction",
  "Country",
  "Event",
  "Magic",
  "Concept / Ritual",
  "Lore",
];

const LORE_SECTION_ORDER = [
  "Magic",
  "Religion",
  "Faction",
  "Country",
  "Event",
  "Concept / Ritual",
  "Lore",
];

const TYPE_META = {
  Religion: {
    icon: Landmark,
    card: "border-amber-400/25 bg-amber-500/10 text-amber-200",
    iconWrap: "bg-amber-500/15 text-amber-200",
  },
  Faction: {
    icon: Flag,
    card: "border-rose-400/25 bg-rose-500/10 text-rose-200",
    iconWrap: "bg-rose-500/15 text-rose-200",
  },
  Country: {
    icon: Globe2,
    card: "border-sky-400/25 bg-sky-500/10 text-sky-200",
    iconWrap: "bg-sky-500/15 text-sky-200",
  },
  Event: {
    icon: ScrollText,
    card: "border-violet-400/25 bg-violet-500/10 text-violet-200",
    iconWrap: "bg-violet-500/15 text-violet-200",
  },
  Magic: {
    icon: Sparkles,
    card: "border-cyan-400/25 bg-cyan-500/10 text-cyan-200",
    iconWrap: "bg-cyan-500/15 text-cyan-200",
  },
  "Concept / Ritual": {
    icon: BookOpen,
    card: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
    iconWrap: "bg-emerald-500/15 text-emerald-200",
  },
  Lore: {
    icon: Library,
    card: "border-zinc-400/20 bg-zinc-500/10 text-zinc-200",
    iconWrap: "bg-zinc-500/15 text-zinc-200",
  },
};

function createLoreId() {
  try {
    return `lore-${crypto.randomUUID()}`;
  } catch {
    return `lore-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function createLoreDraft() {
  return {
    name: "",
    type: "Lore",
    visibility: "gm-only",
    summary: "",
    content: "",
    gmNotes: "",
    aliases: "",
    data: {},
  };
}

function normalizeAliases(value) {
  return Array.from(
    new Set(
      String(value || "")
        .split(",")
        .map((alias) => alias.trim())
        .filter(Boolean)
    )
  );
}

function getPlainTextPreview(value, fallback = "No player-facing details added yet.") {
  const text = String(value || "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1$2")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return fallback;
  return text.length > 180 ? `${text.slice(0, 177).trim()}...` : text;
}

function visibilityPill(visibility) {
  if (visibility === "public") {
    return (
      <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-200">
        Player-visible
      </span>
    );
  }

  return (
    <span className="rounded-full border border-rose-400/30 bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-200">
      GM-only
    </span>
  );
}

export function getLoreTypeMeta(type) {
  return TYPE_META[type] || TYPE_META.Lore;
}

export default function Lore() {
  const navigate = useNavigate();
  const { isGM } = useMode();
  const { selectedCampaignId } = useCampaign();

  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("All");
  const [selectedVisibility, setSelectedVisibility] = useState("All");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState(createLoreDraft());
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadLore() {
      if (!selectedCampaignId) {
        setEntries([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError("");
        const data = await loreRepo.getAll(selectedCampaignId);
        if (!cancelled) setEntries(data);
      } catch (loadError) {
        console.error("[Lore] Failed to load lore", loadError);
        if (!cancelled) {
          setEntries([]);
          setError("Unable to load Lore right now.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadLore();

    return () => {
      cancelled = true;
    };
  }, [selectedCampaignId]);

  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return entries.filter((entry) => {
      if (!isGM && entry.visibility === "gm-only") return false;

      const matchesType = selectedType === "All" || entry.type === selectedType;
      const matchesVisibility =
        !isGM ||
        selectedVisibility === "All" ||
        entry.visibility === selectedVisibility;

      const searchable = [
        entry.name,
        entry.type,
        entry.summary,
        entry.content,
        ...(Array.isArray(entry.aliases) ? entry.aliases : []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesType && matchesVisibility && (!query || searchable.includes(query));
    });
  }, [entries, isGM, searchQuery, selectedType, selectedVisibility]);

  const groupedEntries = useMemo(() => {
    return LORE_SECTION_ORDER.map((type) => ({
      type,
      entries: filteredEntries.filter((entry) => entry.type === type),
    })).filter((section) => section.entries.length > 0);
  }, [filteredEntries]);

  const hasActiveFilters =
    searchQuery.trim() || selectedType !== "All" || selectedVisibility !== "All";

  async function handleCreate(event) {
    event.preventDefault();
    if (!selectedCampaignId || isSavingRef.current || !formData.name.trim()) return;

    try {
      isSavingRef.current = true;
      setIsSaving(true);
      const nextLore = {
        id: createLoreId(),
        name: formData.name.trim(),
        type: formData.type,
        visibility: formData.visibility,
        summary: formData.summary.trim(),
        content: formData.content.trim(),
        gmNotes: formData.gmNotes.trim(),
        aliases: normalizeAliases(formData.aliases),
        data: {},
      };
      const savedLore = await loreRepo.upsert(selectedCampaignId, nextLore);
      setEntries((current) => [savedLore, ...current]);
      setShowCreateModal(false);
      setFormData(createLoreDraft());
      navigate(`/lore/${savedLore.id}`);
    } catch (saveError) {
      console.error("[Lore] Failed to create lore", saveError);
      setError("Unable to create Lore right now.");
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }

  if (!selectedCampaignId) {
    return (
      <main className="flex-1 overflow-auto p-8">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-300">
          Select a campaign to view Lore.
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-white">
            <Library className="h-7 w-7 text-violet-300" />
            Lore
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Campaign knowledge, beliefs, factions, histories, magic, and world truths.
          </p>
        </div>
      </div>

      <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search Lore..."
              className="w-full rounded-xl border border-white/10 bg-black/30 py-2.5 pl-10 pr-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-300"
            />
          </div>
          {isGM && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-400"
            >
              <Plus className="h-4 w-4" />
              Add Lore
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-2 text-zinc-400">
            Type
            <select
              value={selectedType}
              onChange={(event) => setSelectedType(event.target.value)}
              className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-violet-300"
            >
              <option>All</option>
              {LORE_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          {isGM && (
            <label className="flex items-center gap-2 text-zinc-400">
              Visibility
              <select
                value={selectedVisibility}
                onChange={(event) => setSelectedVisibility(event.target.value)}
                className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-violet-300"
              >
                <option>All</option>
                <option value="public">Player-visible</option>
                <option value="gm-only">GM-only</option>
              </select>
            </label>
          )}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedType("All");
                setSelectedVisibility("All");
              }}
              className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-white/10"
            >
              Reset Filters
            </button>
          )}
        </div>
      </section>

      {error && (
        <div className="mb-4 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-300">
          Loading Lore...
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <Library className="mx-auto mb-3 h-8 w-8 text-zinc-500" />
          <h2 className="text-base font-semibold text-white">No Lore entries yet</h2>
          <p className="mt-1 text-sm text-zinc-400">
            {isGM ? "Add the first entry when the world is ready for it." : "No player-visible Lore has been shared yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedEntries.map((section) => {
            const meta = getLoreTypeMeta(section.type);
            const Icon = meta.icon;

            return (
              <section key={section.type} className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.iconWrap}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">{section.type}</h2>
                    <p className="text-xs text-zinc-500">
                      {section.entries.length} {section.entries.length === 1 ? "entry" : "entries"}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {section.entries.map((entry) => {
                    const entryMeta = getLoreTypeMeta(entry.type);
                    const EntryIcon = entryMeta.icon;

                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => navigate(`/lore/${entry.id}`)}
                        className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left transition hover:border-violet-300/40 hover:bg-white/[0.07]"
                      >
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${entryMeta.iconWrap}`}>
                              <EntryIcon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${entryMeta.card}`}>
                                  {entry.type}
                                </span>
                                {isGM && visibilityPill(entry.visibility)}
                              </div>
                              <h2 className="mt-2 line-clamp-2 text-base font-semibold text-white">
                                {entry.name || "Untitled Lore"}
                              </h2>
                            </div>
                          </div>
                        </div>

                        {entry.aliases?.length ? (
                          <p className="mb-3 text-xs text-zinc-500">
                            Aliases: {entry.aliases.slice(0, 4).join(" • ")}
                          </p>
                        ) : null}

                        <p className="line-clamp-4 text-sm leading-6 text-zinc-400">
                          {getPlainTextPreview(entry.summary || entry.content)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black/70 p-4 backdrop-blur-sm">
          <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
            <div className="shrink-0 border-b border-white/10 p-5">
              <h2 className="text-lg font-semibold text-white">Add Lore</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Create a campaign-scoped Lore entry. Visibility defaults to GM-only.
              </p>
            </div>
            <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleCreate}>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
                <fieldset disabled={isSaving} className="space-y-4 disabled:opacity-60">
                  <div className="grid gap-4 sm:grid-cols-[1.2fr_0.8fr]">
                    <label className="space-y-1 text-sm text-zinc-300">
                      Name
                      <input
                        value={formData.name}
                        onChange={(event) =>
                          setFormData((current) => ({ ...current, name: event.target.value }))
                        }
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-violet-300"
                        required
                      />
                    </label>
                    <label className="space-y-1 text-sm text-zinc-300">
                      Type
                      <select
                        value={formData.type}
                        onChange={(event) =>
                          setFormData((current) => ({ ...current, type: event.target.value }))
                        }
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-violet-300"
                      >
                        {LORE_TYPES.map((type) => (
                          <option key={type}>{type}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="space-y-1 text-sm text-zinc-300">
                    Aliases
                    <input
                      value={formData.aliases}
                      onChange={(event) =>
                        setFormData((current) => ({ ...current, aliases: event.target.value }))
                      }
                      placeholder="Comma-separated aliases"
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-violet-300"
                    />
                  </label>

                  <label className="space-y-1 text-sm text-zinc-300">
                    Visibility
                    <select
                      value={formData.visibility}
                      onChange={(event) =>
                        setFormData((current) => ({ ...current, visibility: event.target.value }))
                      }
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-violet-300"
                    >
                      <option value="gm-only">GM-only</option>
                      <option value="public">Player-visible</option>
                    </select>
                  </label>

                  <label className="space-y-1 text-sm text-zinc-300">
                    Summary
                    <textarea
                      rows={3}
                      value={formData.summary}
                      onChange={(event) =>
                        setFormData((current) => ({ ...current, summary: event.target.value }))
                      }
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-violet-300"
                    />
                  </label>

                  <label className="space-y-1 text-sm text-zinc-300">
                    Content
                    <textarea
                      rows={5}
                      value={formData.content}
                      onChange={(event) =>
                        setFormData((current) => ({ ...current, content: event.target.value }))
                      }
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-violet-300"
                    />
                  </label>

                  <label className="space-y-1 text-sm text-zinc-300">
                    GM Notes
                    <textarea
                      rows={4}
                      value={formData.gmNotes}
                      onChange={(event) =>
                        setFormData((current) => ({ ...current, gmNotes: event.target.value }))
                      }
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-violet-300"
                    />
                  </label>
                </fieldset>
              </div>
              <div className="flex shrink-0 justify-end gap-3 border-t border-white/10 p-5">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormData(createLoreDraft());
                  }}
                  className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !formData.name.trim()}
                  className="rounded-xl bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? "Creating..." : "Create Lore"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
