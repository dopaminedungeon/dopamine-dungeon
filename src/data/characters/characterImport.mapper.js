import { createEmptyCharacter } from "./character.model";

function parseClassLine(classLine = "") {
  return String(classLine)
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(.*?)(\d+)$/);
      if (!match) {
        return {
          className: part.trim(),
          level: 0,
          subclass: "",
          spellcastingAbility: "",
        };
      }

      return {
        className: match[1].trim(),
        level: Number(match[2]) || 0,
        subclass: "",
        spellcastingAbility: "",
      };
    });
}

function abilityMod(score) {
  if (typeof score !== "number") return undefined;
  return Math.floor((score - 10) / 2);
}

function getField(parsed, ...keys) {
  const fields = parsed?.fields || {};

  for (const key of keys) {
    const value = fields?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return "";
}

function toNumber(value) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return undefined;

  const cleaned = value.replace(/[^\d+-]/g, "").trim();
  if (!cleaned) return undefined;

  const parsedNumber = Number(cleaned);
  return Number.isFinite(parsedNumber) ? parsedNumber : undefined;
}

function normalizeSpeed(value) {
  if (!value) return undefined;
  const match = String(value).match(/\d+/);
  return match ? Number(match[0]) : value;
}

function parseDefenses(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return {
      resistances: [],
      immunities: [],
      vulnerabilities: [],
      notes: "",
    };
  }

  const resistancesMatch = raw.match(/Resistances\s*-\s*([^;]+)/i);
  const resistances = resistancesMatch
    ? resistancesMatch[1]
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];

  return {
    resistances,
    immunities: [],
    vulnerabilities: [],
    notes: raw,
  };
}

export function createCharacterImportDraft() {
  return {
    character: createEmptyCharacter(),
    review: {
      warnings: [],
      missingFields: [],
      confidence: "medium",
    },
  };
}

export function mapParsedPdfToCharacterDraft(parsed) {
  const draft = createCharacterImportDraft();
  const character = draft.character;

  const classLine = parsed?.classLine || getField(parsed, "CLASS LEVEL", "CLASS LEVEL2", "CLASS LEVEL3");
  const levelFromClassLine = classLine.match(/(\d+)(?!.*\d)/)?.[1];

  const extractedAbilities = {
    str: toNumber(parsed?.abilities?.str) ?? toNumber(getField(parsed, "STR")),
    dex: toNumber(parsed?.abilities?.dex) ?? toNumber(getField(parsed, "DEX")),
    con: toNumber(parsed?.abilities?.con) ?? toNumber(getField(parsed, "CON")),
    int: toNumber(parsed?.abilities?.int) ?? toNumber(getField(parsed, "INT")),
    wis: toNumber(parsed?.abilities?.wis) ?? toNumber(getField(parsed, "WIS")),
    cha: toNumber(parsed?.abilities?.cha) ?? toNumber(getField(parsed, "CHA")),
  };

  character.name = parsed?.name || getField(parsed, "CharacterName", "CharacterName2", "CharacterName3", "CharacterName4");
  character.playerName = parsed?.playerName || getField(parsed, "PLAYER NAME", "PLAYER NAME2", "PLAYER NAME3");
  character.race = parsed?.race || getField(parsed, "RACE", "RACE2", "RACE3");
  character.background = parsed?.background || getField(parsed, "BACKGROUND", "BACKGROUND2", "BACKGROUND3");
  character.alignment = parsed?.alignment || getField(parsed, "ALIGNMENT");
  character.level = Number(parsed?.level) || Number(levelFromClassLine) || 0;
  character.class = classLine || "";
  character.classes = parseClassLine(classLine || "");

  character.ddbCharacterUrl = parsed?.ddbCharacterUrl || "";
  character.ddbCharacterId = parsed?.ddbCharacterId || "";
  character.syncFromDDB = true;

  character.identity = {
    faith: parsed?.faith || getField(parsed, "FAITH"),
    size: parsed?.size || getField(parsed, "SIZE"),
    height: parsed?.height || getField(parsed, "HEIGHT"),
    weight: parsed?.weight || getField(parsed, "WEIGHT"),
    gender: parsed?.gender || getField(parsed, "GENDER"),
    eyes: parsed?.eyes || getField(parsed, "EYES"),
    hair: parsed?.hair || getField(parsed, "HAIR"),
    skin: parsed?.skin || getField(parsed, "SKIN"),
  };

  for (const key of ["str", "dex", "con", "int", "wis", "cha"]) {
    const score = extractedAbilities[key];
    character.stats.abilities[key] = {
      score,
      mod: abilityMod(score),
    };
  }

  character.stats.hpMax = parsed?.hpMax ?? toNumber(getField(parsed, "MaxHP"));
  character.stats.hpCurrent = parsed?.hpCurrent ?? parsed?.hpMax ?? toNumber(getField(parsed, "CurrentHP")) ?? character.stats.hpMax;
  character.stats.ac = parsed?.ac ?? toNumber(getField(parsed, "AC"));
  character.stats.initiativeMod = parsed?.initiativeMod ?? toNumber(getField(parsed, "Init"));
  character.stats.speed = parsed?.speed ?? normalizeSpeed(getField(parsed, "Speed"));
  character.stats.proficiencyBonus = parsed?.proficiencyBonus ?? toNumber(getField(parsed, "ProfBonus"));
  character.stats.spellcastingAbility = parsed?.spellcastingAbility || getField(parsed, "spellCastingAbility0");
  character.stats.spellSaveDC = parsed?.spellSaveDC ?? toNumber(getField(parsed, "spellSaveDC0"));
  character.stats.spellAttackBonus = parsed?.spellAttackBonus ?? toNumber(getField(parsed, "spellAtkBonus0"));
  character.stats.passivePerception = parsed?.passivePerception ?? toNumber(getField(parsed, "Passive1"));
  character.stats.passiveInsight = parsed?.passiveInsight ?? toNumber(getField(parsed, "Passive2"));
  character.stats.passiveInvestigation = parsed?.passiveInvestigation ?? toNumber(getField(parsed, "Passive3"));
  character.stats.additionalSenses = parsed?.additionalSenses || getField(parsed, "AdditionalSenses");

  character.stats.saves = parsed?.saves || {};
  character.stats.skills = parsed?.skills || {};
  character.stats.defenses = parsed?.defenses || parseDefenses(getField(parsed, "Defenses")) || character.stats.defenses;

  character.proficiencies = parsed?.proficiencies || character.proficiencies;
  character.inventory = parsed?.inventory || character.inventory;
  character.actions = parsed?.actions || character.actions;
  character.spells = parsed?.spells || [];
  character.narrative = parsed?.narrative || {
    ...character.narrative,
    personalityTraits: getField(parsed, "PersonalityTraits"),
    ideals: getField(parsed, "Ideals"),
    bonds: getField(parsed, "Bonds"),
    flaws: getField(parsed, "Flaws"),
  };

  character.importMeta = {
    source: "dndbeyond-pdf",
    importedAt: new Date().toISOString(),
    filename: parsed?.filename || "",
    warnings: parsed?.warnings || [],
    confidence: parsed?.confidence || "medium",
  };

  if (!character.name) draft.review.missingFields.push("name");
  if (!character.race) draft.review.missingFields.push("race");
  if (!character.classes.length) draft.review.missingFields.push("classes");

  if (draft.review.missingFields.length > 0) {
    draft.review.confidence = "low";
    draft.review.warnings.push("Some core fields are missing and need manual review.");
  }

  return draft;
}