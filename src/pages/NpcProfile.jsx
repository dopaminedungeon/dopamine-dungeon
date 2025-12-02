// src/pages/NpcProfile.jsx
import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import GradientBackground from "../components/GradientBackground";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { useMode } from "../context/ModeContext.jsx";
import {
  ArrowLeft,
  MapPin,
  Users,
  Eye,
  Lock,
  Star,
  Clock,
  Tag,
} from "lucide-react";

// TEMP MOCK DATA — later we'll replace with real data / Firestore
const MOCK_NPC_DATA = {
  1: {
    id: 1,
    name: "Grimlock the Wise",
    type: "Merchant",
    level: 12,
    location: "Crystal Market",
    health: 450,
    description:
      "A weathered merchant who deals in rare artifacts and forbidden knowledge.",
    visibility: "public",
  },
  2: {
    id: 2,
    name: "Sera Nightwhisper",
    type: "Quest Giver",
    level: 25,
    location: "Shadow Grove",
    health: 800,
    description: "An enigmatic elf who guides heroes on dangerous quests.",
    visibility: "public",
  },
  3: {
    id: 3,
    name: "Thornax the Destroyer",
    type: "Boss",
    level: 50,
    location: "Obsidian Fortress",
    health: 15000,
    description: "A fearsome demon lord who guards the gates of the underworld.",
    visibility: "gm-only",
  },
  4: {
    id: 4,
    name: "Old Man Jenkins",
    type: "NPC",
    level: 5,
    location: "Starting Village",
    health: 100,
    description:
      "A friendly villager who offers guidance to new adventurers.",
    visibility: "public",
  },
  5: {
    id: 5,
    name: "Zephyr Stormcaller",
    type: "Quest Giver",
    level: 35,
    location: "Skyward Peak",
    health: 1200,
    description: "A powerful mage who controls the winds and storms.",
    visibility: "gm-only",
  },
  6: {
    id: 6,
    name: "Blackfang",
    type: "Boss",
    level: 40,
    location: "Venom Caves",
    health: 12000,
    description: "A giant spider queen with deadly poison attacks.",
    visibility: "gm-only",
  },
};

export default function NpcProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isGM } = useMode();

  const [isEditing, setIsEditing] = useState(false);
  const [editableNpc, setEditableNpc] = useState(null);

  const baseNpc = MOCK_NPC_DATA[id];
  const npc = isEditing && editableNpc ? editableNpc : baseNpc;

  const handleFieldChange = (field, value) => {
    setEditableNpc((prev) => ({
      ...(prev || baseNpc || {}),
      [field]: value,
    }));
  };

  const handleToggleEdit = () => {
    if (!isGM) return;

    if (!isEditing) {
      // Enter edit mode: seed editableNpc from baseNpc (or keep existing edits)
      setEditableNpc((prev) => prev || baseNpc || {});
      setIsEditing(true);
    } else {
      // Leaving edit mode: "save" into mock store for now
      if (editableNpc && baseNpc) {
        MOCK_NPC_DATA[id] = editableNpc;
      }
      setIsEditing(false);
    }
  };

  if (!npc) {
    return (
      <GradientBackground>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 ml-64 p-8 text-white">
            <h1 className="text-3xl font-bold">NPC Not Found</h1>
            <button
              onClick={() => navigate(-1)}
              className="mt-4 px-4 py-2 bg-white/10 rounded-xl text-zinc-300 hover:bg-white/20"
            >
              Go Back
            </button>
          </div>
        </div>
      </GradientBackground>
    );
  }

  const starCount = Math.min(5, Math.ceil((npc.level || 0) / 10));

  return (
    <GradientBackground>
      <div className="flex min-h-screen">
        <Sidebar />

        <div className="flex-1 flex flex-col ml-64">
          <TopBar title={npc.name} />

          <main className="flex-1 p-8 overflow-auto">
            {/* Top bar: Back + Edit */}
            <div className="flex items-center justify-between mb-6">
              <button
                className="flex items-center gap-2 text-zinc-400 hover:text-white"
                onClick={() => navigate("/npcs")}
              >
                <ArrowLeft className="w-5 h-5" />
                Back to NPCs
              </button>

              {isGM && (
                <button
                  onClick={handleToggleEdit}
                  className="px-3 py-1 text-xs rounded-full border border-white/20 text-zinc-200 hover:bg-white/10 transition"
                >
                  {isEditing ? "Done" : "Edit"}
                </button>
              )}
            </div>

            {/* HEADER – full-width core identity, like ItemProfile */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6 backdrop-blur-sm">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-2xl font-bold">
                    {(editableNpc?.name || npc.name || "?").charAt(0)}
                  </div>
                  <div>
                    {isGM && isEditing ? (
                      <input
                        className="bg-transparent border-b border-white/20 text-2xl font-bold text-white focus:outline-none focus:border-purple-400"
                        value={editableNpc?.name ?? npc.name ?? ""}
                        onChange={(e) =>
                          handleFieldChange("name", e.target.value)
                        }
                      />
                    ) : (
                      <h1 className="text-2xl font-bold text-white">
                        {npc.name || "Unknown NPC"}
                      </h1>
                    )}

                    <p className="text-zinc-400 text-sm flex items-center gap-2 mt-1">
                      <MapPin className="w-4 h-4 text-zinc-500" />
                      <span>
                        {isGM && isEditing ? (
                          <input
                            className="bg-transparent border-b border-white/20 text-sm text-zinc-200 focus:outline-none focus:border-purple-400"
                            value={editableNpc?.location ?? npc.location ?? ""}
                            onChange={(e) =>
                              handleFieldChange("location", e.target.value)
                            }
                          />
                        ) : (
                          npc.location || "Unknown location"
                        )}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 md:justify-end">
                  {isGM && isEditing ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleFieldChange("visibility", "public")}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border transition ${
                          (editableNpc?.visibility ?? npc.visibility) === "public"
                            ? "bg-emerald-500/20 text-emerald-200 border-emerald-500/40"
                            : "bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10"
                        }`}
                      >
                        <Eye className="w-3 h-3" />
                        Player-visible
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleFieldChange("visibility", "gm-only")
                        }
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border transition ${
                          (editableNpc?.visibility ?? npc.visibility) ===
                          "gm-only"
                            ? "bg-red-500/20 text-red-200 border-red-500/40"
                            : "bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10"
                        }`}
                      >
                        <Lock className="w-3 h-3" />
                        GM only
                      </button>
                    </div>
                  ) : (editableNpc?.visibility ?? npc.visibility) === "gm-only" ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/40">
                      <Lock className="w-3 h-3" />
                      GM ONLY
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      <Eye className="w-3 h-3" />
                      Player-visible
                    </span>
                  )}
                </div>
              </div>

              {isGM && isEditing ? (
                <textarea
                  rows={3}
                  className="mt-4 w-full bg-white/5 border border-white/10 rounded-xl text-sm text-zinc-100 px-3 py-2 focus:outline-none focus:border-purple-400"
                  value={editableNpc?.description ?? npc.description ?? ""}
                  onChange={(e) =>
                    handleFieldChange("description", e.target.value)
                  }
                />
              ) : (
                <p className="mt-4 text-zinc-300 text-sm leading-relaxed">
                  {npc.description}
                </p>
              )}
            </div>

            {/* Main layout grid:
               - GM mode: 2 columns (player-safe + GM zone)
               - Player mode: 1 column full-width (player-safe only) */}
            <div
              className={`grid grid-cols-1 gap-6 ${
                isGM ? "xl:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]" : ""
              }`}
            >
              {/* LEFT COLUMN – PLAYER SAFE */}
              <div className="space-y-6">
                {/* What the party knows */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                  <h2 className="text-lg font-semibold text-white mb-3">
                    What the party knows
                  </h2>
                  {isGM && isEditing ? (
                    <textarea
                      rows={4}
                      className="w-full bg-white/5 border border-white/10 rounded-xl text-sm text-zinc-100 px-3 py-2 focus:outline-none focus:border-purple-400"
                      value={
                        editableNpc?.playerKnownInfo ??
                        npc.playerKnownInfo ??
                        ""
                      }
                      onChange={(e) =>
                        handleFieldChange("playerKnownInfo", e.target.value)
                      }
                    />
                  ) : (
                    <p className="text-zinc-400 text-sm leading-relaxed">
                      {npc.playerKnownInfo ||
                        "Placeholder: player-known facts about this NPC. You’ll later replace this with real notes from your sessions (public motives, history they’ve revealed, deals made, promises, etc.)."}
                    </p>
                  )}
                </div>

                {/* Appearance & quirks */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                  <h2 className="text-lg font-semibold text-white mb-3">
                    Appearance & quirks
                  </h2>
                  {isGM && isEditing ? (
                    <textarea
                      rows={4}
                      className="w-full bg-white/5 border border-white/10 rounded-xl text-sm text-zinc-100 px-3 py-2 focus:outline-none focus:border-purple-400"
                      value={
                        editableNpc?.appearanceQuirks ??
                        npc.appearanceQuirks ??
                        ""
                      }
                      onChange={(e) =>
                        handleFieldChange("appearanceQuirks", e.target.value)
                      }
                    />
                  ) : (
                    <p className="text-zinc-400 text-sm leading-relaxed">
                      {npc.appearanceQuirks ||
                        "Placeholder: visual description, mannerisms, speech patterns, recurring gestures, and any memorable quirks the players notice."}
                    </p>
                  )}
                </div>

                {/* Player-facing lore blurbs */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                  <h2 className="text-lg font-semibold text-white mb-3">
                    Player lore
                  </h2>
                  {isGM && isEditing ? (
                    <textarea
                      rows={4}
                      className="w-full bg-white/5 border border-white/10 rounded-xl text-sm text-zinc-100 px-3 py-2 focus:outline-none focus:border-purple-400"
                      value={editableNpc?.playerLore ?? npc.playerLore ?? ""}
                      onChange={(e) =>
                        handleFieldChange("playerLore", e.target.value)
                      }
                    />
                  ) : (
                    <p className="text-zinc-400 text-sm leading-relaxed">
                      {npc.playerLore ||
                        "Placeholder: legends, rumors and stories about this NPC that are safe for the players to know. Use this to keep the “public myth” consistent."}
                    </p>
                  )}
                </div>

                {/* Relationship to party (player-safe view) */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                  <h2 className="text-lg font-semibold text-white mb-3">
                    Relationship to the party
                  </h2>
                  {isGM && isEditing ? (
                    <textarea
                      rows={3}
                      className="w-full bg-white/5 border border-white/10 rounded-xl text-sm text-zinc-100 px-3 py-2 focus:outline-none focus:border-purple-400"
                      value={
                        editableNpc?.relationshipToParty ??
                        npc.relationshipToParty ??
                        ""
                      }
                      onChange={(e) =>
                        handleFieldChange("relationshipToParty", e.target.value)
                      }
                    />
                  ) : (
                    <p className="text-zinc-400 text-sm leading-relaxed">
                      {npc.relationshipToParty ||
                        "Placeholder: how the party currently perceives this NPC (ally, wary, hostile, indebted, suspicious, etc.). Later we’ll sync this with your relationship trackers."}
                    </p>
                  )}
                </div>

                {/* Sessions involving this NPC */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                  <h2 className="text-lg font-semibold text-white mb-3">
                    Sessions involving this NPC
                  </h2>
                  {isGM && isEditing ? (
                    <textarea
                      rows={3}
                      className="w-full bg-white/5 border border-white/10 rounded-xl text-sm text-zinc-100 px-3 py-2 focus:outline-none focus:border-purple-400"
                      value={
                        editableNpc?.sessionsInvolving ??
                        npc.sessionsInvolving ??
                        ""
                      }
                      onChange={(e) =>
                        handleFieldChange("sessionsInvolving", e.target.value)
                      }
                    />
                  ) : (
                    <p className="text-zinc-400 text-sm leading-relaxed">
                      {npc.sessionsInvolving ||
                        "Placeholder list of sessions where this NPC appeared. Later this will auto-link to Session profiles (first appearance, major turning points, betrayals, deals, etc.)."}
                    </p>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN – GM-ONLY ZONE */}
              {isGM && (
                <div className="space-y-6">
                  {/* Combat / role profile (GM-only fields: type, CR, health) */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                    <h2 className="text-lg font-semibold text-white mb-3">
                      GM Combat / Role Profile
                    </h2>
                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                      <div>
                        <p className="text-zinc-500 text-xs">Type</p>
                        {isEditing ? (
                          <input
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-purple-400"
                            value={editableNpc?.type ?? npc.type ?? ""}
                            onChange={(e) =>
                              handleFieldChange("type", e.target.value)
                            }
                          />
                        ) : (
                          <p className="text-white font-medium">
                            {npc.type || "—"}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-zinc-500 text-xs">CR</p>
                        {isEditing ? (
                          <input
                            type="number"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-purple-400"
                            value={
                              editableNpc?.level ??
                              npc.level ??
                              ""
                            }
                            onChange={(e) =>
                              handleFieldChange(
                                "level",
                                Number(e.target.value) || 0
                              )
                            }
                          />
                        ) : (
                          <p className="text-white font-medium">
                            {npc.level}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-zinc-500 text-xs">Health</p>
                        {isEditing ? (
                          <input
                            type="number"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-purple-400"
                            value={
                              editableNpc?.health ??
                              npc.health ??
                              ""
                            }
                            onChange={(e) =>
                              handleFieldChange(
                                "health",
                                Number(e.target.value) || 0
                              )
                            }
                          />
                        ) : (
                          <p className="text-white font-medium">
                            {npc.health.toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 text-xs">
                        Danger impression
                      </span>
                      <div className="flex gap-1">
                        {Array.from({ length: starCount }).map((_, i) => (
                          <Star
                            key={i}
                            className="w-4 h-4 text-amber-400 fill-amber-400"
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Secret motivations & hidden truths */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                    <h2 className="text-lg font-semibold text-white mb-2">
                      Secret motivations &amp; hidden truths
                    </h2>
                    {isEditing ? (
                      <textarea
                        rows={4}
                        className="w-full bg-white/5 border border-white/10 rounded-xl text-sm text-zinc-100 px-3 py-2 focus:outline-none focus:border-purple-400"
                        value={
                          editableNpc?.gmSecretMotivations ??
                          npc.gmSecretMotivations ??
                          ""
                        }
                        onChange={(e) =>
                          handleFieldChange(
                            "gmSecretMotivations",
                            e.target.value
                          )
                        }
                      />
                    ) : (
                      <p className="text-zinc-400 text-sm leading-relaxed">
                        {npc.gmSecretMotivations ||
                          "GM-only placeholder: what this NPC really wants, who they serve, what they are hiding, and how those goals intersect with the party."}
                      </p>
                    )}
                  </div>

                  {/* Relationship tracker (players think vs truth) */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                    <h2 className="text-lg font-semibold text-white mb-3">
                      Relationship tracker
                    </h2>
                    <div className="grid grid-cols-1 gap-3 text-sm">
                      <div>
                        <p className="text-zinc-500 text-xs mb-1">
                          What the players think
                        </p>
                        {isEditing ? (
                          <textarea
                            rows={3}
                            className="w-full bg-white/5 border border-white/10 rounded-xl text-sm text-zinc-100 px-3 py-2 focus:outline-none focus:border-purple-400"
                            value={
                              editableNpc?.gmRelPlayersThink ??
                              npc.gmRelPlayersThink ??
                              ""
                            }
                            onChange={(e) =>
                              handleFieldChange(
                                "gmRelPlayersThink",
                                e.target.value
                              )
                            }
                          />
                        ) : (
                          <p className="text-zinc-300">
                            {npc.gmRelPlayersThink ||
                              "Placeholder: their assumptions about loyalty, power, alignment, and intentions."}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-zinc-500 text-xs mb-1">
                          What&apos;s actually true
                        </p>
                        {isEditing ? (
                          <textarea
                            rows={3}
                            className="w-full bg-white/5 border border-white/10 rounded-xl text-sm text-zinc-100 px-3 py-2 focus:outline-none focus:border-purple-400"
                            value={
                              editableNpc?.gmRelTruth ??
                              npc.gmRelTruth ??
                              ""
                            }
                            onChange={(e) =>
                              handleFieldChange("gmRelTruth", e.target.value)
                            }
                          />
                        ) : (
                          <p className="text-zinc-300">
                            {npc.gmRelTruth ||
                              "Placeholder: real loyalties, secret allegiances, hidden relationships, and future betrayals."}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Foreshadowing / future plans */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                    <h2 className="text-lg font-semibold text-white mb-2">
                      Foreshadowing &amp; future plans
                    </h2>
                    {isEditing ? (
                      <textarea
                        rows={4}
                        className="w-full bg-white/5 border border-white/10 rounded-xl text-sm text-zinc-100 px-3 py-2 focus:outline-none focus:border-purple-400"
                        value={
                          editableNpc?.gmForeshadowing ??
                          npc.gmForeshadowing ??
                          ""
                        }
                        onChange={(e) =>
                          handleFieldChange("gmForeshadowing", e.target.value)
                        }
                      />
                    ) : (
                      <p className="text-zinc-400 text-sm leading-relaxed">
                        {npc.gmForeshadowing ||
                          "GM-only placeholder: how this NPC will appear again, what future arcs they are tied to, and what hints you want to drop in upcoming sessions."}
                      </p>
                    )}
                  </div>

                  {/* NPC secrets & consequences */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                    <h2 className="text-lg font-semibold text-white mb-2">
                      NPC secrets &amp; consequences
                    </h2>
                    {isEditing ? (
                      <textarea
                        rows={4}
                        className="w-full bg-white/5 border border-white/10 rounded-xl text-sm text-zinc-100 px-3 py-2 focus:outline-none focus:border-purple-400"
                        value={
                          editableNpc?.gmSecretsConsequences ??
                          npc.gmSecretsConsequences ??
                          ""
                        }
                        onChange={(e) =>
                          handleFieldChange(
                            "gmSecretsConsequences",
                            e.target.value
                          )
                        }
                      />
                    ) : (
                      <p className="text-zinc-400 text-sm leading-relaxed">
                        {npc.gmSecretsConsequences ||
                          "GM-only placeholder: secrets the players don&apos;t know yet and notes on how these will bite them in the ass later. You can mirror the structure you use in Session profiles (secret, trigger, payoff)."}
                      </p>
                    )}
                  </div>

                  {/* GM notes */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                    <h2 className="text-lg font-semibold text-white mb-2">
                      GM notes
                    </h2>
                    {isEditing ? (
                      <textarea
                        rows={4}
                        className="w-full bg-white/5 border border-white/10 rounded-xl text-sm text-zinc-100 px-3 py-2 focus:outline-none focus:border-purple-400"
                        value={editableNpc?.gmNotes ?? npc.gmNotes ?? ""}
                        onChange={(e) =>
                          handleFieldChange("gmNotes", e.target.value)
                        }
                      />
                    ) : (
                      <p className="text-zinc-400 text-sm leading-relaxed">
                        {npc.gmNotes ||
                          "Freeform notes for you: improvisation tips, voice notes, how to play them under stress, and any table meta (which player is attached, etc.)."}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Metadata strip */}
            <div className="mt-6 bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
              <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400">
                <div className="flex items-center gap-2">
                  <Tag className="w-3 h-3" />
                  {isGM && isEditing ? (
                    <>
                      <span>Tags:</span>
                      <input
                        className="ml-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-zinc-100 focus:outline-none focus:border-purple-400"
                        placeholder="e.g. faction, role, arc"
                        value={editableNpc?.tags ?? npc.tags ?? ""}
                        onChange={(e) =>
                          handleFieldChange("tags", e.target.value)
                        }
                      />
                    </>
                  ) : (
                    <span>
                      Tags: {npc.tags || "placeholder (e.g. faction, role, arc)"}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-3 h-3" />
                  {isGM && isEditing ? (
                    <>
                      <span>First appearance:</span>
                      <input
                        className="ml-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-zinc-100 focus:outline-none focus:border-purple-400"
                        placeholder="e.g. Session 3"
                        value={
                          editableNpc?.firstAppearance ??
                          npc.firstAppearance ??
                          ""
                        }
                        onChange={(e) =>
                          handleFieldChange("firstAppearance", e.target.value)
                        }
                      />
                    </>
                  ) : (
                    <span>
                      First appearance:{" "}
                      {npc.firstAppearance || "placeholder session"}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  {isGM && isEditing ? (
                    <>
                      <span>Last updated:</span>
                      <input
                        className="ml-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-zinc-100 focus:outline-none focus:border-purple-400"
                        placeholder="e.g. 2025-12-01"
                        value={
                          editableNpc?.lastUpdated ?? npc.lastUpdated ?? ""
                        }
                        onChange={(e) =>
                          handleFieldChange("lastUpdated", e.target.value)
                        }
                      />
                    </>
                  ) : (
                    <span>
                      Last updated: {npc.lastUpdated || "placeholder"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </GradientBackground>
  );
}