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

  character.name = parsed?.name || "";
  character.playerName = parsed?.playerName || "";
  character.race = parsed?.race || "";
  character.background = parsed?.background || "";
  character.alignment = parsed?.alignment || "";
  character.level = Number(parsed?.level) || 0;
  character.class = parsed?.classLine || "";
  character.classes = parseClassLine(parsed?.classLine || "");

  character.ddbCharacterUrl = parsed?.ddbCharacterUrl || "";
  character.ddbCharacterId = parsed?.ddbCharacterId || "";
  character.syncFromDDB = true;

  character.identity = {
    faith: parsed?.faith || "",
    size: parsed?.size || "",
    height: parsed?.height || "",
    weight: parsed?.weight || "",
    gender: parsed?.gender || "",
    eyes: parsed?.eyes || "",
    hair: parsed?.hair || "",
    skin: parsed?.skin || "",
  };

  for (const key of ["str", "dex", "con", "int", "wis", "cha"]) {
    const score = typeof parsed?.abilities?.[key] === "number" ? parsed.abilities[key] : undefined;
    character.stats.abilities[key] = {
      score,
      mod: abilityMod(score),
    };
  }

  character.stats.hpMax = parsed?.hpMax;
  character.stats.hpCurrent = parsed?.hpCurrent ?? parsed?.hpMax;
  character.stats.ac = parsed?.ac;
  character.stats.initiativeMod = parsed?.initiativeMod;
  character.stats.speed = parsed?.speed;
  character.stats.proficiencyBonus = parsed?.proficiencyBonus;
  character.stats.spellcastingAbility = parsed?.spellcastingAbility || "";
  character.stats.spellSaveDC = parsed?.spellSaveDC;
  character.stats.spellAttackBonus = parsed?.spellAttackBonus;
  character.stats.passivePerception = parsed?.passivePerception;
  character.stats.passiveInsight = parsed?.passiveInsight;
  character.stats.passiveInvestigation = parsed?.passiveInvestigation;
  character.stats.additionalSenses = parsed?.additionalSenses || "";

  character.stats.saves = parsed?.saves || {};
  character.stats.skills = parsed?.skills || {};
  character.stats.defenses = parsed?.defenses || character.stats.defenses;

  character.proficiencies = parsed?.proficiencies || character.proficiencies;
  character.inventory = parsed?.inventory || character.inventory;
  character.actions = parsed?.actions || character.actions;
  character.spells = parsed?.spells || [];
  character.narrative = parsed?.narrative || character.narrative;

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