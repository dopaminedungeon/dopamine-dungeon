import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import GradientBackground from "../components/GradientBackground";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { useMode } from "../context/ModeContext.jsx";
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
    visibility: "gm-only",
    attunement: "Required",
    owner: "Akumu",
    location: "Volcanic Caverns",
    hiddenEffects:
      "On a natural 20, the target gains a stacking fire vulnerability until the end of combat.",
    curse:
      "If the wielder flees from a dragon, the sword goes dormant for 3 sessions.",
    upgradePath:
      "Can be reforged in dragonfire to awaken a mythic form once the party slays an ancient dragon.",
    storyHooks:
      "Key to an old prophecy about the Heart of Cinders; dragons and fire cults can sense it from afar.",
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
    visibility: "public",
    attunement: "Required",
    owner: "Unassigned",
    location: "Crystal Market vault",
    hiddenEffects:
      "Once per long rest, can fully negate a spell of 5th level or lower without using a reaction.",
    curse: "If its bearer breaks an oath, the shield imposes disadvantage on all saving throws for a day.",
    upgradePath:
      "Can be awakened in an ancient temple, gaining a radiant aura that shields nearby allies.",
    storyHooks:
      "One of three relics tied to the Old Gods; clerical factions are actively searching for it.",
  },
  3: {
    id: 3,
    name: "Healing Potion",
    type: "Consumable",
    rarity: "Common",
    power: 25,
    description: "Restores 25% of maximum health when consumed.",
    stats: { heal: 25 },
    visibility: "public",
    attunement: "None",
    owner: "Consumable stock",
    location: "General stores / loot tables",
    hiddenEffects: "None. This is a baseline potion for quick reference.",
    curse: "—",
    upgradePath: "Can be combined with rare herbs to brew greater variants.",
    storyHooks: "Merchants may water these down in poorer districts.",
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
    visibility: "gm-only",
    attunement: "Required",
    owner: "Hidden villain asset",
    location: "Skyward Peak tower",
    hiddenEffects:
      "In a storm, the staff's damage dice are maximized on the first round of combat.",
    curse: "Each combat, on the first natural 1 the wielder attracts a lightning strike (self damage).",
    upgradePath:
      "If bathed in a storm elemental's core, it can gain control over local weather patterns.",
    storyHooks: "Signature weapon of a future arc boss; foreshadowed via rumors and scorch marks.",
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
    visibility: "public",
    attunement: "None",
    owner: "Party loot pool",
    location: "Forest ruins",
    hiddenEffects: "Once per short rest, the wearer can move through difficult terrain without penalty.",
    curse: "If the wearer stands still for an entire round, they gain a level of impatience (flavour-only).",
    upgradePath: "Can be stitched with feysilk to grant short bursts of teleportation.",
    storyHooks: "Favoured by messengers of the Verdant Court; may be recognised by fey NPCs.",
  },
  6: {
    id: 6,
    name: "Mana Crystal",
    type: "Consumable",
    rarity: "Uncommon",
    power: 40,
    description: "Restores 40% of maximum mana when consumed.",
    stats: { mana: 40 },
    visibility: "public",
    attunement: "None",
    owner: "Consumable stock",
    location: "Mage guilds, arcane merchants",
    hiddenEffects:
      "Overuse in a single session may leave faint arcane residue that can be tracked by certain entities.",
    curse: "—",
    upgradePath: "Can be refined into spell gems that store single-use spells.",
    storyHooks: "Good vector to show shortages, sanctions or magical crises in the world.",
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
    visibility: "gm-only",
    attunement: "Required",
    owner: "None yet",
    location: "Unknown dragon hoard",
    hiddenEffects:
      "The armour slowly shifts to mirror the temperament of the dragon it came from.",
    curse:
      "Dragons who see it may react violently; charisma checks against them are at disadvantage.",
    upgradePath: "Can absorb additional scales to change its elemental resistance profile.",
    storyHooks:
      "Central to a future high-level arc about ancient dragons and their descendants.",
  },
  8: {
    id: 8,
    name: "Void Dagger",
    type: "Weapon",
    rarity: "Rare",
    power: 85,
    description: "A dagger that phases through armor, dealing true damage.",
    stats: { attack: 85, penetration: 50, speed: 40 },
    visibility: "gm-only",
    attunement: "Required",
    owner: "Unknown assassin",
    location: "Black market / assassin guilds",
    hiddenEffects:
      "On a kill, can silently erase minor physical traces at the scene (blood, fingerprints, etc.).",
    curse:
      "The wielder occasionally sees echoes of the people they've killed with it.",
    upgradePath:
      "If fed enough souls, might gain the ability to cut through planar barriers.",
    storyHooks:
      "Perfect signature weapon for a recurring villain or morally grey rogue ally.",
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
  const { isGM } = useMode();

  const rawItem = MOCK_ITEM_DATA[id];
  const [formData, setFormData] = useState(rawItem || null);
  const [isEditing, setIsEditing] = useState(false);

  if (!formData) {
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

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleStatChange = (statKey, value) => {
    setFormData(prev => ({
      ...prev,
      stats: {
        ...prev.stats,
        [statKey]: Number.isNaN(Number(value)) ? prev.stats[statKey] : Number(value),
      },
    }));
  };

  const handleVisibilityChange = (visibility) => {
    setFormData(prev => ({ ...prev, visibility }));
  };

  const rarityBg = rarityColors[formData.rarity] || rarityColors.Common;
  const Icon = typeIcons[formData.type] || Sparkles;
  const visibility = formData.visibility || "public";

  return (
    <GradientBackground>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col ml-64">
          <TopBar title={formData.name} />
          <main className="flex-1 p-8 overflow-auto">
            <div className="flex items-center justify-between mb-6">
              <button
                className="flex items-center gap-2 text-zinc-400 hover:text-white"
                onClick={() => navigate("/items")}
              >
                <ArrowLeft className="w-5 h-5" />
                Back to Items
              </button>
              {isGM && (
                <button
                  onClick={() => setIsEditing(prev => !prev)}
                  className="px-4 py-2 rounded-xl bg-white/10 text-zinc-200 hover:bg-white/20 text-sm font-medium"
                >
                  {isEditing ? "Done" : "Edit"}
                </button>
              )}
            </div>

            {/* Header / identity */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm mb-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${rarityBg} flex items-center justify-center text-white`}
                  >
                    <Icon className="w-10 h-10" />
                  </div>
                  <div>
                    {isEditing && isGM ? (
                      <input
                        className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-2xl font-bold text-white"
                        value={formData.name}
                        onChange={e => handleFieldChange("name", e.target.value)}
                      />
                    ) : (
                      <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                        {formData.name}
                        {isGM && visibility === "gm-only" && (
                          <span className="px-2 py-0.5 text-[10px] rounded-full bg-red-500/20 text-red-300 border border-red-500/40 uppercase tracking-wide">
                            GM ONLY
                          </span>
                        )}
                      </h1>
                    )}
                    <div className="flex gap-2 mt-1">
                      {isEditing && isGM ? (
                        <>
                          <select
                            className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-sm text-white"
                            value={formData.type}
                            onChange={e => handleFieldChange("type", e.target.value)}
                          >
                            <option value="Weapon">Weapon</option>
                            <option value="Armor">Armor</option>
                            <option value="Consumable">Consumable</option>
                          </select>
                          <select
                            className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-sm text-white"
                            value={formData.rarity}
                            onChange={e => handleFieldChange("rarity", e.target.value)}
                          >
                            <option value="Legendary">Legendary</option>
                            <option value="Epic">Epic</option>
                            <option value="Rare">Rare</option>
                            <option value="Uncommon">Uncommon</option>
                            <option value="Common">Common</option>
                          </select>
                        </>
                      ) : (
                        <p className="text-zinc-400 text-sm">
                          {formData.type} • <span className="font-medium">{formData.rarity}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div className="bg-white/5 rounded-xl border border-white/10 px-4 py-3">
                    <p className="text-zinc-500 text-xs uppercase tracking-wide">Power</p>
                    {isEditing && isGM ? (
                      <input
                        type="number"
                        className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-xl font-bold text-white w-20"
                        value={formData.power}
                        onChange={e => handleFieldChange("power", Number(e.target.value))}
                      />
                    ) : (
                      <p className="text-white text-xl font-bold">+{formData.power}</p>
                    )}
                  </div>
                  <div className="bg-white/5 rounded-xl border border-white/10 px-4 py-3">
                    <p className="text-zinc-500 text-xs uppercase tracking-wide">Attunement</p>
                    {isEditing && isGM ? (
                      <select
                        className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-white"
                        value={formData.attunement}
                        onChange={e => handleFieldChange("attunement", e.target.value)}
                      >
                        <option value="Required">Required</option>
                        <option value="None">None</option>
                      </select>
                    ) : (
                      <p className="text-white font-medium">{formData.attunement || "None"}</p>
                    )}
                  </div>
                  <div className="bg-white/5 rounded-xl border border-white/10 px-4 py-3">
                    <p className="text-zinc-500 text-xs uppercase tracking-wide">Visibility</p>
                    {isEditing && isGM ? (
                      <div className="flex gap-2 mt-1">
                        <button
                          type="button"
                          onClick={() => handleVisibilityChange("public")}
                          className={`px-3 py-1 rounded-full text-xs font-medium border ${
                            visibility === "public"
                              ? "bg-emerald-500/20 border-emerald-400 text-emerald-200"
                              : "bg-white/5 border-white/10 text-zinc-300"
                          }`}
                        >
                          Player-visible
                        </button>
                        <button
                          type="button"
                          onClick={() => handleVisibilityChange("gm-only")}
                          className={`px-3 py-1 rounded-full text-xs font-medium border ${
                            visibility === "gm-only"
                              ? "bg-red-500/20 border-red-400 text-red-200"
                              : "bg-white/5 border-white/10 text-zinc-300"
                          }`}
                        >
                          GM only
                        </button>
                      </div>
                    ) : (
                      <p className="text-white font-medium">
                        {visibility === "gm-only" ? "GM-only" : "Player-visible"}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Player vs GM columns */}
            <div
              className={`grid grid-cols-1 gap-6 ${isGM ? "lg:grid-cols-2" : ""}`}
            >
              {/* Player-safe column */}
              <div className="space-y-4">
                {/* Description */}
                <section className="bg-white/5 border border-white/10 rounded-2xl p-5">
                  <h2 className="text-lg font-semibold text-white mb-2">Item description</h2>
                  {isEditing && isGM ? (
                    <textarea
                      className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-zinc-200 w-full min-h-[80px]"
                      value={formData.description}
                      onChange={e => handleFieldChange("description", e.target.value)}
                    />
                  ) : (
                    <p className="text-zinc-400">{formData.description}</p>
                  )}
                </section>

                {/* Core stats */}
                <section className="bg-white/5 border border-white/10 rounded-2xl p-5">
                  <h2 className="text-lg font-semibold text-white mb-3">Core stats</h2>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {isEditing && isGM ? (
                      <>
                        <select
                          className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-xs text-white"
                          value={formData.type}
                          onChange={e => handleFieldChange("type", e.target.value)}
                        >
                          <option value="Weapon">Weapon</option>
                          <option value="Armor">Armor</option>
                          <option value="Consumable">Consumable</option>
                        </select>
                        <select
                          className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-xs text-white"
                          value={formData.rarity}
                          onChange={e => handleFieldChange("rarity", e.target.value)}
                        >
                          <option value="Legendary">Legendary</option>
                          <option value="Epic">Epic</option>
                          <option value="Rare">Rare</option>
                          <option value="Uncommon">Uncommon</option>
                          <option value="Common">Common</option>
                        </select>
                        <span className="px-3 py-1 rounded-lg bg-white/5 text-zinc-300 text-xs uppercase tracking-wide">
                          Power +{formData.power}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="px-3 py-1 rounded-lg bg-white/5 text-zinc-300 text-xs uppercase tracking-wide">
                          {formData.type}
                        </span>
                        <span className="px-3 py-1 rounded-lg bg-white/5 text-zinc-300 text-xs uppercase tracking-wide">
                          {formData.rarity}
                        </span>
                        <span className="px-3 py-1 rounded-lg bg-white/5 text-zinc-300 text-xs uppercase tracking-wide">
                          Power +{formData.power}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isEditing && isGM
                      ? Object.entries(formData.stats).map(([key, value]) => (
                          <span key={key} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 text-zinc-300 text-sm">
                            <span>{key}:</span>
                            <input
                              type="number"
                              className="bg-transparent border border-white/20 rounded px-1 py-0.5 w-16 text-zinc-100"
                              value={value}
                              onChange={e => handleStatChange(key, e.target.value)}
                            />
                          </span>
                        ))
                      : Object.entries(formData.stats).map(([key, value]) => (
                          <span
                            key={key}
                            className="px-3 py-1 rounded-lg bg-white/5 text-zinc-300 text-sm"
                          >
                            {key}: {value}
                          </span>
                        ))}
                  </div>
                </section>

                {/* Ownership & usage */}
                <section className="bg-white/5 border border-white/10 rounded-2xl p-5">
                  <h2 className="text-lg font-semibold text-white mb-2">
                    Ownership & usage
                  </h2>
                  <p className="text-zinc-400 text-sm mb-1 flex items-center gap-2">
                    <span className="text-zinc-500">Current owner:</span>
                    {isEditing && isGM ? (
                      <input
                        className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-white font-medium"
                        value={formData.owner}
                        onChange={e => handleFieldChange("owner", e.target.value)}
                      />
                    ) : (
                      <span className="text-white font-medium">{formData.owner || "Unassigned"}</span>
                    )}
                  </p>
                  <p className="text-zinc-400 text-sm mb-1 flex items-center gap-2">
                    <span className="text-zinc-500">Typical location:</span>
                    {isEditing && isGM ? (
                      <input
                        className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-white/90"
                        value={formData.location}
                        onChange={e => handleFieldChange("location", e.target.value)}
                      />
                    ) : (
                      <span className="text-white/90">{formData.location || "—"}</span>
                    )}
                  </p>
                  <p className="text-zinc-500 text-xs mt-2">
                    Later this card will auto-link to PCs, sessions and maps that reference this item.
                  </p>
                </section>
              </div>

              {/* GM-only column */}
              {isGM && (
                <div className="space-y-4">
                  <section className="bg-white/5 border border-purple-500/30 rounded-2xl p-5">
                    <h2 className="text-lg font-semibold text-white mb-2">
                      Hidden properties (GM only)
                    </h2>
                    {isEditing && isGM ? (
                      <textarea
                        className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-zinc-200 w-full min-h-[60px]"
                        value={formData.hiddenEffects}
                        onChange={e => handleFieldChange("hiddenEffects", e.target.value)}
                      />
                    ) : (
                      <p className="text-zinc-400">
                        {formData.hiddenEffects ||
                          "Space for secret mechanics, extra damage riders, or conditional bonuses the players haven't discovered yet."}
                      </p>
                    )}
                  </section>

                  <section className="bg-white/5 border border-red-500/30 rounded-2xl p-5">
                    <h2 className="text-lg font-semibold text-white mb-2">
                      Curses & drawbacks
                    </h2>
                    {isEditing && isGM ? (
                      <textarea
                        className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-zinc-200 w-full min-h-[60px]"
                        value={formData.curse}
                        onChange={e => handleFieldChange("curse", e.target.value)}
                      />
                    ) : (
                      <p className="text-zinc-400">
                        {formData.curse && formData.curse !== "—"
                          ? formData.curse
                          : "If this item has a curse or downside, park it here so you remember to actually use it at the table."}
                      </p>
                    )}
                  </section>

                  <section className="bg-white/5 border border-emerald-500/30 rounded-2xl p-5">
                    <h2 className="text-lg font-semibold text-white mb-2">
                      Upgrade path / evolution
                    </h2>
                    {isEditing && isGM ? (
                      <textarea
                        className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-zinc-200 w-full min-h-[60px]"
                        value={formData.upgradePath}
                        onChange={e => handleFieldChange("upgradePath", e.target.value)}
                      />
                    ) : (
                      <p className="text-zinc-400">
                        {formData.upgradePath ||
                          "Ideas for how this item can grow with the party: reforging, absorbing shards, unlocking attunement tiers, etc."}
                      </p>
                    )}
                  </section>

                  <section className="bg-white/5 border border-blue-500/30 rounded-2xl p-5">
                    <h2 className="text-lg font-semibold text-white mb-2">
                      Story hooks & links
                    </h2>
                    {isEditing && isGM ? (
                      <textarea
                        className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-zinc-200 w-full min-h-[60px]"
                        value={formData.storyHooks}
                        onChange={e => handleFieldChange("storyHooks", e.target.value)}
                      />
                    ) : (
                      <>
                        <p className="text-zinc-400 mb-2">
                          {formData.storyHooks ||
                            "Notes on which NPCs, factions, maps or future sessions this item is tied to."}
                        </p>
                        <p className="text-zinc-500 text-xs">
                          Later this will connect to Sessions, NPCs and Maps automatically.
                        </p>
                      </>
                    )}
                  </section>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </GradientBackground>
  );
}