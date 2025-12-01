import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import GradientBackground from "../components/GradientBackground";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import {
  Search,
  Plus,
  Map as MapIconBase,
  MapPin,
  Mountain,
  TreePine,
  Castle,
  Skull,
  Waves,
  Flame,
  Grid,
  LayoutGrid,
} from "lucide-react";

const mockMaps = [
  { 
    id: 1, 
    name: 'Volcanic Caverns', 
    type: 'Dungeon',
    difficulty: 'Mythic',
    size: 'Large',
    players: '4-8',
    thumbnail: 'https://images.unsplash.com/photo-1518173946687-a4c036bc9982?w=400&h=300&fit=crop',
    npcs: 24,
    items: 45,
    icon: Flame
  },
  { 
    id: 2, 
    name: 'Enchanted Woods', 
    type: 'Open World',
    difficulty: 'Normal',
    size: 'Massive',
    players: '1-20',
    thumbnail: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&h=300&fit=crop',
    npcs: 56,
    items: 120,
    icon: TreePine
  },
  { 
    id: 3, 
    name: 'Arena of Champions', 
    type: 'PvP',
    difficulty: 'Competitive',
    size: 'Small',
    players: '2-16',
    thumbnail: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&h=300&fit=crop',
    npcs: 4,
    items: 20,
    icon: Castle
  },
  { 
    id: 4, 
    name: 'Catacombs of Despair', 
    type: 'Dungeon',
    difficulty: 'Heroic',
    size: 'Medium',
    players: '3-5',
    thumbnail: 'https://images.unsplash.com/photo-1509023464722-18d996393ca8?w=400&h=300&fit=crop',
    npcs: 35,
    items: 78,
    icon: Skull
  },
  { 
    id: 5, 
    name: 'Crystal Kingdom', 
    type: 'Story',
    difficulty: 'Normal',
    size: 'Large',
    players: '1-4',
    thumbnail: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&h=300&fit=crop',
    npcs: 42,
    items: 95,
    icon: Mountain
  },
  { 
    id: 6, 
    name: 'Sunken Depths', 
    type: 'Dungeon',
    difficulty: 'Epic',
    size: 'Large',
    players: '4-6',
    thumbnail: 'https://images.unsplash.com/photo-1551244072-5d12893278ab?w=400&h=300&fit=crop',
    npcs: 28,
    items: 62,
    icon: Waves
  },
];

const typeColors = {
  Dungeon: 'from-red-500 to-orange-500',
  'Open World': 'from-emerald-500 to-green-500',
  PvP: 'from-purple-500 to-pink-500',
  Story: 'from-blue-500 to-cyan-500',
};

const difficultyConfig = {
  Normal: { color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  Heroic: { color: 'text-blue-400', bg: 'bg-blue-500/10' },
  Epic: { color: 'text-purple-400', bg: 'bg-purple-500/10' },
  Mythic: { color: 'text-amber-400', bg: 'bg-amber-500/10' },
  Competitive: { color: 'text-red-400', bg: 'bg-red-500/10' },
};

export default function Maps() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState('All');
  const [viewMode, setViewMode] = useState('grid');

  const filteredMaps = mockMaps.filter(map => {
    const matchesSearch = map.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'All' || map.type === selectedType;
    return matchesSearch && matchesType;
  });

  return (
    <GradientBackground>
      <div className="flex min-h-screen">
        <Sidebar />
        
        <div className="flex-1 flex flex-col ml-64">
          <TopBar title="Maps" />
          
          <main className="flex-1 p-8 overflow-auto">
            {/* Header Actions */}
            <div className="flex flex-col lg:flex-row gap-4 mb-8">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search maps..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>

              {/* Type Filter */}
              <div className="flex gap-2 flex-wrap">
                {['All', 'Dungeon', 'Open World', 'PvP', 'Story'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`px-4 py-3 rounded-xl font-medium transition-all ${
                      selectedType === type
                        ? 'bg-indigo-500 text-white'
                        : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {/* View Toggle */}
              <div className="flex bg-white/5 border border-white/10 rounded-xl p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-zinc-500'}`}
                >
                  <LayoutGrid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('large')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'large' ? 'bg-white/10 text-white' : 'text-zinc-500'}`}
                >
                  <Grid className="w-5 h-5" />
                </button>
              </div>

              {/* Create Button */}
              <button className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity">
                <Plus className="w-5 h-5" />
                Create Map
              </button>
            </div>

            {/* Maps Grid */}
            <div className={viewMode === 'grid' 
              ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
              : "grid grid-cols-1 lg:grid-cols-2 gap-8"
            }>
              {filteredMaps.map((map) => {
                const MapIcon = map.icon;
                const typeGradient = typeColors[map.type] || 'from-zinc-500 to-zinc-600';
                const difficulty = difficultyConfig[map.difficulty] || difficultyConfig.Normal;
                
                return (
                 <div
  key={map.id}
  className="group bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:border-indigo-500/30 hover:bg-white/10 transition-all cursor-pointer"
  onClick={() => navigate(`/map/${map.id}`)}
>
                    {/* Thumbnail */}
                    <div className="relative h-48 overflow-hidden">
                      <img 
                        src={map.thumbnail} 
                        alt={map.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      
                      {/* Type Badge */}
                      <div className={`absolute top-4 left-4 px-3 py-1.5 rounded-lg bg-gradient-to-r ${typeGradient} text-white text-xs font-medium`}>
                        {map.type}
                      </div>
                      
                      {/* Icon */}
                      <div className="absolute bottom-4 right-4 w-12 h-12 rounded-xl bg-black/50 backdrop-blur-sm flex items-center justify-center">
                        <MapIcon className="w-6 h-6 text-white" />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">
                            {map.name}
                          </h3>
                          <p className="text-zinc-500 text-sm">{map.size} • {map.players} players</p>
                        </div>
                        <span className={`px-3 py-1 rounded-lg text-xs font-medium ${difficulty.color} ${difficulty.bg}`}>
                          {map.difficulty}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-white/10">
                        <div className="flex gap-4">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-zinc-500" />
                            <span className="text-zinc-400 text-sm">{map.npcs} NPCs</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapIconBase className="w-4 h-4 text-zinc-500" />
                            <span className="text-zinc-400 text-sm">{map.items} Items</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </main>
        </div>
      </div>
    </GradientBackground>
  );
}