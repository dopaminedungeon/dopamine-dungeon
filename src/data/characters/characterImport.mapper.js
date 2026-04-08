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

function parseFeatureList(values = []) {
    if (!Array.isArray(values)) return [];

    return values
        .map((value) => {
            if (typeof value === "string") {
                const entry = value.trim();
                return entry
                    ? {
                        name: entry,
                        description: entry,
                    }
                    : null;
            }

            if (value && typeof value === "object") {
                const name = String(value.name || value.title || value.label || value.description || "").trim();
                const description = String(value.description || value.details || value.text || name).trim();

                if (!name && !description) return null;

                return {
                    name: name || description,
                    description: description || name,
                };
            }

            return null;
        })
        .filter(Boolean);
}


function normalizeActionGroups(actionsInput) {
    if (Array.isArray(actionsInput)) {
        return {
            weapons: [],
            actions: actionsInput,
            bonusActions: [],
            reactions: [],
            other: [],
        };
    }

    if (actionsInput && typeof actionsInput === "object") {
        return {
            weapons: Array.isArray(actionsInput.weapons) ? actionsInput.weapons : [],
            actions: Array.isArray(actionsInput.actions) ? actionsInput.actions : [],
            bonusActions: Array.isArray(actionsInput.bonusActions) ? actionsInput.bonusActions : [],
            reactions: Array.isArray(actionsInput.reactions) ? actionsInput.reactions : [],
            other: Array.isArray(actionsInput.other) ? actionsInput.other : [],
        };
    }

    return {
        weapons: [],
        actions: [],
        bonusActions: [],
        reactions: [],
        other: [],
    };
}

function parseListFromDelimitedString(value = "") {
    return String(value || "")
        .split(/[\n;,]/)
        .map((entry) => entry.trim())
        .filter(Boolean);
}

function normalizeProficiencyToken(value = "") {
    return String(value || "")
        .replace(/^=+\s*/, "")
        .replace(/\s*=+$/, "")
        .replace(/\s+/g, " ")
        .trim();
}

function classifyProficiencyToken(value = "") {
    const token = normalizeProficiencyToken(value);
    const lowered = token.toLowerCase();

    if (!token) return null;
    if (lowered.includes("armor") || lowered.includes("shield")) return "armor";
    if (lowered.includes("weapon") || lowered.includes("firearm")) return "weapons";
    if (
        lowered.includes("tool") ||
        lowered.includes("kit") ||
        lowered.includes("instrument") ||
        lowered.includes("supplies")
    ) return "tools";

    return "languages";
}

function parseSectionedProficiencies(raw = "") {
    const result = {
        armor: [],
        weapons: [],
        tools: [],
        languages: [],
    };

    const headingRegex = /===\s*(ARMOR|WEAPONS|TOOLS|LANGUAGES)\s*===/gi;
    const matches = [...String(raw || "").matchAll(headingRegex)];

    if (matches.length === 0) return result;

    matches.forEach((match, index) => {
        const heading = String(match[1] || "").toLowerCase();
        const start = (match.index ?? 0) + match[0].length;
        const end = index + 1 < matches.length ? (matches[index + 1].index ?? raw.length) : raw.length;
        const sectionBody = String(raw).slice(start, end).trim();
        const values = parseListFromDelimitedString(sectionBody).map(normalizeProficiencyToken).filter(Boolean);

        if (heading === "armor") result.armor.push(...values);
        if (heading === "weapons") result.weapons.push(...values);
        if (heading === "tools") result.tools.push(...values);
        if (heading === "languages") result.languages.push(...values);
    });

    return {
        armor: [...new Set(result.armor)],
        weapons: [...new Set(result.weapons)],
        tools: [...new Set(result.tools)],
        languages: [...new Set(result.languages)],
    };
}

function parseProficiencies(value = "") {
    const raw = String(value || "").trim();
    if (!raw) {
        return {
            armor: [],
            weapons: [],
            tools: [],
            languages: [],
            notes: "",
        };
    }

    const sectioned = parseSectionedProficiencies(raw);
    if (
        sectioned.armor.length > 0 ||
        sectioned.weapons.length > 0 ||
        sectioned.tools.length > 0 ||
        sectioned.languages.length > 0
    ) {
        return {
            ...sectioned,
            notes: raw,
        };
    }

    const result = {
        armor: [],
        weapons: [],
        tools: [],
        languages: [],
        notes: raw,
    };

    const patterns = {
        armor: /armor\s*[:\-]\s*([^\n]+)/i,
        weapons: /weapons?\s*[:\-]\s*([^\n]+)/i,
        tools: /tools?\s*[:\-]\s*([^\n]+)/i,
        languages: /languages?\s*[:\-]\s*([^\n]+)/i,
    };

    Object.entries(patterns).forEach(([key, pattern]) => {
        const match = raw.match(pattern);
        if (match?.[1]) {
            result[key] = parseListFromDelimitedString(match[1]).map(normalizeProficiencyToken).filter(Boolean);
        }
    });

    if (
        result.armor.length === 0 &&
        result.weapons.length === 0 &&
        result.tools.length === 0 &&
        result.languages.length === 0
    ) {
        parseListFromDelimitedString(raw)
            .map(normalizeProficiencyToken)
            .filter(Boolean)
            .forEach((entry) => {
                const bucket = classifyProficiencyToken(entry);
                if (bucket) {
                    result[bucket].push(entry);
                }
            });
    }

    result.armor = [...new Set(result.armor)];
    result.weapons = [...new Set(result.weapons)];
    result.tools = [...new Set(result.tools)];
    result.languages = [...new Set(result.languages)];

    return result;
}

function parseInventory(parsed = {}) {
    const equipment = [];
    const currency = {
        cp: toNumber(getField(parsed, "CP")) ?? 0,
        sp: toNumber(getField(parsed, "SP")) ?? 0,
        ep: toNumber(getField(parsed, "EP")) ?? 0,
        gp: toNumber(getField(parsed, "GP")) ?? 0,
        pp: toNumber(getField(parsed, "PP")) ?? 0,
    };

    for (let index = 0; index <= 39; index += 1) {
        const name = getField(parsed, `Eq Name${index}`);
        if (!name) continue;

        equipment.push({
            name: String(name).trim(),
            qty: toNumber(getField(parsed, `Eq Qty${index}`)) ?? 1,
            weight: getField(parsed, `Eq Weight${index}`),
        });
    }

    for (let index = 1; index <= 3; index += 1) {
        const name = getField(parsed, `Attuned Name${index}`);
        if (!name) continue;

        const alreadyExists = equipment.some((entry) => entry.name === String(name).trim());
        if (alreadyExists) continue;

        equipment.push({
            name: String(name).trim(),
            qty: toNumber(getField(parsed, `Attuned Qty${index}`)) ?? 1,
            weight: getField(parsed, `Attuned Weight${index}`, `AttunedWeight${index}`),
            attuned: true,
        });
    }

    return {
        currency,
        equipment,
    };
}

function parseWeapons(parsed = {}) {
    const weapons = [];

    const weaponFieldKeys = [
        ["Wpn Name", "Wpn1 AtkBonus", "Wpn1 Damage", "Wpn Notes 1"],
        ["Wpn Name 2", "Wpn2 AtkBonus", "Wpn2 Damage", "Wpn Notes 2"],
        ["Wpn Name 3", "Wpn3 AtkBonus", "Wpn3 Damage", "Wpn Notes 3"],
        ["Wpn Name 4", "Wpn4 AtkBonus", "Wpn4 Damage", "Wpn Notes 4"],
    ];

    weaponFieldKeys.forEach(([nameKey, attackKey, damageKey, notesKey]) => {
        const name = getField(parsed, nameKey);
        if (!name) return;

        weapons.push({
            name: String(name).trim(),
            attackBonus: getField(parsed, attackKey),
            damage: getField(parsed, damageKey),
            notes: getField(parsed, notesKey),
        });
    });

    return weapons;
}

function parseSpells(parsed = {}) {
    const spells = [];
    const spellcastingClasses = parseListFromDelimitedString(getField(parsed, "spellCastingClass0").replace(/\//g, ","));

    for (let index = 0; index <= 99; index += 1) {
        const name = getField(parsed, `spellName${index}`);
        if (!name) continue;

        const className =
            spellcastingClasses.length === 1
                ? spellcastingClasses[0]
                : spellcastingClasses.length > 1
                    ? spellcastingClasses[0]
                    : "";

        spells.push({
            name: String(name).trim(),
            className,
            source: getField(parsed, `spellSource${index}`),
            saveHit: getField(parsed, `spellSaveHit${index}`),
            castingTime: getField(parsed, `spellCastingTime${index}`),
            range: getField(parsed, `spellRange${index}`),
            components: getField(parsed, `spellComponents${index}`),
            duration: getField(parsed, `spellDuration${index}`),
            page: getField(parsed, `spellPage${index}`),
            notes: getField(parsed, `spellNotes${index}`),
        });
    }

    return spells;
}

function normalizeImportedClassEntries(classLine = "", parsed = {}) {
    const sourceEntries = Array.isArray(parsed?.classEntries) && parsed.classEntries.length > 0
        ? parsed.classEntries
        : parseClassLine(classLine || "");

    return sourceEntries.map((entry) => ({
        className: String(entry?.className || "").trim(),
        level: Number(entry?.level) || 0,
        subclass: String(entry?.subclass || "").trim(),
        spellcastingAbility:
            String(entry?.spellcastingAbility || parsed?.spellcastingAbility || "").trim(),
        spellSaveDC:
            typeof entry?.spellSaveDC === "number"
                ? entry.spellSaveDC
                : (typeof parsed?.spellSaveDC === "number" ? parsed.spellSaveDC : undefined),
        spellAttackBonus:
            typeof entry?.spellAttackBonus === "number"
                ? entry.spellAttackBonus
                : (typeof parsed?.spellAttackBonus === "number" ? parsed.spellAttackBonus : undefined),
    }));
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
    character.class = classLine || "";
    character.classes = normalizeImportedClassEntries(classLine, parsed);

    const totalParsedLevel =
        character.classes.length > 0
            ? character.classes.reduce((sum, entry) => sum + (Number(entry.level) || 0), 0)
            : 0;

    character.level = Number(parsed?.level) || totalParsedLevel || Number(levelFromClassLine) || 0;

    if (character.classes.length > 0) {
        character.class = character.classes
            .map((entry) => `${entry.className} ${entry.level}`.trim())
            .join(" / ");
        character.subclass = parsed?.subclass || character.classes[0].subclass || "";
    } else {
        character.subclass = parsed?.subclass || "";
    }

    const primarySpellcastingEntry =
        character.classes.find(
            (entry) => entry.spellcastingAbility || entry.spellSaveDC !== undefined || entry.spellAttackBonus !== undefined
        ) || null;

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
    character.stats.spellcastingAbility =
        primarySpellcastingEntry?.spellcastingAbility ||
        parsed?.spellcastingAbility ||
        getField(parsed, "spellCastingAbility0");
    character.stats.spellSaveDC =
        primarySpellcastingEntry?.spellSaveDC ??
        parsed?.spellSaveDC ??
        toNumber(getField(parsed, "spellSaveDC0"));
    character.stats.spellAttackBonus =
        primarySpellcastingEntry?.spellAttackBonus ??
        parsed?.spellAttackBonus ??
        toNumber(getField(parsed, "spellAtkBonus0"));
    character.stats.passivePerception = parsed?.passivePerception ?? toNumber(getField(parsed, "Passive1"));
    character.stats.passiveInsight = parsed?.passiveInsight ?? toNumber(getField(parsed, "Passive2"));
    character.stats.passiveInvestigation = parsed?.passiveInvestigation ?? toNumber(getField(parsed, "Passive3"));
    character.stats.additionalSenses = parsed?.additionalSenses || getField(parsed, "AdditionalSenses");

    character.stats.saves = parsed?.saves || character.stats.saves || {};
    character.stats.skills = parsed?.skills || character.stats.skills || {};
    character.stats.defenses = parsed?.defenses || parseDefenses(getField(parsed, "Defenses")) || character.stats.defenses;

    character.proficiencies = parsed?.proficiencies || {
        ...character.proficiencies,
        ...parseProficiencies(getField(parsed, "ProficienciesLang")),
    };
    character.inventory = parsed?.inventory || {
        ...character.inventory,
        ...parseInventory(parsed),
    };

    const normalizedActionGroups = normalizeActionGroups(parsed?.actions);
    const parsedWeapons = parseWeapons(parsed);
    character.actions = {
        ...(character.actions || {}),
        weapons:
            normalizedActionGroups.weapons.length > 0
                ? normalizedActionGroups.weapons
                : parsedWeapons,
        actions: [],
        bonusActions: [],
        reactions: [],
        other: [],
    };

    character.features = [];
    character.feats = [];
    character.spells = [];
    character.spellcasting = Array.isArray(parsed?.spellcasting) ? parsed.spellcasting : (character.spellcasting || []);

    character.narrative = parsed?.narrative || {
        ...character.narrative,
        personalityTraits: getField(parsed, "PersonalityTraits"),
        ideals: getField(parsed, "Ideals"),
        bonds: getField(parsed, "Bonds"),
        flaws: getField(parsed, "Flaws"),
    };

    if (!Array.isArray(character.actions.weapons)) character.actions.weapons = [];
    if (!Array.isArray(character.actions.actions)) character.actions.actions = [];
    if (!Array.isArray(character.actions.bonusActions)) character.actions.bonusActions = [];
    if (!Array.isArray(character.actions.reactions)) character.actions.reactions = [];
    if (!Array.isArray(character.actions.other)) character.actions.other = [];

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
    if (character.class && !character.subclass && Array.isArray(parsed?.features) && parsed.features.length > 0) {
        draft.review.warnings.push("Subclass was not confidently mapped from imported features and may need manual review.");
    }

    if (draft.review.missingFields.length > 0) {
        draft.review.confidence = "low";
        draft.review.warnings.push("Some core fields are missing and need manual review.");
    }

    return draft;
}