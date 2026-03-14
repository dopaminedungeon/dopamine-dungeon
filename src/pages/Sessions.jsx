import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMode } from "../context/ModeContext.jsx";
import {
  Search,
  Plus,
  Clock,
  Users,
  Play,
  Pause,
  Square,
  Calendar,
} from "lucide-react";
import { useCampaign } from "../context/CampaignContext";
import { sessionsRepo } from "../data/sessions/sessions.repo";

const statusConfig = {
  active: { color: 'bg-emerald-500', text: 'text-emerald-400', label: 'Live', icon: Play },
  paused: { color: 'bg-amber-500', text: 'text-amber-400', label: 'Paused', icon: Pause },
  completed: { color: 'bg-zinc-500', text: 'text-zinc-400', label: 'Completed', icon: Square },
  scheduled: { color: 'bg-blue-500', text: 'text-blue-400', label: 'Scheduled', icon: Calendar },
};

const difficultyColors = {
  Normal: 'text-emerald-400 bg-emerald-500/10',
  Heroic: 'text-blue-400 bg-blue-500/10',
  Mythic: 'text-purple-400 bg-purple-500/10',
  Extreme: 'text-red-400 bg-red-500/10',
  Competitive: 'text-amber-400 bg-amber-500/10',
};

function newId(prefix = "session") {
  try {
    return `${prefix}-${crypto.randomUUID()}`;
  } catch {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export default function Sessions() {
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { selectedCampaignId } = useCampaign();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

useEffect(() => {
  if (!selectedCampaignId) {
    setSessions([]);
    setLoading(false);
    return;
  }

  async function load() {
    setLoading(true);
    try {
      const data = await sessionsRepo.getAll(selectedCampaignId);
      setSessions(safeArray(data));
    } catch (error) {
      console.error("[Sessions] Failed to load sessions", error);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }

  load();
}, [selectedCampaignId]);

  const [formData, setFormData] = useState({
    name: "",
    sessionNumber: 1,
    map: "",
    difficulty: "Normal",
    players: 0,
    maxPlayers: 4,
    status: "scheduled",
    startTime: "",
    visibility: "public",
    gmNotes: "",
  });
  const navigate = useNavigate();
  const { isGM } = useMode();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState('All');

  const filteredSessions = sessions.filter((session) => {
    const matchesSearch = String(session.name || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatus === 'All' || session.status === selectedStatus.toLowerCase();
    return matchesSearch && matchesStatus;
  });
  const visibleSessions = isGM
    ? filteredSessions
    : filteredSessions.filter((session) => session.visibility === "public");

const activeSessions = sessions.filter((s) => s.status === "active").length;
const totalPlayers = sessions.reduce((acc, s) => acc + (Number(s.players) || 0), 0);

if (!selectedCampaignId) {
  return (
    <main className="flex-1 overflow-auto flex items-center justify-center">
      <div className="text-zinc-400">Select a campaign to view sessions.</div>
    </main>
  );
}

if (loading) {
  return (
    <main className="flex-1 overflow-auto flex items-center justify-center">
      <div className="text-zinc-400">Loading sessions...</div>
    </main>
  );
}

  return (
    <main className="flex-1 overflow-auto">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/20 rounded-xl">
            <Play className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-zinc-500 text-sm">Active Sessions</p>
            <p className="text-2xl font-bold text-white">{activeSessions}</p>
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-blue-500/20 rounded-xl">
            <Users className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="text-zinc-500 text-sm">Players Online</p>
            <p className="text-2xl font-bold text-white">{totalPlayers}</p>
          </div>
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-3 py-2.5 sm:pl-12 sm:pr-4 sm:py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
          />
        </div>

        {/* Status Filter */}
        <div className="flex gap-2 overflow-x-auto whitespace-nowrap pr-1 [-webkit-overflow-scrolling:touch]">
          {['All', 'Active', 'Paused', 'Scheduled', 'Completed'].map((status) => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`shrink-0 px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl font-medium transition-all ${selectedStatus === status
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
                }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Create Button */}
        {isGM && (
          <button
            className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2.5 sm:px-6 sm:py-3 bg-linear-to-r from-indigo-500 to-purple-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="w-5 h-5" />
            New Session
          </button>
        )}
      </div>

      {/* Sessions List */}
      <div className="space-y-4">
        {visibleSessions.map((session) => {
          const status = statusConfig[session.status];
          const StatusIcon = status.icon;
          const isGmOnly = session.visibility === "gm-only";
          const progress = Number(session.progress) || 0;
          return (
            <div
              key={session.id}
              className="group bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-purple-500/30 hover:bg-white/10 transition-all cursor-pointer"
              onClick={() => navigate(`/sessions/${session.id}`)}
            >
              <div className="flex flex-col lg:flex-row lg:items-center gap-3 sm:gap-4">
                {/* Session Info */}
                <div className="flex items-center gap-4 flex-1">
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-linear-to-br from-emerald-500 to-teal-500 flex items-center justify-center`}>
                    <StatusIcon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
                        {session.name}
                      </h3>

                      {/* GM-only badge – only visible in GM mode */}
                      {isGM && isGmOnly && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/20 text-red-300 border border-red-500/40">
                          GM ONLY
                        </span>
                      )}

                      <span
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.text} bg-white/5`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${status.color} ${session.status === "active" ? "animate-pulse" : ""
                            }`}
                        />
                        {status.label}
                      </span>
                    </div>
                    <p className="text-zinc-500 text-sm">{session.map || ""}</p>
                  </div>
                </div>

                {/* Session Details */}
                <div className="flex flex-wrap items-center gap-3 sm:gap-6">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-zinc-500" />
                    <span className="text-white">{Number(session.players) || 0}/{Number(session.maxPlayers) || 0}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-zinc-500" />
                    <span className="text-white">{session.duration || "—"}</span>
                  </div>
                  <span className={`px-3 py-1 rounded-lg text-xs font-medium ${difficultyColors[session.difficulty] || difficultyColors.Normal}`}>
                    {session.difficulty}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full lg:w-32">
                  <div className="flex items-center justify-between mb-1 min-w-0">
                    <span className="text-zinc-500 text-xs">Progress</span>
                    <span className="text-white text-xs font-medium">{progress}%</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${progress === 100 ? 'bg-zinc-500' : 'bg-linear-to-r from-emerald-500 to-teal-500'
                        }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4 pt-6 pb-28 sm:pb-6 overflow-y-auto">
          <div className="w-[92vw] max-w-xl max-h-[85vh] overflow-y-auto my-auto bg-zinc-950 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4">Create New Session</h2>

            <form
              className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!selectedCampaignId) return;

              const id = newId("session");
              const nextSession = {
                id,
                name: formData.name,
                sessionNumber: Number(formData.sessionNumber) || 1,
                map: formData.map,
                difficulty: formData.difficulty,
                players: Number(formData.players) || 0,
                maxPlayers: Number(formData.maxPlayers) || 0,
                status: formData.status,
                startTime: formData.startTime,
                visibility: formData.visibility,
                gmNotes: formData.gmNotes,
                summary: "",
                duration: "—",
                progress: 0,
              };

              await sessionsRepo.upsert(selectedCampaignId, nextSession);
              const data = await sessionsRepo.getAll(selectedCampaignId);
              setSessions(safeArray(data));

              setShowCreateModal(false);
              setFormData({
                name: "",
                sessionNumber: 1,
                map: "",
                difficulty: "Normal",
                players: 0,
                maxPlayers: 4,
                status: "scheduled",
                startTime: "",
                visibility: "public",
                gmNotes: "",
              });

              // Navigate straight to the new session
              navigate(`/sessions/${id}`);
            }}
            >
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Session Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Session Number</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.sessionNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, sessionNumber: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-1">
                    Visibility
                  </label>
                  <div className="grid grid-cols-1 sm:flex gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, visibility: "public" })
                      }
                      className={`px-3 py-2 rounded-xl text-sm border ${formData.visibility === "public"
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
                      className={`px-3 py-2 rounded-xl text-sm border ${formData.visibility === "gm-only"
                          ? "border-red-500 bg-red-500/10 text-red-300"
                          : "border-white/10 bg-white/5 text-zinc-300"
                        }`}
                    >
                      GM only
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Map</label>
                <input
                  type="text"
                  required
                  value={formData.map}
                  onChange={(e) => setFormData({ ...formData, map: e.target.value })}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Difficulty</label>
                  <select
                    value={formData.difficulty}
                    onChange={(e) =>
                      setFormData({ ...formData, difficulty: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
                  >
                    <option>Normal</option>
                    <option>Heroic</option>
                    <option>Mythic</option>
                    <option>Extreme</option>
                    <option>Competitive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Players</label>
                  <input
                    type="number"
                    value={formData.players}
                    onChange={(e) =>
                      setFormData({ ...formData, players: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Max Players</label>
                  <input
                    type="number"
                    value={formData.maxPlayers}
                    onChange={(e) =>
                      setFormData({ ...formData, maxPlayers: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Start Time</label>
                <input
                  type="datetime-local"
                  value={formData.startTime}
                  onChange={(e) =>
                    setFormData({ ...formData, startTime: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">GM notes / prep (optional)</label>
                <textarea
                  rows={3}
                  value={formData.gmNotes}
                  onChange={(e) =>
                    setFormData({ ...formData, gmNotes: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:flex sm:justify-end gap-2 sm:gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-white/5 text-zinc-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-linear-to-r from-purple-500 to-indigo-500 text-white font-medium hover:opacity-90"
                >
                  Save Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}