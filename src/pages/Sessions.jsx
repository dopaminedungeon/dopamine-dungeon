import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { locationsRepo } from "../data/maps/locations.repo";
import { createLink } from "../domain/links/link.service";
import { addLink, getLinksForEntity, loadLinks } from "../data/links/links.repo";

const MAIN_LOCATION_LINK_NOTE = "auto:session-main-location";

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

function getOtherEndpoint(link, baseType, baseId) {
  return link.entityA.type === baseType && String(link.entityA.id) === String(baseId)
    ? link.entityB
    : link.entityA;
}

function hasVisitedPlayerSessionLocationLink(links, sessionId, locationId) {
  return links.some((link) => {
    const other = getOtherEndpoint(link, "Session", sessionId);
    return (
      other.type === "Map" &&
      String(other.id) === String(locationId) &&
      link.label === "visited" &&
      link.visibility === "Player"
    );
  });
}

async function ensureMainLocationLink(campaignId, sessionId, locationId) {
  if (!campaignId || !sessionId || !locationId) return;

  await loadLinks(campaignId);
  const sessionLinks = getLinksForEntity("Session", String(sessionId), "GM");
  if (hasVisitedPlayerSessionLocationLink(sessionLinks, sessionId, locationId)) return;

  const link = createLink({
    entityA: { type: "Session", id: String(sessionId) },
    entityB: { type: "Map", id: String(locationId) },
    label: "visited",
    visibility: "Player",
    note: MAIN_LOCATION_LINK_NOTE,
  });

  try {
    await addLink(link, campaignId);
  } catch (error) {
    if (!String(error?.message || "").includes("Duplicate link prevented")) {
      throw error;
    }
  }
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

function getSessionPreview(session) {
  return String(session?.summary || session?.description || "").trim() || "No summary yet.";
}

function getHighlightSessionId(sessions) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const datedSessions = sessions
    .map((session) => ({
      session,
      dateMs: getSessionDateMs(session),
    }))
    .filter(({ dateMs }) => dateMs !== null);

  const upcoming = datedSessions
    .filter(({ dateMs }) => dateMs >= today.getTime())
    .sort((a, b) => a.dateMs - b.dateMs)[0];

  if (upcoming) return String(upcoming.session.id);

  const mostRecentCompleted = datedSessions
    .filter(({ session }) => session.status === "completed")
    .sort((a, b) => b.dateMs - a.dateMs)[0];

  return mostRecentCompleted ? String(mostRecentCompleted.session.id) : null;
}

export default function Sessions() {
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { selectedCampaignId } = useCampaign();
  const [sessions, setSessions] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");

useEffect(() => {
  if (!selectedCampaignId) {
    setSessions([]);
    setLoading(false);
    return;
  }

  async function load() {
    setLoading(true);
    try {
      const [sessionData, locationData] = await Promise.all([
        sessionsRepo.getAll(selectedCampaignId),
        locationsRepo.getAll(selectedCampaignId),
      ]);
      setSessions(safeArray(sessionData));
      setLocations(safeArray(locationData));
    } catch (error) {
      console.error("[Sessions] Failed to load sessions", error);
      setSessions([]);
      setLocations([]);
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
  const highlightSessionId = useMemo(
    () => getHighlightSessionId(visibleSessions),
    [visibleSessions]
  );
  const visibleLocations = useMemo(() => {
    if (isGM) return locations;
    return locations.filter((location) => location?.visibility === "public");
  }, [isGM, locations]);
  const locationsById = useMemo(
    () => new Map(visibleLocations.map((location) => [String(location.id), location])),
    [visibleLocations]
  );
  const allLocationsById = useMemo(
    () => new Map(locations.map((location) => [String(location.id), location])),
    [locations]
  );
  const filteredLocations = useMemo(() => {
    const normalizedQuery = locationQuery.trim().toLowerCase();

    return locations
      .filter((location) => {
        if (!location?.id) return false;
        if (!normalizedQuery) return true;

        return [location.name, location.category]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery));
      })
      .sort((a, b) =>
        String(a?.name || "").localeCompare(String(b?.name || ""), undefined, {
          sensitivity: "base",
          numeric: true,
        })
      );
  }, [locationQuery, locations]);
  const selectedLocation = formData.map ? allLocationsById.get(String(formData.map)) : null;
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
          const locationId = String(session?.map || "").trim();
          const location = locationId ? locationsById.get(locationId) : null;
          const locationLabel = !locationId
            ? "No location"
            : location?.name || "Unknown location";
          const sessionNumber =
            session.sessionNumber !== undefined &&
            session.sessionNumber !== null &&
            session.sessionNumber !== ""
              ? `Session ${session.sessionNumber}`
              : "Session";
          const isHighlighted = String(session.id) === highlightSessionId;
          return (
            <article
              key={session.id}
              className={`group relative rounded-xl border bg-white/5 p-5 backdrop-blur-sm transition-all hover:border-purple-500/30 hover:bg-white/10 sm:rounded-2xl ${
                isHighlighted
                  ? "border-emerald-400/35 shadow-[0_0_24px_rgba(16,185,129,0.12)]"
                  : "border-white/10"
              }`}
            >
              <Link
                to={`/sessions/${session.id}`}
                aria-label={`Open ${session.name || "session"}`}
                className="absolute inset-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400/60 sm:rounded-2xl"
              />

              <div className="relative pointer-events-none flex gap-4">
                <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 to-teal-500 text-white">
                  <StatusIcon className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        {sessionNumber}
                      </p>
                      <h3 className="mt-0.5 text-lg font-bold leading-tight text-white transition-colors group-hover:text-emerald-300 sm:text-xl">
                        {session.name || "Untitled session"}
                      </h3>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium ${status.text}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${status.color} ${
                            session.status === "active" ? "animate-pulse" : ""
                          }`}
                        />
                        {status.label}
                      </span>

                      {isGM && isGmOnly ? (
                        <span className="rounded-full border border-red-500/40 bg-red-500/20 px-2.5 py-1 text-xs font-medium text-red-300">
                          GM only
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
                    <span>{formatSessionDate(session)}</span>
                    <span className="hidden text-zinc-700 sm:inline">•</span>
                    {location ? (
                      <Link
                        to={`/maps/${location.id}`}
                        className="pointer-events-auto relative z-10 text-zinc-300 hover:text-purple-200"
                      >
                        {locationLabel}
                      </Link>
                    ) : (
                      <span>{locationLabel}</span>
                    )}
                  </div>

                  <p className="line-clamp-2 text-sm leading-6 text-zinc-400">
                    {getSessionPreview(session)}
                  </p>
                </div>
              </div>
            </article>
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
                if (nextSession.map) {
                  await ensureMainLocationLink(selectedCampaignId, id, nextSession.map);
                }
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
                setLocationQuery("");

                // Navigate straight to the new session
                navigate(`/sessions/${id}`);
              } finally {
                setIsSaving(false);
              }
            }}
	            >
                <fieldset disabled={isSaving} className="space-y-4 disabled:opacity-60">
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
                        disabled={isSaving}
	                      onClick={() =>
                        setFormData({ ...formData, visibility: "public" })
                      }
	                      className={`px-3 py-2 rounded-xl text-sm border disabled:cursor-not-allowed disabled:opacity-50 ${formData.visibility === "public"
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                          : "border-white/10 bg-white/5 text-zinc-300"
                        }`}
                    >
                      Player-visible
                    </button>
                    <button
	                      type="button"
                        disabled={isSaving}
	                      onClick={() =>
                        setFormData({ ...formData, visibility: "gm-only" })
                      }
	                      className={`px-3 py-2 rounded-xl text-sm border disabled:cursor-not-allowed disabled:opacity-50 ${formData.visibility === "gm-only"
                          ? "border-red-500 bg-red-500/10 text-red-300"
                          : "border-white/10 bg-white/5 text-zinc-300"
                        }`}
                    >
                      GM only
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm text-zinc-400">Main Location</label>
                <input
                  type="search"
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  placeholder="Search locations..."
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-500"
                />

                <div className="rounded-xl border border-white/10 bg-black/10">
                  <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-zinc-500">
                        Selected
                      </p>
                      <p className="truncate text-sm text-zinc-200">
                        {selectedLocation?.name || "No location"}
                        {selectedLocation?.category ? (
                          <span className="text-zinc-500"> • {selectedLocation.category}</span>
                        ) : null}
                      </p>
                    </div>
                    {formData.map ? (
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => {
                          setFormData({ ...formData, map: "" });
                          setLocationQuery("");
                        }}
                        className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Clear
                      </button>
                    ) : (
                      <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-500">
                        None
                      </span>
                    )}
                  </div>

                  <div className="max-h-48 overflow-y-auto p-1.5">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => {
                        setFormData({ ...formData, map: "" });
                        setLocationQuery("");
                      }}
                      className={`mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        !formData.map
                          ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                          : "border border-transparent text-zinc-300 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span>No location</span>
                      {!formData.map ? (
                        <span className="text-[11px] uppercase tracking-wide text-emerald-300">
                          Selected
                        </span>
                      ) : null}
                    </button>

                    {filteredLocations.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-zinc-500">No matching locations.</p>
                    ) : (
                      filteredLocations.map((location) => {
                        const isSelected = String(formData.map || "") === String(location.id);
                        return (
                          <button
                            key={location.id}
                            type="button"
                            disabled={isSaving}
                            onClick={() => {
                              setFormData({ ...formData, map: String(location.id) });
                              setLocationQuery(location.name || "");
                            }}
                            className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                              isSelected
                                ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                                : "border border-transparent text-zinc-300 hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate">
                                {location.name || "Untitled location"}
                              </span>
                              {location.category ? (
                                <span className="block truncate text-xs text-zinc-500">
                                  {location.category}
                                </span>
                              ) : null}
                            </span>
                            {isSelected ? (
                              <span className="shrink-0 text-[11px] uppercase tracking-wide text-emerald-300">
                                Selected
                              </span>
                            ) : null}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
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
	                  disabled={isSaving}
	                  onClick={() => {
                      setShowCreateModal(false);
                      setLocationQuery("");
                    }}
	                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-white/5 text-zinc-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
	                >
                  Cancel
                </button>
                <button
                  type="submit"
	                  disabled={isSaving}
	                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-linear-to-r from-purple-500 to-indigo-500 text-white font-medium hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
	                >
                  {isSaving ? "Saving..." : "Save Session"}
                </button>
	              </div>
                </fieldset>
	            </form>
          </div>
        </div>
      )}
    </main>
  );
}
