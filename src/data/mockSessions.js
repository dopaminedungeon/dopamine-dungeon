export const MOCK_SESSION_DATA = {
  1: {
    id: 1,
    sessionNumber: 1,
    name: "Dragon's Lair Raid",
    players: 6,
    maxPlayers: 8,
    duration: "2h 30m",
    status: "active",
    startTime: "2024-01-15 19:00",
    map: "Volcanic Caverns",
    difficulty: "Mythic",
    progress: 75,
    visibility: "public",
    summary:
      "The party descends into the volcanic caverns to confront an ancient dragon and recover a legendary artifact.",
    gmNotes:
      "Dragon is badly wounded and playing for time. If party stalls, lair begins collapsing. Reinforcements arrive on round 4.",
    gmSecrets:
      "Artifact is sentient and aligned with an enemy faction. It may try to bargain with the party's warlock.",
    gmPrep: [
      "Stat blocks: adult red dragon (modified HP), 2x fire elementals",
      "Lair actions scripted for rounds 2, 4, 6",
      "Legendary item: Heart of Cinders – draft attunement rules",
    ],
  },
  2: {
    id: 2,
    sessionNumber: 2,
    name: "Forest Exploration",
    players: 4,
    maxPlayers: 6,
    duration: "1h 15m",
    status: "active",
    startTime: "2024-01-15 20:00",
    map: "Enchanted Woods",
    difficulty: "Normal",
    progress: 40,
    visibility: "public",
    summary:
      "Light exploration through the Enchanted Woods, with fae encounters and a missing caravan hook.",
    gmNotes:
      "Keep the tone whimsical but unsettling. One encounter should hint at the Nexus corruption.",
    gmSecrets:
      "The missing caravan is actually in a time loop one day ahead. Clues point toward a moonlit clearing.",
    gmPrep: [
      "Prep 3 fae NPCs with distinct vibes",
      "Roll 2–3 random forest events in advance",
      "Decide which PC gets the first dream/vision",
    ],
  },
  3: {
    id: 3,
    sessionNumber: 3,
    name: "PvP Tournament",
    players: 16,
    maxPlayers: 16,
    duration: "45m",
    status: "paused",
    startTime: "2024-01-15 18:00",
    map: "Arena of Champions",
    difficulty: "Competitive",
    progress: 60,
    visibility: "public",
    summary:
      "Characters and rivals compete in a structured arena tournament with escalating stakes.",
    gmNotes:
      "Let players shine with cool builds. Keep elimination flexible so favourites don’t get knocked out too early.",
    gmSecrets:
      "The tournament sponsor is secretly scouting candidates for a planar war. One rival is already recruited.",
    gmPrep: [
      "Bracket sketch + rough seeding",
      "Stats for 4 signature rival teams",
      "Reward table: boons, titles, minor magic items",
    ],
  },
  4: {
    id: 4,
    sessionNumber: 4,
    name: "Dungeon Crawl",
    players: 5,
    maxPlayers: 5,
    duration: "3h 45m",
    status: "completed",
    startTime: "2024-01-14 20:00",
    map: "Catacombs of Despair",
    difficulty: "Heroic",
    progress: 100,
    visibility: "public",
    summary:
      "Classic dungeon crawl through haunted catacombs, ending in a confrontation with an exiled priest.",
    gmNotes:
      "Used as pacing reference for future crawls. Boss felt slightly undertuned; consider buffing similar enemies.",
    gmSecrets:
      "The exiled priest served the same patron as an upcoming villain. Seeds for that connection are hidden here.",
    gmPrep: [
      "Note which rooms the party skipped – can be reused later",
      "Record which traps they fell for vs. spotted",
    ],
  },
  5: {
    id: 5,
    sessionNumber: 5,
    name: "Boss Rush Challenge",
    players: 0,
    maxPlayers: 4,
    duration: "0m",
    status: "scheduled",
    startTime: "2024-01-16 21:00",
    map: "Gauntlet Arena",
    difficulty: "Extreme",
    progress: 0,
    visibility: "gm-only",
    summary:
      "Planned special challenge session featuring consecutive boss fights in a custom arena.",
    gmNotes:
      "Use this as an optional one-shot or side challenge. Tune difficulty around current party power spikes.",
    gmSecrets:
      "Last boss should reveal a meta-plot clue about the Whispering Stones or Varionath’s deeper structure.",
    gmPrep: [
      "Design 3–5 boss encounters with escalating mechanics",
      "Decide opt-in rules for players (who, when, rewards)",
      "Sketch unique arena hazards per boss",
    ],
  },
  6: {
    id: 6,
    sessionNumber: 6,
    name: "Story Campaign Ch.5",
    players: 3,
    maxPlayers: 4,
    duration: "1h 50m",
    status: "active",
    startTime: "2024-01-15 19:30",
    map: "Crystal Kingdom",
    difficulty: "Normal",
    progress: 55,
    visibility: "gm-only",
    summary:
      "Main story chapter focusing on political intrigue in the Crystal Kingdom and the Nexus influence.",
    gmNotes:
      "Heavy on lore. Pace scenes so players don’t drown in exposition. Anchor everything in character choices.",
    gmSecrets:
      "At least one faction leader is already compromised by the Nexus. Reveal hints but not the full truth yet.",
    gmPrep: [
      "Faction relationship map updated after last session",
      "List 3 concrete choices that can shift the political balance",
      "Prep 1 emergency combat scene if they go feral",
    ],
  },
};

export const mockSessions = [
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
    visibility: "public",
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
    visibility: "public",
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
    visibility: "public",
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
    visibility: "public",
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
    visibility: "gm-only",
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
    visibility: "gm-only",
    progress: 55
  },
];