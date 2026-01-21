// src/pages/Lore.jsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookText,
  Sparkles,
  Search,
  Plus,
  List,
  LayoutGrid,
  Tag,
} from "lucide-react";
import { useMode } from "../context/ModeContext.jsx";
import { MOCK_LORE } from "../data/mockLore";

const TYPE_FILTERS = ["All", "World", "Location", "Deity", "Faction", "Event", "Concept"];
const RARITY_FILTERS = ["All", "Major", "Minor", "Obscure"];

export default function Lore() {
  const navigate = useNavigate();
  const { isGM } = useMode();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("All");
  const [selectedRarity, setSelectedRarity] = useState("All");
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'list'
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    type: "World",
    category: "",
    rarity: "Major",
    visibility: "public",
    synopsis: "",
  });

  const filteredLore = useMemo(() => {
    const baseList =
      isGM
        ? MOCK_LORE
        : MOCK_LORE.filter((entry) => entry.visibility === "public");

    return baseList.filter((entry) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        entry.title.toLowerCase().includes(q) ||
        entry.synopsis.toLowerCase().includes(q) ||
        entry.category.toLowerCase().includes(q);

      const matchesType =
        selectedType === "All" ? true : entry.type === selectedType;

      const matchesRarity =
        selectedRarity === "All" ? true : entry.rarity === selectedRarity;

      return matchesSearch && matchesType && matchesRarity;
    });
  }, [searchQuery, selectedType, selectedRarity, isGM]);

  const handleCreate = (e) => {
    e.preventDefault();
    console.log("New Lore entry (mock only):", formData);
    setShowCreateModal(false);
    setFormData({
      title: "",
      type: "World",
      category: "",
      rarity: "Major",
      visibility: "public",
      synopsis: "",
    });
  };

  const visibilityPill = (visibility) => {
    if (visibility === "gm-only") {
      return (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-500/10 text-red-300 border border-red-500/40">
          GM ONLY
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/40">
        Player-visible
      </span>
    );
  };

  const renderGridCard = (entry) => (
    <div
      key={entry.id}
      onClick={() => navigate(`/lore/${entry.id}`)}
      className="bg-white/5 border border-white/10 rounded-2xl p-5 
                 hover:bg-white/10 hover:border-purple-400/40 transition-all 
                 cursor-pointer flex flex-col justify-between"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-purple-500 to-indigo-500 flex items-center justify-center shadow-lg">
            <BookText className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              {entry.category} • {entry.type}
            </p>
            <h2 className="text-base font-semibold text-white">
              {entry.title}
            </h2>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-violet-500/10 text-violet-300 border border-violet-500/40">
            {entry.rarity}
          </span>
          {isGM && visibilityPill(entry.visibility)}
        </div>
      </div>

      <p className="text-sm text-zinc-400 line-clamp-3 mb-3">
        {entry.synopsis}
      </p>

      <div className="flex items-center justify-between text-xs mt-auto pt-2 border-t border-white/5">
        <div className="flex flex-wrap gap-1">
          {entry.tags?.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 text-zinc-400"
            >
              <Tag className="w-3 h-3" />
              {tag}
            </span>
          ))}
        </div>
        <span className="text-zinc-500">ID: {entry.id}</span>
      </div>
    </div>
  );

  const renderListRow = (entry) => (
    <button
      key={entry.id}
      onClick={() => navigate(`/lore/${entry.id}`)}
      className="w-full text-left bg-white/5 border border-white/10 rounded-2xl px-4 py-3
                 hover:bg-white/10 hover:border-purple-400/40 transition-all flex items-center justify-between"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-linear-to-br from-purple-500 to-indigo-500 flex items-center justify-center shadow-lg">
          <BookText className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-white">
              {entry.title}
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-violet-500/10 text-violet-300 border border-violet-500/40">
              {entry.rarity}
            </span>
            {isGM && visibilityPill(entry.visibility)}
          </div>
          <p className="text-xs text-zinc-400 line-clamp-1">
            {entry.category} • {entry.type} — {entry.synopsis}
          </p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 text-xs text-zinc-500">
        <span>#{entry.id}</span>
        {entry.tags && (
          <span>{entry.tags.slice(0, 2).join(" • ")}</span>
        )}
      </div>
    </button>
  );

  return (
    <main className="flex-1 p-8 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <BookText className="w-7 h-7 text-purple-400" />
            Lore Hub
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Central archive for world lore, deities, factions, locations and concepts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-zinc-400">
            <Sparkles className="w-4 h-4 text-purple-300" />
            <span>Design phase • Mock data only</span>
          </div>
          {isGM && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-linear-to-r from-purple-500 to-pink-500 text-sm font-medium text-white hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              Add Lore Entry
            </button>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search lore by title, category, or synopsis..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-400/60"
          />
        </div>

        {/* Type filters */}
        <div className="flex flex-wrap gap-2">
          {TYPE_FILTERS.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                selectedType === type
                  ? "bg-purple-500 text-white"
                  : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Secondary controls */}
      <div className="flex items-center justify-between gap-4 mb-4">
        {/* Rarity filter */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-500">Rarity:</span>
          <div className="flex gap-2">
            {RARITY_FILTERS.map((rarity) => (
              <button
                key={rarity}
                onClick={() => setSelectedRarity(rarity)}
                className={`px-3 py-1.5 rounded-full border text-xs transition-all ${
                  selectedRarity === rarity
                    ? "border-purple-400 bg-purple-500/20 text-purple-100"
                    : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                {rarity}
              </button>
            ))}
          </div>
        </div>

        {/* View toggle */}
        <div className="inline-flex rounded-xl bg-white/5 p-1 border border-white/10">
          <button
            onClick={() => setViewMode("grid")}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs ${
              viewMode === "grid"
                ? "bg-white text-zinc-900"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            Grid
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs ${
              viewMode === "list"
                ? "bg-white text-zinc-900"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <List className="w-4 h-4" />
            List
          </button>
        </div>
      </div>

      {/* Lore entries */}
      {filteredLore.length === 0 ? (
        <div className="mt-12 text-center text-zinc-500 text-sm">
          No lore entries match your filters yet.
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredLore.map((entry) => renderGridCard(entry))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLore.map((entry) => renderListRow(entry))}
        </div>
      )}

      {/* Create Lore Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-zinc-950 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">
              Add New Lore Entry
            </h2>
            <form className="space-y-4" onSubmit={handleCreate}>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                  >
                    <option>World</option>
                    <option>Location</option>
                    <option>Deity</option>
                    <option>Faction</option>
                    <option>Event</option>
                    <option>Concept</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Rarity</label>
                  <select
                    value={formData.rarity}
                    onChange={(e) => setFormData({ ...formData, rarity: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                  >
                    <option>Major</option>
                    <option>Minor</option>
                    <option>Obscure</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Visibility</label>
                <div className="inline-flex rounded-xl bg-white/5 p-1 border border-white/10">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, visibility: "public" })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                      formData.visibility === "public"
                        ? "bg-emerald-500 text-white"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    Player-visible
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, visibility: "gm-only" })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                      formData.visibility === "gm-only"
                        ? "bg-red-500 text-white"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    GM only
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Synopsis (player-safe)</label>
                <textarea
                  rows={3}
                  value={formData.synopsis}
                  onChange={(e) => setFormData({ ...formData, synopsis: e.target.value })}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50 resize-none"
                />
              </div>

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
                  Save Lore Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}