import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import GradientBackground from "../components/GradientBackground";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { ArrowLeft, Swords, Shield, Sparkles } from "lucide-react";

const MOCK_ITEM_DATA = {
  1: {
    id: 1,
    name: "Sword of Eternal Flames",
    type: "Weapon",
    rarity: "Legendary",
    power: 150,
    description:
      "A blade forged in the heart of a dying star, its flames never extinguish.",
    stats: { attack: 150, speed: 20, critical: 15 },
  },
  2: {
    id: 2,
    name: "Shield of the Ancients",
    type: "Armor",
    rarity: "Epic",
    power: 120,
    description:
      "Blessed by the old gods, this shield can block even magical attacks.",
    stats: { defense: 120, block: 45, resistance: 30 },
  },
  3: {
    id: 3,
    name: "Healing Potion",
    type: "Consumable",
    rarity: "Common",
    power: 25,
    description: "Restores 25% of maximum health when consumed.",
    stats: { heal: 25 },
  },
  4: {
    id: 4,
    name: "Thunder Staff",
    type: "Weapon",
    rarity: "Epic",
    power: 135,
    description:
      "Channels the power of lightning storms into devastating magical attacks.",
    stats: { attack: 135, magic: 80, critical: 25 },
  },
  5: {
    id: 5,
    name: "Boots of Swiftness",
    type: "Armor",
    rarity: "Rare",
    power: 60,
    description:
      "Enchanted boots that increase movement speed significantly.",
    stats: { speed: 60, dodge: 20 },
  },
  6: {
    id: 6,
    name: "Mana Crystal",
    type: "Consumable",
    rarity: "Uncommon",
    power: 40,
    description: "Restores 40% of maximum mana when consumed.",
    stats: { mana: 40 },
  },
  7: {
    id: 7,
    name: "Dragon Scale Armor",
    type: "Armor",
    rarity: "Legendary",
    power: 180,
    description:
      "Forged from the scales of an ancient dragon, nearly impenetrable.",
    stats: { defense: 180, resistance: 60, health: 100 },
  },
  8: {
    id: 8,
    name: "Void Dagger",
    type: "Weapon",
    rarity: "Rare",
    power: 85,
    description: "A dagger that phases through armor, dealing true damage.",
    stats: { attack: 85, penetration: 50, speed: 40 },
  },
};

const rarityColors = {
  Legendary: "from-amber-500 to-orange-600",
  Epic: "from-purple-500 to-violet-600",
  Rare: "from-blue-500 to-cyan-600",
  Uncommon: "from-emerald-500 to-green-600",
  Common: "from-zinc-500 to-zinc-600",
};

const typeIcons = {
  Weapon: Swords,
  Armor: Shield,
  Consumable: Sparkles,
};

export default function ItemProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  const item = MOCK_ITEM_DATA[id];

  if (!item) {
    return (
      <GradientBackground>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 ml-64 p-8 text-white">
            <h1 className="text-3xl font-bold">Item Not Found</h1>
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

  const rarityBg = rarityColors[item.rarity] || rarityColors.Common;
  const Icon = typeIcons[item.type] || Sparkles;

  return (
    <GradientBackground>
      <div className="flex min-h-screen">
        <Sidebar />

        <div className="flex-1 flex flex-col ml-64">
          <TopBar title={item.name} />

          <main className="flex-1 p-8 overflow-auto">
            <button
              className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6"
              onClick={() => navigate("/items")}
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Items
            </button>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
              <div className="flex items-center gap-6 mb-6">
                <div
                  className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${rarityBg} flex items-center justify-center text-white`}
                >
                  <Icon className="w-10 h-10" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white">
                    {item.name}
                  </h1>
                  <p className="text-zinc-400 text-sm">
                    {item.type} •{" "}
                    <span className="font-medium">{item.rarity}</span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                  <p className="text-zinc-500 text-sm">Type</p>
                  <p className="text-white text-xl font-bold">{item.type}</p>
                </div>
                <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                  <p className="text-zinc-500 text-sm">Rarity</p>
                  <p className="text-white text-xl font-bold">{item.rarity}</p>
                </div>
                <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                  <p className="text-zinc-500 text-sm">Power</p>
                  <p className="text-white text-2xl font-bold">
                    +{item.power}
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <h2 className="text-xl font-bold text-white mb-2">
                  Description
                </h2>
                <p className="text-zinc-400">{item.description}</p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-white mb-2">Stats</h2>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(item.stats).map(([key, value]) => (
                    <span
                      key={key}
                      className="px-3 py-1 rounded-lg bg-white/5 text-zinc-300 text-sm"
                    >
                      {key}: {value}
                    </span>
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