import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMode } from "../context/ModeContext.jsx";
import { MOCK_MAP_DATA } from "../data/mockMaps.js";
import {
  ArrowLeft,
  MapPin,
  Users,
  Map as MapIconBase,
  EyeOff,
  AlertTriangle,
  Swords,
  Compass,
  ChevronRight,
  Tag,
} from "lucide-react";


export default function MapProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isGM } = useMode();
  
  const isGmView = Boolean(isGM);

  const map = MOCK_MAP_DATA[id];

  // Hard gate: players should not be able to open GM-only maps via direct URL.
  if (!isGM && map && map.visibility === "gm-only") {
    return (
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-xl mx-auto bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">DM Eyes Only</h1>
          <p className="text-zinc-400 text-sm mb-4">
            This location is marked GM-only. Players don’t get to see it until it’s revealed in play. 💜
          </p>
          <button
            className="mt-2 px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20"
            onClick={() => navigate("/maps")}
          >
            Back to Locations
          </button>
        </div>
      </main>
    );
  }

  if (!map) {
    return (
      <main className="p-8 text-white">
        <h1 className="text-3xl font-bold">Location Not Found</h1>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 bg-white/10 rounded-xl text-zinc-300 hover:bg-white/20"
        >
          Go Back
        </button>
      </main>
    );
  }

  const [editMode, setEditMode] = React.useState(false);
  const [editableMap, setEditableMap] = React.useState(() => ({ ...map }));

  // --- Placeholder data for new sections (will be replaced with real DB content later) ---
  const INITIAL_KEY_FEATURES = [
    {
      name: "Central Landmark",
      description: "The most obvious feature players notice on arrival.",
      status: "explored",
    },
    {
      name: "Secondary Point of Interest",
      description: "A location the party has interacted with at least once.",
      status: "unexplored",
    },
  ];
  const [keyFeaturesData, setKeyFeaturesData] = React.useState(INITIAL_KEY_FEATURES);
  const visibleKeyFeatures = isGmView
    ? keyFeaturesData
    : keyFeaturesData.filter((feat) => feat.status === "explored");

  const INITIAL_NPCS_PRESENT = [
    { name: "Named NPC #1", role: "Local contact / guide" },
    { name: "Named NPC #2", role: "Antagonist / watcher" },
  ];
  const [npcsPresentData, setNpcsPresentData] = React.useState(INITIAL_NPCS_PRESENT);

  const INITIAL_PLAYER_INTERACTIONS = [
    "Session 05 – First arrival, initial exploration.",
    "Session 09 – Major confrontation / turning point.",
  ];
  const [playerInteractionsData, setPlayerInteractionsData] = React.useState(INITIAL_PLAYER_INTERACTIONS);

  const hiddenFeatures = [
    "Secret passage connecting two non-adjacent rooms.",
    "Lore book that reveals the true owner / origin of the location.",
  ];
  const mapStateDetails = [
    "Current faction control: shifting between two groups.",
    "Corruption level rising slowly due to Nexus influence.",
    "Location evolves between sessions (reinforcements, debris, repairs).",
  ];
  const threatsAndEncounters = [
    {
      name: "Signature encounter",
      type: "Combat",
      trigger: "Triggered when players approach the central chamber unstealthed.",
    },
    {
      name: "Social tension",
      type: "Social",
      trigger: "Emerges if players side with the local faction.",
    },
  ];
  const foreshadowingBeats = [
    "Subtle symbol / sigil that matches a later villain.",
    "Environmental clue hinting at a future catastrophe or invasion.",
  ];
  const gmNotes = [
    "Tone: emphasize atmosphere over raw difficulty.",
    "Keep a sense of verticality / depth when describing spaces.",
    "Use this map to tie together at least two NPC arcs.",
  ];

  // GM-only textareas state
  const [hiddenFeaturesText, setHiddenFeaturesText] = React.useState(() => hiddenFeatures.join("\n"));
  const [mapStateText, setMapStateText] = React.useState(() => mapStateDetails.join("\n"));
  const [threatsText, setThreatsText] = React.useState(() =>
    threatsAndEncounters.map((enc) => `${enc.name} — ${enc.type} — ${enc.trigger}`).join("\n")
  );
  const [foreshadowingText, setForeshadowingText] = React.useState(() => foreshadowingBeats.join("\n"));
  const [gmNotesText, setGmNotesText] = React.useState(() => gmNotes.join("\n"));

  return (
    <main className="p-8 overflow-auto">
      {/* Back + Edit/Done Buttons Row */}
      <div className="flex items-center justify-between mb-6">
        <button
          className="flex items-center gap-2 text-zinc-400 hover:text-white"
          onClick={() => navigate("/maps")}
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Locations
        </button>
        {isGmView && (
          <button
            onClick={() => {
              if (!editMode) {
                setEditableMap({ ...map });
                setEditMode(true);
              } else {
                Object.assign(map, editableMap);
                setEditMode(false);
              }
            }}
            className="px-3 py-1 text-xs rounded-lg border border-white/30 text-zinc-200 bg-black/40 hover:bg-white/10 transition"
          >
            {editMode ? "Done" : "Edit"}
          </button>
        )}
      </div>

            {/* HERO / CORE IDENTITY */}
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
              {/* Image */}
              <div className="relative h-72">
                <img
                  src={map.thumbnail}
                  alt={map.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />

                {/* Name + subtitle + location */}
                <div className="absolute bottom-4 left-6 space-y-1">
                  {isGmView && editMode ? (
                    <input
                      className="text-3xl font-bold text-white bg-white/10 px-2 py-1 rounded-xl w-full"
                      value={editableMap.name}
                      onChange={(e) => setEditableMap({ ...editableMap, name: e.target.value })}
                    />
                  ) : (
                    <h1 className="text-3xl font-bold text-white">{map.name}</h1>
                  )}
                  {isGmView && editMode ? (
                    <input
                      className="text-sm text-white bg-white/10 px-2 py-1 rounded-xl w-full"
                      value={editableMap.subtitle}
                      onChange={(e) => setEditableMap({ ...editableMap, subtitle: e.target.value })}
                    />
                  ) : (
                    map.subtitle && (
                      <p className="text-zinc-300 text-sm">{map.subtitle}</p>
                    )
                  )}
                  {isGmView && editMode ? (
                    <div className="flex items-center gap-2 text-xs text-zinc-200 mt-1">
                      <Compass className="w-3 h-3 text-zinc-400" />
                      <input
                        className="bg-white/10 px-2 py-1 rounded-lg w-72 max-w-full"
                        value={editableMap.locationPath || ""}
                        onChange={(e) =>
                          setEditableMap({ ...editableMap, locationPath: e.target.value })
                        }
                      />
                    </div>
                  ) : (
                    map.locationPath && (
                      <p className="text-zinc-500 text-xs">
                        <Compass className="inline-block w-3 h-3 mr-1 text-zinc-400" />
                        {map.locationPath}
                      </p>
                    )
                  )}
                </div>

                {/* Type, size + visibility pill */}
                <div className="absolute top-4 right-6 flex items-start gap-3">
                  <div className="flex flex-col items-end gap-2">
                    {isGmView && editMode ? (
                      <div className="flex gap-2">
                        <input
                          className="px-2 py-1 rounded-lg bg-black/50 border border-white/20 text-xs text-white w-28"
                          value={editableMap.type || ""}
                          onChange={(e) =>
                            setEditableMap({ ...editableMap, type: e.target.value })
                          }
                        />
                        <input
                          className="px-2 py-1 rounded-lg bg-black/50 border border-white/20 text-xs text-white w-20"
                          value={editableMap.size || ""}
                          onChange={(e) =>
                            setEditableMap({ ...editableMap, size: e.target.value })
                          }
                        />
                      </div>
                    ) : (
                      <span className="px-3 py-1 rounded-lg text-xs font-medium bg-white/10 text-white border border-white/20">
                        {map.type} • {map.size}
                      </span>
                    )}

                    {isGmView && (
                      editMode ? (
                        <div className="flex gap-2 mt-1">
                          <button
                            type="button"
                            onClick={() =>
                              setEditableMap((prev) => ({
                                ...prev,
                                visibility: "public",
                              }))
                            }
                            className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                              editableMap.visibility === "public"
                                ? "bg-emerald-500/20 text-emerald-100 border-emerald-400"
                                : "bg-black/40 text-zinc-200 border-white/20 hover:bg-white/10"
                            }`}
                          >
                            Player-visible
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setEditableMap((prev) => ({
                                ...prev,
                                visibility: "gm-only",
                              }))
                            }
                            className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                              editableMap.visibility === "gm-only"
                                ? "bg-red-500/30 text-red-100 border-red-400"
                                : "bg-black/40 text-zinc-200 border-white/20 hover:bg-white/10"
                            }`}
                          >
                            GM only
                          </button>
                        </div>
                      ) : (
                        (map.visibility === "gm-only") && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold bg-red-500/20 text-red-200 border border-red-500/40">
                            <EyeOff className="w-3 h-3" />
                            GM ONLY
                          </span>
                        )
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* Quick stats row */}
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-white/10">
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-zinc-400" />
                  <div>
                    <p className="text-zinc-500 text-xs">Location Type</p>
                    <p className="text-white font-medium">
                      {isGmView && editMode ? (
                        <input
                          className="px-2 py-1 rounded-lg bg-black/40 border border-white/20 text-xs text-white w-40"
                          value={editableMap.category || ""}
                          onChange={(e) =>
                            setEditableMap({ ...editableMap, category: e.target.value })
                          }
                        />
                      ) : (
                        map.category
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-zinc-400" />
                  <div>
                    <p className="text-zinc-500 text-xs">Recommended Players</p>
                    <p className="text-white font-medium">
                      {isGmView && editMode ? (
                        <input
                          className="px-2 py-1 rounded-lg bg-black/40 border border-white/20 text-xs text-white w-24"
                          value={editableMap.players || ""}
                          onChange={(e) =>
                            setEditableMap({ ...editableMap, players: e.target.value })
                          }
                        />
                      ) : (
                        map.players
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <MapIconBase className="w-5 h-5 text-zinc-400" />
                  <div>
                    <p className="text-zinc-500 text-xs">Content</p>
                    <p className="text-white font-medium">
                      {isGmView && editMode ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            className="px-2 py-1 rounded-lg bg-black/40 border border-white/20 text-xs text-white w-20"
                            value={editableMap.npcs ?? ""}
                            onChange={(e) =>
                              setEditableMap({
                                ...editableMap,
                                npcs: e.target.value === "" ? "" : Number(e.target.value),
                              })
                            }
                          />
                          <span className="text-xs text-zinc-400">NPCs</span>
                          <input
                            type="number"
                            className="px-2 py-1 rounded-lg bg-black/40 border border-white/20 text-xs text-white w-20"
                            value={editableMap.items ?? ""}
                            onChange={(e) =>
                              setEditableMap({
                                ...editableMap,
                                items: e.target.value === "" ? "" : Number(e.target.value),
                              })
                            }
                          />
                          <span className="text-xs text-zinc-400">Items</span>
                        </div>
                      ) : (
                        <>
                          {map.npcs} NPCs • {map.items} Items
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* MAIN GRID: Player (left) + GM Zone (right) */}
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* PLAYER-SAFE COLUMN */}
              <div
                className={
                  isGmView
                    ? "lg:col-span-7 space-y-6"
                    : "lg:col-span-12 space-y-6"
                }
              >
                {/* Description */}
                <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h2 className="text-lg font-semibold text-white mb-2">
                    Location description
                  </h2>
                  {isGmView && editMode ? (
                    <textarea
                      className="w-full bg-white/10 text-white rounded-xl p-3 text-sm"
                      rows={4}
                      value={editableMap.description}
                      onChange={(e) => setEditableMap({ ...editableMap, description: e.target.value })}
                    />
                  ) : (
                    <p className="text-zinc-300 text-sm leading-relaxed">
                      {map.description || "Describe what the characters see when they first arrive at this location."}
                    </p>
                  )}
                </section>

                {/* Key Features */}
                <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-white">
                      {isGmView ? "Key features (player-visible)" : "Key features"}
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {visibleKeyFeatures.map((feat, idx) => {
                      if (isGmView && editMode) {
                        const updateFeature = (idx, field, value) => {
                          setKeyFeaturesData((prev) => {
                            const next = [...prev];
                            next[idx] = { ...next[idx], [field]: value };
                            return next;
                          });
                        };
                        return (
                          <div
                            key={idx}
                            className="bg-black/20 border border-white/10 rounded-xl p-4"
                          >
                            <input
                              className="text-sm font-semibold text-white bg-black/30 rounded-lg px-2 py-1 w-full mb-1"
                              value={feat.name}
                              onChange={(e) => updateFeature(idx, "name", e.target.value)}
                            />
                            <textarea
                              className="text-xs text-zinc-300 bg-black/30 rounded-lg px-2 py-1 w-full mb-1"
                              value={feat.description}
                              onChange={(e) => updateFeature(idx, "description", e.target.value)}
                              rows={2}
                            />
                            <div className="flex items-center gap-2">
                              <ChevronRight className="w-3 h-3 text-zinc-400" />
                              <select
                                className="text-[11px] px-2 py-1 rounded-full bg-white/5 text-zinc-300 border border-white/10"
                                value={feat.status}
                                onChange={(e) => updateFeature(idx, "status", e.target.value)}
                              >
                                <option value="explored">explored</option>
                                <option value="unexplored">unexplored</option>
                              </select>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div
                          key={idx}
                          className="bg-black/20 border border-white/10 rounded-xl p-4"
                        >
                          <p className="text-sm font-semibold text-white">{feat.name}</p>
                          <p className="text-xs text-zinc-400 mt-1">{feat.description}</p>
                          <p className="mt-2 inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-white/5 text-zinc-300">
                            <ChevronRight className="w-3 h-3" />
                            Status: {feat.status}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* NPCs present / known */}
                <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-white">
                      NPCs present / known
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {npcsPresentData.map((npc, idx) => {
                      if (isGmView && editMode) {
                        const updateNpc = (idx, field, value) => {
                          setNpcsPresentData((prev) => {
                            const next = [...prev];
                            next[idx] = { ...next[idx], [field]: value };
                            return next;
                          });
                        };
                        return (
                          <div
                            key={idx}
                            className="w-full text-left bg-black/20 border border-white/10 rounded-xl p-4"
                          >
                            <input
                              className="text-sm font-semibold text-white bg-black/30 rounded-lg px-2 py-1 w-full mb-1"
                              value={npc.name}
                              onChange={(e) => updateNpc(idx, "name", e.target.value)}
                            />
                            <input
                              className="text-xs text-zinc-400 bg-black/30 rounded-lg px-2 py-1 w-full"
                              value={npc.role}
                              onChange={(e) => updateNpc(idx, "role", e.target.value)}
                            />
                          </div>
                        );
                      }
                      return (
                        <button
                          key={idx}
                          type="button"
                          className="w-full text-left bg-black/20 border border-white/10 rounded-xl p-4 hover:border-indigo-500/50 hover:bg-white/10 transition-colors"
                        >
                          <p className="text-sm font-semibold text-white">
                            {npc.name}
                          </p>
                          <p className="text-xs text-zinc-400 mt-1">
                            {npc.role}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Player interactions with this location */}
                <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-white">
                      Player interactions with this location
                    </h2>
                  </div>
                  <ul className="space-y-2 text-sm text-zinc-300">
                    {playerInteractionsData.map((entry, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-zinc-300"
                      >
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-400" />
                        {isGmView && editMode ? (
                          <input
                            className="w-full bg-black/40 border border-white/20 rounded-lg px-2 py-1 text-xs text-zinc-100"
                            value={entry}
                            onChange={(e) => {
                              const value = e.target.value;
                              setPlayerInteractionsData((prev) => {
                                const next = [...prev];
                                next[idx] = value;
                                return next;
                              });
                            }}
                          />
                        ) : (
                          <span>{entry}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-zinc-500">
                    Current state:{" "}
                    {isGmView && editMode ? (
                      <input
                        className="ml-1 px-2 py-1 rounded-lg bg-black/40 border border-white/20 text-[11px] text-zinc-100 w-64 max-w-full"
                        value={editableMap.state || ""}
                        onChange={(e) =>
                          setEditableMap({ ...editableMap, state: e.target.value })
                        }
                      />
                    ) : (
                      <span className="text-zinc-300 font-medium">
                        {map.state}
                      </span>
                    )}
                  </p>
                </section>
              </div>

              {/* GM-ONLY COLUMN */}
              {isGmView && (
                <div className="lg:col-span-5 space-y-6">
                  {/* Hidden Features / Secrets */}
                  <section className="bg-white/5 border border-red-500/30 rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                      <h2 className="text-lg font-semibold text-white">
                        Hidden features & secrets
                      </h2>
                    </div>
                    {editMode ? (
                      <textarea
                        className="w-full bg-black/30 border border-red-500/30 rounded-xl p-2 text-sm text-red-200"
                        rows={4}
                        value={hiddenFeaturesText}
                        onChange={(e) => setHiddenFeaturesText(e.target.value)}
                      />
                    ) : (
                      <ul className="space-y-2 text-sm text-zinc-300">
                        {hiddenFeaturesText.split("\n").filter(Boolean).map((entry, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-zinc-300"
                          >
                            <span className="mt-1 h-1 w-4 rounded-full bg-red-500/60" />
                            <span>{entry}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  {/* Location state (GM-only) */}
                  <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <h2 className="text-lg font-semibold text-white mb-3">
                      Location state (GM-only)
                    </h2>
                    {editMode ? (
                      <textarea
                        className="w-full bg-black/30 border border-white/20 rounded-xl p-2 text-sm text-emerald-200"
                        rows={4}
                        value={mapStateText}
                        onChange={(e) => setMapStateText(e.target.value)}
                      />
                    ) : (
                      <ul className="space-y-2 text-sm text-zinc-300">
                        {mapStateText.split("\n").filter(Boolean).map((entry, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-zinc-300"
                          >
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            <span>{entry}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  {/* Threats & Encounters */}
                  <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Swords className="w-5 h-5 text-amber-400" />
                      <h2 className="text-lg font-semibold text-white">
                        Threats & encounters
                      </h2>
                    </div>
                    {editMode ? (
                      <textarea
                        className="w-full bg-black/30 border border-white/20 rounded-xl p-2 text-sm text-amber-200"
                        rows={4}
                        value={threatsText}
                        onChange={(e) => setThreatsText(e.target.value)}
                      />
                    ) : (
                      <div className="space-y-3 text-sm text-zinc-300">
                        {threatsAndEncounters.map((enc, idx) => (
                          <div
                            key={idx}
                            className="border border-white/10 rounded-xl p-3 bg-black/20"
                          >
                            <p className="text-sm font-semibold text-white">
                              {enc.name}
                            </p>
                            <p className="text-xs text-zinc-400">
                              Type: {enc.type}
                            </p>
                            <p className="text-xs text-zinc-400 mt-1">
                              Trigger: {enc.trigger}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Foreshadowing */}
                  <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <h2 className="text-lg font-semibold text-white mb-3">
                      Foreshadowing
                    </h2>
                    {editMode ? (
                      <textarea
                        className="w-full bg-black/30 border border-purple-400/30 rounded-xl p-2 text-sm text-purple-200"
                        rows={3}
                        value={foreshadowingText}
                        onChange={(e) => setForeshadowingText(e.target.value)}
                      />
                    ) : (
                      <ul className="space-y-2 text-sm text-zinc-300">
                        {foreshadowingText.split("\n").filter(Boolean).map((entry, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-zinc-300"
                          >
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-purple-400" />
                            <span>{entry}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  {/* GM Notes */}
                  <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <h2 className="text-lg font-semibold text-white mb-3">
                      GM notes
                    </h2>
                    {editMode ? (
                      <textarea
                        className="w-full bg-black/30 border border-zinc-400/30 rounded-xl p-2 text-sm text-zinc-200"
                        rows={3}
                        value={gmNotesText}
                        onChange={(e) => setGmNotesText(e.target.value)}
                      />
                    ) : (
                      <ul className="space-y-2 text-sm text-zinc-300">
                        {gmNotesText.split("\n").filter(Boolean).map((entry, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-zinc-300"
                          >
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-zinc-400" />
                            <span>{entry}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
              )}
            </div>

            {/* METADATA STRIP */}
            <div className="mt-8 border-t border-white/10 pt-4 text-xs text-zinc-400 flex flex-wrap gap-4">
              <span>
                Campaign:{" "}
                {isGmView && editMode ? (
                  <input
                    className="ml-1 px-2 py-1 rounded-lg bg-black/40 border border-white/20 text-[11px] text-zinc-100"
                    value={editableMap.campaign || ""}
                    onChange={(e) =>
                      setEditableMap({ ...editableMap, campaign: e.target.value })
                    }
                  />
                ) : (
                  <span className="text-zinc-200 font-medium">
                    {map.campaign}
                  </span>
                )}
              </span>
              <span>
                Category:{" "}
                {isGmView && editMode ? (
                  <input
                    className="ml-1 px-2 py-1 rounded-lg bg-black/40 border border-white/20 text-[11px] text-zinc-100"
                    value={editableMap.category || ""}
                    onChange={(e) =>
                      setEditableMap({ ...editableMap, category: e.target.value })
                    }
                  />
                ) : (
                  <span className="text-zinc-200 font-medium">
                    {map.category}
                  </span>
                )}
              </span>
              <span>
                Creator:{" "}
                {isGmView && editMode ? (
                  <input
                    className="ml-1 px-2 py-1 rounded-lg bg-black/40 border border-white/20 text-[11px] text-zinc-100"
                    value={editableMap.creator || ""}
                    onChange={(e) =>
                      setEditableMap({ ...editableMap, creator: e.target.value })
                    }
                  />
                ) : (
                  <span className="text-zinc-200 font-medium">
                    {map.creator}
                  </span>
                )}
              </span>
              <span className="inline-flex items-center gap-1">
                <Tag className="w-3 h-3" />
                Tags:{" "}
                {isGmView && editMode ? (
                  <input
                    className="ml-1 px-2 py-1 rounded-lg bg-black/40 border border-white/20 text-[11px] text-zinc-100"
                    value={
                      Array.isArray(editableMap.tags)
                        ? editableMap.tags.join(", ")
                        : editableMap.tags || ""
                    }
                    onChange={(e) =>
                      setEditableMap({
                        ...editableMap,
                        tags: e.target.value
                          .split(",")
                          .map((t) => t.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                ) : (
                  <span className="text-zinc-200 font-medium">
                    {map.tags?.join(", ")}
                  </span>
                )}
              </span>
              <span>
                Last updated:{" "}
                {isGmView && editMode ? (
                  <input
                    className="ml-1 px-2 py-1 rounded-lg bg-black/40 border border-white/20 text-[11px] text-zinc-100"
                    value={editableMap.lastUpdated || ""}
                    onChange={(e) =>
                      setEditableMap({ ...editableMap, lastUpdated: e.target.value })
                    }
                  />
                ) : (
                  <span className="text-zinc-200 font-medium">
                    {map.lastUpdated}
                  </span>
                )}
              </span>
            </div>
    </main>
  );
}