export function createEmptyCharacter() {
  return {
    id: crypto.randomUUID(),
    name: "",
    level: 1,

    race: "",
    background: "",
    alignment: "",
    age: "",
    playerName: "",

    class: "",
    subclass: "",
    classes: [],

    avatarUrl: "",
    ddbCharacterUrl: "",
    ddbCharacterId: "",
    syncFromDDB: false,

    visibility: "player",
    isPlayerVisible: true,
    ownerUserId: "",

    publicNotes: "",
    gmNotes: "",
    secrets: "",

    identity: {
      faith: "",
      size: "",
      height: "",
      weight: "",
      gender: "",
      eyes: "",
      hair: "",
      skin: "",
    },

    proficiencies: {
      armor: [],
      weapons: [],
      tools: [],
      languages: [],
      raw: "",
    },

    inventory: {
      currency: {
        cp: 0,
        sp: 0,
        ep: 0,
        gp: 0,
        pp: 0,
      },
      equipment: [],
    },

    actions: {
      raw: "",
      weapons: [],
    },

    spells: [],

    narrative: {
      personalityTraits: "",
      ideals: "",
      bonds: "",
      flaws: "",
      backstory: "",
      additionalNotes: "",
    },

    importMeta: {
      source: "",
      importedAt: "",
      filename: "",
      warnings: [],
      confidence: "",
    },

    stats: {
      abilities: {
        str: { score: undefined, mod: undefined },
        dex: { score: undefined, mod: undefined },
        con: { score: undefined, mod: undefined },
        int: { score: undefined, mod: undefined },
        wis: { score: undefined, mod: undefined },
        cha: { score: undefined, mod: undefined },
      },

      saves: {},
      skills: {},

      hpCurrent: undefined,
      hpMax: undefined,
      ac: undefined,
      initiativeMod: undefined,
      speed: undefined,

      spellcastingAbility: "",
      spellSaveDC: undefined,
      spellAttackBonus: undefined,

      proficiencyBonus: undefined,

      passivePerception: undefined,
      passiveInsight: undefined,
      passiveInvestigation: undefined,
      additionalSenses: "",

      defenses: {
        resistances: [],
        immunities: [],
        vulnerabilities: [],
        notes: "",
      },
    },
  };
}