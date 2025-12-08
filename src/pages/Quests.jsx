// src/pages/Quests.jsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import GradientBackground from "../components/GradientBackground";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { useMode } from "../context/ModeContext.jsx";
import {
  Search,
  Plus,
  CheckCircle2,
  XCircle,
  PauseCircle,
  Sparkles,
  User,
  Map as MapIcon,
  ScrollText,
  Link2,
  Tag,
} from "lucide-react";
import { mockQuests } from "../data/mockQuests.js";


const statusConfig = {
  active: {
    label: "Active",
    icon: PauseCircle,
    chipClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    chipClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    chipClass: "bg-red-500/15 text-red-300 border-red-500/30",
  },
};

export default function Quests() {
  const navigate = useNavigate();
  const { isGM } = useMode();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | active | completed | failed

  // Quests are a GM-only planning tool.
  // If the current user is in Player mode (isGM === false),
  // show a friendly message instead of the quest console.
  const filteredQuests = useMemo(() => {
    return mockQuests.filter((q) => {
      const matchesStatus =
        statusFilter === "all" ? true : q.status === statusFilter;

      const haystack = (
        `${q.name} ${q.playerSummary} ${q.campaign} ${(q.tags || []).join(" ")}`
      ).toLowerCase();

      const matchesSearch = haystack.includes(searchQuery.toLowerCase());

      return matchesStatus && matchesSearch;
    });
  }, [searchQuery, statusFilter]);

  if (!isGM) {
    return (
      <GradientBackground>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col ml-64">
            <TopBar title="Quests & Plot Threads" />
            <main className="flex-1 p-8 overflow-auto flex items-center justify-center">
              <div className="max-w-lg bg-white/5 border border-white/10 rounded-2xl p-8 text-center backdrop-blur-sm">
                <h1 className="text-2xl font-bold text-white mb-2">
                  GM-Only Plot Console
                </h1>
                <p className="text-sm text-zinc-400">
                  Quests and plot threads live here, but this module is for the Dungeon Master only.
                  Players will see quest info in their own session log instead of this page. 💜
                </p>
              </div>
            </main>
          </div>
        </div>
      </GradientBackground>
    );
  }

  const handleCardClick = (id) => {
    navigate(`/quests/${id}`);
  };

  return (
    <GradientBackground>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col ml-64">
          <TopBar title="Quests & Plot Threads" />

          <main className="flex-1 p-8 overflow-auto">
            {/* Header row: search + filters + add button */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
              {/* Search */}
              <div className="relative w-full md:max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search quests by name, summary, or tag..."
                  className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400/50"
                />
              </div>

              {/* Filters + add */}
              <div className="flex flex-wrap gap-3 items-center justify-between md:justify-end">
                <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 text-sm">
                  {[
                    { key: "all", label: "All" },
                    { key: "active", label: "Active" },
                    { key: "completed", label: "Completed" },
                    { key: "failed", label: "Failed" },
                  ].map((option) => (
                    <button
                      key={option.key}
                      onClick={() => setStatusFilter(option.key)}
                      className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                        statusFilter === option.key
                          ? "bg-purple-500 text-white"
                          : "text-zinc-400 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {isGM && (
                  <button
                    type="button"
                    onClick={() => {
                      // later: open "New Quest" modal
                      console.log("New quest modal – TODO");
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-purple-500/25 hover:opacity-90 transition"
                  >
                    <Plus className="w-4 h-4" />
                    New Quest
                  </button>
                )}
              </div>
            </div>

            {/* Summary bar */}
            <div className="mb-6 flex flex-wrap gap-3 text-xs text-zinc-400">
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1">
                <Sparkles className="w-3 h-3 text-purple-300" />
                <span>
                  Showing {filteredQuests.length} quest
                  {filteredQuests.length === 1 ? "" : "s"}
                </span>
              </div>
              {isGM && (
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 rounded-full px-3 py-1">
                  <ScrollText className="w-3 h-3" />
                  <span>GM-only view: players never see this page. Use it to wrangle plot chaos.</span>
                </div>
              )}
            </div>

            {/* Quest swimlanes by status */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              {["active", "completed", "failed"].map((lane) => {
                const laneQuests = filteredQuests.filter((q) => q.status === lane);
                const config = statusConfig[lane];

                return (
                  <section
                    key={lane}
                    className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col min-h-[260px]"
                  >
                    {/* Lane header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${config.chipClass}`}
                        >
                          <config.icon className="w-3.5 h-3.5" />
                          <span>{config.label}</span>
                        </div>
                        <span className="text-[11px] uppercase tracking-wide text-zinc-500">
                          {laneQuests.length} quest
                          {laneQuests.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>

                    {/* Lane body */}
                    {laneQuests.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-xs text-zinc-500 border border-dashed border-white/10 rounded-xl py-6">
                        No {config.label.toLowerCase()} quests.
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                        {laneQuests.map((quest) => {
                          const StatusIcon = statusConfig[quest.status].icon;

                          return (
                            <button
                              key={quest.id}
                              type="button"
                              onClick={() => handleCardClick(quest.id)}
                              className="w-full text-left group bg-zinc-900/60 hover:bg-zinc-900/90 border border-white/10 hover:border-purple-400/40 rounded-xl p-4 transition flex flex-col gap-3"
                            >
                              {/* Top row: name + status + GM-only */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-sm font-semibold text-white group-hover:text-purple-200">
                                      {quest.name}
                                    </h3>
                                    {quest.visibility === "gm-only" && (
                                      <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40">
                                        GM ONLY
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-zinc-400 line-clamp-2">
                                    {quest.playerSummary}
                                  </p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                                      statusConfig[quest.status].chipClass
                                    }`}
                                  >
                                    <StatusIcon className="w-3 h-3" />
                                    {statusConfig[quest.status].label}
                                  </span>
                                  <span className="text-[10px] text-zinc-500">
                                    {quest.campaign}
                                  </span>
                                </div>
                              </div>

                              {/* Progress bar */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[10px] text-zinc-500">
                                  <span>Progress</span>
                                  <span>{quest.progress}%</span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-purple-500 via-violet-400 to-pink-500 transition-all"
                                    style={{ width: `${quest.progress}%` }}
                                  />
                                </div>
                              </div>

                              {/* Linked counts */}
                              <div className="flex flex-wrap gap-3 text-[11px] text-zinc-500 mt-1">
                                <div className="inline-flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  <span>{quest.links.npcs} NPCs</span>
                                </div>
                                <div className="inline-flex items-center gap-1">
                                  <ScrollText className="w-3 h-3" />
                                  <span>{quest.links.sessions} sessions</span>
                                </div>
                                <div className="inline-flex items-center gap-1">
                                  <MapIcon className="w-3 h-3" />
                                  <span>{quest.links.maps} maps</span>
                                </div>
                                <div className="inline-flex items-center gap-1">
                                  <Link2 className="w-3 h-3" />
                                  <span>{quest.links.lore} lore</span>
                                </div>
                              </div>

                              {/* Tags */}
                              {quest.tags?.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {quest.tags.map((tag) => (
                                    <span
                                      key={tag}
                                      className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] text-zinc-300"
                                    >
                                      <Tag className="w-3 h-3 text-zinc-400" />
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </main>
        </div>
      </div>
    </GradientBackground>
  );
}