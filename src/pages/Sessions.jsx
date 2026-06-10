import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMode } from "../context/ModeContext.jsx";
import {
  Search,
  Plus,
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

function getSessionDateMs(session) {
  const rawDate = getSessionDateValue(session?.startTime);
  if (!rawDate) return null;

  const parsed = Date.parse(`${rawDate}T00:00:00`);
  return Number.isFinite(parsed) ? parsed : null;
}

function getSessionDateValue(value) {
  const rawDate = String(value || "").trim();
  if (!rawDate) return "";
  return rawDate.slice(0, 10);
}

function compareSessionNames(a, b) {
  return String(a?.name || "").localeCompare(String(b?.name || ""), undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

function sortSessions(sessions, sortMode) {
  return sessions
    .map((session, index) => ({
      session,
      index,
      dateMs: getSessionDateMs(session),
    }))
    .sort((a, b) => {
      const aHasDate = a.dateMs !== null;
      const bHasDate = b.dateMs !== null;

      if (sortMode === "name-asc" || sortMode === "name-desc") {
        const byName = compareSessionNames(a.session, b.session);
        if (byName !== 0) {
          return sortMode === "name-asc" ? byName : -byName;
        }
        return a.index - b.index;
      }

      if (aHasDate && bHasDate && a.dateMs !== b.dateMs) {
        return sortMode === "date-asc" ? a.dateMs - b.dateMs : b.dateMs - a.dateMs;
      }

      if (aHasDate !== bHasDate) {
        return aHasDate ? -1 : 1;
      }

      return a.index - b.index;
    })
    .map(({ session }) => session);
}

function formatSessionDate(session) {
  const rawDate = getSessionDateValue(session?.startTime);
  if (!rawDate) return "Date not set";

  const parsed = new Date(`${rawDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return rawDate;

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function Sessions() {
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { selectedCampaignId } = useCampaign();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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
    status: "scheduled",
    startTime: "",
    visibility: "public",
    gmNotes: "",
  });
  const navigate = useNavigate();
  const { isGM } = useMode();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [sortMode, setSortMode] = useState("date-desc");

  const filteredSessions = sessions.filter((session) => {
    const matchesSearch = String(session.name || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatus === 'All' || session.status === selectedStatus.toLowerCase();
    return matchesSearch && matchesStatus;
  });
  const sortedSessions = sortSessions(filteredSessions, sortMode);
  const visibleSessions = isGM
    ? sortedSessions
    : sortedSessions.filter((session) => session.visibility === "public");

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

        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value)}
          className="w-full md:w-auto px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-white/10 bg-white/5 text-sm font-medium text-zinc-200 focus:outline-none focus:border-emerald-500/50"
          aria-label="Sort sessions"
        >
          <option value="date-desc">Newest to oldest</option>
          <option value="date-asc">Oldest to newest</option>
          <option value="name-asc">A-Z</option>
          <option value="name-desc">Z-A</option>
        </select>

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
          const status = statusConfig[session.status] || statusConfig.scheduled;
          const StatusIcon = status.icon;
          const isGmOnly = session.visibility === "gm-only";
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
                    <p className="text-zinc-500 text-sm">
                      {formatSessionDate(session)} • Location: {session.map || "—"}
                    </p>
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
              if (!selectedCampaignId || isSaving) return;

              const id = newId("session");
              const nextSession = {
                id,
                name: formData.name,
                sessionNumber: Number.isFinite(Number(formData.sessionNumber))
                  ? Number(formData.sessionNumber)
                  : 1,
                map: formData.map,
                difficulty: "Normal",
                players: 0,
                maxPlayers: 0,
                status: formData.status,
                startTime: getSessionDateValue(formData.startTime),
                visibility: formData.visibility,
                gmNotes: formData.gmNotes,
                summary: "",
                duration: "—",
                progress: 0,
              };

              try {
                setIsSaving(true);

                await sessionsRepo.upsert(selectedCampaignId, nextSession);
                const data = await sessionsRepo.getAll(selectedCampaignId);
                setSessions(safeArray(data));

                setShowCreateModal(false);
                setFormData({
                  name: "",
                  sessionNumber: 1,
                  map: "",
                  status: "scheduled",
                  startTime: "",
                  visibility: "public",
                  gmNotes: "",
                });

                // Navigate straight to the new session
                navigate(`/sessions/${id}`);
              } finally {
                setIsSaving(false);
              }
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
                    min={0}
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
                <label className="block text-sm text-zinc-400 mb-1">Location</label>
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

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Date</label>
                <input
                  type="date"
                  value={formData.startTime}
                  onChange={(e) =>
                    setFormData({ ...formData, startTime: getSessionDateValue(e.target.value) })
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
                  disabled={isSaving}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-linear-to-r from-purple-500 to-indigo-500 text-white font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save Session"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
