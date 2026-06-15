import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  Castle,
  Landmark,
  Map,
  Mountain,
  Plus,
  Search,
  Trees,
} from "lucide-react";
import { useMode } from "../context/ModeContext.jsx";
import { useCampaign } from "../context/CampaignContext";
import { locationsRepo } from "../data/maps/locations.repo";

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
  District: { icon: Map, badge: "border-indigo-400/25 bg-indigo-500/10 text-indigo-200", iconWrap: "bg-indigo-500/15 text-indigo-200" },
  Building: { icon: Castle, badge: "border-stone-400/25 bg-stone-500/10 text-stone-200", iconWrap: "bg-stone-500/15 text-stone-200" },
  Region: { icon: Mountain, badge: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200", iconWrap: "bg-emerald-500/15 text-emerald-200" },
  Landmark: { icon: Landmark, badge: "border-amber-400/25 bg-amber-500/10 text-amber-200", iconWrap: "bg-amber-500/15 text-amber-200" },
  Wilderness: { icon: Trees, badge: "border-green-400/25 bg-green-500/10 text-green-200", iconWrap: "bg-green-500/15 text-green-200" },
  Dungeon: { icon: Castle, badge: "border-rose-400/25 bg-rose-500/10 text-rose-200", iconWrap: "bg-rose-500/15 text-rose-200" },
  Other: { icon: Map, badge: "border-zinc-400/20 bg-zinc-500/10 text-zinc-200", iconWrap: "bg-zinc-500/15 text-zinc-200" },
};

function getCategoryMeta(category) {
  return CATEGORY_META[category] || CATEGORY_META.Other;
}

function createLocationId() {
  try {
    return `location-${crypto.randomUUID()}`;
  } catch {
    return `location-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function createDraft() {
  return {
    name: "",
    category: "Other",
    visibility: "gm-only",
    aliases: "",
    summary: "",
    description: "",
    gmNotes: "",
    imageUrl: "",
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

function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read image file."));
    reader.readAsDataURL(file);
  });
}

export default function Maps() {
  const navigate = useNavigate();
  const { isGM } = useMode();
  const { selectedCampaignId } = useCampaign();

  const [locations, setLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [imageError, setImageError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedVisibility, setSelectedVisibility] = useState("All");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState(createDraft());
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadLocations() {
      if (!selectedCampaignId) {
        setLocations([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError("");
        const data = await locationsRepo.getAll(selectedCampaignId);
        if (!cancelled) setLocations(data);
      } catch (loadError) {
        console.error("[Locations] Failed to load locations", loadError);
        if (!cancelled) {
          setLocations([]);
          setError("Unable to load Locations right now.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadLocations();

    return () => {
      cancelled = true;
    };
  }, [selectedCampaignId]);

  const filteredLocations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return locations.filter((location) => {
      if (!isGM && location.visibility === "gm-only") return false;

      const matchesCategory =
        selectedCategory === "All" || location.category === selectedCategory;
      const matchesVisibility =
        !isGM ||
        selectedVisibility === "All" ||
        location.visibility === selectedVisibility;
      const searchable = [
        location.name,
        location.category,
        location.summary,
        location.description,
        ...(Array.isArray(location.aliases) ? location.aliases : []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesCategory && matchesVisibility && (!query || searchable.includes(query));
    });
  }, [isGM, locations, searchQuery, selectedCategory, selectedVisibility]);

  const hasActiveFilters =
    searchQuery.trim() || selectedCategory !== "All" || selectedVisibility !== "All";

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
      setFormData((current) => ({ ...current, imageUrl }));
    } catch (readError) {
      console.error("[Locations] Failed to read image", readError);
      setImageError("Unable to read that image file.");
    }
  }

  async function handleCreate(event) {
    event.preventDefault();
    if (!selectedCampaignId || isSavingRef.current || !formData.name.trim()) return;

    try {
      isSavingRef.current = true;
      setIsSaving(true);
      const nextLocation = {
        id: createLocationId(),
        name: formData.name.trim(),
        category: formData.category,
        visibility: formData.visibility,
        aliases: normalizeAliases(formData.aliases),
        summary: formData.summary.trim(),
        description: formData.description.trim(),
        gmNotes: formData.gmNotes.trim(),
        imageUrl: formData.imageUrl,
        data: {},
      };
      const savedLocation = await locationsRepo.upsert(selectedCampaignId, nextLocation);
      setLocations((current) => [savedLocation, ...current]);
      setShowCreateModal(false);
      setImageError("");
      setFormData(createDraft());
      navigate(`/maps/${savedLocation.id}`);
    } catch (saveError) {
      console.error("[Locations] Failed to create location", saveError);
      setError("Unable to create Location right now.");
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }

  if (!selectedCampaignId) {
    return (
      <main className="flex-1 overflow-auto p-8">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-300">
          Select a campaign to view Locations.
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-white">
            <Map className="h-7 w-7 text-indigo-300" />
            Locations
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Narrative places, reference images, and player-facing location notes.
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
              placeholder="Search Locations..."
              className="w-full rounded-xl border border-white/10 bg-black/30 py-2.5 pl-10 pr-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-300"
            />
          </div>
          {isGM && (
            <button
              type="button"
              onClick={() => {
                setImageError("");
                setShowCreateModal(true);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-400"
            >
              <Plus className="h-4 w-4" />
              Add Location
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-2 text-zinc-400">
            Category
            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-indigo-300"
            >
              <option>All</option>
              {LOCATION_CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
          {isGM && (
            <label className="flex items-center gap-2 text-zinc-400">
              Visibility
              <select
                value={selectedVisibility}
                onChange={(event) => setSelectedVisibility(event.target.value)}
                className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-indigo-300"
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
                setSelectedCategory("All");
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
          Loading Locations...
        </div>
      ) : filteredLocations.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <Map className="mx-auto mb-3 h-8 w-8 text-zinc-500" />
          <h2 className="text-base font-semibold text-white">No Locations yet</h2>
          <p className="mt-1 text-sm text-zinc-400">
            {isGM
              ? "Add the first place when the campaign needs a shared reference."
              : "No player-visible Locations have been shared yet."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredLocations.map((location) => {
            const meta = getCategoryMeta(location.category);
            const Icon = meta.icon;

            return (
              <button
                key={location.id}
                type="button"
                onClick={() => navigate(`/maps/${location.id}`)}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] text-left transition hover:border-indigo-300/40 hover:bg-white/[0.07]"
              >
                {location.imageUrl ? (
                  <div className="h-40 overflow-hidden border-b border-white/10">
                    <img
                      src={location.imageUrl}
                      alt=""
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                  </div>
                ) : null}

                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.iconWrap}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.badge}`}>
                            {location.category}
                          </span>
                          {isGM && visibilityPill(location.visibility)}
                        </div>
                        <h2 className="mt-2 line-clamp-2 text-base font-semibold text-white">
                          {location.name || "Untitled Location"}
                        </h2>
                      </div>
                    </div>
                  </div>

                  {location.aliases?.length ? (
                    <p className="mb-3 text-xs text-zinc-500">
                      Aliases: {location.aliases.slice(0, 4).join(" • ")}
                    </p>
                  ) : null}

                  <p className="line-clamp-4 text-sm leading-6 text-zinc-400">
                    {getPlainTextPreview(location.summary || location.description)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showCreateModal && typeof document !== "undefined" ? createPortal((
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => {
            if (isSaving) return;
            setShowCreateModal(false);
            setImageError("");
            setFormData(createDraft());
          }}
        >
          <div
            className="flex max-h-[calc(100dvh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="shrink-0 border-b border-white/10 p-5">
              <h2 className="text-lg font-semibold text-white">Add Location</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Store narrative notes and an optional reference image. Image data URL storage is temporary.
              </p>
            </div>
            <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleCreate}>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
                <fieldset disabled={isSaving} className="space-y-6 disabled:opacity-60">
                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      Basic Information
                    </h3>
                    <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
                      <label className="space-y-1 text-sm text-zinc-300">
                        Name
                        <input
                          value={formData.name}
                          onChange={(event) =>
                            setFormData((current) => ({ ...current, name: event.target.value }))
                          }
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-indigo-300"
                          required
                        />
                      </label>
                      <label className="space-y-1 text-sm text-zinc-300">
                        Category
                        <select
                          value={formData.category}
                          onChange={(event) =>
                            setFormData((current) => ({ ...current, category: event.target.value }))
                          }
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-indigo-300"
                        >
                          {LOCATION_CATEGORIES.map((category) => (
                            <option key={category}>{category}</option>
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
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-indigo-300"
                      />
                    </label>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="mb-3 text-sm font-medium text-zinc-300">Visibility</p>
                      <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((current) => ({ ...current, visibility: "public" }))
                        }
                        className={`rounded-xl border px-4 py-2 text-left text-sm ${
                          formData.visibility === "public"
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                            : "border-white/10 bg-white/5 text-zinc-300"
                        }`}
                      >
                        Player-visible
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((current) => ({ ...current, visibility: "gm-only" }))
                        }
                        className={`rounded-xl border px-4 py-2 text-left text-sm ${
                          formData.visibility === "gm-only"
                            ? "border-red-500 bg-red-500/10 text-red-300"
                            : "border-white/10 bg-white/5 text-zinc-300"
                        }`}
                      >
                        GM-only
                      </button>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      What Players Know
                    </h3>
                    <label className="space-y-1 text-sm text-zinc-300">
                      Summary
                      <input
                        value={formData.summary}
                        onChange={(event) =>
                          setFormData((current) => ({ ...current, summary: event.target.value }))
                        }
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-indigo-300"
                      />
                    </label>

                    <label className="space-y-1 text-sm text-zinc-300">
                      What players know
                      <textarea
                        rows={7}
                        value={formData.description}
                        onChange={(event) =>
                          setFormData((current) => ({ ...current, description: event.target.value }))
                        }
                        className="min-h-36 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-indigo-300"
                      />
                    </label>
                  </section>

                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      GM Notes
                    </h3>
                    <label className="space-y-1 text-sm text-zinc-300">
                      GM Notes
                      <textarea
                        rows={6}
                        value={formData.gmNotes}
                        onChange={(event) =>
                          setFormData((current) => ({ ...current, gmNotes: event.target.value }))
                        }
                        className="min-h-32 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-indigo-300"
                      />
                    </label>
                  </section>

                  <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                        Reference Material
                      </h3>
                      <p className="mt-1 text-xs text-zinc-500">
                        Temporary data URL storage. Images over 1 MB are rejected.
                      </p>
                    </div>
                    {formData.imageUrl ? (
                      <div className="overflow-hidden rounded-xl border border-white/10">
                        <img src={formData.imageUrl} alt="" className="max-h-64 w-full object-cover" />
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex cursor-pointer items-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300 hover:bg-white/10">
                        Upload image
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => handleImageFile(event.target.files?.[0])}
                        />
                      </label>
                      {formData.imageUrl ? (
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((current) => ({ ...current, imageUrl: "" }))
                          }
                          className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/10"
                        >
                          Remove image
                        </button>
                      ) : null}
                    </div>
                    {imageError ? <p className="text-sm text-red-200">{imageError}</p> : null}
                  </section>
                </fieldset>
              </div>
              <div className="flex shrink-0 justify-end gap-3 border-t border-white/10 p-5">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    setShowCreateModal(false);
                    setImageError("");
                    setFormData(createDraft());
                  }}
                  className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !formData.name.trim()}
                  className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? "Creating..." : "Create Location"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ), document.body) : null}
    </main>
  );
}
