import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMode } from "../context/ModeContext.jsx";
import { useCampaign } from "../context/CampaignContext";
import { itemsRepo } from "../data/items/items.repo";
import {
  Search,
  Plus,
  Swords,
  Shield,
  Sparkles,
  Grid,
  List,
} from "lucide-react";


const typeIcons = {
  Weapon: Swords,
  Armor: Shield,
  Consumable: Sparkles,
};

const rarityConfig = {
  Legendary: { bg: 'from-amber-500 to-orange-600', border: 'border-amber-500/30', text: 'text-amber-400', glow: 'shadow-amber-500/20' },
  Epic: { bg: 'from-purple-500 to-violet-600', border: 'border-purple-500/30', text: 'text-purple-400', glow: 'shadow-purple-500/20' },
  Rare: { bg: 'from-blue-500 to-cyan-600', border: 'border-blue-500/30', text: 'text-blue-400', glow: 'shadow-blue-500/20' },
  Uncommon: { bg: 'from-emerald-500 to-green-600', border: 'border-emerald-500/30', text: 'text-emerald-400', glow: 'shadow-emerald-500/20' },
  Common: { bg: 'from-zinc-500 to-zinc-600', border: 'border-zinc-500/30', text: 'text-zinc-400', glow: 'shadow-zinc-500/20' },
};

function newId(prefix = "item") {
  try {
    return `${prefix}-${crypto.randomUUID()}`;
  } catch {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export default function Items() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { selectedCampaignId } = useCampaign();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedCampaignId) {
      setItems([]);
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      try {
        const data = await itemsRepo.getAll(selectedCampaignId);
        setItems(safeArray(data));
      } catch (error) {
        console.error("[Items] Failed to load items", error);
        setItems([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [selectedCampaignId]);

  const [formData, setFormData] = useState({
    name: "",
    type: "Weapon",
    rarity: "Common",
    power: 0,
    description: "",
    visibility: "public",
    mechanicalSummary: "",
    gmNotes: "",
    stats: {},
  });
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState('All');
  const [selectedRarity, setSelectedRarity] = useState('All');
  const [viewMode, setViewMode] = useState('grid');
  const { isGM } = useMode();

  if (!selectedCampaignId) {
    return (
      <main className="flex-1 overflow-auto flex items-center justify-center">
        <div className="text-zinc-400">Select a campaign to view items.</div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex-1 overflow-auto flex items-center justify-center">
        <div className="text-zinc-400">Loading items...</div>
      </main>
    );
  }

  const filteredItems = items.filter((item) => {
    const matchesSearch = String(item.name || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'All' || item.type === selectedType;
    const matchesRarity = selectedRarity === 'All' || item.rarity === selectedRarity;
    return matchesSearch && matchesType && matchesRarity;
  });

  const visibleItems = isGM
  ? filteredItems
  : filteredItems.filter((item) => item.visibility === "public");

  return (
  <>
    {/* Header Actions */}
    <div className="flex flex-col lg:flex-row gap-4 mb-8">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
        <input
          type="text"
          placeholder="Search items..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
        />
      </div>

      {/* Type Filter */}
      <div className="flex gap-2">
        {["All", "Weapon", "Armor", "Consumable"].map((type) => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={`px-4 py-3 rounded-xl font-medium transition-all ${
              selectedType === type
                ? "bg-blue-500 text-white"
                : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Rarity Filter */}
      <select
        value={selectedRarity}
        onChange={(e) => setSelectedRarity(e.target.value)}
        className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500/50"
      >
        <option value="All">All Rarities</option>
        <option value="Legendary">Legendary</option>
        <option value="Epic">Epic</option>
        <option value="Rare">Rare</option>
        <option value="Uncommon">Uncommon</option>
        <option value="Common">Common</option>
      </select>

      {/* View Toggle */}
      <div className="flex bg-white/5 border border-white/10 rounded-xl p-1">
        <button
          onClick={() => setViewMode("grid")}
          className={`p-2 rounded-lg transition-all ${
            viewMode === "grid" ? "bg-white/10 text-white" : "text-zinc-500"
          }`}
        >
          <Grid className="w-5 h-5" />
        </button>
        <button
          onClick={() => setViewMode("list")}
          className={`p-2 rounded-lg transition-all ${
            viewMode === "list" ? "bg-white/10 text-white" : "text-zinc-500"
          }`}
        >
          <List className="w-5 h-5" />
        </button>
      </div>

      {/* Add Button */}
      {isGM && (
        <button
          className="flex items-center gap-2 px-6 py-3 bg-linear-to-r from-indigo-500 to-purple-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus className="w-5 h-5" />
          Add Item
        </button>
      )}
    </div>

    {visibleItems.length === 0 && (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-zinc-300">
        <p className="text-white font-semibold">No items yet.</p>
        <p className="text-zinc-400 text-sm mt-1">
          {isGM
            ? "Add your first item to start linking it to sessions and the Bag of Holding."
            : "Your GM hasn’t added any public items yet."}
        </p>
      </div>
    )}

    {/* Items Grid */}
    <div
      className={
        viewMode === "grid"
          ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6"
          : "flex flex-col gap-4"
      }
    >
      {visibleItems.map((item) => {
        const TypeIcon = typeIcons[item.type] || Sparkles;
        const rarity = rarityConfig[item.rarity] || rarityConfig.Common;

        if (viewMode === "list") {
          return (
            <div
              key={item.id}
              className={`group bg-white/5 backdrop-blur-sm border ${rarity.border} rounded-xl p-4 hover:bg-white/10 transition-all cursor-pointer flex items-center gap-4`}
              onClick={() =>
                navigate(`/items/${item.id}`)
              }
            >
              <div
                className={`w-14 h-14 rounded-xl bg-linear-to-br ${rarity.bg} flex items-center justify-center shadow-lg ${rarity.glow}`}
              >
                <TypeIcon className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold group-hover:text-blue-300 transition-colors">
                  {item.name}
                </h3>
                <p className="text-zinc-500 text-sm">{item.type}</p>
              </div>
              <span
                className={`px-3 py-1 rounded-lg text-xs font-medium ${rarity.text} bg-white/5`}
              >
                {item.rarity}
              </span>
              <span className="text-white font-bold">+{item.power}</span>
            </div>
          );
        }

        return (
          <div
            key={item.id}
            className={`group bg-white/5 backdrop-blur-sm border ${rarity.border} rounded-2xl p-5 hover:bg-white/10 transition-all cursor-pointer`}
            onClick={() =>
              navigate(`/items/${item.id}`)
            }
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className={`w-12 h-12 rounded-xl bg-linear-to-br ${rarity.bg} flex items-center justify-center shadow-lg ${rarity.glow}`}
              >
                <TypeIcon className="w-6 h-6 text-white" />
              </div>
              <span
                className={`px-3 py-1 rounded-lg text-xs font-medium ${rarity.text} bg-white/5`}
              >
                {item.rarity}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors">
                {item.name}
              </h3>

              {isGM && item.visibility === "gm-only" && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/20 text-red-300 border border-red-500/40">
                  GM ONLY
                </span>
              )}
            </div>

            <p className="text-zinc-500 text-sm mb-3">{item.type}</p>
            <p className="text-zinc-400 text-sm mb-4 line-clamp-2">
              {item.description}
            </p>

            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <div className="flex gap-2">
                {Object.entries(item.stats || {})
                  .slice(0, 2)
                  .map(([stat, value]) => (
                    <span
                      key={stat}
                      className="px-2 py-1 bg-white/5 rounded-lg text-xs text-zinc-400"
                    >
                      {stat}: {value}
                    </span>
                  ))}
              </div>
              <span className="text-white font-bold text-lg">+{item.power}</span>
            </div>
          </div>
        );
      })}
    </div>

    {showCreateModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="w-[92vw] max-w-2xl max-h-[85vh] overflow-y-auto bg-zinc-950/90 border border-white/10 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <h2 className="text-white font-semibold text-lg">Add Item</h2>
            <button
              type="button"
              className="text-zinc-400 hover:text-white"
              onClick={() => setShowCreateModal(false)}
            >
              ✕
            </button>
          </div>

          <form
  className="p-4 sm:p-6 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!selectedCampaignId) return;

              const id = newId("item");
              const nextItem = {
                id,
                name: formData.name,
                type: formData.type,
                rarity: formData.rarity,
                power: Number(formData.power) || 0,
                description: formData.description,
                visibility: formData.visibility,
                mechanicalSummary: formData.mechanicalSummary,
                gmNotes: formData.gmNotes,
                stats: formData.stats || {},
                linkedSessionIds: [],
                location: null,
              };

              await itemsRepo.upsert(selectedCampaignId, nextItem);
              const data = await itemsRepo.getAll(selectedCampaignId);
              setItems(safeArray(data));

              setShowCreateModal(false);
              setFormData({
                name: "",
                type: "Weapon",
                rarity: "Common",
                power: 0,
                description: "",
                visibility: "public",
                mechanicalSummary: "",
                gmNotes: "",
                stats: {},
              });

              navigate(`/items/${id}`);
            }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Name</label>
                <input
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                  placeholder="e.g. Stormwrought Dagger"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Visibility</label>
                <select
                  value={formData.visibility}
                  onChange={(e) => setFormData((p) => ({ ...p, visibility: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                >
                  <option value="public">Public</option>
                  <option value="gm-only">GM Only</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData((p) => ({ ...p, type: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                >
                  <option value="Weapon">Weapon</option>
                  <option value="Armor">Armor</option>
                  <option value="Consumable">Consumable</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Rarity</label>
                <select
                  value={formData.rarity}
                  onChange={(e) => setFormData((p) => ({ ...p, rarity: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                >
                  {Object.keys(rarityConfig).map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Power</label>
                <input
                  type="number"
                  value={formData.power}
                  onChange={(e) => setFormData((p) => ({ ...p, power: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                  min={0}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs text-zinc-400 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                  rows={3}
                  placeholder="Short player-facing description"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs text-zinc-400 mb-1">Mechanical Summary (optional)</label>
                <textarea
                  value={formData.mechanicalSummary}
                  onChange={(e) => setFormData((p) => ({ ...p, mechanicalSummary: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                  rows={2}
                  placeholder="Rules/mechanics notes"
                />
              </div>

              {isGM && (
                <div className="md:col-span-2">
                  <label className="block text-xs text-zinc-400 mb-1">GM Notes (optional)</label>
                  <textarea
                    value={formData.gmNotes}
                    onChange={(e) => setFormData((p) => ({ ...p, gmNotes: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                    rows={2}
                    placeholder="Hidden GM notes"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-linear-to-r from-indigo-500 to-purple-500 text-white font-medium hover:opacity-90"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
  </>
);
}