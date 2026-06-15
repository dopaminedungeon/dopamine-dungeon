import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMode } from "../context/ModeContext.jsx";
import { useCampaign } from "../context/CampaignContext";
import {
  Users,
  Search,
  Plus,
  Star,
  Skull,
  ShoppingBag,
  MessageSquare,
} from "lucide-react";
import { mockNpcs } from "../data/mockNpcs.js";

const typeIcons = {
  Merchant: ShoppingBag,
  "Quest Giver": MessageSquare,
  Boss: Skull,
  NPC: Users,
};

const typeColors = {
  Merchant: "from-amber-500 to-orange-500",
  "Quest Giver": "from-blue-500 to-cyan-500",
  Boss: "from-red-500 to-rose-500",
  NPC: "from-zinc-500 to-zinc-600",
};

export default function Npcs() {
  const { isGM } = useMode();
  const { selectedCampaignId } = useCampaign();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("All");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    // Player-visible basics
    name: "",
    type: "NPC", // NPC / Merchant / Quest Giver / Boss
    location: "",
    description: "", // what the party knows / first impression

    // GM basics
    visibility: "public", // "public" or "gm-only"
    relationship: "", // short note about relationship to party
    tags: "", // comma-separated tags for now
  });

  // 1) Filter by search + type
  const filteredNpcs = mockNpcs.filter((npc) => {
    const matchesSearch = npc.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesType = selectedType === "All" || npc.type === selectedType;
    return matchesSearch && matchesType;
  });

  // 2) Apply GM / player visibility
  const visibleNpcs = isGM
    ? filteredNpcs
    : filteredNpcs.filter((npc) => npc.visibility === "public");

  const handleCreate = (e) => {
    e.preventDefault();
    console.log("New NPC (not yet persisted):", formData);
    setShowCreateModal(false);
    setFormData({
      name: "",
      type: "NPC",
      location: "",
      description: "",
      visibility: "public",
      relationship: "",
      tags: "",
    });
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
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search NPCs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
          />
        </div>

        {/* Filter */}
        <div className="flex gap-2">
          {["All", "Merchant", "Quest Giver", "Boss", "NPC"].map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-4 py-3 rounded-xl font-medium transition-all ${
                selectedType === type
                  ? "bg-purple-500 text-white"
                  : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Add Button (GM only) */}
        {isGM && (
          <button
            className="flex items-center gap-2 px-6 py-3 bg-linear-to-r from-indigo-500 to-purple-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="w-5 h-5" />
            Add NPC
          </button>
        )}
      </div>

      {/* NPCs Grid */}
      {visibleNpcs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {visibleNpcs.map((npc) => {
          const TypeIcon = typeIcons[npc.type] || Users;
          const gradientColor =
            typeColors[npc.type] || "from-zinc-500 to-zinc-600";

          return (
            <div
              key={npc.id}
              className="group bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-purple-500/30 hover:bg-white/10 transition-all cursor-pointer"
              onClick={() => navigate(`/npcs/${npc.id}`)}
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`w-14 h-14 rounded-xl bg-linear-to-br ${gradientColor} flex items-center justify-center shadow-lg`}
                >
                  <TypeIcon className="w-7 h-7 text-white" />
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-lg text-xs font-medium ${
                      npc.type === "Boss"
                        ? "bg-red-500/20 text-red-300"
                        : npc.type === "Quest Giver"
                        ? "bg-blue-500/20 text-blue-300"
                        : npc.type === "Merchant"
                        ? "bg-amber-500/20 text-amber-300"
                        : "bg-zinc-500/20 text-zinc-300"
                    }`}
                  >
                    {npc.type}
                  </span>
                </div>
              </div>

              <h3 className="text-xl font-bold text-white mb-1 group-hover:text-purple-300 transition-colors">
                {npc.name}
                {isGM && npc.visibility !== "public" && (
                  <span className="ml-2 px-2 py-0.5 text-[10px] rounded-full bg-red-500/20 text-red-300 border border-red-500/40">
                    GM ONLY
                  </span>
                )}
              </h3>
              <p className="text-zinc-500 text-sm mb-4">{npc.location}</p>
              <p className="text-zinc-400 text-sm mb-4 line-clamp-2">
                {npc.description}
              </p>

              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-zinc-500 text-xs">Level</p>
                    <p className="text-white font-bold">{npc.level}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs">Health</p>
                    <p className="text-white font-bold">
                      {npc.health.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  {[...Array(Math.min(5, Math.ceil(npc.level / 10)) || 1)].map(
                    (_, i) => (
                      <Star
                        key={i}
                        className="w-4 h-4 text-amber-400 fill-amber-400"
                      />
                    )
                  )}
                </div>
              </div>
            </div>
          );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-zinc-300">
          <h2 className="text-lg font-semibold text-white">No NPCs found</h2>
          <p className="mt-2 text-sm text-zinc-400">
            {isGM
              ? "No NPCs match the current filters yet."
              : "No player-visible NPCs match the current filters yet."}
          </p>
        </div>
      )}

      {/* Create NPC Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-zinc-950 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-1">Quick Add NPC</h2>
            <p className="text-xs text-zinc-500 mb-4">
              Capture the basics now. You can flesh out the full profile later in GM edit mode.
            </p>

            <form className="space-y-6" onSubmit={handleCreate}>
              {/* Player-visible basics */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-zinc-300">
                  Player-visible info
                </h3>

                {/* Name */}
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                  />
                </div>

                {/* Type & Location */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) =>
                        setFormData({ ...formData, type: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                    >
                      <option value="NPC">NPC</option>
                      <option value="Merchant">Merchant</option>
                      <option value="Quest Giver">Quest Giver</option>
                      <option value="Boss">Boss</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Location</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) =>
                        setFormData({ ...formData, location: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                </div>

                {/* Description / first impression */}
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">
                    Description (what the party knows / first impression)
                  </label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50 resize-none"
                  />
                </div>
              </div>

              {/* GM basics */}
              <div className="space-y-4 border-t border-white/10 pt-4">
                <h3 className="text-sm font-semibold text-zinc-300">GM basics</h3>

                {/* Visibility */}
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Visibility</label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, visibility: "public" })
                      }
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
                      onClick={() =>
                        setFormData({ ...formData, visibility: "gm-only" })
                      }
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

                {/* Relationship */}
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">
                    Relationship to party (short note)
                  </label>
                  <input
                    type="text"
                    placeholder="ally, wary contact, secret patron..."
                    value={formData.relationship}
                    onChange={(e) =>
                      setFormData({ ...formData, relationship: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="langendris, council, shadow, stormwrought..."
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-zinc-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-linear-to-r from-purple-500 to-pink-500 text-white font-medium hover:opacity-90"
                >
                  Save NPC
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
