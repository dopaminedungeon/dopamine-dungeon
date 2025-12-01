import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import GradientBackground from "../components/GradientBackground";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { ArrowLeft, Star } from "lucide-react";

// TEMP MOCK DATA — later we'll replace this with a proper data source
const MOCK_NPC_DATA = {
  1: {
    id: 1,
    name: "Grimlock the Wise",
    type: "Merchant",
    level: 12,
    location: "Crystal Market",
    health: 450,
    description: "A weathered merchant who deals in rare artifacts and forbidden knowledge.",
  },
  2: {
    id: 2,
    name: "Sera Nightwhisper",
    type: "Quest Giver",
    level: 25,
    location: "Shadow Grove",
    health: 800,
    description: "An enigmatic elf who guides heroes on dangerous quests.",
  },
  3: {
    id: 3,
    name: "Thornax the Destroyer",
    type: "Boss",
    level: 50,
    location: "Obsidian Fortress",
    health: 15000,
    description: "A fearsome demon lord who guards the gates of the underworld.",
  },
};

export default function NpcProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

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

            {/* Main NPC Card */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">

              {/* Header block */}
              <div className="flex items-center gap-6 mb-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-3xl font-bold">
                  {npc.name[0]}
                </div>

                <div>
                  <h1 className="text-3xl font-bold text-white">{npc.name}</h1>
                  <p className="text-purple-300 text-sm font-medium">{npc.type}</p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                  <p className="text-zinc-500 text-sm">Level</p>
                  <p className="text-white text-2xl font-bold">{npc.level}</p>
                </div>
                <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                  <p className="text-zinc-500 text-sm">Health</p>
                  <p className="text-white text-2xl font-bold">{npc.health}</p>
                </div>
                <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                  <p className="text-zinc-500 text-sm">Location</p>
                  <p className="text-white text-xl">{npc.location}</p>
                </div>
              </div>

              {/* Description */}
              <div>
                <h2 className="text-xl font-bold text-white mb-2">Description</h2>
                <p className="text-zinc-400">{npc.description}</p>
              </div>

              {/* Difficulty */}
              <div className="mt-6">
                <h3 className="text-lg text-white font-bold mb-2">Difficulty</h3>
                <div className="flex gap-1">
                  {[...Array(Math.min(5, Math.ceil(npc.level / 10)))]?.map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-amber-400 fill-amber-400" />
                  ))}
                </div>
              </div>

            </div>
          </main>
        </div>
      </div>
    </GradientBackground>
  );
}