// src/pages/NpcProfile.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMode } from "../context/ModeContext.jsx";
import { useCampaign } from "../context/CampaignContext";
import {
  ArrowLeft,
  Eye,
  Lock,
  Trash2,
  Users,
} from "lucide-react";
import { npcsRepo } from "../data/npcs/npcs.repo";

const NPC_ROLES = ["ally", "neutral", "antagonist", "unknown"];
const NPC_STATUSES = ["active", "missing", "dead", "unknown"];

const ROLE_LABELS = {
  ally: "Ally",
  neutral: "Neutral",
  antagonist: "Antagonist",
  unknown: "Unknown",
};

const STATUS_LABELS = {
  active: "Active",
  missing: "Missing",
  dead: "Dead",
  unknown: "Unknown",
};

function normalizeRole(value) {
  const role = String(value || "").trim().toLowerCase();
  return NPC_ROLES.includes(role) ? role : "unknown";
}

function normalizeStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  return NPC_STATUSES.includes(status) ? status : "unknown";
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

  return <div className="space-y-3 text-sm text-zinc-300">{nodes}</div>;
}

function buildDraft(npc) {
  return {
    id: npc?.id || "",
    name: npc?.name || "",
    title: npc?.title || "",
    type: normalizeRole(npc?.type),
    status: normalizeStatus(npc?.status || "active"),
    visibility: npc?.visibility === "gm-only" ? "gm-only" : "public",
    summary: npc?.summary || "",
    description: npc?.description || "",
    gmNotes: npc?.gmNotes || "",
    imageUrl: npc?.imageUrl || "",
  };
}

export default function NpcProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isGM } = useMode();
  const { selectedCampaignId } = useCampaign();

  const [npc, setNpc] = useState(null);
  const [draft, setDraft] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadNpc() {
      if (!selectedCampaignId || !id) {
        setNpc(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError("");
        const data = await npcsRepo.getById(selectedCampaignId, id);
        if (!cancelled) {
          setNpc(data);
          setDraft(data ? buildDraft(data) : null);
        }
      } catch (loadError) {
        console.error("[NpcProfile] Failed to load NPC", loadError);
        if (!cancelled) {
          setNpc(null);
          setError("Unable to load this NPC right now.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadNpc();

    return () => {
      cancelled = true;
    };
  }, [selectedCampaignId, id]);

  const visibleDescription = useMemo(
    () => [npc?.summary, npc?.description].filter(Boolean).join("\n\n"),
    [npc]
  );

  const updateDraft = (field, value) => {
    setDraft((current) => ({
      ...(current || buildDraft(npc)),
      [field]: value,
    }));
  };

  const handleStartEdit = () => {
    if (!isGM || !npc || isSaving || isDeleting) return;
    setDraft(buildDraft(npc));
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (isSaving) return;
    setDraft(buildDraft(npc));
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!isGM || !selectedCampaignId || !draft || isSaving) return;

    try {
      setIsSaving(true);
      const savedNpc = await npcsRepo.upsert(selectedCampaignId, {
        ...draft,
        name: draft.name.trim(),
        title: draft.title.trim(),
        summary: draft.summary.trim(),
        description: draft.description.trim(),
        gmNotes: draft.gmNotes.trim(),
        imageUrl: draft.imageUrl.trim(),
      });
      setNpc(savedNpc);
      setDraft(buildDraft(savedNpc));
      setIsEditing(false);
    } catch (saveError) {
      console.error("[NpcProfile] Failed to save NPC", saveError);
      setError("Unable to save this NPC right now.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isGM || !selectedCampaignId || !npc || isDeleting || isSaving) return;
    const confirmed = window.confirm(`Delete ${npc.name || "this NPC"}?`);
    if (!confirmed) return;

    try {
      setIsDeleting(true);
      await npcsRepo.remove(selectedCampaignId, npc.id);
      navigate("/npcs");
    } catch (deleteError) {
      console.error("[NpcProfile] Failed to delete NPC", deleteError);
      setError("Unable to delete this NPC right now.");
      setIsDeleting(false);
    }
  };

  if (!selectedCampaignId) {
    return (
      <main className="flex-1 overflow-auto flex items-center justify-center p-8">
        <div className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <h1 className="text-xl font-semibold text-white">Select a campaign</h1>
          <p className="mt-2 text-sm text-zinc-400">
            NPC profiles are scoped to the active campaign.
          </p>
        </div>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="p-8 text-zinc-400">
        Loading NPC...
      </main>
    );
  }

  if (!npc) {
    return (
      <main className="p-8 text-white">
        <div className="max-w-xl bg-white/5 border border-white/10 rounded-2xl p-8">
          <h1 className="text-2xl font-bold">NPC not found</h1>
          <p className="mt-2 text-sm text-zinc-400">
            This NPC does not exist in the active campaign, or it is not visible in the current mode.
          </p>
          {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
          <button
            type="button"
            onClick={() => navigate("/npcs")}
            className="mt-5 px-4 py-2 bg-white/10 rounded-xl text-zinc-300 hover:bg-white/20"
          >
            Back to NPCs
          </button>
        </div>
      </main>
    );
  }

  if (!isGM && npc.visibility === "gm-only") {
    return (
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-xl mx-auto bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">DM Eyes Only</h1>
          <p className="text-zinc-400 text-sm mb-4">
            This NPC is marked GM-only.
          </p>
          <button
            type="button"
            className="mt-2 px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20"
            onClick={() => navigate("/npcs")}
          >
            Back to NPCs
          </button>
        </div>
      </main>
    );
  }

  const viewNpc = isEditing && draft ? draft : npc;

  return (
    <main className="p-8">
      <div className="flex items-center justify-between gap-4 mb-6">
        <button
          type="button"
          className="flex items-center gap-2 text-zinc-400 hover:text-white"
          onClick={() => navigate("/npcs")}
        >
          <ArrowLeft className="w-5 h-5" />
          Back to NPCs
        </button>

        {isGM ? (
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-xs rounded-full border border-white/20 text-zinc-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || !draft?.name?.trim()}
                  className="px-3 py-1.5 text-xs rounded-full border border-indigo-400/50 bg-indigo-500/20 text-white hover:bg-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-50 transition"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleStartEdit}
                  disabled={isDeleting}
                  className="px-3 py-1.5 text-xs rounded-full border border-white/20 text-zinc-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 transition"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-full border border-rose-400/40 bg-rose-500/15 text-rose-100 hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-50 transition"
                >
                  <Trash2 className="w-3 h-3" />
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <section className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-2xl font-bold overflow-hidden shrink-0">
              {viewNpc.imageUrl ? (
                <img src={viewNpc.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                (viewNpc.name || "?").charAt(0)
              )}
            </div>
            <div className="min-w-0">
              {isEditing ? (
                <input
                  className="w-full bg-transparent border-b border-white/20 text-2xl font-bold text-white focus:outline-none focus:border-purple-400"
                  value={draft?.name ?? ""}
                  onChange={(e) => updateDraft("name", e.target.value)}
                />
              ) : (
                <h1 className="text-2xl font-bold text-white">{viewNpc.name || "Unnamed NPC"}</h1>
              )}

              {isEditing ? (
                <input
                  className="mt-2 w-full bg-transparent border-b border-white/20 text-sm text-zinc-200 focus:outline-none focus:border-purple-400"
                  placeholder="Title"
                  value={draft?.title ?? ""}
                  onChange={(e) => updateDraft("title", e.target.value)}
                />
              ) : viewNpc.title ? (
                <p className="mt-1 text-sm text-zinc-400">{viewNpc.title}</p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col items-start md:items-end gap-2">
            {isEditing ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateDraft("visibility", "public")}
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border transition ${
                    draft?.visibility === "public"
                      ? "bg-emerald-500/20 text-emerald-200 border-emerald-500/40"
                      : "bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10"
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  Player-visible
                </button>
                <button
                  type="button"
                  onClick={() => updateDraft("visibility", "gm-only")}
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border transition ${
                    draft?.visibility === "gm-only"
                      ? "bg-red-500/20 text-red-200 border-red-500/40"
                      : "bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10"
                  }`}
                >
                  <Lock className="w-3 h-3" />
                  GM only
                </button>
              </div>
            ) : viewNpc.visibility === "gm-only" ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/40">
                <Lock className="w-3 h-3" />
                GM ONLY
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <Eye className="w-3 h-3" />
                Player-visible
              </span>
            )}
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-white/5 text-zinc-300 border border-white/10">
              <Users className="w-3 h-3" />
              {ROLE_LABELS[normalizeRole(viewNpc.type)]} / {STATUS_LABELS[normalizeStatus(viewNpc.status)]}
            </span>
          </div>
        </div>
      </section>

      {isEditing ? (
        <fieldset disabled={isSaving} className="space-y-6 disabled:opacity-60">
          <section className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-white mb-4">Core details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Role</label>
                <select
                  value={draft?.type ?? "unknown"}
                  onChange={(e) => updateDraft("type", e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                >
                  {NPC_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Status</label>
                <select
                  value={draft?.status ?? "active"}
                  onChange={(e) => updateDraft("status", e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                >
                  {NPC_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-zinc-400 mb-1">Image URL</label>
                <input
                  type="url"
                  value={draft?.imageUrl ?? ""}
                  onChange={(e) => updateDraft("imageUrl", e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-zinc-400 mb-1">Summary</label>
                <input
                  value={draft?.summary ?? ""}
                  onChange={(e) => updateDraft("summary", e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-zinc-400 mb-1">Description</label>
                <textarea
                  rows={5}
                  value={draft?.description ?? ""}
                  onChange={(e) => updateDraft("description", e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-zinc-400 mb-1">GM Notes</label>
                <textarea
                  rows={5}
                  value={draft?.gmNotes ?? ""}
                  onChange={(e) => updateDraft("gmNotes", e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                />
              </div>
            </div>
          </section>
        </fieldset>
      ) : (
        <div className={`grid grid-cols-1 gap-6 ${isGM ? "xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" : ""}`}>
          <section className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-white mb-3">Profile</h2>
            {renderMarkdownBlock(visibleDescription, "No public NPC details added yet.")}
          </section>

          {isGM ? (
            <section className="bg-white/5 border border-rose-500/30 rounded-2xl p-6 backdrop-blur-sm">
              <h2 className="text-lg font-semibold text-rose-100 mb-3">GM Notes</h2>
              {renderMarkdownBlock(npc.gmNotes, "No GM notes yet.")}
            </section>
          ) : null}
        </div>
      )}
    </main>
  );
}
