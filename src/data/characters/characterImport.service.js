import { mapParsedPdfToCharacterDraft } from "./characterImport.mapper";
import { parsePdf } from "./pdfParser";

function deriveNameFromFilename(filename = "") {
  const base = String(filename || "")
    .replace(/\.pdf$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();

  if (!base) return "";

  return base
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getFieldValue(fields, ...keys) {
  for (const key of keys) {
    const value = fields?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return "";
}

function findFieldByIncludes(fields, searchText) {
  const target = String(searchText || "").toLowerCase();
  if (!target) return "";

  for (const [key, value] of Object.entries(fields || {})) {
    if (String(key).toLowerCase().includes(target) && String(value || "").trim() !== "") {
      return String(value).trim();
    }
  }

  return "";
}

function extractClassLine(fields, rawText = "") {
  const direct = getFieldValue(
    fields,
    "CLASS LEVEL",
    "CLASS LEVEL2",
    "CLASS LEVEL3",
    "CLASS LEVEL4",
    "CLASSLEVEL",
    "CLASS_LEVEL"
  );

  if (direct) return direct;

  const fuzzy = findFieldByIncludes(fields, "class level");
  if (fuzzy) return fuzzy;

  const rawMatch = String(rawText || "").match(/(?:CLASS\s*&\s*LEVEL|CLASS\s+LEVEL)\s+([A-Za-z][A-Za-z'\- ]+\d+)/i);
  if (rawMatch?.[1]) {
    return rawMatch[1].trim();
  }

  return "";
}

function extractClassLineFromFieldsOrText(fields, rawText = "") {
  const direct = extractClassLine(fields, rawText);
  if (direct) return direct;

  const normalizedText = String(rawText || "").replace(/\s+/g, " ").trim();

  const candidates = [
    /CharacterName\s*[:\-]?\s*[^\n]+?\s+CLASS LEVEL\s*[:\-]?\s*([A-Za-z][A-Za-z'\- ]+\d+)/i,
    /CLASS LEVEL\s*[:\-]?\s*([A-Za-z][A-Za-z'\- ]+\d+)/i,
    /CLASS\s*&\s*LEVEL\s+PLAYER NAME\s+CHARACTER NAME\s+BACKGROUND.*?CharacterName\s*[:\-]?\s*[^\n]+?\s+CLASS LEVEL\s*[:\-]?\s*([A-Za-z][A-Za-z'\- ]+\d+)/i,
  ];

  for (const pattern of candidates) {
    const match = normalizedText.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return "";
}

function buildWarnings(fields, fallbackName, classLine) {
  const warnings = [];

  if (!getFieldValue(fields, "CharacterName", "CharacterName2", "CharacterName3", "CharacterName4") && !fallbackName) {
    warnings.push("Could not confidently extract character name.");
  }

  if (!getFieldValue(fields, "RACE", "RACE2", "RACE3")) {
    warnings.push("Could not confidently extract race/species.");
  }

  if (!classLine) {
    warnings.push("Could not confidently extract class and level.");
  }

  return warnings;
}

export async function importCharacterFromDdbPdf(file) {
  if (!file) {
    return {
      ok: false,
      draft: null,
      error: "No PDF file was provided.",
    };
  }

  const isPdf =
    file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");

  if (!isPdf) {
    return {
      ok: false,
      draft: null,
      error: "Selected file is not a PDF.",
    };
  }

  try {
    const parsed = await parsePdf(file);
    const fallbackName = deriveNameFromFilename(file.name || "");
    const fields = parsed?.fields || {};
    const classLine = extractClassLineFromFieldsOrText(fields, parsed?.rawText || "");
    const extractedName = getFieldValue(fields, "CharacterName", "CharacterName2", "CharacterName3", "CharacterName4") || fallbackName;
    const warnings = buildWarnings(fields, fallbackName, classLine);
    console.log("[characterImport] parsed field keys", Object.keys(fields || {}));
    console.log("[characterImport] extracted core fields", {
      extractedName,
      classLine,
      race: getFieldValue(fields, "RACE", "RACE2", "RACE3"),
      background: getFieldValue(fields, "BACKGROUND", "BACKGROUND2", "BACKGROUND3"),
    });

    const parsedPayload = {
      filename: file.name,
      rawText: parsed?.rawText || "",
      fields,
      name: extractedName,
      classLine,
      race: getFieldValue(fields, "RACE", "RACE2", "RACE3"),
      background: getFieldValue(fields, "BACKGROUND", "BACKGROUND2", "BACKGROUND3"),
      playerName: getFieldValue(fields, "PLAYER NAME", "PLAYER NAME2", "PLAYER NAME3"),
      alignment: getFieldValue(fields, "ALIGNMENT"),
      faith: getFieldValue(fields, "FAITH"),
      size: getFieldValue(fields, "SIZE"),
      age: getFieldValue(fields, "AGE"),
      height: getFieldValue(fields, "HEIGHT"),
      weight: getFieldValue(fields, "WEIGHT"),
      gender: getFieldValue(fields, "GENDER"),
      eyes: getFieldValue(fields, "EYES"),
      hair: getFieldValue(fields, "HAIR"),
      skin: getFieldValue(fields, "SKIN"),
      abilities: {
        str: Number(fields.STR) || undefined,
        dex: Number(fields.DEX) || undefined,
        con: Number(fields.CON) || undefined,
        int: Number(fields.INT) || undefined,
        wis: Number(fields.WIS) || undefined,
        cha: Number(fields.CHA) || undefined,
      },
      hpMax: Number(fields.MaxHP) || undefined,
      ac: Number(fields.AC) || undefined,
      initiativeMod: fields.Init || undefined,
      speed: fields.Speed || undefined,
      proficiencyBonus: fields.ProfBonus || undefined,
      passivePerception: Number(fields.Passive1) || undefined,
      passiveInsight: Number(fields.Passive2) || undefined,
      passiveInvestigation: Number(fields.Passive3) || undefined,
      additionalSenses: fields.AdditionalSenses || "",
      spellcastingAbility: fields.spellCastingAbility0 || "",
      spellSaveDC: fields.spellSaveDC0 || undefined,
      spellAttackBonus: fields.spellAtkBonus0 || undefined,
      warnings,
      confidence: warnings.length === 0 ? "high" : extractedName ? "medium" : "low",
    };

    const draft = mapParsedPdfToCharacterDraft(parsedPayload);

    return {
      ok: true,
      draft,
      error: "",
    };
  } catch (error) {
    console.error("[characterImport] Failed to import D&D Beyond PDF", error);
    return {
      ok: false,
      draft: null,
      error: error?.message || "Failed to import D&D Beyond PDF.",
    };
  }
}