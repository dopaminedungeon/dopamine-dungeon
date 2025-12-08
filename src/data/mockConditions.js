export const mockConditions = [
  // CORRUPTION
  {
    id: "kriaxin-corruption",
    conditionFamily: "corruption",
    targetType: "PC",
    targetName: "Kriaxin",
    trackerName: "Shadow Corruption",
    summary: "Shadow-touched magic slowly reshaping her.",
    severity: "Severe",
    trend: "Rising",
    lastUpdated: "Session 13",
    gmNotes: "Monitor for sudden surges during shadow phases.",
    history: [
      "Session 5: Initial manifestation noticed.",
      "Session 10: Increased symptoms observed.",
      "Session 13: Severe corruption phase reached."
    ],
    linkedSessions: ["Session 5", "Session 10", "Session 13"],
    tags: ["shadow", "magic", "corruption"]
  },
  {
    id: "party-nexus-taint",
    conditionFamily: "corruption",
    targetType: "PC",
    targetName: "Party",
    trackerName: "Nexus Taint – Whispering Stones",
    summary:
      "Lingering resonance from the Taste Nexus, stirring hunger and intrusive cravings.",
    severity: "Severe",
    trend: "Fluctuating",
    lastUpdated: "Session 15",
    gmNotes: "Players report increased cravings during Nexus proximity.",
    history: [
      "Session 12: First signs of taint.",
      "Session 15: Fluctuating intensity."
    ],
    linkedSessions: ["Session 12", "Session 15"],
    tags: ["nexus", "taint", "whispering stones"]
  },
  // DIVINE / BOONS
  {
    id: "zorrhoa-benzaiten-blessing",
    conditionFamily: "divine",
    targetType: "PC",
    targetName: "Zorrhoa",
    trackerName: "Blessing of Benzaiten",
    summary:
      "Fey-touched luck and inspiration that keeps arriving exactly on time… for a price later.",
    severity: "Mild",
    trend: "Rising",
    lastUpdated: "Session 11",
    gmNotes: "Track the price to be paid after each boon use.",
    history: [
      "Session 3: Blessing received.",
      "Session 11: Signs of price emerging."
    ],
    linkedSessions: ["Session 3", "Session 11"],
    tags: ["blessing", "fey", "luck"]
  },

  // CURSES
  {
    id: "echo-curse",
    conditionFamily: "curse",
    targetType: "PC",
    targetName: "Echo",
    trackerName: "Echo the Cursed Mask of the Last Rehearsal",
    summary:
      "Some summary about the curse affecting Echo, causing misfortune during performances.",
    severity: "Mild",
    trend: "Rising",
    lastUpdated: "Session 11",
    gmNotes: "Track the price to be paid after each boon use.",
    history: [
      "Session 3: Blessing received.",
      "Session 11: Signs of price emerging."
    ],
    linkedSessions: ["Session 3", "Session 11"],
    tags: ["blessing", "fey", "luck"]
  },

  // BOONS
  {
    id: "echo-curse",
    conditionFamily: "boon",
    targetType: "PC",
    targetName: "Echo",
    trackerName: "Echo the Cursed Mask of the Last Rehearsal",
    summary:
      "Some summary about the curse affecting Echo, causing misfortune during performances.",
    severity: "Mild",
    trend: "Rising",
    progress: 65,
    lastUpdated: "Session 11",
    gmNotes: "Track the price to be paid after each boon use.",
    history: [
      "Session 3: Blessing received.",
      "Session 11: Signs of price emerging."
    ],
    linkedSessions: ["Session 3", "Session 11"],
    tags: ["blessing", "fey", "luck"]
  },
  // ... other conditions can be added similarly
];