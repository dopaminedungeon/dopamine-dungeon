export const mockItems = [
  { 
    id: 1, 
    name: 'Sword of Eternal Flames', 
    type: 'Weapon',
    rarity: 'Legendary', 
    power: 150,
    description: 'A blade forged in the heart of a dying star, its flames never extinguish.',
    visibility: "public",
    stats: { attack: 150, speed: 20, critical: 15 }
  },
  { 
    id: 2, 
    name: 'Shield of the Ancients', 
    type: 'Armor',
    rarity: 'Epic', 
    power: 120,
    description: 'Blessed by the old gods, this shield can block even magical attacks.',
    visibility: "public",
    stats: { defense: 120, block: 45, resistance: 30 }
  },
  { 
    id: 3, 
    name: 'Healing Potion', 
    type: 'Consumable',
    rarity: 'Common', 
    power: 25,
    description: 'Restores 25% of maximum health when consumed.',
    visibility: "public",
    stats: { heal: 25 }
  },
  { 
    id: 4, 
    name: 'Thunder Staff', 
    type: 'Weapon',
    rarity: 'Epic', 
    power: 135,
    description: 'Channels the power of lightning storms into devastating magical attacks.',
    visibility: "public",
    stats: { attack: 135, magic: 80, critical: 25 }
  },
  { 
    id: 5, 
    name: 'Boots of Swiftness', 
    type: 'Armor',
    rarity: 'Rare', 
    power: 60,
    description: 'Enchanted boots that increase movement speed significantly.',
    visibility: "gm-only",
    stats: { speed: 60, dodge: 20 }
  },
  { 
    id: 6, 
    name: 'Mana Crystal', 
    type: 'Consumable',
    rarity: 'Uncommon', 
    power: 40,
    description: 'Restores 40% of maximum mana when consumed.',
    visibility: "gm-only",
    stats: { mana: 40 }
  },
  { 
    id: 7, 
    name: 'Dragon Scale Armor', 
    type: 'Armor',
    rarity: 'Legendary', 
    power: 180,
    description: 'Forged from the scales of an ancient dragon, nearly impenetrable.',
    visibility: "gm-only",
    stats: { defense: 180, resistance: 60, health: 100 }
  },
  { 
    id: 8, 
    name: 'Void Dagger', 
    type: 'Weapon',
    rarity: 'Rare', 
    power: 85,
    description: 'A dagger that phases through armor, dealing true damage.',
    visibility: "gm-only",
    stats: { attack: 85, penetration: 50, speed: 40 }
  },
];

export const MOCK_ITEM_DATA = {
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