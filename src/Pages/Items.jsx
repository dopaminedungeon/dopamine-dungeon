import React, { useState } from 'react';
import GradientBackground from '../components/GradientBackground';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import { Search, Plus, Swords, Shield, Sparkles, Heart, Zap, Filter, Grid, List } from 'lucide-react';

const mockItems = [
  { 
    id: 1, 
    name: 'Sword of Eternal Flames', 
    type: 'Weapon',
    rarity: 'Legendary', 
    power: 150,
    description: 'A blade forged in the heart of a dying star, its flames never extinguish.',
    stats: { attack: 150, speed: 20, critical: 15 }
  },
  { 
    id: 2, 
    name: 'Shield of the Ancients', 
    type: 'Armor',
    rarity: 'Epic', 
    power: 120,
    description: 'Blessed by the old gods, this shield can block even magical attacks.',
    stats: { defense: 120, block: 45, resistance: 30 }
  },
  { 
    id: 3, 
    name: 'Healing Potion', 
    type: 'Consumable',
    rarity: 'Common', 
    power: 25,
    description: 'Restores 25% of maximum health when consumed.',
    stats: { heal: 25 }
  },
  { 
    id: 4, 
    name: 'Thunder Staff', 
    type: 'Weapon',
    rarity: 'Epic', 
    power: 135,
    description: 'Channels the power of lightning storms into devastating magical attacks.',
    stats: { attack: 135, magic: 80, critical: 25 }
  },
  { 
    id: 5, 
    name: 'Boots of Swiftness', 
    type: 'Armor',
    rarity: 'Rare', 
    power: 60,
    description: 'Enchanted boots that increase movement speed significantly.',
    stats: { speed: 60, dodge: 20 }
  },
  { 
    id: 6, 
    name: 'Mana Crystal', 
    type: 'Consumable',
    rarity: 'Uncommon', 
    power: 40,
    description: 'Restores 40% of maximum mana when consumed.',
    stats: { mana: 40 }
  },
  { 
    id: 7, 
    name: 'Dragon Scale Armor', 
    type: 'Armor',
    rarity: 'Legendary', 
    power: 180,
    description: 'Forged from the scales of an ancient dragon, nearly impenetrable.',
    stats: { defense: 180, resistance: 60, health: 100 }
  },
  { 
    id: 8, 
    name: 'Void Dagger', 
    type: 'Weapon',
    rarity: 'Rare', 
    power: 85,
    description: 'A dagger that phases through armor, dealing true damage.',
    stats: { attack: 85, penetration: 50, speed: 40 }
  },
];

const typeIcons = {
  Weapon: Swords,
  Armor: Shield,
  Consumable: Sparkles,
};

const rarityConfig = {
  Legendary: { bg: 'from-amber-500 to-orange-600', border: 'border-amber-500/30', text: 'text-amber-400', glow: 'shadow-amber-500/20' },
  Epic: { bg: 'from-purple-500 to-violet-600', border: 'border-purple-500/30', text: 'text-purple-400', glow: 'shadow-purple-500/20' },
  Rare: { bg: 'from-blue-500 to-cyan-600', border: 'border-blue-500/30', text: 'text-blue-400', glow: 'shadow-blue-500/20' },
  Uncommon: { bg: 'from-emerald-500 to-green-600', border: 'border-emerald-500/30', text: 'text-emerald-400', glow: 'shadow-emerald-500/20' },
  Common: { bg: 'from-zinc-500 to-zinc-600', border: 'border-zinc-500/30', text: 'text-zinc-400', glow: 'shadow-zinc-500/20' },
};

export default function Items() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedRarity, setSelectedRarity] = useState('All');
  const [viewMode, setViewMode] = useState('grid');

  const filteredItems = mockItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'All' || item.type === selectedType;
    const matchesRarity = selectedRarity === 'All' || item.rarity === selectedRarity;
    return matchesSearch && matchesType && matchesRarity;
  });

  return (
    <GradientBackground>
      <div className="flex min-h-screen">
        <Sidebar />
        
        <div className="flex-1 flex flex-col ml-64">
          <TopBar title="Items" />
          
          <main className="flex-1 p-8 overflow-auto">
            {/* Header Actions */}
            <div className="flex flex-col lg:flex-row gap-4 mb-8">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>

              {/* Type Filter */}
              <div className="flex gap-2">
                {['All', 'Weapon', 'Armor', 'Consumable'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`px-4 py-3 rounded-xl font-medium transition-all ${
                      selectedType === type
                        ? 'bg-blue-500 text-white'
                        : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {/* Rarity Filter */}
              <select
                value={selectedRarity}
                onChange={(e) => setSelectedRarity(e.target.value)}
                className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500/50"
              >
                <option value="All">All Rarities</option>
                <option value="Legendary">Legendary</option>
                <option value="Epic">Epic</option>
                <option value="Rare">Rare</option>
                <option value="Uncommon">Uncommon</option>
                <option value="Common">Common</option>
              </select>

              {/* View Toggle */}
              <div className="flex bg-white/5 border border-white/10 rounded-xl p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-zinc-500'}`}
                >
                  <Grid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-zinc-500'}`}
                >
                  <List className="w-5 h-5" />
                </button>
              </div>

              {/* Add Button */}
              <button className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity">
                <Plus className="w-5 h-5" />
                Add Item
              </button>
            </div>

            {/* Items Grid */}
            <div className={viewMode === 'grid' 
              ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6"
              : "flex flex-col gap-4"
            }>
              {filteredItems.map((item) => {
                const TypeIcon = typeIcons[item.type] || Sparkles;
                const rarity = rarityConfig[item.rarity] || rarityConfig.Common;
                
                if (viewMode === 'list') {
                  return (
                    <div
                      key={item.id}
                      className={`group bg-white/5 backdrop-blur-sm border ${rarity.border} rounded-xl p-4 hover:bg-white/10 transition-all cursor-pointer flex items-center gap-4`}
                    >
                      <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${rarity.bg} flex items-center justify-center shadow-lg ${rarity.glow}`}>
                        <TypeIcon className="w-7 h-7 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-white font-semibold group-hover:text-blue-300 transition-colors">{item.name}</h3>
                        <p className="text-zinc-500 text-sm">{item.type}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-lg text-xs font-medium ${rarity.text} bg-white/5`}>
                        {item.rarity}
                      </span>
                      <span className="text-white font-bold">+{item.power}</span>
                    </div>
                  );
                }
                
                return (
                  <div
                    key={item.id}
                    className={`group bg-white/5 backdrop-blur-sm border ${rarity.border} rounded-2xl p-5 hover:bg-white/10 transition-all cursor-pointer`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${rarity.bg} flex items-center justify-center shadow-lg ${rarity.glow}`}>
                        <TypeIcon className="w-6 h-6 text-white" />
                      </div>
                      <span className={`px-3 py-1 rounded-lg text-xs font-medium ${rarity.text} bg-white/5`}>
                        {item.rarity}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-white mb-1 group-hover:text-blue-300 transition-colors">
                      {item.name}
                    </h3>
                    <p className="text-zinc-500 text-sm mb-3">{item.type}</p>
                    <p className="text-zinc-400 text-sm mb-4 line-clamp-2">{item.description}</p>

                    <div className="flex items-center justify-between pt-3 border-t border-white/10">
                      <div className="flex gap-2">
                        {Object.entries(item.stats).slice(0, 2).map(([stat, value]) => (
                          <span key={stat} className="px-2 py-1 bg-white/5 rounded-lg text-xs text-zinc-400">
                            {stat}: {value}
                          </span>
                        ))}
                      </div>
                      <span className="text-white font-bold text-lg">+{item.power}</span>
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