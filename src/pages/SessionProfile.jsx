// src/pages/SessionProfile.jsx
import React, { useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import GradientBackground from "../components/GradientBackground";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { ArrowLeft, Users, Clock, Map } from "lucide-react";
import { useMode } from "../context/ModeContext.jsx";

const MOCK_SESSION_DATA = {
  1: {
    id: 1,
    sessionNumber: 1,
    name: "Dragon's Lair Raid",
    players: 6,
    maxPlayers: 8,
    duration: "2h 30m",
    status: "active",
    startTime: "2024-01-15 19:00",
    map: "Volcanic Caverns",
    difficulty: "Mythic",
    progress: 75,
    visibility: "public",
    summary:
      "The party descends into the volcanic caverns to confront an ancient dragon and recover a legendary artifact.",
    gmNotes:
      "Dragon is badly wounded and playing for time. If party stalls, lair begins collapsing. Reinforcements arrive on round 4.",
    gmSecrets:
      "Artifact is sentient and aligned with an enemy faction. It may try to bargain with the party's warlock.",
    gmPrep: [
      "Stat blocks: adult red dragon (modified HP), 2x fire elementals",
      "Lair actions scripted for rounds 2, 4, 6",
      "Legendary item: Heart of Cinders – draft attunement rules",
    ],
  },
  2: {
    id: 2,
    sessionNumber: 2,
    name: "Forest Exploration",
    players: 4,
    maxPlayers: 6,
    duration: "1h 15m",
    status: "active",
    startTime: "2024-01-15 20:00",
    map: "Enchanted Woods",
    difficulty: "Normal",
    progress: 40,
    visibility: "public",
    summary:
      "Light exploration through the Enchanted Woods, with fae encounters and a missing caravan hook.",
    gmNotes:
      "Keep the tone whimsical but unsettling. One encounter should hint at the Nexus corruption.",
    gmSecrets:
      "The missing caravan is actually in a time loop one day ahead. Clues point toward a moonlit clearing.",
    gmPrep: [
      "Prep 3 fae NPCs with distinct vibes",
      "Roll 2–3 random forest events in advance",
      "Decide which PC gets the first dream/vision",
    ],
  },
  3: {
    id: 3,
    sessionNumber: 3,
    name: "PvP Tournament",
    players: 16,
    maxPlayers: 16,
    duration: "45m",
    status: "paused",
    startTime: "2024-01-15 18:00",
    map: "Arena of Champions",
    difficulty: "Competitive",
    progress: 60,
    visibility: "public",
    summary:
      "Characters and rivals compete in a structured arena tournament with escalating stakes.",
    gmNotes:
      "Let players shine with cool builds. Keep elimination flexible so favourites don’t get knocked out too early.",
    gmSecrets:
      "The tournament sponsor is secretly scouting candidates for a planar war. One rival is already recruited.",
    gmPrep: [
      "Bracket sketch + rough seeding",
      "Stats for 4 signature rival teams",
      "Reward table: boons, titles, minor magic items",
    ],
  },
  4: {
    id: 4,
    sessionNumber: 4,
    name: "Dungeon Crawl",
    players: 5,
    maxPlayers: 5,
    duration: "3h 45m",
    status: "completed",
    startTime: "2024-01-14 20:00",
    map: "Catacombs of Despair",
    difficulty: "Heroic",
    progress: 100,
    visibility: "public",
    summary:
      "Classic dungeon crawl through haunted catacombs, ending in a confrontation with an exiled priest.",
    gmNotes:
      "Used as pacing reference for future crawls. Boss felt slightly undertuned; consider buffing similar enemies.",
    gmSecrets:
      "The exiled priest served the same patron as an upcoming villain. Seeds for that connection are hidden here.",
    gmPrep: [
      "Note which rooms the party skipped – can be reused later",
      "Record which traps they fell for vs. spotted",
    ],
  },
  5: {
    id: 5,
    sessionNumber: 5,
    name: "Boss Rush Challenge",
    players: 0,
    maxPlayers: 4,
    duration: "0m",
    status: "scheduled",
    startTime: "2024-01-16 21:00",
    map: "Gauntlet Arena",
    difficulty: "Extreme",
    progress: 0,
    visibility: "gm-only",
    summary:
      "Planned special challenge session featuring consecutive boss fights in a custom arena.",
    gmNotes:
      "Use this as an optional one-shot or side challenge. Tune difficulty around current party power spikes.",
    gmSecrets:
      "Last boss should reveal a meta-plot clue about the Whispering Stones or Varionath’s deeper structure.",
    gmPrep: [
      "Design 3–5 boss encounters with escalating mechanics",
      "Decide opt-in rules for players (who, when, rewards)",
      "Sketch unique arena hazards per boss",
    ],
  },
  6: {
    id: 6,
    sessionNumber: 6,
    name: "Story Campaign Ch.5",
    players: 3,
    maxPlayers: 4,
    duration: "1h 50m",
    status: "active",
    startTime: "2024-01-15 19:30",
    map: "Crystal Kingdom",
    difficulty: "Normal",
    progress: 55,
    visibility: "gm-only",
    summary:
      "Main story chapter focusing on political intrigue in the Crystal Kingdom and the Nexus influence.",
    gmNotes:
      "Heavy on lore. Pace scenes so players don’t drown in exposition. Anchor everything in character choices.",
    gmSecrets:
      "At least one faction leader is already compromised by the Nexus. Reveal hints but not the full truth yet.",
    gmPrep: [
      "Faction relationship map updated after last session",
      "List 3 concrete choices that can shift the political balance",
      "Prep 1 emergency combat scene if they go feral",
    ],
  },
};

export default function SessionProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isGM } = useMode();
  const [searchParams] = useSearchParams();
  const isGmView = isGM && searchParams.get("mode") !== "player";

  const session = MOCK_SESSION_DATA[id];

  const [editMode, setEditMode] = useState(false);
  const [editableSession, setEditableSession] = useState({ ...session });

  const [gmPrepText, setGmPrepText] = useState(
    (session && session.gmPrep) ? session.gmPrep.join("\n") : ""
  );
  const [encounterStageText, setEncounterStageText] = useState(
    "Placeholder for tracking the current encounter phase: which stat blocks are in play, objectives, map used, and what triggered this scene."
  );
  const [conditionTrackersText, setConditionTrackersText] = useState(
    "Here you'll track things like Kriaxin's corruption, Roman's stress, Akumu's contract pressure, etc. For now this is a free-text placeholder until we wire real data."
  );
  const [futureHooksText, setFutureHooksText] = useState(
    "Space for timers, foreshadowing notes, missed clues, and spoiler timelines tied to this session."
  );
  const [multiSessionText, setMultiSessionText] = useState(
    "Placeholder for tracking how long arcs (Kiyomi, Ciara, Nexus corruption, etc.) advance with this session — later this can become progress bars per arc."
  );
  const [milestoneBibleText, setMilestoneBibleText] = useState(
    "Slot for linking this session to your Milestone level / power progression notes. For now this is just a GM-only reminder panel."
  );
  const [dmToolsText, setDmToolsText] = useState(
    "Future home for combat prep helpers, an initiative tracker, and quick dice tools specific to this session."
  );

  // No such session at all
  if (!session) {
    return (
      <GradientBackground>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 ml-64 p-8 text-white">
            <h1 className="text-3xl font-bold">Session Not Found</h1>
            <p className="text-zinc-400 mt-2">
              There is no session with this ID in the mock data.
            </p>
            <button
              onClick={() => navigate("/sessions")}
              className="mt-4 px-4 py-2 bg-white/10 rounded-xl text-zinc-300 hover:bg-white/20"
            >
              Back to Sessions
            </button>
          </div>
        </div>
      </GradientBackground>
    );
  }

  // GM restriction guard: prevent players from viewing GM-only sessions
  if (session.visibility === "gm-only" && !isGmView) {
    return (
      <GradientBackground>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col ml-64">
            <TopBar title="GM-Only Session" />
            <main className="flex-1 p-8 overflow-auto">
              <button
                className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6"
                onClick={() => navigate("/sessions")}
              >
                <ArrowLeft className="w-5 h-5" />
                Back to Sessions
              </button>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
                <h1 className="text-3xl font-bold text-white mb-2">
                  Hidden by the Dungeon Master
                </h1>
                <p className="text-zinc-400 text-sm max-w-xl">
                  This session is GM-only. Nice try, chaos goblin 💜
                </p>
              </div>
            </main>
          </div>
        </div>
      </GradientBackground>
    );
  }

  const isGmOnly = session.visibility === "gm-only";


  const viewSession = editMode ? editableSession : session;
  const isGmOnlyCurrent = viewSession.visibility === "gm-only";

  const handleFieldChange = (field, value) => {
    setEditableSession((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleVisibilityChange = (visibility) => {
    if (!isGM || !editMode) return;
    setEditableSession((prev) => ({
      ...prev,
      visibility,
    }));
  };


  return (
    <GradientBackground>
      <div className="flex min-h-screen">
        <Sidebar />

        <div className="flex-1 flex flex-col ml-64">
          <TopBar title={viewSession.name} />

          <main className="flex-1 p-8 overflow-auto">
            <button
              className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6"
              onClick={() => navigate("/sessions")}
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Sessions
            </button>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm space-y-6">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                    {viewSession.name}
                    {isGmOnlyCurrent && (
                      <span className="px-2 py-1 text-[10px] rounded-full bg-red-500/20 text-red-300 border border-red-500/40">
                        GM ONLY
                      </span>
                    )}
                  </h1>
                  <p className="text-zinc-400 text-sm">
                    {viewSession.map}
                    {viewSession.sessionNumber && (
                      <>
                        {" "}
                        • Session #{viewSession.sessionNumber}
                      </>
                    )}
                    {viewSession.startTime && (
                      <>
                        {" "}
                        • {viewSession.startTime}
                      </>
                    )}
                  </p>
                </div>

                {isGM && (
                  <div className="flex items-center gap-3 self-start">
                    <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-full p-1">
                      <button
                        type="button"
                        disabled={!editMode}
                        onClick={() => handleVisibilityChange("public")}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                          viewSession.visibility === "public"
                            ? "bg-emerald-500 text-white"
                            : "text-zinc-300 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-zinc-400"
                        }`}
                      >
                        Player-visible
                      </button>
                      <button
                        type="button"
                        disabled={!editMode}
                        onClick={() => handleVisibilityChange("gm-only")}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                          viewSession.visibility === "gm-only"
                            ? "bg-red-500 text-white"
                            : "text-zinc-300 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-zinc-400"
                        }`}
                      >
                        GM-only
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (editMode) {
                          Object.assign(session, editableSession);
                        }
                        setEditMode((prev) => !prev);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-zinc-300 hover:bg-white/10 transition"
                    >
                      {editMode ? "Done" : "Edit"}
                    </button>
                  </div>
                )}
              </div>


              {/* Player & GM layout */}
              <div className={`grid grid-cols-1 ${isGM ? "lg:grid-cols-2" : ""} gap-6 pt-2`}>
                {/* LEFT: Player overview */}
                <div className="space-y-4">
                  {/* Recap */}
                  <div className="bg-white/5 rounded-xl border border-white/10 p-5">
                    <h2 className="text-lg font-semibold text-white mb-2">
                      Session recap
                    </h2>
                    {isGM && editMode ? (
                      <textarea
                        className="w-full bg-transparent border border-white/15 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-500/60"
                        rows={4}
                        value={editableSession.summary}
                        onChange={(e) => handleFieldChange("summary", e.target.value)}
                      />
                    ) : (
                      <p className="text-zinc-300 text-sm whitespace-pre-line">
                        {viewSession.summary}
                      </p>
                    )}
                  </div>

                  {/* Attendance */}
                  <div className="bg-white/5 rounded-xl border border-white/10 p-5">
                    <h2 className="text-lg font-semibold text-white mb-2">
                      Attendance
                    </h2>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Users className="w-5 h-5 text-zinc-500" />
                        <div>
                          <p className="text-zinc-400 text-xs uppercase tracking-wide">
                            Players present
                          </p>
                          {isGM && editMode ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={0}
                                className="w-16 bg-transparent border border-white/15 rounded-lg px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-purple-500/60"
                                value={editableSession.players}
                                onChange={(e) =>
                                  handleFieldChange("players", Number(e.target.value) || 0)
                                }
                              />
                              <span className="text-zinc-400 text-sm">/</span>
                              <input
                                type="number"
                                min={0}
                                className="w-16 bg-transparent border border-white/15 rounded-lg px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-purple-500/60"
                                value={editableSession.maxPlayers}
                                onChange={(e) =>
                                  handleFieldChange("maxPlayers", Number(e.target.value) || 0)
                                }
                              />
                            </div>
                          ) : (
                            <p className="text-white font-semibold text-lg">
                              {viewSession.players} / {viewSession.maxPlayers}
                            </p>
                          )}
                        </div>
                      </div>
                      <p className="text-zinc-500 text-xs">
                        (Detailed PC list & roles coming later)
                      </p>
                    </div>
                  </div>

                  {/* Items (player-visible) */}
                  <div className="bg-white/5 rounded-xl border border-white/10 p-5">
                    <h2 className="text-lg font-semibold text-white mb-2">
                      Items discovered
                    </h2>
                    <p className="text-zinc-400 text-sm">
                      No items logged yet. You&apos;ll be able to track items as a
                      table (gained / refused / destroyed) once real data is wired
                      in.
                    </p>
                  </div>

                  {/* Notable NPCs (player-visible) */}
                  <div className="bg-white/5 rounded-xl border border-white/10 p-5">
                    <h2 className="text-lg font-semibold text-white mb-2">
                      Notable NPCs
                    </h2>
                    <p className="text-zinc-400 text-sm">
                      Placeholder for a future NPC table: who appeared, what they
                      did this session, and the current relationship vibe with the
                      party.
                    </p>
                  </div>

                  {/* Session timeline */}
                  <div className="bg-white/5 rounded-xl border border-white/10 p-5">
                    <h2 className="text-lg font-semibold text-white mb-2">
                      Session timeline
                    </h2>
                    <p className="text-zinc-400 text-sm">
                      Placeholder for a chronological list of key beats in this
                      session (&quot;Arrived at Volcanic Caverns&quot; → &quot;Negotiated
                      with the dragon&quot; → &quot;Lair collapse escape&quot;).
                    </p>
                  </div>

                  {/* Moments */}
                  <div className="bg-white/5 rounded-xl border border-white/10 p-5">
                    <h2 className="text-lg font-semibold text-white mb-2">
                      Moments
                    </h2>
                    <p className="text-zinc-400 text-sm">
                      Highlight reel placeholder for the most cinematic or
                      emotionally heavy moments of the session.
                    </p>
                  </div>

                  {/* Quotes of the day */}
                  <div className="bg-white/5 rounded-xl border border-white/10 p-5">
                    <h2 className="text-lg font-semibold text-white mb-2">
                      Quotes of the day
                    </h2>
                    <p className="text-zinc-400 text-sm">
                      Space for Fizzy one-liners, Akumu drama, and other iconic
                      quotes. Eventually this can be a small list per session.
                    </p>
                  </div>

                  {/* NPC relationship tracker */}
                  <div className="bg-white/5 rounded-xl border border-white/10 p-5">
                    <h2 className="text-lg font-semibold text-white mb-2">
                      NPC relationships
                    </h2>
                    <p className="text-zinc-400 text-sm">
                      Placeholder for a relationship tracker summarising how this
                      session changed the party&apos;s ties to key NPCs. Later this
                      will sync with NPC profiles.
                    </p>
                  </div>
                </div>

                {/* RIGHT: GM-only zone */}
                {isGM && (
                  <div className="space-y-4">
                    {/* Off-screen events / GM notes / secrets */}
                    <div className="bg-white/5 rounded-xl border border-purple-500/40 p-5">
                      <h2 className="text-lg font-semibold text-purple-200 mb-2">
                        Off-screen events & GM notes
                      </h2>
                      {isGM && editMode ? (
                        <textarea
                          className="w-full bg-transparent border border-purple-500/40 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-400/80"
                          rows={3}
                          value={editableSession.gmNotes}
                          onChange={(e) => handleFieldChange("gmNotes", e.target.value)}
                        />
                      ) : (
                        <p className="text-zinc-300 text-sm mb-3">
                          {viewSession.gmNotes}
                        </p>
                      )}
                      {isGM && editMode ? (
                        <textarea
                          className="mt-3 w-full bg-transparent border border-purple-500/25 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-400/80"
                          rows={3}
                          value={editableSession.gmSecrets}
                          onChange={(e) => handleFieldChange("gmSecrets", e.target.value)}
                        />
                      ) : (
                        <p className="text-zinc-400 text-sm mb-3">
                          <span className="font-semibold text-purple-200">
                            Secrets &amp; twists:
                          </span>{" "}
                          {viewSession.gmSecrets}
                        </p>
                      )}
                      {isGM && editMode ? (
                        <div className="mt-3">
                          <p className="text-zinc-500 text-xs mb-1 uppercase tracking-wide">
                            Prep notes
                          </p>
                          <textarea
                            className="w-full bg-transparent border border-purple-500/25 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-400/80"
                            rows={4}
                            value={gmPrepText}
                            onChange={(e) => setGmPrepText(e.target.value)}
                          />
                        </div>
                      ) : (
                        viewSession.gmPrep &&
                        viewSession.gmPrep.length > 0 && (
                          <div className="mt-3">
                            <p className="text-zinc-500 text-xs mb-1 uppercase tracking-wide">
                              Prep notes
                            </p>
                            <ul className="list-disc list-inside text-zinc-400 text-sm space-y-1">
                              {viewSession.gmPrep.map((item, idx) => (
                                <li key={idx}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )
                      )}
                    </div>

                    {/* Encounter stage */}
                    <div className="bg-white/5 rounded-xl border border-purple-500/40 p-5">
                      <h2 className="text-lg font-semibold text-purple-200 mb-2">
                        Encounter stage
                      </h2>
                      {isGM && editMode ? (
                        <textarea
                          className="w-full bg-transparent border border-purple-500/25 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-400/80"
                          rows={3}
                          value={encounterStageText}
                          onChange={(e) => setEncounterStageText(e.target.value)}
                        />
                      ) : (
                        <p className="text-zinc-400 text-sm">{encounterStageText}</p>
                      )}
                    </div>

                    {/* Condition trackers (GM-only placeholder) */}
                    <div className="bg-white/5 rounded-xl border border-purple-500/40 p-5">
                      <h2 className="text-lg font-semibold text-purple-200 mb-2">
                        Condition trackers
                      </h2>
                      {isGM && editMode ? (
                        <textarea
                          className="w-full bg-transparent border border-purple-500/25 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-400/80"
                          rows={3}
                          value={conditionTrackersText}
                          onChange={(e) => setConditionTrackersText(e.target.value)}
                        />
                      ) : (
                        <p className="text-zinc-400 text-sm">{conditionTrackersText}</p>
                      )}
                    </div>

                    {/* Future hooks / timers / foreshadowing */}
                    <div className="bg-white/5 rounded-xl border border-purple-500/40 p-5">
                      <h2 className="text-lg font-semibold text-purple-200 mb-2">
                        Future hooks & timelines
                      </h2>
                      {isGM && editMode ? (
                        <textarea
                          className="w-full bg-transparent border border-purple-500/25 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-400/80"
                          rows={3}
                          value={futureHooksText}
                          onChange={(e) => setFutureHooksText(e.target.value)}
                        />
                      ) : (
                        <>
                          <p className="text-zinc-400 text-sm mb-2">
                            {futureHooksText}
                          </p>
                          <p className="text-zinc-500 text-xs">
                            (Currently using gmPrep as a rough placeholder seed.)
                          </p>
                        </>
                      )}
                    </div>

                    {/* Multi-session arcs */}
                    <div className="bg-white/5 rounded-xl border border-purple-500/40 p-5">
                      <h2 className="text-lg font-semibold text-purple-200 mb-2">
                        Multi-session arcs & progress
                      </h2>
                      {isGM && editMode ? (
                        <textarea
                          className="w-full bg-transparent border border-purple-500/25 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-400/80"
                          rows={3}
                          value={multiSessionText}
                          onChange={(e) => setMultiSessionText(e.target.value)}
                        />
                      ) : (
                        <p className="text-zinc-400 text-sm">{multiSessionText}</p>
                      )}
                    </div>

                    {/* Milestone Power Bible integration */}
                    <div className="bg-white/5 rounded-xl border border-purple-500/40 p-5">
                      <h2 className="text-lg font-semibold text-purple-200 mb-2">
                        Milestone Power Bible
                      </h2>
                      {isGM && editMode ? (
                        <textarea
                          className="w-full bg-transparent border border-purple-500/25 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-400/80"
                          rows={3}
                          value={milestoneBibleText}
                          onChange={(e) => setMilestoneBibleText(e.target.value)}
                        />
                      ) : (
                        <p className="text-zinc-400 text-sm">{milestoneBibleText}</p>
                      )}
                    </div>

                    {/* DM tools */}
                    <div className="bg-white/5 rounded-xl border border-purple-500/40 p-5">
                      <h2 className="text-lg font-semibold text-purple-200 mb-2">
                        DM tools
                      </h2>
                      {isGM && editMode ? (
                        <textarea
                          className="w-full bg-transparent border border-purple-500/25 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-400/80"
                          rows={3}
                          value={dmToolsText}
                          onChange={(e) => setDmToolsText(e.target.value)}
                        />
                      ) : (
                        <p className="text-zinc-400 text-sm">{dmToolsText}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Metadata strip */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-zinc-400 pt-2">
                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4 text-zinc-500" />
                  <span>{viewSession.players} active players in this session.</span>
                </div>
                <div className="flex items-center gap-3">
                  <Map className="w-4 h-4 text-zinc-500" />
                  <span>Map: {viewSession.map}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-zinc-500" />
                  <span>
                    Status: {viewSession.status} • Duration: {viewSession.duration} •
                    Visibility: {isGmOnlyCurrent ? "GM-only" : "Player-visible"}
                  </span>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </GradientBackground>
  );
}