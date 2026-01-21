// src/pages/Arcs.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMode } from "../context/ModeContext";
import { Plus, Search } from "lucide-react";
import { mockArcs } from "../data/mockArcs";

// CLEANED STATUSES
const statusOrder = ["Active", "Planned", "Resolved", "Failed"];

const arcTypes = ["All", "Main Arc", "Character Arc", "PC Arc", "Timeline"];

export default function Arcs() {
  const navigate = useNavigate();
  const { isGM } = useMode();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("All");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    arcType: "Main Arc",
    status: "Planned",
    visibility: "gm-only",
    summary: "",
    world: "Chronicles of Varionath",
    progress: 0,
  });

  const term = searchQuery.toLowerCase().trim();

  // FILTERING
  const filteredArcs = mockArcs.filter((arc) => {
    if (!isGM && arc.visibility === "gm-only") return false;

    const matchesSearch =
      arc.name.toLowerCase().includes(term) ||
      arc.summary.toLowerCase().includes(term);

    const matchesType = selectedType === "All" || arc.arcType === selectedType;

    return matchesSearch && matchesType;
  });

  function statusColor(status) {
    switch (status) {
      case "Active":
        return "bg-violet-900/40 border border-violet-700/40 text-violet-300";
      case "Planned":
        return "bg-blue-900/40 border border-blue-700/40 text-blue-300";
      case "Resolved":
        return "bg-emerald-900/40 border border-emerald-700/40 text-emerald-300";
      case "Failed":
        return "bg-red-900/40 border border-red-700/40 text-red-300";
      default:
        return "bg-white/10 text-white/60";
    }
  }

  function resetForm() {
    setFormData({
      name: "",
      arcType: "Main Arc",
      status: "Planned",
      visibility: "gm-only",
      summary: "",
      world: "Chronicles of Varionath",
      progress: 0,
    });
  }

  function handleSave(e) {
    e.preventDefault();
    console.log("New arc:", formData);
    setShowCreateModal(false);
    resetForm();
  }

  if (!isGM) {
    return (
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-xl mx-auto bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">DM Eyes Only</h1>
          <p className="text-zinc-400 text-sm mb-4">
            This page is for long-term plot scheming, foreshadowing and emotional
            damage planning. If you're a player, you definitely shouldn't be here.
            Go touch some loot instead. 💜
          </p>
          <button
            className="mt-2 px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20"
            onClick={() => navigate("/")}
          >
            Back to Dashboard
          </button>
        </div>
      </main>
    );
  }
  return (
    <>
      <main className="flex-1 p-8 overflow-auto">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white">Arcs & Timelines</h1>
          {isGM && (
            <button
              className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-violet-600 to-violet-500 hover:from-violet-700 hover:to-violet-600 text-white rounded-xl"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="w-4 h-4" />
              New Arc / Timeline
            </button>
          )}
        </div>

        {/* SEARCH + TYPE FILTER */}
        <div className="flex flex-col md:flex-row md:items-center md:gap-4 mb-8">
          {/* Search */}
          <div className="relative flex-1 mb-4 md:mb-0">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
            <input
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-3 text-white placeholder-zinc-500"
              placeholder="Search arcs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Type Filter */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-4 md:mb-0">
            {arcTypes.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`whitespace-nowrap px-4 py-1 rounded-full text-sm font-semibold transition ${
                  selectedType === type
                    ? "bg-violet-600 text-white"
                    : "bg-white/10 text-white/60 hover:bg-white/20"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* 🟣 SWIMLANES */}
        {statusOrder.map((statusKey) => {
          const arcsInLane = filteredArcs.filter((arc) => arc.status === statusKey);

          if (!arcsInLane.length) return null;

          return (
            <section key={statusKey} className="mb-12">
              <h2 className="text-xl font-semibold text-white mb-4">{statusKey}</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {arcsInLane.map((arc) => (
                  <div
                    key={arc.id}
                    onClick={() => navigate(`/arcs/${arc.id}`)}
                    className="relative group bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-violet-500/40 hover:bg-white/10 transition cursor-pointer"
                  >
                    {/* GM ONLY BADGE */}
                    {isGM && arc.visibility === "gm-only" && (
                      <span className="absolute top-3 right-3 text-[10px] px-2 py-0.5 rounded-full bg-red-900/40 border border-red-700/40 text-red-300 font-semibold">
                        GM ONLY
                      </span>
                    )}

                    <p className="text-xs uppercase text-violet-300 font-semibold tracking-wide mb-1">
                      {arc.arcType}
                    </p>

                    <h2 className="text-xl font-bold text-white mb-2">{arc.name}</h2>

                    <p className="text-zinc-400 text-sm mb-4">{arc.summary}</p>

                    {/* Progress bar */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
                        <span>Progress</span>
                        <span>{arc.progress}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-linear-to-r from-violet-500 to-emerald-400"
                          style={{ width: `${arc.progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Linked entities summary */}
                    <div className="flex items-center gap-3 text-[11px] text-zinc-400 mb-4">
                      <span>{arc.linkedSessions} sessions</span>
                      <span>• {arc.linkedNPCs} NPCs</span>
                      <span>• {arc.linkedMaps} maps</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusColor(
                          arc.status
                        )}`}
                      >
                        {arc.status}
                      </div>

                      <p className="text-zinc-500 text-xs">Updated {arc.lastUpdated}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </main>

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <form
            onSubmit={handleSave}
            className="max-w-lg w-full bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 text-white flex flex-col gap-6"
          >
            <h2 className="text-2xl font-bold mb-4">Create New Arc / Timeline</h2>

            {/* Name */}
            <label className="flex flex-col gap-1">
              <span className="font-semibold">Name *</span>
              <input
                required
                type="text"
                className="bg-white/10 rounded-lg px-3 py-2 text-white placeholder-white/50"
                value={formData.name}
                onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
              />
            </label>

            {/* Arc Type */}
            <label className="flex flex-col gap-1">
              <span className="font-semibold">Arc Type</span>
              <select
                className="bg-white/10 rounded-lg px-3 py-2 text-white"
                value={formData.arcType}
                onChange={(e) => setFormData((f) => ({ ...f, arcType: e.target.value }))}
              >
                {arcTypes
                  .filter((t) => t !== "All")
                  .map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
              </select>
            </label>

            {/* Status */}
            <label className="flex flex-col gap-1">
              <span className="font-semibold">Status</span>
              <select
                className="bg-white/10 rounded-lg px-3 py-2 text-white"
                value={formData.status}
                onChange={(e) => setFormData((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="Planned">Planned</option>
                <option value="Active">Active</option>
                <option value="Resolved">Resolved</option>
                <option value="Failed">Failed</option>
              </select>
            </label>

            {/* Progress */}
            <label className="flex flex-col gap-1">
              <span className="font-semibold">Progress (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                className="bg-white/10 rounded-lg px-3 py-2 text-white placeholder-white/50"
                value={formData.progress}
                onChange={(e) =>
                  setFormData((f) => ({
                    ...f,
                    progress: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                  }))
                }
              />
            </label>

            {/* Visibility */}
            <div className="flex flex-col gap-1">
              <span className="font-semibold">Visibility</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
                    formData.visibility === "gm-only"
                      ? "bg-violet-600 text-white"
                      : "bg-white/10 text-white/60 hover:bg-white/20"
                  }`}
                  onClick={() => setFormData((f) => ({ ...f, visibility: "gm-only" }))}
                >
                  GM Only
                </button>

                <button
                  type="button"
                  className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
                    formData.visibility === "public"
                      ? "bg-violet-600 text-white"
                      : "bg-white/10 text-white/60 hover:bg-white/20"
                  }`}
                  onClick={() => setFormData((f) => ({ ...f, visibility: "public" }))}
                >
                  Public
                </button>
              </div>
            </div>

            {/* World */}
            <label className="flex flex-col gap-1">
              <span className="font-semibold">World</span>
              <input
                type="text"
                className="bg-white/10 rounded-lg px-3 py-2 text-white placeholder-white/50"
                value={formData.world}
                onChange={(e) => setFormData((f) => ({ ...f, world: e.target.value }))}
              />
            </label>

            {/* Summary */}
            <label className="flex flex-col gap-1">
              <span className="font-semibold">Summary</span>
              <textarea
                rows={3}
                className="bg-white/10 rounded-lg px-3 py-2 text-white placeholder-white/50 resize-none"
                value={formData.summary}
                onChange={(e) => setFormData((f) => ({ ...f, summary: e.target.value }))}
              />
            </label>

            {/* Buttons */}
            <div className="flex justify-end gap-4 pt-4 border-t border-white/10">
              <button
                type="button"
                className="px-6 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition"
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="px-6 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white transition"
              >
                Save Arc
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}