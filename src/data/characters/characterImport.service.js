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

        // Extract only the reliable feature data needed for subclass detection
        const features = extractFeatures(fields);
        const feats = [];
        const actions = {
            weapons: [],
            actions: [],
            bonusActions: [],
            reactions: [],
            other: [],
        };

        const classLine = extractClassLineFromFieldsOrText(fields, parsed?.rawText || "");
        const subclassData = extractSubclassData(features, classLine);
        const spellcastingData = extractSpellcastingData(fields, subclassData.classEntries);
        const subclass = subclassData.primarySubclass;
        const saves = extractSaves(fields);
        const skills = extractSkills(fields);

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
            saves,
            skills,
            features,
            subclass,
            classEntries: subclassData.classEntries.map((entry) => {
                const spellcastingMatch = spellcastingData.entries.find(
                    (spellEntry) => spellEntry.className === entry.className
                );

                return {
                    ...entry,
                    spellcastingAbility: spellcastingMatch?.ability || "",
                    spellSaveDC: spellcastingMatch?.spellSaveDC,
                    spellAttackBonus: spellcastingMatch?.spellAttackBonus,
                };
            }),
            spellcasting: spellcastingData.entries,
            feats: [],
            actions,
            hpMax: Number(fields.MaxHP) || undefined,
            ac: Number(fields.AC) || undefined,
            initiativeMod: fields.Init || undefined,
            speed: fields.Speed || undefined,
            proficiencyBonus: fields.ProfBonus || undefined,
            passivePerception: Number(fields.Passive1) || undefined,
            passiveInsight: Number(fields.Passive2) || undefined,
            passiveInvestigation: Number(fields.Passive3) || undefined,
            additionalSenses: fields.AdditionalSenses || "",
            spellcastingAbility: spellcastingData.primarySpellcasting?.ability || "",
            spellSaveDC: spellcastingData.primarySpellcasting?.spellSaveDC,
            spellAttackBonus: spellcastingData.primarySpellcasting?.spellAttackBonus,
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

function extractFeatures(parsed) {
    const rawSections = [];

    for (let i = 1; i <= 6; i++) {
        const key = `FeaturesTraits${i}`;
        if (!parsed[key]) continue;
        rawSections.push(String(parsed[key] || "").trim());
    }

    if (rawSections.length === 0) return [];

    return rawSections
        .flatMap((section) => splitFeatureSectionEntries(section))
        .map((entry) => String(entry || "").trim())
        .filter(Boolean)
        .filter((entry) => !looksLikeFeatSectionMarker(entry))
        .filter((entry) => !looksLikeRawActionsSection(entry));
}

function splitFeatureSectionEntries(raw = "") {
    const text = String(raw || "").trim();
    if (!text) return [];

    const normalized = text
        .replace(/\r/g, "")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    const entries = [];
    let current = "";

    const lines = normalized
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

    const flush = () => {
        const value = current.trim();
        if (value) entries.push(value);
        current = "";
    };

    lines.forEach((line) => {
        if (looksLikeSectionHeader(line)) {
            flush();
            current = line;
            return;
        }

        if (looksLikeFeatureEntryStart(line)) {
            flush();
            current = line;
            return;
        }

        current = current ? `${current} ${line}` : line;
    });

    flush();

    return entries;
}

function looksLikeSectionHeader(line = "") {
    const value = String(line || "").trim();
    if (!value) return false;

    return (
        /^===\s*[^=]+\s*===$/i.test(value) ||
        /^(ARTIFICER|WARLOCK|WIZARD|CLERIC|DRUID|RANGER|PALADIN|BARD|ROGUE|FIGHTER|MONK|BARBARIAN|SORCERER) FEATURES$/i.test(value) ||
        /^(FEATS|ACTIONS|BONUS ACTIONS|REACTIONS|OTHER|LIMITED USE)$/i.test(value)
    );
}

function looksLikeFeatureEntryStart(line = "") {
    const value = String(line || "").trim();
    if (!value) return false;

    return (
        /^TCoE\s*\d+/i.test(value) ||
        /^XGtE\s*\d+/i.test(value) ||
        /^PHB[- ]?\d+/i.test(value) ||
        /^DMG\s*\d+/i.test(value) ||
        /^Legacy\s*[:\-]/i.test(value) ||
        /^[A-Z][A-Za-z'’()/:+\- ,]{2,60}\s*\|/i.test(value) ||
        /^[A-Z][A-Za-z'’()/:+\- ,]{2,60}\s*\(.*\)$/i.test(value)
    );
}

function looksLikeFeatSectionMarker(line = "") {
    return /^===\s*FEATS\s*===$/i.test(String(line || "").trim());
}

function looksLikeRawActionsSection(line = "") {
    const value = String(line || "").trim();
    return (
        /^===\s*ACTIONS\s*===$/i.test(value) ||
        /^===\s*BONUS ACTIONS\s*===$/i.test(value) ||
        /^===\s*REACTIONS\s*===$/i.test(value) ||
        /^===\s*OTHER\s*===$/i.test(value) ||
        /^===\s*LIMITED USE\s*===$/i.test(value)
    );
}

function normalizeSubclassCandidate(value = "") {
    return String(value || "")
        .replace(/\s+/g, " ")
        .replace(/^[:\-–—|]+/, "")
        .trim();
}

function isLikelyValidSubclassName(value = "") {
    const candidate = normalizeSubclassCandidate(value);
    if (!candidate) return false;

    if (candidate.length > 60) return false;
    if (/[.!?]/.test(candidate)) return false;
    if ((candidate.match(/,/g) || []).length > 1) return false;

    const words = candidate.split(/\s+/).filter(Boolean);
    if (words.length > 8) return false;

    const forbiddenFragments = [
        "when you",
        "as a bonus action",
        "as an action",
        "you can use",
        "you gain",
        "you have",
        "you know",
        "you learn",
        "your speed",
        "hit points",
        "saving throw",
        "creature",
        "rest",
        "damage",
        "attack roll",
        "spell slot",
        "proficiency bonus",
    ];

    const lowered = candidate.toLowerCase();
    if (forbiddenFragments.some((fragment) => lowered.includes(fragment))) {
        return false;
    }

    return true;
}

function extractSubclassForClass(features = [], className = "") {
    const joined = Array.isArray(features)
        ? features.map((entry) => String(entry || "").trim()).join(" ")
        : String(features || "");

    if (!joined.trim() || !className) return "";

    const escapedClassName = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const classSpecificPatterns = {
        Artificer: [
            /Artificer Specialist[\s\S]*?\|\s*([^*|]+?)(?=\s*\*|\s*\||$)/i,
            /Artificer Subclass[\s\S]*?\|\s*([^*|]+?)(?=\s*\*|\s*\||$)/i,
        ],
        Warlock: [
            /Otherworldly Patron[\s\S]*?\|\s*([^*|]+?)(?=\s*\*|\s*\||$)/i,
            /Warlock Subclass[\s\S]*?\|\s*([^*|]+?)(?=\s*\*|\s*\||$)/i,
        ],
        Cleric: [
            /Cleric Subclass[\s\S]*?\|\s*([^*|]+?)(?=\s*\*|\s*\||$)/i,
            /Divine Domain[\s\S]*?\|\s*([^*|]+?)(?=\s*\*|\s*\||$)/i,
        ],
        Sorcerer: [
            /Sorcerer Subclass[\s\S]*?\|\s*([^*|]+?)(?=\s*\*|\s*\||$)/i,
            /Sorcerous Origin[\s\S]*?\|\s*([^*|]+?)(?=\s*\*|\s*\||$)/i,
        ],
        Druid: [
            /Druid Subclass[\s\S]*?\|\s*([^*|]+?)(?=\s*\*|\s*\||$)/i,
            /Druid Circle[\s\S]*?\|\s*([^*|]+?)(?=\s*\*|\s*\||$)/i,
            /Circle of[\s\S]*?\|\s*([^*|]+?)(?=\s*\*|\s*\||$)/i,
        ],
        Ranger: [
            /Ranger Subclass[\s\S]*?\|\s*([^*|]+?)(?=\s*\*|\s*\||$)/i,
            /Hunter Conclave[\s\S]*?\|\s*([^*|]+?)(?=\s*\*|\s*\||$)/i,
        ],
    };

    const genericPatterns = [
        new RegExp(`${escapedClassName}\\s+Subclass[\\s\\S]*?\\|\\s*([^*|]+?)(?=\\s*\\*|\\s*\\||$)`, "i"),
        new RegExp(`${escapedClassName}\\s+[A-Z][A-Za-z' -]{1,40}?\\s*\\|\\s*([^*|]+?)(?=\\s*\\*|\\s*\\||$)`, "i"),
    ];

    const patterns = [
        ...(classSpecificPatterns[className] || []),
        ...genericPatterns,
    ];

    for (const pattern of patterns) {
        const match = joined.match(pattern);
        const candidate = normalizeSubclassCandidate(match?.[1] || "");
        if (isLikelyValidSubclassName(candidate)) {
            return candidate;
        }
    }

    return "";
}

function extractSubclass(features = []) {
    const joined = Array.isArray(features)
        ? features.map((entry) => String(entry || "").trim()).join(" ")
        : String(features || "");

    if (!joined.trim()) return "";

    const patterns = [
        /Artificer Specialist[\s\S]*?\|\s*([^*|]+?)(?=\s*\*|\s*\||$)/i,
        /Otherworldly Patron[\s\S]*?\|\s*([^*|]+?)(?=\s*\*|\s*\||$)/i,
        /Sorcerer Subclass[\s\S]*?\|\s*([^*|]+?)(?=\s*\*|\s*\||$)/i,
        /Sorcerous Origin[\s\S]*?\|\s*([^*|]+?)(?=\s*\*|\s*\||$)/i,
        /Cleric Subclass[\s\S]*?\|\s*([^*|]+?)(?=\s*\*|\s*\||$)/i,
        /Divine Domain[\s\S]*?\|\s*([^*|]+?)(?=\s*\*|\s*\||$)/i,
        /Warlock Subclass[\s\S]*?\|\s*([^*|]+?)(?=\s*\*|\s*\||$)/i,
        /Wizard Subclass[\s\S]*?\|\s*([^*|]+?)(?=\s*\*|\s*\||$)/i,
        /Druid Subclass[\s\S]*?\|\s*([^*|]+?)(?=\s*\*|\s*\||$)/i,
        /Druid Circle[\s\S]*?\|\s*([^*|]+?)(?=\s*\*|\s*\||$)/i,
        /Bard Subclass[\s\S]*?\|\s*([^*|]+?)(?=\s*\*|\s*\||$)/i,
        /Fighter Subclass[\s\S]*?\|\s*([^*|]+?)(?=\s*\*|\s*\||$)/i,
        /Rogue Subclass[\s\S]*?\|\s*([^*|]+?)(?=\s*\*|\s*\||$)/i,
        /Paladin Subclass[\s\S]*?\|\s*([^*|]+?)(?=\s*\*|\s*\||$)/i,
        /Ranger Subclass[\s\S]*?\|\s*([^*|]+?)(?=\s*\*|\s*\||$)/i,
        /Barbarian Subclass[\s\S]*?\|\s*([^*|]+?)(?=\s*\*|\s*\||$)/i,
        /Monk Subclass[\s\S]*?\|\s*([^*|]+?)(?=\s*\*|\s*\||$)/i,
    ];

    for (const pattern of patterns) {
        const match = joined.match(pattern);
        const candidate = normalizeSubclassCandidate(match?.[1] || "");
        if (isLikelyValidSubclassName(candidate)) {
            return candidate;
        }
    }

    return "";
}

function parseClassLineEntries(classLine = "") {
    return String(classLine || "")
        .split("/")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
            const match = part.match(/^(.*?)\s+(\d+)$/);
            if (!match) {
                return {
                    className: part,
                    level: 0,
                };
            }

            return {
                className: match[1].trim(),
                level: Number(match[2]) || 0,
            };
        });
}

function extractSubclassData(features = [], classLine = "") {
    const classEntries = parseClassLineEntries(classLine).map((entry) => ({
        ...entry,
        subclass: extractSubclassForClass(features, entry.className),
    }));

    return {
        classEntries,
        primarySubclass: classEntries.find((entry) => entry.subclass)?.subclass || extractSubclass(features),
    };
}

function splitSlashValues(value = "") {
    return String(value || "")
        .split("/")
        .map((part) => part.trim())
        .filter(Boolean);
}

function normalizeSpellcastingAbility(value = "") {
    const raw = String(value || "").trim().toUpperCase();
    if (!raw) return "";

    if (raw.includes("INT")) return "INT";
    if (raw.includes("WIS")) return "WIS";
    if (raw.includes("CHA")) return "CHA";
    if (raw.includes("STR")) return "STR";
    if (raw.includes("DEX")) return "DEX";
    if (raw.includes("CON")) return "CON";

    return raw;
}

function extractSpellcastingData(fields = {}, classEntries = []) {
    const classNames = splitSlashValues(fields.spellCastingClass0);
    const abilityValues = splitSlashValues(fields.spellCastingAbility0).map(normalizeSpellcastingAbility);
    const saveDcValues = splitSlashValues(fields.spellSaveDC0).map(parseSignedNumber);
    const attackBonusValues = splitSlashValues(fields.spellAtkBonus0).map(parseSignedNumber);

    const fallbackClassNames = Array.isArray(classEntries)
        ? classEntries.map((entry) => String(entry?.className || "").trim()).filter(Boolean)
        : [];

    const resolvedClassNames = classNames.length > 0 ? classNames : fallbackClassNames;
    const maxLength = Math.max(
        resolvedClassNames.length,
        abilityValues.length,
        saveDcValues.length,
        attackBonusValues.length
    );

    const entries = Array.from({ length: maxLength }, (_, index) => {
        const className = resolvedClassNames[index] || fallbackClassNames[index] || "";
        const ability = abilityValues[index] || "";
        const spellSaveDC = saveDcValues[index];
        const spellAttackBonus = attackBonusValues[index];

        if (!className && !ability && spellSaveDC === undefined && spellAttackBonus === undefined) {
            return null;
        }

        return {
            className,
            ability,
            spellSaveDC,
            spellAttackBonus,
        };
    }).filter(Boolean);

    return {
        entries,
        primarySpellcasting: entries[0] || null,
    };
}

function parseSignedNumber(value) {
    const raw = String(value || "").trim();
    if (!raw) return undefined;

    const normalized = raw.replace(/[^\d+-]/g, "");
    if (!normalized) return undefined;

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function parseProficiencyFlag(value) {
    const raw = String(value || "").trim().toUpperCase();
    return raw === "P" || raw === "E" || raw === "•";
}

function parseExpertiseFlag(value) {
    return String(value || "").trim().toUpperCase() === "E";
}

function extractSaves(fields = {}) {
    return {
        strength: {
            mod: parseSignedNumber(fields["ST Strength"]),
            proficient: parseProficiencyFlag(fields["StrProf"]),
        },
        dexterity: {
            mod: parseSignedNumber(fields["ST Dexterity"]),
            proficient: parseProficiencyFlag(fields["DexProf"]),
        },
        constitution: {
            mod: parseSignedNumber(fields["ST Constitution"]),
            proficient: parseProficiencyFlag(fields["ConProf"]),
        },
        intelligence: {
            mod: parseSignedNumber(fields["ST Intelligence"]),
            proficient: parseProficiencyFlag(fields["IntProf"]),
        },
        wisdom: {
            mod: parseSignedNumber(fields["ST Wisdom"]),
            proficient: parseProficiencyFlag(fields["WisProf"]),
        },
        charisma: {
            mod: parseSignedNumber(fields["ST Charisma"]),
            proficient: parseProficiencyFlag(fields["ChaProf"]),
        },
    };
}

function extractSkills(fields = {}) {
    return {
        acrobatics: {
            mod: parseSignedNumber(fields["Acrobatics"]),
            proficient: parseProficiencyFlag(fields["AcrobaticsProf"]),
            expertise: parseExpertiseFlag(fields["AcrobaticsProf"]),
            ability: "DEX",
        },
        animalHandling: {
            mod: parseSignedNumber(fields["Animal"]),
            proficient: parseProficiencyFlag(fields["AnimalHandlingProf"]),
            expertise: parseExpertiseFlag(fields["AnimalHandlingProf"]),
            ability: "WIS",
        },
        arcana: {
            mod: parseSignedNumber(fields["Arcana"]),
            proficient: parseProficiencyFlag(fields["ArcanaProf"]),
            expertise: parseExpertiseFlag(fields["ArcanaProf"]),
            ability: "INT",
        },
        athletics: {
            mod: parseSignedNumber(fields["Athletics"]),
            proficient: parseProficiencyFlag(fields["AthleticsProf"]),
            expertise: parseExpertiseFlag(fields["AthleticsProf"]),
            ability: "STR",
        },
        deception: {
            mod: parseSignedNumber(fields["Deception"]),
            proficient: parseProficiencyFlag(fields["DeceptionProf"]),
            expertise: parseExpertiseFlag(fields["DeceptionProf"]),
            ability: "CHA",
        },
        history: {
            mod: parseSignedNumber(fields["History"]),
            proficient: parseProficiencyFlag(fields["HistoryProf"]),
            expertise: parseExpertiseFlag(fields["HistoryProf"]),
            ability: "INT",
        },
        insight: {
            mod: parseSignedNumber(fields["Insight"]),
            proficient: parseProficiencyFlag(fields["InsightProf"]),
            expertise: parseExpertiseFlag(fields["InsightProf"]),
            ability: "WIS",
        },
        intimidation: {
            mod: parseSignedNumber(fields["Intimidation"]),
            proficient: parseProficiencyFlag(fields["IntimidationProf"]),
            expertise: parseExpertiseFlag(fields["IntimidationProf"]),
            ability: "CHA",
        },
        investigation: {
            mod: parseSignedNumber(fields["Investigation"]),
            proficient: parseProficiencyFlag(fields["InvestigationProf"]),
            expertise: parseExpertiseFlag(fields["InvestigationProf"]),
            ability: "INT",
        },
        medicine: {
            mod: parseSignedNumber(fields["Medicine"]),
            proficient: parseProficiencyFlag(fields["MedicineProf"]),
            expertise: parseExpertiseFlag(fields["MedicineProf"]),
            ability: "WIS",
        },
        nature: {
            mod: parseSignedNumber(fields["Nature"]),
            proficient: parseProficiencyFlag(fields["NatureProf"]),
            expertise: parseExpertiseFlag(fields["NatureProf"]),
            ability: "INT",
        },
        perception: {
            mod: parseSignedNumber(fields["Perception"]),
            proficient: parseProficiencyFlag(fields["PerceptionProf"]),
            expertise: parseExpertiseFlag(fields["PerceptionProf"]),
            ability: "WIS",
        },
        performance: {
            mod: parseSignedNumber(fields["Performance"]),
            proficient: parseProficiencyFlag(fields["PerformanceProf"]),
            expertise: parseExpertiseFlag(fields["PerformanceProf"]),
            ability: "CHA",
        },
        persuasion: {
            mod: parseSignedNumber(fields["Persuasion"]),
            proficient: parseProficiencyFlag(fields["PersuasionProf"]),
            expertise: parseExpertiseFlag(fields["PersuasionProf"]),
            ability: "CHA",
        },
        religion: {
            mod: parseSignedNumber(fields["Religion"]),
            proficient: parseProficiencyFlag(fields["ReligionProf"]),
            expertise: parseExpertiseFlag(fields["ReligionProf"]),
            ability: "INT",
        },
        sleightOfHand: {
            mod: parseSignedNumber(fields["SleightofHand"]),
            proficient: parseProficiencyFlag(fields["SleightOfHandProf"]),
            expertise: parseExpertiseFlag(fields["SleightOfHandProf"]),
            ability: "DEX",
        },
        stealth: {
            mod: parseSignedNumber(fields["Stealth"]),
            proficient: parseProficiencyFlag(fields["StealthProf"]),
            expertise: parseExpertiseFlag(fields["StealthProf"]),
            ability: "DEX",
        },
        survival: {
            mod: parseSignedNumber(fields["Survival"]),
            proficient: parseProficiencyFlag(fields["SurvivalProf"]),
            expertise: parseExpertiseFlag(fields["SurvivalProf"]),
            ability: "WIS",
        },
    };
}