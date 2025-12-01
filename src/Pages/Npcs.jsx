import React, { useState } from 'react';
import GradientBackground from '../components/GradientBackground';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import Card from '../components/Card';
import { Users, Search, Filter, Plus, Star, Skull, ShoppingBag, MessageSquare } from 'lucide-react';

const mockNpcs = [
  { 
    id: 1, 
    name: 'Grimlock the Wise', 
    type: 'Merchant', 
    level: 12,
    location: 'Crystal Market',
    health: 450,
    description: 'A weathered merchant who deals in rare artifacts and forbidden knowledge.'
  },
  { 
    id: 2, 
    name: 'Sera Nightwhisper', 
    type: 'Quest Giver', 
    level: 25,
    location: 'Shadow Grove',
    health: 800,
    description: 'An enigmatic elf who guides heroes on dangerous quests.'
  },
  { 
    id: 3, 
    name: 'Thornax the Destroyer', 
    type: 'Boss', 
    level: 50,
    location: 'Obsidian Fortress',
    health: 15000,
    description: 'A fearsome demon lord who guards the gates of the underworld.'
  },
  { 
    id: 4, 
    name: 'Old Man Jenkins', 
    type: 'NPC', 
    level: 5,
    location: 'Starting Village',
    health: 100,
    description: 'A friendly villager who offers guidance to new adventurers.'
  },
  { 
    id: 5, 
    name: 'Zephyr Stormcaller', 
    type: 'Quest Giver', 
    level: 35,
    location: 'Skyward Peak',
    health: 1200,
    description: 'A powerful mage who controls the winds and storms.'
  },
  { 
    id: 6, 
    name: 'Blackfang', 
    type: 'Boss', 
    level: 40,
    location: 'Venom Caves',
    health: 12000,
    description: 'A giant spider queen with deadly poison attacks.'
  },
];

const typeIcons = {
  Merchant: ShoppingBag,
  'Quest Giver': MessageSquare,
  Boss: Skull,
  NPC: Users,
};

const typeColors = {
  Merchant: 'from-amber-500 to-orange-500',
  'Quest Giver': 'from-blue-500 to-cyan-500',
  Boss: 'from-red-500 to-rose-500',
  NPC: 'from-zinc-500 to-zinc-600',
};

export default function Npcs() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All');

  const filteredNpcs = mockNpcs.filter(npc => {
    const matchesSearch = npc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'All' || npc.type === selectedType;
    return matchesSearch && matchesType;
  });

  return (
    <GradientBackground>
      <div className="flex min-h-screen">
        <Sidebar />
        
        <div className="flex-1 flex flex-col ml-64">
          <TopBar title="NPCs" />
          
          <main className="flex-1 p-8 overflow-auto">
            {/* Header Actions */}
            <div className="flex flex-col md:flex-row gap-4 mb-8">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search NPCs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
                />
              </div>

              {/* Filter */}
              <div className="flex gap-2">
                {['All', 'Merchant', 'Quest Giver', 'Boss', 'NPC'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`px-4 py-3 rounded-xl font-medium transition-all ${
                      selectedType === type
                        ? 'bg-purple-500 text-white'
                        : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {/* Add Button */}
              <button className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity">
                <Plus className="w-5 h-5" />
                Add NPC
              </button>
            </div>

            {/* NPCs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredNpcs.map((npc) => {
                const TypeIcon = typeIcons[npc.type] || Users;
                const gradientColor = typeColors[npc.type] || 'from-zinc-500 to-zinc-600';
                
                return (
                  <div
                    key={npc.id}
                    className="group bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-purple-500/30 hover:bg-white/10 transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${gradientColor} flex items-center justify-center shadow-lg`}>
                        <TypeIcon className="w-7 h-7 text-white" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-lg text-xs font-medium ${
                          npc.type === 'Boss' ? 'bg-red-500/20 text-red-300' :
                          npc.type === 'Quest Giver' ? 'bg-blue-500/20 text-blue-300' :
                          npc.type === 'Merchant' ? 'bg-amber-500/20 text-amber-300' :
                          'bg-zinc-500/20 text-zinc-300'
                        }`}>
                          {npc.type}
                        </span>
                      </div>
                    </div>

                    <h3 className="text-xl font-bold text-white mb-1 group-hover:text-purple-300 transition-colors">
                      {npc.name}
                    </h3>
                    <p className="text-zinc-500 text-sm mb-4">{npc.location}</p>
                    <p className="text-zinc-400 text-sm mb-4 line-clamp-2">{npc.description}</p>

                    <div className="flex items-center justify-between pt-4 border-t border-white/10">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-zinc-500 text-xs">Level</p>
                          <p className="text-white font-bold">{npc.level}</p>
                        </div>
                        <div>
                          <p className="text-zinc-500 text-xs">Health</p>
                          <p className="text-white font-bold">{npc.health.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {[...Array(Math.min(5, Math.ceil(npc.level / 10)))].map((_, i) => (
                          <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                        ))}
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