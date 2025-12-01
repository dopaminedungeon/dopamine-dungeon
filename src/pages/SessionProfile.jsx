import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import GradientBackground from "../components/GradientBackground";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { ArrowLeft, Users, Clock, Map, TrendingUp } from "lucide-react";

const MOCK_SESSION_DATA = {
  1: {
    id: 1,
    name: "Dragon's Lair Raid",
    players: 6,
    maxPlayers: 8,
    duration: "2h 30m",
    status: "active",
    startTime: "2024-01-15 19:00",
    map: "Volcanic Caverns",
    difficulty: "Mythic",
    progress: 75,
  },
  2: {
    id: 2,
    name: "Forest Exploration",
    players: 4,
    maxPlayers: 6,
    duration: "1h 15m",
    status: "active",
    startTime: "2024-01-15 20:00",
    map: "Enchanted Woods",
    difficulty: "Normal",
    progress: 40,
  },
  3: {
    id: 3,
    name: "PvP Tournament",
    players: 16,
    maxPlayers: 16,
    duration: "45m",
    status: "paused",
    startTime: "2024-01-15 18:00",
    map: "Arena of Champions",
    difficulty: "Competitive",
    progress: 60,
  },
  4: {
    id: 4,
    name: "Dungeon Crawl",
    players: 5,
    maxPlayers: 5,
    duration: "3h 45m",
    status: "completed",
    startTime: "2024-01-14 20:00",
    map: "Catacombs of Despair",
    difficulty: "Heroic",
    progress: 100,
  },
  5: {
    id: 5,
    name: "Boss Rush Challenge",
    players: 0,
    maxPlayers: 4,
    duration: "0m",
    status: "scheduled",
    startTime: "2024-01-16 21:00",
    map: "Gauntlet Arena",
    difficulty: "Extreme",
    progress: 0,
  },
  6: {
    id: 6,
    name: "Story Campaign Ch.5",
    players: 3,
    maxPlayers: 4,
    duration: "1h 50m",
    status: "active",
    startTime: "2024-01-15 19:30",
    map: "Crystal Kingdom",
    difficulty: "Normal",
    progress: 55,
  },
};

const difficultyColors = {
  Normal: "text-emerald-400 bg-emerald-500/10",
  Heroic: "text-blue-400 bg-blue-500/10",
  Mythic: "text-purple-400 bg-purple-500/10",
  Extreme: "text-red-400 bg-red-500/10",
  Competitive: "text-amber-400 bg-amber-500/10",
};

export default function SessionProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  const session = MOCK_SESSION_DATA[id];

  if (!session) {
    return (
      <GradientBackground>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 ml-64 p-8 text-white">
            <h1 className="text-3xl font-bold">Session Not Found</h1>
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

  const difficulty = difficultyColors[session.difficulty] || difficultyColors.Normal;

  return (
    <GradientBackground>
      <div className="flex min-h-screen">
        <Sidebar />

        <div className="flex-1 flex flex-col ml-64">
          <TopBar title={session.name} />

          <main className="flex-1 p-8 overflow-auto">
            <button
              className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6"
              onClick={() => navigate("/sessions")}
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Sessions
            </button>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold text-white">{session.name}</h1>
                  <p className="text-zinc-400 text-sm">
                    {session.map} • {session.difficulty}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-lg text-xs font-medium ${difficulty}`}
                >
                  {session.difficulty}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                  <p className="text-zinc-500 text-sm">Players</p>
                  <p className="text-white text-2xl font-bold">
                    {session.players}/{session.maxPlayers}
                  </p>
                </div>
                <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                  <p className="text-zinc-500 text-sm">Duration</p>
                  <p className="text-white text-2xl font-bold">{session.duration}</p>
                </div>
                <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                  <p className="text-zinc-500 text-sm">Start Time</p>
                  <p className="text-white text-md">{session.startTime}</p>
                </div>
                <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                  <p className="text-zinc-500 text-sm">Progress</p>
                  <div className="flex items-center gap-2 mt-1">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <p className="text-white text-xl font-bold">
                      {session.progress}%
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-bold text-white mb-2">
                  Progress
                </h2>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      session.progress === 100
                        ? "bg-zinc-500"
                        : "bg-gradient-to-r from-emerald-500 to-teal-500"
                    }`}
                    style={{ width: `${session.progress}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-zinc-400" />
                  <p className="text-zinc-300 text-sm">
                    {session.players} active players in this session.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Map className="w-5 h-5 text-zinc-400" />
                  <p className="text-zinc-300 text-sm">
                    Map: {session.map}
                  </p>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </GradientBackground>
  );
}