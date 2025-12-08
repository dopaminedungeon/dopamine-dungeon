// Temporary mock quest data
export const mockQuest = {
  id: "1",
  name: "Nexus Echoes in Langendris",
  tagline: "Unravel why the city hums with half-remembered dreams.",
  status: "active", // not-started | active | completed | failed
  type: "main-arc", // main-arc | side-quest | character-arc | world-arc
  campaign: "Varionath Core",
  playerSummary:
    "Strange echoes ripple through Langendris. People wake up with someone else's memories, and the Nexus stones in the city walls thrum louder each week.",
  playerSteps: [
    "Investigate unusual dreams and memory slips in the Takeru District.",
    "Track the connection between the Nexus stones and the recent disappearances.",
  ],
  visibleConsequences:
    "Whispers of 'the Last Shadow' spread through taverns. Clerics report prayers going to the wrong gods.",
  playerRewards:
    "Gold from worried nobles, rare Nexus fragments, new allies in the Moonlit Archive.",
  gmSummary:
    "The Last Shadow is using Langendris as a testbed, bleeding 'taste' and 'memory' together via corrupted Nexus stones. This arc sets up the reveal of Ciara's fractured senses.",
  gmSteps: [
    "Kiyomi notices script anomalies in city records and quietly flags the party.",
    "A minor cult in Waldenmont begins 'harvesting' memories as offerings.",
    "A failed ritual causes one PC to glimpse the true form of the Last Shadow.",
  ],
  gmConsequences:
    "If ignored, Langendris becomes partially memory-scarred: maps, contracts, and even names no longer line up. Factions exploit the chaos.",
  gmRewards:
    "Foothold for the Last Shadow, leverage over Kiyomi, and a direct line into the party's personal histories.",
  tags: ["nexus", "langendris", "last-shadow", "main-arc"],
  linkedSessionsCount: 3,
  linkedNpcsCount: 5,
  linkedItemsCount: 2,
  linkedMapsCount: 2,
  linkedLoreCount: 4,
};

// Temporary mock data – later this will be driven by Firebase
export const mockQuests = [
  {
    id: "q1",
    name: "Whispers in the Moonlit Archive",
    status: "active", // active | completed | failed
    visibility: "public", // public | gm-only
    campaign: "Chronicles of Varionath",
    playerSummary:
      "Strange whispers haunt the Moonlit Archive. The party agreed to investigate missing pages and odd magical echoes.",
    gmTwist:
      "The whispers are fragments of Ciara's lost sense, drawn to the Archive's nexus residue. Completing this quest advances the Last Shadow arc.",
    rewardsPlayer: "Favour with the Langendris librarians, unique scrolls, and access to restricted stacks.",
    rewardsGM: "Unlocks Lore node: Moonlit Archive; advances main arc milestone 2/5.",
    progress: 40, // 0–100
    tags: ["main-arc", "langendris", "nexus"],
    links: {
      npcs: 3,
      items: 2,
      sessions: 1,
      maps: 1,
      lore: 2,
    },
  },
  {
    id: "q2",
    name: "Roman's Quiet Debt",
    status: "active",
    visibility: "gm-only",
    campaign: "Chronicles of Varionath",
    playerSummary:
      "Roman owes someone a favour. The details are fuzzy, but it keeps coming up at inconvenient times.",
    gmTwist:
      "A criminal faction covered for Roman in Waldenmont. They now expect him to sabotage a future negotiation.",
    rewardsPlayer: "Debts cleared, access to black market contacts.",
    rewardsGM:
      "Can flip this faction between ally/enemy depending on how the party handles the reveal.",
    progress: 20,
    tags: ["character-arc", "roman", "faction"],
    links: {
      npcs: 2,
      items: 0,
      sessions: 2,
      maps: 1,
      lore: 1,
    },
  },
  {
    id: "q3",
    name: "Fix Karlach, Not Emotionally This Time",
    status: "completed",
    visibility: "public",
    campaign: "One-Shot: Infernal Repairs",
    playerSummary:
      "The party helped an infernal engineer stabilize a soul engine before it went critical.",
    gmTwist:
      "The repair subtly tuned the engine to a different patron, who now has a claim on future infernal tech.",
    rewardsPlayer: "Infernal favour, custom magic item, bragging rights.",
    rewardsGM: "Hook into future cross-campaign infernal nonsense.",
    progress: 100,
    tags: ["side-quest", "infernal", "engineering"],
    links: {
      npcs: 1,
      items: 1,
      sessions: 1,
      maps: 0,
      lore: 1,
    },
  },
  {
    id: "q4",
    name: "The Contract Beneath Akumu's Dreams",
    status: "failed",
    visibility: "gm-only",
    campaign: "Chronicles of Varionath",
    playerSummary:
      "Akumu is clearly bound to something, but the party hasn't yet untangled what or how.",
    gmTwist:
      "This specific redemption path is no longer available due to past choices. The contract will resurface in a harsher form later.",
    rewardsPlayer:
      "Originally: a way out. Now: narrative consequences and a darker path unlocked.",
    rewardsGM: "Flag a future major arc beat and corruption spike.",
    progress: 100,
    tags: ["character-arc", "akumu", "contract", "failed"],
    links: {
      npcs: 2,
      items: 1,
      sessions: 3,
      maps: 1,
      lore: 3,
    },
  },
];