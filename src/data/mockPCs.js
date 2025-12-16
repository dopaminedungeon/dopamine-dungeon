// src/data/mockPCs.js

export const mockPCs = [
  {
    id: "pc-yasuke",
    name: "Yasuke",
    race: "Tiefling",
    class: "Warlock",
    subclass: "The Last Shadow", // tweak as needed
    level: 8,
    alignment: "Chaotic Neutral",
    background: "Haunted scholar and reluctant Guardian.",
    age: 28,
    playerName: "Magda",

    // Visuals / D&D Beyond
    avatarUrl: "", // you can plug in a local asset later
    ddbCharacterUrl: "", // paste your D&D Beyond link here when you want
    ddbCharacterId: "",
    syncFromDDB: false,

    stats: {
      abilities: {
        str: { score: 10, mod: 0 },
        dex: { score: 14, mod: 2 },
        con: { score: 14, mod: 2 },
        int: { score: 16, mod: 3 },
        wis: { score: 12, mod: 1 },
        cha: { score: 18, mod: 4 },
      },

      saves: {
        str: { mod: 0, proficient: false },
        dex: { mod: 2, proficient: false },
        con: { mod: 2, proficient: false },
        int: { mod: 3, proficient: false },
        wis: { mod: 1, proficient: false },
        cha: { mod: 8, proficient: true },
      },

      skills: {
        acrobatics: { mod: 2, proficient: false },
        animalHandling: { mod: 1, proficient: false },
        arcana: { mod: 5, proficient: true },
        athletics: { mod: 0, proficient: false },
        deception: { mod: 8, proficient: true },
        history: { mod: 5, proficient: true },
        insight: { mod: 3, proficient: true },
        intimidation: { mod: 6, proficient: false },
        investigation: { mod: 5, proficient: true },
        medicine: { mod: 1, proficient: false },
        nature: { mod: 3, proficient: false },
        perception: { mod: 3, proficient: true },
        performance: { mod: 4, proficient: false },
        persuasion: { mod: 8, proficient: true },
        religion: { mod: 3, proficient: false },
        sleightOfHand: { mod: 2, proficient: false },
        stealth: { mod: 2, proficient: false },
        survival: { mod: 1, proficient: false },
      },

      hpCurrent: 45,
      hpMax: 45,
      ac: 15,
      initiativeMod: 2,
      speed: 30,

      spellcastingAbility: "CHA",
      spellSaveDC: 16,
      spellAttackBonus: 8,

      proficiencyBonus: 3,
    },

    publicNotes:
      "A violet-skinned tiefling warlock bound to the Last Shadow, acting as DM-avatar and narrative anchor.",
    gmNotes:
      "Carries deep guilt about the Guardians and the Nexuses. Protects the party, but will sacrifice almost anything for the bigger picture.",
    secrets:
      "Knows more about the Red Book and the nature of the Shadow corruption than he admits.",
    isPlayerVisible: true,
  },

  {
    id: "pc-kriaxin",
    name: "Kriaxin",
    race: "Dragonborn (Black)",
    class: "Sorcerer",
    subclass: "Shadow",
    level: 8,
    alignment: "Chaotic Good",
    background: "Escaped experiment infused with shadow-touched magic.",
    age: 24,
    playerName: "",

    avatarUrl: "",
    ddbCharacterUrl: "",
    ddbCharacterId: "",
    syncFromDDB: false,

    stats: {
      abilities: {
        str: { score: 10, mod: 0 },
        dex: { score: 14, mod: 2 },
        con: { score: 14, mod: 2 },
        int: { score: 12, mod: 1 },
        wis: { score: 10, mod: 0 },
        cha: { score: 18, mod: 4 },
      },

      saves: {
        str: { mod: 0, proficient: false },
        dex: { mod: 2, proficient: false },
        con: { mod: 4, proficient: true },
        int: { mod: 1, proficient: false },
        wis: { mod: 0, proficient: false },
        cha: { mod: 8, proficient: true },
      },

      skills: {
        acrobatics: { mod: 2, proficient: false },
        animalHandling: { mod: 0, proficient: false },
        arcana: { mod: 3, proficient: true },
        athletics: { mod: 0, proficient: false },
        deception: { mod: 4, proficient: false },
        history: { mod: 1, proficient: false },
        insight: { mod: 0, proficient: false },
        intimidation: { mod: 6, proficient: true },
        investigation: { mod: 1, proficient: false },
        medicine: { mod: 0, proficient: false },
        nature: { mod: 1, proficient: false },
        perception: { mod: 0, proficient: false },
        performance: { mod: 4, proficient: false },
        persuasion: { mod: 4, proficient: false },
        religion: { mod: 1, proficient: false },
        sleightOfHand: { mod: 2, proficient: false },
        stealth: { mod: 2, proficient: false },
        survival: { mod: 0, proficient: false },
      },

      hpCurrent: 42,
      hpMax: 42,
      ac: 14,
      initiativeMod: 2,
      speed: 30,

      spellcastingAbility: "CHA",
      spellSaveDC: 16,
      spellAttackBonus: 8,

      proficiencyBonus: 3,
    },

    publicNotes:
      "Shadow-infused sorceress wrestling with a corruption that’s becoming a central pillar of the campaign.",
    gmNotes:
      "Her corruption tracker is critical to the world’s fate. Conditions module should surface her corruption prominently.",
    secrets:
      "Her origin is tightly bound to the Nexuses and the Whispering Stones.",
    isPlayerVisible: true,
  },

  {
    id: "pc-zorrhoa",
    name: "Zorrhoa",
    race: "Wood Elf",
    class: "Ranger / Druid",
    subclass: "Gloom Stalker / Circle of something", // tweak
    level: 8,
    alignment: "Neutral Good",
    background: "Warden of the wilds with one foot in the shadows.",
    age: 120,
    playerName: "",

    avatarUrl: "",
    ddbCharacterUrl: "",
    ddbCharacterId: "",
    syncFromDDB: false,

    stats: {
      abilities: {
        str: { score: 10, mod: 0 },
        dex: { score: 18, mod: 4 },
        con: { score: 14, mod: 2 },
        int: { score: 12, mod: 1 },
        wis: { score: 16, mod: 3 },
        cha: { score: 8, mod: -1 },
      },

      saves: {
        str: { mod: 0, proficient: false },
        dex: { mod: 7, proficient: true },
        con: { mod: 2, proficient: false },
        int: { mod: 1, proficient: false },
        wis: { mod: 6, proficient: true },
        cha: { mod: -1, proficient: false },
      },

      skills: {
        acrobatics: { mod: 4, proficient: false },
        animalHandling: { mod: 3, proficient: false },
        arcana: { mod: 1, proficient: false },
        athletics: { mod: 0, proficient: false },
        deception: { mod: -1, proficient: false },
        history: { mod: 1, proficient: false },
        insight: { mod: 3, proficient: false },
        intimidation: { mod: -1, proficient: false },
        investigation: { mod: 1, proficient: false },
        medicine: { mod: 3, proficient: false },
        nature: { mod: 3, proficient: true },
        perception: { mod: 7, proficient: true },
        performance: { mod: -1, proficient: false },
        persuasion: { mod: -1, proficient: false },
        religion: { mod: 1, proficient: false },
        sleightOfHand: { mod: 4, proficient: false },
        stealth: { mod: 7, proficient: true },
        survival: { mod: 7, proficient: true },
      },

      hpCurrent: 52,
      hpMax: 52,
      ac: 17,
      initiativeMod: 4,
      speed: 35,

      spellcastingAbility: "WIS",
      spellSaveDC: 14,
      spellAttackBonus: 6,

      proficiencyBonus: 3,
    },

    publicNotes:
      "Sharp-eyed scout and moral compass when everyone else is fireballing first and asking questions later.",
    gmNotes:
      "Key lens into the natural consequences of Nexus corruption. Great hook into Feywild / primal spirits.",
    secrets: "",
    isPlayerVisible: true,
  },

  {
    id: "pc-fizzy",
    name: "Fizzy",
    race: "Gnome",
    class: "Rogue",
    subclass: "???", // tweak
    level: 8,
    alignment: "Chaotic Neutral",
    background: "Agent of chaos with sticky fingers and a soft spot for the party.",
    age: 50,
    playerName: "",

    avatarUrl: "",
    ddbCharacterUrl: "",
    ddbCharacterId: "",
    syncFromDDB: false,

    stats: {
      abilities: {
        str: { score: 8, mod: -1 },
        dex: { score: 18, mod: 4 },
        con: { score: 14, mod: 2 },
        int: { score: 12, mod: 1 },
        wis: { score: 10, mod: 0 },
        cha: { score: 14, mod: 2 },
      },

      saves: {
        str: { mod: -1, proficient: false },
        dex: { mod: 7, proficient: true },
        con: { mod: 2, proficient: false },
        int: { mod: 4, proficient: true },
        wis: { mod: 0, proficient: false },
        cha: { mod: 2, proficient: false },
      },

      skills: {
        acrobatics: { mod: 7, proficient: true },
        animalHandling: { mod: 0, proficient: false },
        arcana: { mod: 1, proficient: false },
        athletics: { mod: -1, proficient: false },
        deception: { mod: 2, proficient: false },
        history: { mod: 1, proficient: false },
        insight: { mod: 0, proficient: false },
        intimidation: { mod: 2, proficient: false },
        investigation: { mod: 4, proficient: true },
        medicine: { mod: 0, proficient: false },
        nature: { mod: 1, proficient: false },
        perception: { mod: 4, proficient: true },
        performance: { mod: 2, proficient: false },
        persuasion: { mod: 2, proficient: false },
        religion: { mod: 1, proficient: false },
        sleightOfHand: { mod: 7, proficient: true },
        stealth: { mod: 7, proficient: true },
        survival: { mod: 0, proficient: false },
      },

      hpCurrent: 46,
      hpMax: 46,
      ac: 16,
      initiativeMod: 4,
      speed: 25,

      spellcastingAbility: null,
      spellSaveDC: undefined,
      spellAttackBonus: undefined,

      proficiencyBonus: 3,
    },

    publicNotes:
      "Explosive gremlin energy. Specializes in getting the party into and (occasionally) out of trouble.",
    gmNotes:
      "Prime candidate for consequences when schemes go sideways. Great hook for criminal factions and heist arcs.",
    secrets: "",
    isPlayerVisible: true,
  },

  {
    id: "pc-roman",
    name: "Roman",
    race: "Half-Orc",
    class: "Barbarian",
    subclass: "???", // tweak
    level: 8,
    alignment: "Chaotic Good",
    background: "Front-line problem solver with a talent for direct action.",
    age: 30,
    playerName: "",

    avatarUrl: "",
    ddbCharacterUrl: "",
    ddbCharacterId: "",
    syncFromDDB: false,

    stats: {
      abilities: {
        str: { score: 18, mod: 4 },
        dex: { score: 14, mod: 2 },
        con: { score: 16, mod: 3 },
        int: { score: 8, mod: -1 },
        wis: { score: 10, mod: 0 },
        cha: { score: 12, mod: 1 },
      },

      saves: {
        str: { mod: 7, proficient: true },
        dex: { mod: 2, proficient: false },
        con: { mod: 6, proficient: true },
        int: { mod: -1, proficient: false },
        wis: { mod: 0, proficient: false },
        cha: { mod: 1, proficient: false },
      },

      skills: {
        acrobatics: { mod: 2, proficient: false },
        animalHandling: { mod: 0, proficient: false },
        arcana: { mod: -1, proficient: false },
        athletics: { mod: 7, proficient: true },
        deception: { mod: 1, proficient: false },
        history: { mod: -1, proficient: false },
        insight: { mod: 0, proficient: false },
        intimidation: { mod: 4, proficient: true },
        investigation: { mod: -1, proficient: false },
        medicine: { mod: 0, proficient: false },
        nature: { mod: -1, proficient: false },
        perception: { mod: 0, proficient: false },
        performance: { mod: 1, proficient: false },
        persuasion: { mod: 1, proficient: false },
        religion: { mod: -1, proficient: false },
        sleightOfHand: { mod: 2, proficient: false },
        stealth: { mod: 2, proficient: false },
        survival: { mod: 3, proficient: true },
      },

      hpCurrent: 70,
      hpMax: 70,
      ac: 15,
      initiativeMod: 2,
      speed: 30,

      spellcastingAbility: null,
      spellSaveDC: undefined,
      spellAttackBonus: undefined,

      proficiencyBonus: 3,
    },

    publicNotes:
      "If it can be solved by rage and a greataxe, Roman is already walking toward it.",
    gmNotes:
      "Stress / trauma trackers could be interesting here later. Great hook for moral choices and war arcs.",
    secrets: "",
    isPlayerVisible: true,
  },

  {
    id: "pc-anleil",
    name: "Anleil",
    race: "Dwarf",
    class: "Artificer",
    subclass: "???",
    level: 8,
    alignment: "Neutral Good",
    background: "Tinkering genius with too many projects and not enough sleep.",
    age: 80,
    playerName: "",

    avatarUrl: "",
    ddbCharacterUrl: "",
    ddbCharacterId: "",
    syncFromDDB: false,

    stats: {
      abilities: {
        str: { score: 10, mod: 0 },
        dex: { score: 14, mod: 2 },
        con: { score: 16, mod: 3 },
        int: { score: 18, mod: 4 },
        wis: { score: 12, mod: 1 },
        cha: { score: 10, mod: 0 },
      },

      saves: {
        str: { mod: 0, proficient: false },
        dex: { mod: 2, proficient: false },
        con: { mod: 6, proficient: true },
        int: { mod: 7, proficient: true },
        wis: { mod: 1, proficient: false },
        cha: { mod: 0, proficient: false },
      },

      skills: {
        acrobatics: { mod: 2, proficient: false },
        animalHandling: { mod: 1, proficient: false },
        arcana: { mod: 7, proficient: true },
        athletics: { mod: 0, proficient: false },
        deception: { mod: 0, proficient: false },
        history: { mod: 7, proficient: true },
        insight: { mod: 1, proficient: false },
        intimidation: { mod: 0, proficient: false },
        investigation: { mod: 7, proficient: true },
        medicine: { mod: 1, proficient: false },
        nature: { mod: 4, proficient: false },
        perception: { mod: 1, proficient: false },
        performance: { mod: 0, proficient: false },
        persuasion: { mod: 0, proficient: false },
        religion: { mod: 4, proficient: false },
        sleightOfHand: { mod: 2, proficient: false },
        stealth: { mod: 2, proficient: false },
        survival: { mod: 1, proficient: false },
      },

      hpCurrent: 55,
      hpMax: 55,
      ac: 17,
      initiativeMod: 2,
      speed: 25,

      spellcastingAbility: "INT",
      spellSaveDC: 15,
      spellAttackBonus: 7,

      proficiencyBonus: 3,
    },

    publicNotes:
      "Workshop goblin, explosion risk: high. Glues the party to the setting’s tech and weird arcane devices.",
    gmNotes:
      "Great anchor for artifact creation, Veinborn Hammer lore, and Nexus-infused tech.",
    secrets: "",
    isPlayerVisible: true,
  },
];