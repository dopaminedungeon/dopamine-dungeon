import React from "react";
import { useNavigate } from "react-router-dom";
import GradientBackground from "../components/GradientBackground";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import Card from "../components/Card";
import { Users, Package, Clock, Swords, Shield, Sparkles } from "lucide-react";

const mockNpcs = [
  { id: 1, name: "Grimlock the Wise", type: "Merchant", level: 12 },
  { id: 2, name: "Sera Nightwhisper", type: "Quest Giver", level: 25 },
  { id: 3, name: "Thornax", type: "Boss", level: 50 },
];

const mockItems = [
  { id: 1, name: "Sword of Flames", rarity: "Legendary", power: 150 },
  { id: 2, name: "Shield of Ages", rarity: "Epic", power: 120 },
  { id: 3, name: "Healing Potion", rarity: "Common", power: 25 },
];

const mockSessions = [
  { id: 1, name: "Dragon's Lair Raid", players: 6, duration: "2h 30m" },
  { id: 2, name: "Forest Exploration", players: 4, duration: "1h 15m" },
  { id: 3, name: "PvP Tournament", players: 16, duration: "45m" },
];

export default function DopamineDungeonDashboard() {
  const navigate = useNavigate();

  return (
    <GradientBackground>
      <div className="flex min-h-screen">
        <Sidebar />

        <div className="flex-1 flex flex-col ml-64">
          <TopBar title="Dashboard" />

          <main className="flex-1 p-8 overflow-auto space-y-8">
            {/* Stats Overview */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-purple-600/20 to-purple-900/20 backdrop-blur-sm border border-purple-500/20 rounded-2xl p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-500/20 rounded-xl">
                    <Users className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-zinc-400 text-sm">Total NPCs</p>
                    <p className="text-2xl font-bold text-white">247</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-600/20 to-blue-900/20 backdrop-blur-sm border border-blue-500/20 rounded-2xl p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-500/20 rounded-xl">
                    <Package className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-zinc-400 text-sm">Total Items</p>
                    <p className="text-2xl font-bold text-white">1,892</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-900/20 backdrop-blur-sm border border-emerald-500/20 rounded-2xl p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/20 rounded-xl">
                    <Clock className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-zinc-400 text-sm">Active Sessions</p>
                    <p className="text-2xl font-bold text-white">12</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Cards Grid */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* NPCs Card */}
              <Card
                title="NPCs"
                icon={<Users className="w-5 h-5" />}
                accentColor="purple"
                onViewAll={() => navigate("/npcs")}
              >
                <div className="space-y-3">
                  {mockNpcs.map((npc) => (
                    <div
                      key={npc.id}
                      className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer group"
                      onClick={() => navigate(`/npc/${npc.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                          <span className="text-white font-bold text-sm">
                            {npc.name[0]}
                          </span>
                        </div>
                        <div>
                          <p className="text-white font-medium group-hover:text-purple-300 transition-colors">
                            {npc.name}
                          </p>
                          <p className="text-zinc-500 text-sm">{npc.type}</p>
                        </div>
                      </div>
                      <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-lg">
                        Lvl {npc.level}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Items Card */}
              <Card
                title="Items"
                icon={<Swords className="w-5 h-5" />}
                accentColor="blue"
                onViewAll={() => navigate("/items")}
              >
                <div className="space-y-3">
                  {mockItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer group"
                      onClick={() => navigate(`/item/${item.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            item.rarity === "Legendary"
                              ? "bg-gradient-to-br from-amber-500 to-orange-500"
                              : item.rarity === "Epic"
                              ? "bg-gradient-to-br from-purple-500 to-violet-500"
                              : "bg-gradient-to-br from-zinc-500 to-zinc-600"
                          }`}
                        >
                          {item.name.includes("Sword") ? (
                            <Swords className="w-5 h-5 text-white" />
                          ) : item.name.includes("Shield") ? (
                            <Shield className="w-5 h-5 text-white" />
                          ) : (
                            <Sparkles className="w-5 h-5 text-white" />
                          )}
                        </div>
                        <div>
                          <p className="text-white font-medium group-hover:text-blue-300 transition-colors">
                            {item.name}
                          </p>
                          <p
                            className={`text-sm ${
                              item.rarity === "Legendary"
                                ? "text-amber-400"
                                : item.rarity === "Epic"
                                ? "text-purple-400"
                                : "text-zinc-500"
                            }`}
                          >
                            {item.rarity}
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-lg">
                        +{item.power}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Sessions Card */}
              <Card
                title="Sessions"
                icon={<Clock className="w-5 h-5" />}
                accentColor="emerald"
                onViewAll={() => navigate("/sessions")}
              >
                <div className="space-y-3">
                  {mockSessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer group"
                      onClick={() => navigate(`/session/${session.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                          <Clock className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="text-white font-medium group-hover:text-emerald-300 transition-colors">
                            {session.name}
                          </p>
                          <p className="text-zinc-500 text-sm">
                            {session.players} players
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 text-xs rounded-lg">
                        {session.duration}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </section>
          </main>
        </div>
      </div>
    </GradientBackground>
  );
}