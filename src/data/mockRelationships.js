// src/data/mockRelationships.js

export const mockRelationships = [
  // PC ↔ PC – Party dynamics
  {
    id: "pcpc-yasuke-kriaxin",
    type: "PC ↔ PC",
    entityA: "Yasuke",
    entityB: "Kriaxin",
    summary:
      "A volatile mix of genuine care, mutual frustration and shared responsibility for the party's disaster energy.",
    status: "Active",
    valence: "Volatile",
    intensity: 4,
    lastChanged: "Session 12",
    tags: ["trust issues", "found family", "leadership tension"],
  },
  {
    id: "pcpc-roman-fizzy",
    type: "PC ↔ PC",
    entityA: "Roman",
    entityB: "Fizzy",
    summary:
      "Chaotic little sibling energy versus tired big brother vibes. They will absolutely commit crimes together.",
    status: "Active",
    valence: "Positive",
    intensity: 3,
    lastChanged: "Session 9",
    tags: ["ride or die", "crime buddies", "banter"],
  },

  // PC ↔ NPC – Bonds
  {
    id: "pcnpc-kriaxin-ciara",
    type: "PC ↔ NPC",
    entityA: "Kriaxin",
    entityB: "Ciara",
    summary:
      "Awe, terror and reluctant devotion toward a being who sees more in her than she sees in herself.",
    status: "Active",
    valence: "Complicated",
    intensity: 5,
    lastChanged: "Session 14",
    tags: ["patron", "corruption", "destiny"],
  },
  {
    id: "pcnpc-akumu-red-book",
    type: "PC ↔ NPC",
    entityA: "Akumu",
    entityB: "Red Book",
    summary:
      "Former mentor turned living reminder of every bad decision. Respect, betrayal and unresolved guilt.",
    status: "Strained",
    valence: "Negative",
    intensity: 4,
    lastChanged: "Session 11",
    tags: ["mentor", "betrayal", "unfinished business"],
  },

  // PC ↔ Faction – Reputation
  {
    id: "pcfaction-wesolki",
    type: "PC ↔ Faction",
    entityA: "Party",
    entityB: "Wesołki",
    summary:
      "Folk-hero chaos gremlins whose actions keep accidentally supporting the rebels' long-term plans.",
    status: "Active",
    valence: "Positive",
    intensity: 4,
    publicReputation: 4,
    gmReputation: 5, 
    lastChanged: "Session 10",
    tags: ["rebels", "folk heroes", "loose cannons"],
  },
  {
    id: "pcfaction-blacksite",
    type: "PC ↔ Faction",
    entityA: "Party",
    entityB: "Blacksite Remnants",
    summary:
      "Officially enemies of the state. Unofficially, the only ones who know exactly how bad the experiments were.",
    status: "Broken",
    valence: "Negative",
    intensity: 5,
    publicReputation: 4,
    gmReputation: 5, 
    lastChanged: "Session 13",
    tags: ["enemies", "war crimes", "collateral damage"],
  },
];