import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import GradientBackground from "../components/GradientBackground";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import {
  Search,
  Plus,
  Clock,
  Users,
  Play,
  Pause,
  Square,
  Calendar,
  Timer,
  TrendingUp,
} from "lucide-react";

const mockSessions = [
  { 
    id: 1, 
    name: "Dragon's Lair Raid", 
    players: 6,
    maxPlayers: 8,
    duration: '2h 30m',
    status: 'active',
    startTime: '2024-01-15 19:00',
    map: 'Volcanic Caverns',
    difficulty: 'Mythic',
    progress: 75
  },
  { 
    id: 2, 
    name: 'Forest Exploration', 
    players: 4,
    maxPlayers: 6,
    duration: '1h 15m',
    status: 'active',
    startTime: '2024-01-15 20:00',
    map: 'Enchanted Woods',
    difficulty: 'Normal',
    progress: 40
  },
  { 
    id: 3, 
    name: 'PvP Tournament', 
    players: 16,
    maxPlayers: 16,
    duration: '45m',
    status: 'paused',
    startTime: '2024-01-15 18:00',
    map: 'Arena of Champions',
    difficulty: 'Competitive',
    progress: 60
  },
  { 
    id: 4, 
    name: 'Dungeon Crawl', 
    players: 5,
    maxPlayers: 5,
    duration: '3h 45m',
    status: 'completed',
    startTime: '2024-01-14 20:00',
    map: 'Catacombs of Despair',
    difficulty: 'Heroic',
    progress: 100
  },
  { 
    id: 5, 
    name: 'Boss Rush Challenge', 
    players: 0,
    maxPlayers: 4,
    duration: '0m',
    status: 'scheduled',
    startTime: '2024-01-16 21:00',
    map: 'Gauntlet Arena',
    difficulty: 'Extreme',
    progress: 0
  },
  { 
    id: 6, 
    name: 'Story Campaign Ch.5', 
    players: 3,
    maxPlayers: 4,
    duration: '1h 50m',
    status: 'active',
    startTime: '2024-01-15 19:30',
    map: 'Crystal Kingdom',
    difficulty: 'Normal',
    progress: 55
  },
];

const statusConfig = {
  active: { color: 'bg-emerald-500', text: 'text-emerald-400', label: 'Live', icon: Play },
  paused: { color: 'bg-amber-500', text: 'text-amber-400', label: 'Paused', icon: Pause },
  completed: { color: 'bg-zinc-500', text: 'text-zinc-400', label: 'Completed', icon: Square },
  scheduled: { color: 'bg-blue-500', text: 'text-blue-400', label: 'Scheduled', icon: Calendar },
};

const difficultyColors = {
  Normal: 'text-emerald-400 bg-emerald-500/10',
  Heroic: 'text-blue-400 bg-blue-500/10',
  Mythic: 'text-purple-400 bg-purple-500/10',
  Extreme: 'text-red-400 bg-red-500/10',
  Competitive: 'text-amber-400 bg-amber-500/10',
};

export default function Sessions() {
  const [showCreateModal, setShowCreateModal] = useState(false);

const [formData, setFormData] = useState({
  name: "",
  map: "",
  difficulty: "Normal",
  players: 0,
  maxPlayers: 4,
  status: "scheduled",
  startTime: "",
  notes: "",
});
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState('All');

  const filteredSessions = mockSessions.filter(session => {
    const matchesSearch = session.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatus === 'All' || session.status === selectedStatus.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const activeSessions = mockSessions.filter(s => s.status === 'active').length;
  const totalPlayers = mockSessions.reduce((acc, s) => acc + s.players, 0);

  return (
    <GradientBackground>
      <div className="flex min-h-screen">
        <Sidebar />
        
        <div className="flex-1 flex flex-col ml-64">
          <TopBar title="Sessions" />
          
          <main className="flex-1 p-8 overflow-auto">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4">
                <div className="p-3 bg-emerald-500/20 rounded-xl">
                  <Play className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-zinc-500 text-sm">Active Sessions</p>
                  <p className="text-2xl font-bold text-white">{activeSessions}</p>
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4">
                <div className="p-3 bg-blue-500/20 rounded-xl">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-zinc-500 text-sm">Players Online</p>
                  <p className="text-2xl font-bold text-white">{totalPlayers}</p>
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4">
                <div className="p-3 bg-purple-500/20 rounded-xl">
                  <Timer className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-zinc-500 text-sm">Avg Duration</p>
                  <p className="text-2xl font-bold text-white">1h 45m</p>
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4">
                <div className="p-3 bg-amber-500/20 rounded-xl">
                  <TrendingUp className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-zinc-500 text-sm">Today's Sessions</p>
                  <p className="text-2xl font-bold text-white">24</p>
                </div>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex flex-col md:flex-row gap-4 mb-8">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search sessions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>

              {/* Status Filter */}
              <div className="flex gap-2">
                {['All', 'Active', 'Paused', 'Scheduled', 'Completed'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setSelectedStatus(status)}
                    className={`px-4 py-3 rounded-xl font-medium transition-all ${
                      selectedStatus === status
                        ? 'bg-emerald-500 text-white'
                        : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>

              {/* Create Button */}
              <button
  className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition"
  onClick={() => setShowCreateModal(true)}
>
  New Session
</button>
            </div>

            {/* Sessions List */}
            <div className="space-y-4">
              {filteredSessions.map((session) => {
                const status = statusConfig[session.status];
                const StatusIcon = status.icon;
                
                return (
                  <div
  key={session.id}
  className="group bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-emerald-500/30 hover:bg-white/10 transition-all cursor-pointer"
  onClick={() => navigate(`/sessions/${session.id}`)}
>
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      {/* Session Info */}
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center`}>
                          <StatusIcon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
                              {session.name}
                            </h3>
                            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.text} bg-white/5`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${status.color} ${session.status === 'active' ? 'animate-pulse' : ''}`} />
                              {status.label}
                            </span>
                          </div>
                          <p className="text-zinc-500 text-sm">{session.map}</p>
                        </div>
                      </div>

                      {/* Session Details */}
                      <div className="flex flex-wrap items-center gap-6">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-zinc-500" />
                          <span className="text-white">{session.players}/{session.maxPlayers}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-zinc-500" />
                          <span className="text-white">{session.duration}</span>
                        </div>
                        <span className={`px-3 py-1 rounded-lg text-xs font-medium ${difficultyColors[session.difficulty]}`}>
                          {session.difficulty}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="lg:w-32">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-zinc-500 text-xs">Progress</span>
                          <span className="text-white text-xs font-medium">{session.progress}%</span>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              session.progress === 100 ? 'bg-zinc-500' : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                            }`}
                            style={{ width: `${session.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {showCreateModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
    <div className="w-full max-w-xl bg-zinc-950 border border-white/10 rounded-2xl p-6">
      <h2 className="text-xl font-bold text-white mb-4">Create New Session</h2>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          console.log("New session:", formData);
          setShowCreateModal(false);
          setFormData({
            name: "",
            map: "",
            difficulty: "Normal",
            players: 0,
            maxPlayers: 4,
            status: "scheduled",
            startTime: "",
            notes: "",
          });
        }}
      >
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Session Name</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Map</label>
          <input
            type="text"
            required
            value={formData.map}
            onChange={(e) => setFormData({ ...formData, map: e.target.value })}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Difficulty</label>
            <select
              value={formData.difficulty}
              onChange={(e) =>
                setFormData({ ...formData, difficulty: e.target.value })
              }
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
            >
              <option>Normal</option>
              <option>Heroic</option>
              <option>Mythic</option>
              <option>Extreme</option>
              <option>Competitive</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value })
              }
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
            >
              <option value="scheduled">Scheduled</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Players</label>
            <input
              type="number"
              value={formData.players}
              onChange={(e) =>
                setFormData({ ...formData, players: Number(e.target.value) })
              }
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Max Players</label>
            <input
              type="number"
              value={formData.maxPlayers}
              onChange={(e) =>
                setFormData({ ...formData, maxPlayers: Number(e.target.value) })
              }
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Start Time</label>
          <input
            type="datetime-local"
            value={formData.startTime}
            onChange={(e) =>
              setFormData({ ...formData, startTime: e.target.value })
            }
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Notes</label>
          <textarea
            rows={3}
            value={formData.notes}
            onChange={(e) =>
              setFormData({ ...formData, notes: e.target.value })
            }
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white resize-none"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => setShowCreateModal(false)}
            className="px-4 py-2 rounded-xl bg-white/5 text-zinc-300 hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-medium hover:opacity-90"
          >
            Save Session
          </button>
        </div>
      </form>
    </div>
  </div>
)}
          </main>
        </div>
      </div>
    </GradientBackground>
  );
}