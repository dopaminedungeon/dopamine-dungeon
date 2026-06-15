import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMode } from "../context/ModeContext.jsx";
import { useCampaign } from "../context/CampaignContext";
import {
  Users,
  Search,
  Plus,
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

const VISIBILITY_LABELS = {
  public: "Player-visible",
  "gm-only": "GM-only",
};

function normalizeRole(value) {
  const role = String(value || "").trim().toLowerCase();
  return NPC_ROLES.includes(role) ? role : "unknown";
}

function normalizeStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  return NPC_STATUSES.includes(status) ? status : "unknown";
}

function newNpcId() {
  try {
    return `npc-${crypto.randomUUID()}`;
  } catch {
    return `npc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function createNpcDraft() {
  return {
    name: "",
    title: "",
    type: "unknown",
    status: "active",
    visibility: "public",
    summary: "",
    description: "",
    gmNotes: "",
    imageUrl: "",
  };
}

export default function Npcs() {
  const { isGM } = useMode();
  const { selectedCampaignId } = useCampaign();
  const navigate = useNavigate();

  const [npcs, setNpcs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedVisibility, setSelectedVisibility] = useState("All");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState(createNpcDraft());
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const hasActiveFilters =
    searchQuery.trim() ||
    selectedRole !== "All" ||
    selectedStatus !== "All" ||
    selectedVisibility !== "All";

  useEffect(() => {
    let cancelled = false;

    async function loadNpcs() {
      if (!selectedCampaignId) {
        setNpcs([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError("");
        const data = await npcsRepo.getAll(selectedCampaignId);
        if (!cancelled) setNpcs(data);
      } catch (loadError) {
        console.error("[Npcs] Failed to load NPCs", loadError);
        if (!cancelled) {
          setNpcs([]);
          setError("Unable to load NPCs right now.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadNpcs();

    return () => {
      cancelled = true;
    };
  }, [selectedCampaignId]);

  const filteredNpcs = useMemo(() => {
    return npcs.filter((npc) => {
      if (!isGM && npc.visibility === "gm-only") {
        return false;
      }

      const npcRole = normalizeRole(npc.type);
      const npcStatus = normalizeStatus(npc.status);
      const npcVisibility = npc.visibility === "gm-only" ? "gm-only" : "public";
      const searchable = [
        npc.name,
        npc.title,
        ROLE_LABELS[npcRole],
        STATUS_LABELS[npcStatus],
        npc.summary,
        npc.description,
        ...(Array.isArray(npc.aliases) ? npc.aliases : []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesSearch = searchable.includes(searchQuery.toLowerCase());
      const matchesRole = selectedRole === "All" || npcRole === selectedRole;
      const matchesStatus = selectedStatus === "All" || npcStatus === selectedStatus;
      const matchesVisibility =
        !isGM || selectedVisibility === "All" || npcVisibility === selectedVisibility;
      return matchesSearch && matchesRole && matchesStatus && matchesVisibility;
    });
  }, [isGM, npcs, searchQuery, selectedRole, selectedStatus, selectedVisibility]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!selectedCampaignId || isSavingRef.current) return;

    const nextNpc = {
      ...formData,
      id: newNpcId(),
      name: formData.name.trim(),
      title: formData.title.trim(),
      summary: formData.summary.trim(),
      description: formData.description.trim(),
      gmNotes: formData.gmNotes.trim(),
      imageUrl: formData.imageUrl.trim(),
    };

    try {
      isSavingRef.current = true;
      setIsSaving(true);
      const savedNpc = await npcsRepo.upsert(selectedCampaignId, nextNpc);
      setNpcs((current) => [savedNpc, ...current]);
      setShowCreateModal(false);
      setFormData(createNpcDraft());
    } catch (saveError) {
      console.error("[Npcs] Failed to create NPC", saveError);
      setError("Unable to save NPC right now.");
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedRole("All");
    setSelectedStatus("All");
    setSelectedVisibility("All");
  };

  if (!selectedCampaignId) {
    return (
      <main className="flex-1 overflow-auto flex items-center justify-center p-8">
        <div className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <h1 className="text-xl font-semibold text-white">Select a campaign</h1>
          <p className="mt-2 text-sm text-zinc-400">
            NPCs are scoped to the active campaign.
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="p-8 overflow-auto">
      <div className="flex flex-col gap-4 mb-8">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search NPCs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
              />
            </div>
            {isGM ? (
              <button
                type="button"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-indigo-500 to-purple-500 px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 sm:w-auto"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus className="w-4 h-4" />
                Add NPC
              </button>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <label className="inline-flex items-center gap-2 text-zinc-500">
              <span className="text-xs font-medium uppercase tracking-wide">Role</span>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="h-9 rounded-lg border border-white/10 bg-zinc-950/70 px-2.5 text-sm text-zinc-200 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              >
                {["All", ...NPC_ROLES].map((role) => (
                  <option key={role} value={role}>
                    {role === "All" ? "All" : ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </label>

            <label className="inline-flex items-center gap-2 text-zinc-500">
              <span className="text-xs font-medium uppercase tracking-wide">Status</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="h-9 rounded-lg border border-white/10 bg-zinc-950/70 px-2.5 text-sm text-zinc-200 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              >
                {["All", ...NPC_STATUSES].map((status) => (
                  <option key={status} value={status}>
                    {status === "All" ? "All" : STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>

            {isGM ? (
              <label className="inline-flex items-center gap-2 text-zinc-500">
                <span className="text-xs font-medium uppercase tracking-wide">Visibility</span>
                <select
                  value={selectedVisibility}
                  onChange={(e) => setSelectedVisibility(e.target.value)}
                  className="h-9 rounded-lg border border-white/10 bg-zinc-950/70 px-2.5 text-sm text-zinc-200 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                >
                  {["All", "public", "gm-only"].map((visibility) => (
                    <option key={visibility} value={visibility}>
                      {visibility === "All" ? "All" : VISIBILITY_LABELS[visibility]}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {hasActiveFilters ? (
              <button
                type="button"
                onClick={handleResetFilters}
                className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white"
              >
                Reset Filters
              </button>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-zinc-400">
          Loading NPCs...
        </div>
      ) : filteredNpcs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredNpcs.map((npc) => {
            const npcRole = normalizeRole(npc.type);
            const npcStatus = normalizeStatus(npc.status);

            return (
              <button
                type="button"
                key={npc.id}
                className="group text-left bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-purple-500/30 hover:bg-white/10 transition-all"
                onClick={() => navigate(`/npcs/${npc.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-14 h-14 rounded-xl bg-linear-to-br from-zinc-600 to-zinc-800 flex items-center justify-center shadow-lg">
                    <Users className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-lg text-xs font-medium bg-zinc-500/20 text-zinc-300">
                      {ROLE_LABELS[npcRole]}
                    </span>
                  </div>
                </div>

                <h3 className="text-xl font-bold text-white mb-1 group-hover:text-purple-300 transition-colors">
                  {npc.name || "Unnamed NPC"}
                  {isGM && npc.visibility === "gm-only" && (
                    <span className="ml-2 px-2 py-0.5 text-[10px] rounded-full bg-red-500/20 text-red-300 border border-red-500/40">
                      GM ONLY
                    </span>
                  )}
                </h3>
                {npc.title ? <p className="text-zinc-500 text-sm mb-2">{npc.title}</p> : null}
                <p className="text-zinc-400 text-sm mb-4 line-clamp-2">
                  {npc.summary || npc.description || "No NPC details added yet."}
                </p>

                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <span className="text-xs text-zinc-500">Status</span>
                  <span className="text-sm font-medium text-zinc-200">
                    {STATUS_LABELS[npcStatus]}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-zinc-300">
          <h2 className="text-lg font-semibold text-white">No NPCs found</h2>
          <p className="mt-2 text-sm text-zinc-400">
            {isGM
              ? "Create the first NPC for this campaign, or adjust the current filters."
              : "No player-visible NPCs match the current filters yet."}
          </p>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg max-h-[calc(100dvh-1rem)] overflow-hidden bg-zinc-950 border border-white/10 rounded-2xl shadow-xl">
            <form className="flex max-h-[calc(100dvh-1rem)] flex-col" onSubmit={handleCreate}>
              <div className="shrink-0 border-b border-white/10 p-6">
                <h2 className="text-xl font-bold text-white mb-1">Add NPC</h2>
                <p className="text-xs text-zinc-500">
                  Capture a campaign-scoped NPC. GM notes stay hidden from players.
                </p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
                <fieldset disabled={isSaving} className="space-y-4 disabled:opacity-60">
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Title</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">Role</label>
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
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
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                      >
                        {NPC_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {STATUS_LABELS[status]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Summary</label>
                    <input
                      type="text"
                      value={formData.summary}
                      onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Description</label>
                    <textarea
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Image URL</label>
                    <input
                      type="url"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Visibility</label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, visibility: "public" })}
                        className={`px-3 py-2 rounded-xl text-sm border ${
                          formData.visibility === "public"
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                            : "border-white/10 bg-white/5 text-zinc-300"
                        }`}
                      >
                        Player-visible
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, visibility: "gm-only" })}
                        className={`px-3 py-2 rounded-xl text-sm border ${
                          formData.visibility === "gm-only"
                            ? "border-red-500 bg-red-500/10 text-red-300"
                            : "border-white/10 bg-white/5 text-zinc-300"
                        }`}
                      >
                        GM only
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">GM Notes</label>
                    <textarea
                      rows={3}
                      value={formData.gmNotes}
                      onChange={(e) => setFormData({ ...formData, gmNotes: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50 resize-none"
                    />
                  </div>
                </fieldset>
              </div>

              <div className="shrink-0 flex justify-end gap-3 border-t border-white/10 p-6">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormData(createNpcDraft());
                  }}
                  className="px-4 py-2 rounded-xl bg-white/5 text-zinc-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-linear-to-r from-purple-500 to-pink-500 text-white font-medium hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save NPC"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
