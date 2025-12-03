// src/pages/ArcProfile.jsx
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import GradientBackground from "../components/GradientBackground";
import { ArrowLeft } from "lucide-react";
import { useMode } from "../context/ModeContext.jsx";

const defaultArc = {
  id: "1",
  name: "Untitled Arc",
  tagline: "A mysterious thread in the tapestry of Varionath.",
  arcType: "Story Arc",
  status: "Active",
  world: "Varionath",
  visibility: "gm-only",
  progress: 0,

  // Player-facing fields
  playerOverview: "",
  themes: "",
  timeline: [],

  // GM-only fields
  gmTruth: "",
  gmFuture: "",
  gmClues: "",

  // Metadata
  tags: [],
  firstAppearance: "",
  lastUpdated: "",
};

function statusStyles(status) {
  switch (status) {
    case "Active":
      return "bg-violet-900/40 border border-violet-700/60 text-violet-200";
    case "Planned":
      return "bg-blue-900/40 border border-blue-700/60 text-blue-200";
    case "Resolved":
      return "bg-emerald-900/40 border border-emerald-700/60 text-emerald-200";
    case "Failed":
      return "bg-red-900/40 border border-red-700/60 text-red-200";
    case "Not started":
      return "bg-zinc-800/60 border border-zinc-600/80 text-zinc-200";
    default:
      return "bg-white/10 border border-white/20 text-white/70";
  }
}

// NEW:
const ARC_TYPES = ["Main Arc", "Side Arc", "Character Arc", "World Arc", "Story Arc"];

const STATUS_OPTIONS = ["Not started", "Active", "Resolved", "Failed"];

export default function ArcProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isGM } = useMode();
  const [searchParams] = useSearchParams();

  const isGmMode = isGM && searchParams.get("mode") !== "player";


  // later we'll fetch real data based on id
  const [arcData, setArcData] = useState(defaultArc);
  const [isEditing, setIsEditing] = useState(false);
  const [tagInput, setTagInput] = useState((defaultArc.tags || []).join(", "));

  const handleFieldChange = (field, value) => {
    setArcData((prev) => ({ ...prev, [field]: value }));
  };

  const handleTimelineChange = (index, field, value) => {
    setArcData((prev) => {
      const updated = [...(prev.timeline || [])];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, timeline: updated };
    });
  };


    const handleAddTimelineEntry = () => {
    setArcData((prev) => ({
      ...prev,
      timeline: [
        ...(prev.timeline || []),
        {
          id: Date.now().toString(),
          label: "",
          session: "",
          isDiscovered: false,   // 👈 NEW
        },
      ],
    }));
  };

  const isGmOnlyArc = arcData.visibility === "gm-only";
  const safeProgress =
    Number.isFinite(arcData.progress) && arcData.progress >= 0 && arcData.progress <= 100
      ? arcData.progress
      : 0;

    const timelineAll = arcData.timeline || [];
  const timelineVisibleForPlayer = timelineAll.filter((entry) => entry.isDiscovered);
  const timelineToRender =
    isGmMode && isEditing
      ? timelineAll
      : isGmMode
      ? timelineAll
      : timelineVisibleForPlayer;

  // Arcs & timelines are a pure GM tool – no player access to this page.
  if (!isGmMode) {
    return (
      <GradientBackground>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col ml-64">
            <TopBar title="GM-Only – Arcs &amp; Timelines" />
            <main className="flex-1 p-8 overflow-auto">
              <button
                className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6"
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="w-5 h-5" />
                Back to safer timelines
              </button>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
                <h1 className="text-3xl font-bold text-white mb-2">
                  This board is for Dungeon Masters only
                </h1>
                <p className="text-zinc-400 text-sm max-w-xl">
                  Arcs and timelines are where the DM keeps all the red string, conspiracy notes, and
                  &quot;secretly everyone is doomed&quot; plans. Players don&apos;t get to see this
                  meta scaffold – you&apos;ll experience it the honest way: by walking into it face first. 💜
                </p>
              </div>
            </main>
          </div>
        </div>
      </GradientBackground>
    );
  }


  return (
    <GradientBackground>
      <div className="flex min-h-screen">
        <Sidebar />

        <div className="flex-1 flex flex-col ml-64">
          <TopBar title={arcData.name} />

          <main className="flex-1 p-8 overflow-auto">
            {/* Back + Actions */}
            <div className="flex items-center justify-between mb-6">
              <button
                className="flex items-center gap-2 text-zinc-400 hover:text-white"
                onClick={() => navigate("/arcs")}
              >
                <ArrowLeft className="w-5 h-5" />
                Back to Arcs
              </button>

              {isGmMode && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setIsEditing((prev) => {
                        const next = !prev;
                        if (!prev) {
                          // entering edit mode – sync tag input from current tags
                          setTagInput((arcData.tags || []).join(", "));
                        }
                        return next;
                      })
                    }
                    className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-zinc-200 hover:bg-white/10"
                  >
                    {isEditing ? "Done" : "Edit"}
                  </button>
                </div>
              )}
            </div>

            {/* Header card */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  {isEditing && isGmMode ? (
                    <input
                      className="w-full bg-white/10 text-white p-3 rounded-xl border border-white/10 text-3xl font-bold"
                      value={arcData.name}
                      onChange={(e) => handleFieldChange("name", e.target.value)}
                    />
                  ) : (
                    <h1 className="text-3xl font-bold text-white">
                      {arcData.name}
                    </h1>
                  )}

                  {isEditing && isGmMode ? (
                    <input
                      className="w-full bg-white/10 text-zinc-200 p-2 rounded-lg border border-white/10 text-sm"
                      placeholder="Short tagline"
                      value={arcData.tagline}
                      onChange={(e) =>
                        handleFieldChange("tagline", e.target.value)
                      }
                    />
                  ) : (
                    <p className="text-zinc-300 text-sm max-w-2xl">
                      {arcData.tagline}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 mt-2">
                     {/* Arc type */}
                    {isGmMode && isEditing ? (
                      <select
                        className="px-3 py-1 rounded-full bg-violet-600/20 text-violet-200 text-xs font-semibold border border-violet-500/40 pr-6"
                        value={arcData.arcType}
                        onChange={(e) => handleFieldChange("arcType", e.target.value)}
                      >
                        {ARC_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-violet-600/20 text-violet-200 text-xs font-semibold">
                        {arcData.arcType || "Story Arc"}
                      </span>
                    )}

                    {/* Status */}
                    {isGmMode && isEditing ? (
                      <select
                        className="px-3 py-1 rounded-full bg-white/10 text-xs font-semibold border border-white/20 text-zinc-100 pr-6"
                        value={arcData.status}
                        onChange={(e) => handleFieldChange("status", e.target.value)}
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${statusStyles(
                          arcData.status
                        )}`}
                      >
                        {arcData.status}
                      </span>
                    )}

                    {/* World */}
                    {isEditing && isGmMode ? (
                      <input
                        className="bg-white/10 px-3 py-1 rounded-full text-xs text-zinc-200 border border-white/10"
                        value={arcData.world}
                        onChange={(e) =>
                          handleFieldChange("world", e.target.value)
                        }
                      />
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-white/5 text-xs text-zinc-300 border border-white/10">
                        {arcData.world}
                      </span>
                    )}

                    {/* GM ONLY badge for GM-view */}
                    {isGmMode && isGmOnlyArc && (
                      <span className="px-3 py-1 rounded-full bg-red-900/40 border border-red-700/60 text-[10px] font-semibold text-red-200 tracking-wide">
                        GM ONLY ARC
                      </span>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="mt-4 max-w-md">
                    <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                      <span>Progress</span>
                      <span className="text-zinc-200 font-semibold">
                        {safeProgress}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-violet-500 to-emerald-400"
                        style={{ width: `${safeProgress}%` }}
                      />
                    </div>
                    {isGmMode && isEditing && (
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="mt-2 w-24 bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-xs text-zinc-100"
                        value={safeProgress}
                        onChange={(e) => {
                          const raw = Number(e.target.value);
                          const clamped = Number.isNaN(raw)
                            ? 0
                            : Math.max(0, Math.min(100, raw));
                          handleFieldChange("progress", clamped);
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Layout grid */}
            <div
              className={`grid gap-8 ${
                isGmMode
                  ? "xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]"
                  : "grid-cols-1"
              }`}
            >
              {/* LEFT – PLAYER-SAFE COLUMN */}
              <div className="space-y-6">
                {/* Overview */}
                <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h2 className="text-lg font-semibold text-white mb-3">
                    Arc Overview
                  </h2>
                  {isGmMode && isEditing ? (
                    <textarea
                      className="w-full bg-white/10 border border-white/10 text-white p-3 rounded-xl min-h-[120px]"
                      value={arcData.playerOverview}
                      onChange={(e) =>
                        handleFieldChange("playerOverview", e.target.value)
                      }
                    />
                  ) : (
                    <p className="text-zinc-300">
                      {arcData.playerOverview || (
                        <span className="text-zinc-500 italic">
                          No overview yet. Future you will be grateful if you
                          write at least three sentences here.
                        </span>
                      )}
                    </p>
                  )}
                </section>

                {/* Themes */}
                <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h2 className="text-lg font-semibold text-white mb-3">
                    Themes &amp; Tone
                  </h2>
                  {isGmMode && isEditing ? (
                    <textarea
                      className="w-full bg-white/10 border border-white/10 text-white p-3 rounded-xl min-h-[80px]"
                      value={arcData.themes}
                      onChange={(e) =>
                        handleFieldChange("themes", e.target.value)
                      }
                    />
                  ) : (
                    <p className="text-zinc-300">
                      {arcData.themes || (
                        <span className="text-zinc-500 italic">
                          Add themes like &quot;corruption, found family, doomed
                          heroism&quot; so future you remembers the mood.
                        </span>
                      )}
                    </p>
                  )}
                </section>

                {/* Timeline (player-visible milestones) */}
                <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h2 className="text-lg font-semibold text-white mb-4">
                    Visible Milestones &amp; Sessions
                  </h2>
                    {timelineToRender.length > 0 ? (
                    <div className="space-y-3">
                      {timelineToRender.map((entry, index) => (
                        <div
                          key={entry.id ?? index}
                          className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between gap-4"
                        >
                          <div className="flex-1">
                            {isGmMode && isEditing ? (
                              <>
                                <input
                                  className="w-full bg-white/10 border border-white/10 text-white px-3 py-2 rounded-lg text-sm mb-1"
                                  value={entry.label}
                                  placeholder="Milestone description"
                                  onChange={(e) =>
                                    handleTimelineChange(
                                      index,
                                      "label",
                                      e.target.value
                                    )
                                  }
                                />
                                <input
                                  className="w-32 bg-white/10 border border-white/10 text-violet-100 px-3 py-1 rounded-lg text-xs"
                                  value={entry.session ?? ""}
                                  placeholder="Session #"
                                  onChange={(e) =>
                                    handleTimelineChange(
                                      index,
                                      "session",
                                      e.target.value
                                    )
                                  }
                                />
                              </>
                            ) : (
                              <>
                                <p className="text-white text-sm">
                                  {entry.label || "Unnamed milestone"}
                                </p>
                                <p className="text-violet-300 text-xs">
                                  Session {entry.session ?? "?"}
                                </p>
                              </>
                            )}
                          </div>
                            {isGmMode && isEditing && (
                            <button
                              type="button"
                              onClick={() =>
                                handleTimelineChange(
                                  index,
                                  "isDiscovered",
                                  !entry.isDiscovered
                                )
                              }
                              className={`text-[10px] px-2 py-1 rounded-full border whitespace-nowrap ${
                                entry.isDiscovered
                                  ? "border-emerald-400 text-emerald-200 bg-emerald-500/10"
                                  : "border-zinc-500 text-zinc-300 bg-transparent hover:bg-white/5"
                              }`}
                            >
                              {entry.isDiscovered ? "Shown to players" : "GM-only"}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-zinc-500 text-sm italic">
                      No milestones yet. Add key beats as they happen so you can
                      reconstruct the chaos later.
                    </p>
                  )}
                  {isGmMode && isEditing && (
                    <button
                      type="button"
                      onClick={handleAddTimelineEntry}
                      className="mt-3 text-xs font-semibold text-violet-300 hover:text-violet-100"
                    >
                      + Add milestone
                    </button>
                  )}
                </section>
              </div>

              {/* RIGHT – GM-ONLY COLUMN */}
              {isGmMode && (
                <div className="space-y-6">
                  {/* True nature */}
                  <section className="bg-red-900/20 border border-red-800/40 rounded-2xl p-6">
                    <h2 className="text-lg font-semibold text-red-200 mb-3">
                      GM Secrets – True Nature of the Arc
                    </h2>
                    {isEditing ? (
                      <textarea
                        className="w-full bg-red-900/30 border border-red-800/60 text-red-100 p-3 rounded-xl min-h-[120px]"
                        value={arcData.gmTruth}
                        onChange={(e) =>
                          handleFieldChange("gmTruth", e.target.value)
                        }
                      />
                    ) : (
                      <p className="text-red-100">
                        {arcData.gmTruth || (
                          <span className="text-red-300/70 italic">
                            Write the ugly truth here — what this arc is really
                            about behind the screen.
                          </span>
                        )}
                      </p>
                    )}
                  </section>

                  {/* Future plans */}
                  <section className="bg-red-900/20 border border-red-800/40 rounded-2xl p-6">
                    <h2 className="text-lg font-semibold text-red-200 mb-3">
                      Future Beats, Fail States &amp; Endgame
                    </h2>
                    {isEditing ? (
                      <textarea
                        className="w-full bg-red-900/30 border border-red-800/60 text-red-100 p-3 rounded-xl min-h-[120px]"
                        value={arcData.gmFuture}
                        onChange={(e) =>
                          handleFieldChange("gmFuture", e.target.value)
                        }
                      />
                    ) : (
                      <p className="text-red-100">
                        {arcData.gmFuture || (
                          <span className="text-red-300/70 italic">
                            Map how this arc escalates, what failure looks like,
                            and what &quot;victory&quot; even means.
                          </span>
                        )}
                      </p>
                    )}
                  </section>

                  {/* Clue map */}
                  <section className="bg-red-900/20 border border-red-800/40 rounded-2xl p-6">
                    <h2 className="text-lg font-semibold text-red-200 mb-3">
                      Clues, Foreshadowing &amp; Cross-links
                    </h2>
                    {isEditing ? (
                      <textarea
                        className="w-full bg-red-900/30 border border-red-800/60 text-red-100 p-3 rounded-xl min-h-[120px]"
                        value={arcData.gmClues}
                        onChange={(e) =>
                          handleFieldChange("gmClues", e.target.value)
                        }
                      />
                    ) : (
                      <p className="text-red-100">
                        {arcData.gmClues || (
                          <span className="text-red-300/70 italic">
                            Note where clues already exist (sessions, maps,
                            NPCs) and where new ones should appear.
                          </span>
                        )}
                      </p>
                    )}
                  </section>
                </div>
              )}
            </div>

            {/* METADATA STRIP – GM ONLY */}
            {isGmMode && (
              <section className="mt-8 bg-white/5 border border-white/10 rounded-2xl p-4 text-xs text-zinc-300 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="uppercase tracking-wide text-zinc-500">
                    Metadata
                  </span>
                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 items-center">
                    <span className="text-zinc-500 mr-1">Tags:</span>
                    {(arcData.tags || []).map((tag, idx) => (
                      <span
                        key={`${tag}-${idx}`}
                        className="px-2 py-1 rounded-full bg-white/10 text-[10px] uppercase tracking-wide"
                      >
                        {tag}
                      </span>
                    ))}
                    {isEditing && (
                      <input
                        className="ml-2 bg-white/10 border border-white/20 rounded-full px-2 py-1 text-[10px] text-zinc-200"
                        placeholder="comma,separated,tags"
                        value={tagInput}
                        onChange={(e) => {
                          const value = e.target.value;
                          setTagInput(value);
                          const tags = value
                            .split(",")
                            .map((t) => t.trim())
                            .filter(Boolean);
                          handleFieldChange("tags", tags);
                        }}
                      />
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 text-[11px] text-zinc-400">
                  <span>
                    First appearance:{" "}
                    <strong className="text-zinc-200">
                      {arcData.firstAppearance || "—"}
                    </strong>
                  </span>
                  <span>
                    Last updated:{" "}
                    <strong className="text-zinc-200">
                      {arcData.lastUpdated || "—"}
                    </strong>
                  </span>
                </div>
              </section>
            )}
          </main>
        </div>
      </div>
    </GradientBackground>
  );
}