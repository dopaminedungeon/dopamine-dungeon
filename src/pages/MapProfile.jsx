import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import GradientBackground from "../components/GradientBackground";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { ArrowLeft, MapPin, Map as MapIconBase, Users } from "lucide-react";

const MOCK_MAP_DATA = {
  1: {
    id: 1,
    name: "Volcanic Caverns",
    type: "Dungeon",
    difficulty: "Mythic",
    size: "Large",
    players: "4-8",
    thumbnail:
      "https://images.unsplash.com/photo-1518173946687-a4c036bc9982?w=800&h=600&fit=crop",
    npcs: 24,
    items: 45,
  },
  2: {
    id: 2,
    name: "Enchanted Woods",
    type: "Open World",
    difficulty: "Normal",
    size: "Massive",
    players: "1-20",
    thumbnail:
      "https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&h=600&fit=crop",
    npcs: 56,
    items: 120,
  },
  3: {
    id: 3,
    name: "Arena of Champions",
    type: "PvP",
    difficulty: "Competitive",
    size: "Small",
    players: "2-16",
    thumbnail:
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&h=600&fit=crop",
    npcs: 4,
    items: 20,
  },
  4: {
    id: 4,
    name: "Catacombs of Despair",
    type: "Dungeon",
    difficulty: "Heroic",
    size: "Medium",
    players: "3-5",
    thumbnail:
      "https://images.unsplash.com/photo-1509023464722-18d996393ca8?w=800&h=600&fit=crop",
    npcs: 35,
    items: 78,
  },
  5: {
    id: 5,
    name: "Crystal Kingdom",
    type: "Story",
    difficulty: "Normal",
    size: "Large",
    players: "1-4",
    thumbnail:
      "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&h=600&fit=crop",
    npcs: 42,
    items: 95,
  },
  6: {
    id: 6,
    name: "Sunken Depths",
    type: "Dungeon",
    difficulty: "Epic",
    size: "Large",
    players: "4-6",
    thumbnail:
      "https://images.unsplash.com/photo-1551244072-5d12893278ab?w=800&h=600&fit=crop",
    npcs: 28,
    items: 62,
  },
};

const difficultyConfig = {
  Normal: { color: "text-emerald-400", bg: "bg-emerald-500/10" },
  Heroic: { color: "text-blue-400", bg: "bg-blue-500/10" },
  Epic: { color: "text-purple-400", bg: "bg-purple-500/10" },
  Mythic: { color: "text-amber-400", bg: "bg-amber-500/10" },
  Competitive: { color: "text-red-400", bg: "bg-red-500/10" },
};

export default function MapProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  const map = MOCK_MAP_DATA[id];

  if (!map) {
    return (
      <GradientBackground>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 ml-64 p-8 text-white">
            <h1 className="text-3xl font-bold">Map Not Found</h1>
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

  const difficulty = difficultyConfig[map.difficulty] || difficultyConfig.Normal;

  return (
    <GradientBackground>
      <div className="flex min-h-screen">
        <Sidebar />

        <div className="flex-1 flex flex-col ml-64">
          <TopBar title={map.name} />

          <main className="flex-1 p-8 overflow-auto">
            <button
              className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6"
              onClick={() => navigate("/maps")}
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Maps
            </button>

            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
              {/* Image */}
              <div className="relative h-72">
                <img
                  src={map.thumbnail}
                  alt={map.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-4 left-6">
                  <h1 className="text-3xl font-bold text-white">{map.name}</h1>
                  <p className="text-zinc-300 text-sm">
                    {map.size} • {map.players} players
                  </p>
                </div>
                <div className="absolute top-4 right-6">
                  <span
                    className={`px-3 py-1 rounded-lg text-xs font-medium ${difficulty.color} ${difficulty.bg}`}
                  >
                    {map.difficulty}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-white/10">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-zinc-400" />
                  <div>
                    <p className="text-zinc-500 text-xs">Type</p>
                    <p className="text-white font-medium">{map.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-zinc-400" />
                  <div>
                    <p className="text-zinc-500 text-xs">
                      Recommended Players
                    </p>
                    <p className="text-white font-medium">{map.players}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MapIconBase className="w-5 h-5 text-zinc-400" />
                  <div>
                    <p className="text-zinc-500 text-xs">Content</p>
                    <p className="text-white font-medium">
                      {map.npcs} NPCs • {map.items} Items
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </GradientBackground>
  );
}