// src/pages/NpcProfile.jsx
import React from "react";
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
    description:
      "A giant spider queen with deadly poison attacks.",
    visibility: "gm-only",
  },
};

export default function NpcProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isGM } = useMode();

  const npc = MOCK_NPC_DATA[id];

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

  const starCount = Math.min(5, Math.ceil(npc.level / 10));

  return (
    <GradientBackground>
      <div className="flex min-h-screen">
        <Sidebar />

        <div className="flex-1 flex flex-col ml-64">
          <TopBar title={npc.name} />

          <main className="flex-1 p-8 overflow-auto">
            {/* Back button */}
            <button
              className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6"
              onClick={() => navigate("/npcs")}
            >
              <ArrowLeft className="w-5 h-5" />
              Back to NPCs
            </button>

            {/* HEADER – full-width core identity, like ItemProfile */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6 backdrop-blur-sm">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-2xl font-bold">
                    {npc.name.charAt(0)}
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-white">{npc.name}</h1>
                    <p className="text-zinc-400 text-sm flex items-center gap-2 mt-1">
                      <MapPin className="w-4 h-4 text-zinc-500" />
                      <span>{npc.location || "Unknown location"}</span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  {npc.visibility === "gm-only" ? (
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

              <p className="mt-4 text-zinc-300 text-sm leading-relaxed">
                {npc.description}
              </p>
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
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    Placeholder: player-known facts about this NPC. You’ll later
                    replace this with real notes from your sessions (public
                    motives, history they’ve revealed, deals made, promises,
                    etc.).
                  </p>
                </div>

                {/* Appearance & quirks */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                  <h2 className="text-lg font-semibold text-white mb-3">
                    Appearance & quirks
                  </h2>
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    Placeholder: visual description, mannerisms, speech
                    patterns, recurring gestures, and any memorable quirks the
                    players notice.
                  </p>
                </div>

                {/* Player-facing lore blurbs */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                  <h2 className="text-lg font-semibold text-white mb-3">
                    Player lore
                  </h2>
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    Placeholder: legends, rumors and stories about this NPC that
                    are safe for the players to know. Use this to keep the
                    “public myth” consistent.
                  </p>
                </div>

                {/* Relationship to party (player-safe view) */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                  <h2 className="text-lg font-semibold text-white mb-3">
                    Relationship to the party
                  </h2>
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    Placeholder: how the party currently perceives this NPC
                    (ally, wary, hostile, indebted, suspicious, etc.). Later
                    we’ll sync this with your relationship trackers.
                  </p>
                </div>

                {/* Sessions involving this NPC */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                  <h2 className="text-lg font-semibold text-white mb-3">
                    Sessions involving this NPC
                  </h2>
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    Placeholder list of sessions where this NPC appeared. Later
                    this will auto-link to Session profiles (first appearance,
                    major turning points, betrayals, deals, etc.).
                  </p>
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
                        <p className="text-white font-medium">{npc.type}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500 text-xs">CR</p>
                        <p className="text-white font-medium">{npc.level}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500 text-xs">Health</p>
                        <p className="text-white font-medium">
                          {npc.health.toLocaleString()}
                        </p>
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
                      Secret motivations & hidden truths
                    </h2>
                    <p className="text-zinc-400 text-sm leading-relaxed">
                      GM-only placeholder: what this NPC really wants, who they
                      serve, what they are hiding, and how those goals intersect
                      with the party.
                    </p>
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
                        <p className="text-zinc-300">
                          Placeholder: their assumptions about loyalty, power,
                          alignment, and intentions.
                        </p>
                      </div>
                      <div>
                        <p className="text-zinc-500 text-xs mb-1">
                          What&apos;s actually true
                        </p>
                        <p className="text-zinc-300">
                          Placeholder: real loyalties, secret allegiances,
                          hidden relationships, and future betrayals.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Foreshadowing / future plans */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                    <h2 className="text-lg font-semibold text-white mb-2">
                      Foreshadowing & future plans
                    </h2>
                    <p className="text-zinc-400 text-sm leading-relaxed">
                      GM-only placeholder: how this NPC will appear again, what
                      future arcs they are tied to, and what hints you want to
                      drop in upcoming sessions.
                    </p>
                  </div>

                  {/* NPC secrets & consequences */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                    <h2 className="text-lg font-semibold text-white mb-2">
                      NPC secrets & consequences
                    </h2>
                    <p className="text-zinc-400 text-sm leading-relaxed">
                      GM-only placeholder: secrets the players don&apos;t know
                      yet and notes on how these will bite them in the ass
                      later. You can mirror the structure you use in Session
                      profiles (secret, trigger, payoff).
                    </p>
                  </div>

                  {/* GM notes */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                    <h2 className="text-lg font-semibold text-white mb-2">
                      GM notes
                    </h2>
                    <p className="text-zinc-400 text-sm leading-relaxed">
                      Freeform notes for you: improvisation tips, voice notes,
                      how to play them under stress, and any table meta (which
                      player is attached, etc.).
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Metadata strip */}
            <div className="mt-6 bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
              <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400">
                <div className="flex items-center gap-2">
                  <Tag className="w-3 h-3" />
                  <span>Tags: placeholder (e.g. faction, role, arc)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-3 h-3" />
                  <span>First appearance: placeholder session</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  <span>Last updated: placeholder</span>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </GradientBackground>
  );
}