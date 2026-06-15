import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Castle,
  Landmark,
  Map,
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
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError("");
        const loadedLocation = await locationsRepo.getById(selectedCampaignId, id);
        if (!cancelled) {
          const normalized = loadedLocation ? normalizeLocation(loadedLocation) : null;
          setLocation(normalized);
          setDraft(normalized);
        }
      } catch (loadError) {
        console.error("[LocationProfile] Failed to load location", loadError);
        if (!cancelled) {
          setLocation(null);
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
      setLocation(savedLocation);
      setDraft(savedLocation);
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

          <Card title="Sessions">
            <p className="text-sm text-zinc-500">Session links coming soon</p>
          </Card>

          <Card title="NPCs">
            <p className="text-sm text-zinc-500">NPC links coming soon</p>
          </Card>

          <Card title="Lore">
            <p className="text-sm text-zinc-500">Lore links coming soon</p>
          </Card>

          <Card title="Items">
            <p className="text-sm text-zinc-500">Item links coming soon</p>
          </Card>
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
