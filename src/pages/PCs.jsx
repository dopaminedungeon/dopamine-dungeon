import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { getAllCharacters, upsertCharacter } from "../data/characters/characters.repo";
import { importCharacterFromDdbPdf } from "../data/characters/characterImport.service";
import { useCampaign } from "../context/CampaignContext";
import { useMode } from "../context/ModeContext";
import { useAuth } from "../context/AuthContext";

function createManualPcDraft() {
  return {
    name: "",
    playerName: "",
    race: "",
    class: "",
    subclass: "",
    level: 1,
    alignment: "",
    background: "",
    publicNotes: "",
    visibility: "player",
    isPlayerVisible: true,
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

const importSkillConfig = [
  { key: "acrobatics", label: "Acrobatics", ability: "DEX" },
  { key: "animalHandling", label: "Animal Handling", ability: "WIS" },
  { key: "arcana", label: "Arcana", ability: "INT" },
  { key: "athletics", label: "Athletics", ability: "STR" },
  { key: "deception", label: "Deception", ability: "CHA" },
  { key: "history", label: "History", ability: "INT" },
  { key: "insight", label: "Insight", ability: "WIS" },
  { key: "intimidation", label: "Intimidation", ability: "CHA" },
  { key: "investigation", label: "Investigation", ability: "INT" },
  { key: "medicine", label: "Medicine", ability: "WIS" },
  { key: "nature", label: "Nature", ability: "INT" },
  { key: "perception", label: "Perception", ability: "WIS" },
  { key: "performance", label: "Performance", ability: "CHA" },
  { key: "persuasion", label: "Persuasion", ability: "CHA" },
  { key: "religion", label: "Religion", ability: "INT" },
  { key: "sleightOfHand", label: "Sleight of Hand", ability: "DEX" },
  { key: "stealth", label: "Stealth", ability: "DEX" },
  { key: "survival", label: "Survival", ability: "WIS" },
];

const importSaveConfig = [
  { key: "strength", label: "Strength", ability: "STR" },
  { key: "dexterity", label: "Dexterity", ability: "DEX" },
  { key: "constitution", label: "Constitution", ability: "CON" },
  { key: "intelligence", label: "Intelligence", ability: "INT" },
  { key: "wisdom", label: "Wisdom", ability: "WIS" },
  { key: "charisma", label: "Charisma", ability: "CHA" },
];

function toOptionalNumber(value) {
  if (value === "" || value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getAbilityModifier(score) {
  if (typeof score !== "number" || Number.isNaN(score)) return undefined;
  return Math.floor((score - 10) / 2);
}

function buildDerivedImportSaves(existingSaves = {}, abilityScores = {}, proficiencyBonus = 0) {
  const abilityMap = {
    strength: "str",
    dexterity: "dex",
    constitution: "con",
    intelligence: "int",
    wisdom: "wis",
    charisma: "cha",
  };

  return Object.fromEntries(
    Object.entries(abilityMap).map(([saveKey, abilityKey]) => {
      const existing = existingSaves?.[saveKey] || {};
      const score = abilityScores?.[abilityKey]?.score;
      const abilityMod = getAbilityModifier(score);
      const proficient = !!existing.proficient;
      const mod =
        typeof abilityMod === "number"
          ? abilityMod + (proficient ? proficiencyBonus : 0)
          : existing.mod;

      return [
        saveKey,
        {
          ...existing,
          proficient,
          mod,
        },
      ];
    })
  );
}

function buildDerivedImportSkills(existingSkills = {}, abilityScores = {}, proficiencyBonus = 0) {
  const abilityMap = {
    acrobatics: "dex",
    animalHandling: "wis",
    arcana: "int",
    athletics: "str",
    deception: "cha",
    history: "int",
    insight: "wis",
    intimidation: "cha",
    investigation: "int",
    medicine: "wis",
    nature: "int",
    perception: "wis",
    performance: "cha",
    persuasion: "cha",
    religion: "int",
    sleightOfHand: "dex",
    stealth: "dex",
    survival: "wis",
  };

  return Object.fromEntries(
    Object.entries(abilityMap).map(([skillKey, abilityKey]) => {
      const existing = existingSkills?.[skillKey] || {};
      const score = abilityScores?.[abilityKey]?.score;
      const abilityMod = getAbilityModifier(score);
      const proficient = !!existing.proficient;
      const expertise = !!existing.expertise;
      const proficiencyMultiplier = expertise ? 2 : proficient ? 1 : 0;
      const mod =
        typeof abilityMod === "number"
          ? abilityMod + proficiencyBonus * proficiencyMultiplier
          : existing.mod;

      return [
        skillKey,
        {
          ...existing,
          proficient,
          expertise,
          mod,
        },
      ];
    })
  );
}

function normalizeImportedSpellcastingEntries(entries = []) {
  if (!Array.isArray(entries)) return [];

  return entries
    .map((entry) => ({
      className: String(entry?.className || "").trim(),
      ability: String(entry?.ability || entry?.spellcastingAbility || "").trim().toUpperCase(),
      spellSaveDC: entry?.spellSaveDC ?? "",
      spellAttackBonus: entry?.spellAttackBonus ?? "",
    }))
    .filter(
      (entry) =>
        entry.className ||
        entry.ability ||
        entry.spellSaveDC !== "" ||
        entry.spellAttackBonus !== ""
    );
}

function buildImportedClassSpellcasting(classEntries = [], fallbackStats = {}, fallbackSpellcasting = []) {
  const normalizedSpellcasting = normalizeImportedSpellcastingEntries(fallbackSpellcasting);

  return Array.isArray(classEntries)
    ? classEntries.map((entry, index) => {
      const className = String(entry?.className || "").trim();
      const spellcastingMatch = normalizedSpellcasting.find(
        (spellEntry) => spellEntry.className === className
      );

      return {
        ...entry,
        className,
        level: Number(entry?.level) || 0,
        subclass: String(entry?.subclass || "").trim(),
        spellcastingAbility:
          String(
            spellcastingMatch?.ability ||
            entry?.spellcastingAbility ||
            (index === 0 ? fallbackStats?.spellcastingAbility || "" : "")
          )
            .trim()
            .toUpperCase(),
        spellSaveDC:
          spellcastingMatch?.spellSaveDC ??
          entry?.spellSaveDC ??
          (index === 0 ? fallbackStats?.spellSaveDC ?? "" : ""),
        spellAttackBonus:
          spellcastingMatch?.spellAttackBonus ??
          entry?.spellAttackBonus ??
          (index === 0 ? fallbackStats?.spellAttackBonus ?? "" : ""),
      };
    })
    : [];
}

function hasMultipleSpellcastingTracks(character) {
  return normalizeImportedSpellcastingEntries(character?.spellcasting).length > 1;
}

const PCs = () => {
  const { selectedCampaignId } = useCampaign();
  const { mode } = useMode();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [pcs, setPcs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPc, setNewPc] = useState(createManualPcDraft());
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [showImportReviewModal, setShowImportReviewModal] = useState(false);
  const [importDraft, setImportDraft] = useState(null);
  const [isSavingImportDraft, setIsSavingImportDraft] = useState(false);
  const [importReviewTab, setImportReviewTab] = useState("core");
  const [importTargetCharacterId, setImportTargetCharacterId] = useState("");
  const importInputRef = useRef(null);

  useEffect(() => {
    const loadCharacters = async () => {
      if (!selectedCampaignId) {
        setPcs([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const characters = await getAllCharacters(selectedCampaignId);
        setPcs(characters);
      } catch (error) {
        console.error("[PCs] Failed to load characters", error);
        setPcs([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadCharacters();
  }, [selectedCampaignId, mode, user?.uid]);

  const isGMMode = String(mode).toLowerCase() === "gm";

  const refreshCharacters = async () => {
    if (!selectedCampaignId) {
      setPcs([]);
      return;
    }

    const characters = await getAllCharacters(selectedCampaignId);
    setPcs(characters);
  };

	  const handleCreatePc = async (e) => {
	    e.preventDefault();
	    if (isSaving || !selectedCampaignId || !newPc.name.trim()) return;

    try {
      setIsSaving(true);

      const level = Math.max(1, Number(newPc.level) || 1);
      const characterToSave = {
        ...newPc,
        name: newPc.name.trim(),
        playerName: newPc.playerName.trim(),
        race: newPc.race.trim(),
        class: newPc.class.trim(),
        subclass: newPc.subclass.trim(),
        alignment: newPc.alignment.trim(),
        background: newPc.background.trim(),
        publicNotes: newPc.publicNotes.trim(),
        level,
        classes: newPc.class.trim()
          ? [
            {
              className: newPc.class.trim(),
              level,
              subclass: newPc.subclass.trim(),
              spellcastingAbility: "",
            },
          ]
          : [],
        visibility: newPc.visibility,
        isPlayerVisible: newPc.visibility === "player",
        ownerUserId: user?.uid || "",
      };

      await upsertCharacter(selectedCampaignId, characterToSave);
      await refreshCharacters();
      setShowCreateModal(false);
      setNewPc(createManualPcDraft());
    } catch (error) {
      console.error("[PCs] Failed to create character", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenImportPicker = () => {
    setImportMessage("");
    setImportDraft(null);
    setShowImportReviewModal(false);
    importInputRef.current?.click();
  };

  const handleImportPdf = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      setImportMessage("");

      const result = await importCharacterFromDdbPdf(file);

      if (!result?.ok || !result?.draft) {
        throw new Error(result?.error || "Failed to prepare character import draft.");
      }

      const mappedDraft = {
        sourceFileName: result.draft?.character?.importMeta?.filename || file.name,
        character: (() => {
          const c = result.draft?.character || {};
          const primaryClass =
            Array.isArray(c.classes) && c.classes.length > 0 ? c.classes[0] : null;

          return {
            name: c.name || "",
            race: c.race || "",
            spellcasting: normalizeImportedSpellcastingEntries(c.spellcasting),
            classes: buildImportedClassSpellcasting(
              Array.isArray(c.classes) ? c.classes : [],
              c.stats || {},
              c.spellcasting || []
            ),
            class:
              Array.isArray(c.classes) && c.classes.length > 0
                ? c.classes.map((entry) => `${entry.className} ${entry.level}`.trim()).join(" / ")
                : c.class || "",
            subclass: primaryClass?.subclass || c.subclass || "",
            level:
              Array.isArray(c.classes) && c.classes.length > 0
                ? c.classes.reduce((sum, entry) => sum + (Number(entry.level) || 0), 0)
                : c.level || 1,
            background: c.background || "",
            alignment: c.alignment || "",
            playerName: c.playerName || "",
            publicNotes: c.publicNotes || "",

            identity: {
              faith: c.identity?.faith || "",
              size: c.identity?.size || "",
              age: c.age || c.identity?.age || "",
              height: c.identity?.height || "",
              weight: c.identity?.weight || "",
              gender: c.identity?.gender || "",
              eyes: c.identity?.eyes || "",
              hair: c.identity?.hair || "",
              skin: c.identity?.skin || "",
            },

            stats: {
              hpMax: c.stats?.hpMax ?? "",
              ac: c.stats?.ac ?? "",
              speed: c.stats?.speed ?? "",
              initiativeMod: c.stats?.initiativeMod ?? "",
              proficiencyBonus: c.stats?.proficiencyBonus ?? "",
              spellcastingAbility:
                normalizeImportedSpellcastingEntries(c.spellcasting)[0]?.ability ||
                c.stats?.spellcastingAbility ||
                "",
              spellSaveDC:
                normalizeImportedSpellcastingEntries(c.spellcasting)[0]?.spellSaveDC ??
                c.stats?.spellSaveDC ??
                "",
              spellAttackBonus:
                normalizeImportedSpellcastingEntries(c.spellcasting)[0]?.spellAttackBonus ??
                c.stats?.spellAttackBonus ??
                "",
              passivePerception: c.stats?.passivePerception ?? "",
              passiveInsight: c.stats?.passiveInsight ?? "",
              passiveInvestigation: c.stats?.passiveInvestigation ?? "",
              additionalSenses: c.stats?.additionalSenses || "",
              abilities: {
                str: c.stats?.abilities?.str?.score ?? "",
                dex: c.stats?.abilities?.dex?.score ?? "",
                con: c.stats?.abilities?.con?.score ?? "",
                int: c.stats?.abilities?.int?.score ?? "",
                wis: c.stats?.abilities?.wis?.score ?? "",
                cha: c.stats?.abilities?.cha?.score ?? "",
              },
              saves: c.stats?.saves || {},
              skills: c.stats?.skills || {},
            },

            inventory: {
              currency: {
                cp: c.inventory?.currency?.cp ?? 0,
                sp: c.inventory?.currency?.sp ?? 0,
                ep: c.inventory?.currency?.ep ?? 0,
                gp: c.inventory?.currency?.gp ?? 0,
                pp: c.inventory?.currency?.pp ?? 0,
              },
              equipment: Array.isArray(c.inventory?.equipment) ? c.inventory.equipment : [],
            },

            actions: {
              weapons: Array.isArray(c.actions?.weapons) ? c.actions.weapons : [],
              actions: Array.isArray(c.actions?.actions) ? c.actions.actions : [],
              bonusActions: Array.isArray(c.actions?.bonusActions) ? c.actions.bonusActions : [],
              reactions: Array.isArray(c.actions?.reactions) ? c.actions.reactions : [],
              other: Array.isArray(c.actions?.other) ? c.actions.other : [],
            },

            features: Array.isArray(c.features) ? c.features : [],
            feats: Array.isArray(c.feats) ? c.feats : [],

            spells: Array.isArray(c.spells) ? c.spells : [],

            proficiencies: {
              armor: Array.isArray(c.proficiencies?.armor) ? c.proficiencies.armor : [],
              weapons: Array.isArray(c.proficiencies?.weapons) ? c.proficiencies.weapons : [],
              tools: Array.isArray(c.proficiencies?.tools) ? c.proficiencies.tools : [],
              languages: Array.isArray(c.proficiencies?.languages) ? c.proficiencies.languages : [],
            },

            narrative: {
              personalityTraits: c.narrative?.personalityTraits || "",
              ideals: c.narrative?.ideals || "",
              bonds: c.narrative?.bonds || "",
              flaws: c.narrative?.flaws || "",
            },
          };
        })(),
        review: {
          confidence: result.draft?.review?.confidence || "medium",
          warnings: Array.isArray(result.draft?.review?.warnings)
            ? result.draft.review.warnings
            : [],
          missingFields: Array.isArray(result.draft?.review?.missingFields)
            ? result.draft.review.missingFields
            : [],
        },
      };

      setImportDraft(mappedDraft);

      const normalizedImportedName = String(mappedDraft.character?.name || "").trim().toLowerCase();
      const suggestedExistingCharacter = normalizedImportedName
        ? pcs.find((pc) => String(pc?.name || "").trim().toLowerCase() === normalizedImportedName)
        : null;

      setImportTargetCharacterId(suggestedExistingCharacter?.id || "");
      setImportReviewTab("core");
      setShowImportReviewModal(true);
      setImportMessage(
        `Import draft prepared for ${mappedDraft.sourceFileName}. Review the character before saving.`
      );
    } catch (error) {
      console.error("[PCs] Failed to start PDF import", error);
      setImportMessage("Failed to start PDF import.");
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  };

  const handleCloseImportReview = () => {
    setShowImportReviewModal(false);
    setImportDraft(null);
    setImportReviewTab("core");
    setImportTargetCharacterId("");
  };

	  const handleCreateImportedPc = async () => {
	    if (isSavingImportDraft || !selectedCampaignId || !importDraft?.character?.name?.trim()) return;

    try {
      setIsSavingImportDraft(true);

      const characterLevel = Math.max(1, Number(importDraft.character.level) || 1);
      const existingCharacter = importTargetCharacterId
        ? pcs.find((pc) => String(pc?.id || "") === String(importTargetCharacterId))
        : null;
      const importedCharacterToSave = {
        ...(existingCharacter || {}),
        ...(existingCharacter?.id ? { id: existingCharacter.id } : {}),
        name: importDraft.character.name.trim(),
        playerName: (importDraft.character.playerName || "").trim(),
        race: (importDraft.character.race || "").trim(),
        class:
          Array.isArray(importDraft.character.classes) && importDraft.character.classes.length > 0
            ? importDraft.character.classes.map((entry) => `${entry.className} ${entry.level}`.trim()).join(" / ")
            : (importDraft.character.class || "").trim(),
        subclass: (importDraft.character.subclass || "").trim(),
        level:
          Array.isArray(importDraft.character.classes) && importDraft.character.classes.length > 0
            ? importDraft.character.classes.reduce((sum, entry) => sum + (Number(entry.level) || 0), 0)
            : characterLevel,
        alignment: (importDraft.character.alignment || "").trim(),
        background: (importDraft.character.background || "").trim(),
        publicNotes:
          (importDraft.character.publicNotes || "").trim() ||
          (existingCharacter?.publicNotes || ""),
        visibility: existingCharacter?.visibility || "player",
        isPlayerVisible:
          typeof existingCharacter?.isPlayerVisible === "boolean"
            ? existingCharacter.isPlayerVisible
            : true,
        ownerUserId: existingCharacter?.ownerUserId || user?.uid || "",

        classes:
          Array.isArray(importDraft.character.classes) && importDraft.character.classes.length > 0
            ? importDraft.character.classes.map((entry, index) => ({
              ...entry,
              className: (entry.className || "").trim(),
              level: Number(entry.level) || 0,
              subclass:
                index === 0
                  ? ((entry.subclass || importDraft.character.subclass || "").trim())
                  : ((entry.subclass || "").trim()),
              spellcastingAbility:
                (entry.spellcastingAbility || importDraft.character.stats?.spellcastingAbility || "")
                  .trim()
                  .toUpperCase(),
              spellSaveDC: toOptionalNumber(entry.spellSaveDC),
              spellAttackBonus: toOptionalNumber(entry.spellAttackBonus),
            }))
            : importDraft.character.class?.trim()
              ? [
                {
                  className: importDraft.character.class.trim(),
                  level: characterLevel,
                  subclass: (importDraft.character.subclass || "").trim(),
                  spellcastingAbility:
                    (importDraft.character.stats?.spellcastingAbility || "").trim().toUpperCase(),
                  spellSaveDC: toOptionalNumber(importDraft.character.stats?.spellSaveDC),
                  spellAttackBonus: toOptionalNumber(importDraft.character.stats?.spellAttackBonus),
                },
              ]
              : [],

        identity: {
          faith: (importDraft.character.identity?.faith || "").trim(),
          size: (importDraft.character.identity?.size || "").trim(),
          height: (importDraft.character.identity?.height || "").trim(),
          weight: (importDraft.character.identity?.weight || "").trim(),
          gender: (importDraft.character.identity?.gender || "").trim(),
          eyes: (importDraft.character.identity?.eyes || "").trim(),
          hair: (importDraft.character.identity?.hair || "").trim(),
          skin: (importDraft.character.identity?.skin || "").trim(),
        },

        stats: (() => {
          const nextAbilityScores = {
            str: {
              score: toOptionalNumber(importDraft.character.stats?.abilities?.str),
            },
            dex: {
              score: toOptionalNumber(importDraft.character.stats?.abilities?.dex),
            },
            con: {
              score: toOptionalNumber(importDraft.character.stats?.abilities?.con),
            },
            int: {
              score: toOptionalNumber(importDraft.character.stats?.abilities?.int),
            },
            wis: {
              score: toOptionalNumber(importDraft.character.stats?.abilities?.wis),
            },
            cha: {
              score: toOptionalNumber(importDraft.character.stats?.abilities?.cha),
            },
          };

          Object.keys(nextAbilityScores).forEach((key) => {
            nextAbilityScores[key] = {
              ...nextAbilityScores[key],
              mod: getAbilityModifier(nextAbilityScores[key]?.score),
            };
          });

          const nextProficiencyBonus =
            toOptionalNumber(importDraft.character.stats?.proficiencyBonus) ?? 0;
          const nextSaves = buildDerivedImportSaves(
            importDraft.character.stats?.saves || {},
            nextAbilityScores,
            nextProficiencyBonus
          );
          const nextSkills = buildDerivedImportSkills(
            importDraft.character.stats?.skills || {},
            nextAbilityScores,
            nextProficiencyBonus
          );
          const nextInitiative =
            toOptionalNumber(importDraft.character.stats?.initiativeMod) ??
            nextAbilityScores.dex?.mod;
          const nextPassivePerception =
            toOptionalNumber(importDraft.character.stats?.passivePerception) ??
            (typeof nextSkills.perception?.mod === "number"
              ? 10 + nextSkills.perception.mod
              : undefined);
          const nextPassiveInsight =
            toOptionalNumber(importDraft.character.stats?.passiveInsight) ??
            (typeof nextSkills.insight?.mod === "number"
              ? 10 + nextSkills.insight.mod
              : undefined);
          const nextPassiveInvestigation =
            toOptionalNumber(importDraft.character.stats?.passiveInvestigation) ??
            (typeof nextSkills.investigation?.mod === "number"
              ? 10 + nextSkills.investigation.mod
              : undefined);

          return {
            abilities: nextAbilityScores,
            saves: nextSaves,
            skills: nextSkills,
            hpMax: toOptionalNumber(importDraft.character.stats?.hpMax),
            hpCurrent:
              toOptionalNumber(importDraft.character.stats?.hpMax) || undefined,
            ac: toOptionalNumber(importDraft.character.stats?.ac),
            speed: String(importDraft.character.stats?.speed || "").trim(),
            initiativeMod: nextInitiative,
            proficiencyBonus: nextProficiencyBonus || undefined,
            spellcastingAbility:
              normalizeImportedSpellcastingEntries(importDraft.character.spellcasting)[0]?.ability ||
              (importDraft.character.stats?.spellcastingAbility || "").trim().toUpperCase(),
            spellSaveDC:
              toOptionalNumber(
                normalizeImportedSpellcastingEntries(importDraft.character.spellcasting)[0]?.spellSaveDC
              ) ?? toOptionalNumber(importDraft.character.stats?.spellSaveDC),
            spellAttackBonus:
              toOptionalNumber(
                normalizeImportedSpellcastingEntries(importDraft.character.spellcasting)[0]?.spellAttackBonus
              ) ?? toOptionalNumber(importDraft.character.stats?.spellAttackBonus),
            passivePerception: nextPassivePerception,
            passiveInsight: nextPassiveInsight,
            passiveInvestigation: nextPassiveInvestigation,
            additionalSenses:
              (importDraft.character.stats?.additionalSenses || "").trim(),
          };
        })(),

        spellcasting: normalizeImportedSpellcastingEntries(importDraft.character.spellcasting).map((entry) => ({
          className: entry.className,
          ability: entry.ability,
          spellSaveDC: toOptionalNumber(entry.spellSaveDC),
          spellAttackBonus: toOptionalNumber(entry.spellAttackBonus),
        })),

        inventory: {
          currency: {
            cp: Number(importDraft.character.inventory?.currency?.cp ?? 0),
            sp: Number(importDraft.character.inventory?.currency?.sp ?? 0),
            ep: Number(importDraft.character.inventory?.currency?.ep ?? 0),
            gp: Number(importDraft.character.inventory?.currency?.gp ?? 0),
            pp: Number(importDraft.character.inventory?.currency?.pp ?? 0),
          },
          equipment: Array.isArray(importDraft.character.inventory?.equipment)
            ? importDraft.character.inventory.equipment
              .map((item) => ({
                name: String(item?.name || "").trim(),
                qty: Number(item?.qty ?? 1),
                weight: item?.weight ?? "",
                attuned: !!item?.attuned,
              }))
              .filter((item) => item.name)
            : [],
        },

        proficiencies: {
          armor: Array.isArray(importDraft.character.proficiencies?.armor)
            ? importDraft.character.proficiencies.armor.filter(Boolean)
            : [],
          weapons: Array.isArray(importDraft.character.proficiencies?.weapons)
            ? importDraft.character.proficiencies.weapons.filter(Boolean)
            : [],
          tools: Array.isArray(importDraft.character.proficiencies?.tools)
            ? importDraft.character.proficiencies.tools.filter(Boolean)
            : [],
          languages: Array.isArray(importDraft.character.proficiencies?.languages)
            ? importDraft.character.proficiencies.languages.filter(Boolean)
            : [],
        },

        actions: {
          weapons: Array.isArray(importDraft.character.actions?.weapons)
            ? importDraft.character.actions.weapons
              .map((weapon) => ({
                name: String(weapon?.name || "").trim(),
                attackBonus: weapon?.attackBonus ?? "",
                damage: weapon?.damage ?? "",
                notes: weapon?.notes ?? "",
              }))
              .filter((weapon) => weapon.name)
            : [],
          actions: Array.isArray(importDraft.character.actions?.actions)
            ? importDraft.character.actions.actions
              .map((entry) =>
                typeof entry === "string"
                  ? { name: entry.trim(), description: entry.trim() }
                  : {
                    name: String(entry?.name || entry?.description || "").trim(),
                    description: String(entry?.description || entry?.name || "").trim(),
                  }
              )
              .filter((entry) => entry.name || entry.description)
            : [],
          bonusActions: Array.isArray(importDraft.character.actions?.bonusActions)
            ? importDraft.character.actions.bonusActions
              .map((entry) =>
                typeof entry === "string"
                  ? { name: entry.trim(), description: entry.trim() }
                  : {
                    name: String(entry?.name || entry?.description || "").trim(),
                    description: String(entry?.description || entry?.name || "").trim(),
                  }
              )
              .filter((entry) => entry.name || entry.description)
            : [],
          reactions: Array.isArray(importDraft.character.actions?.reactions)
            ? importDraft.character.actions.reactions
              .map((entry) =>
                typeof entry === "string"
                  ? { name: entry.trim(), description: entry.trim() }
                  : {
                    name: String(entry?.name || entry?.description || "").trim(),
                    description: String(entry?.description || entry?.name || "").trim(),
                  }
              )
              .filter((entry) => entry.name || entry.description)
            : [],
          other: Array.isArray(importDraft.character.actions?.other)
            ? importDraft.character.actions.other
              .map((entry) =>
                typeof entry === "string"
                  ? { name: entry.trim(), description: entry.trim() }
                  : {
                    name: String(entry?.name || entry?.description || "").trim(),
                    description: String(entry?.description || entry?.name || "").trim(),
                  }
              )
              .filter((entry) => entry.name || entry.description)
            : [],
        },

        features: Array.isArray(importDraft.character.features)
          ? importDraft.character.features
            .map((entry) =>
              typeof entry === "string"
                ? { name: entry.trim(), description: entry.trim() }
                : {
                  name: String(entry?.name || entry?.description || "").trim(),
                  description: String(entry?.description || entry?.name || "").trim(),
                }
            )
            .filter((entry) => entry.name || entry.description)
          : [],

        feats: Array.isArray(importDraft.character.feats)
          ? importDraft.character.feats
            .map((entry) =>
              typeof entry === "string"
                ? { name: entry.trim(), description: entry.trim() }
                : {
                  name: String(entry?.name || entry?.description || "").trim(),
                  description: String(entry?.description || entry?.name || "").trim(),
                }
            )
            .filter((entry) => entry.name || entry.description)
          : [],

        spells: Array.isArray(importDraft.character.spells)
          ? importDraft.character.spells
            .map((spell) => ({
              name: String(spell?.name || "").trim(),
              className: spell?.className ?? "",
              source: spell?.source ?? "",
              saveHit: spell?.saveHit ?? "",
              castingTime: spell?.castingTime ?? "",
              range: spell?.range ?? "",
              components: spell?.components ?? "",
              duration: spell?.duration ?? "",
              page: spell?.page ?? "",
              notes: spell?.notes ?? "",
            }))
            .filter((spell) => spell.name)
          : [],

        narrative: {
          personalityTraits:
            (importDraft.character.narrative?.personalityTraits || "").trim(),
          ideals: (importDraft.character.narrative?.ideals || "").trim(),
          bonds: (importDraft.character.narrative?.bonds || "").trim(),
          flaws: (importDraft.character.narrative?.flaws || "").trim(),
        },

        importMeta: {
          source: "dndbeyond-pdf",
          importedAt: new Date().toISOString(),
          filename: importDraft.sourceFileName || "",
          warnings: Array.isArray(importDraft.review?.warnings)
            ? importDraft.review.warnings
            : [],
          confidence: importDraft.review?.confidence || "medium",
        },
      };

      await upsertCharacter(selectedCampaignId, importedCharacterToSave);
      await refreshCharacters();
      setShowImportReviewModal(false);
      setImportDraft(null);
      setImportReviewTab("core");
      setImportTargetCharacterId("");
      setImportMessage(
        existingCharacter
          ? `Updated ${importedCharacterToSave.name} from ${importDraft.sourceFileName || "the imported PDF"}.`
          : `Imported character created from ${importedCharacterToSave.name}.`
      );
    } catch (error) {
      console.error("[PCs] Failed to create imported character", error);
      setImportMessage(error?.message || "Failed to create imported character.");
    } finally {
      setIsSavingImportDraft(false);
    }
  };

  const hasPcs = pcs.length > 0;

  useEffect(() => {
    if (!isGMMode && !isLoading && pcs.length === 1) {
      navigate(`/pcs/${pcs[0].id}`, { replace: true });
    }
  }, [isGMMode, isLoading, navigate, pcs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pcs;
    return pcs.filter((pc) => {
      const haystack = [
        pc?.name,
        pc?.race,
        pc?.class,
        pc?.subclass,
        pc?.alignment,
        pc?.background,
        pc?.playerName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [pcs, query]);

  return (
    <div className="w-full text-white">
      {/* Page */}
      <main className="w-full px-6 py-6 md:px-10 md:py-8">
        {/* Subsection nav */}
        <div className="mb-4 flex items-center gap-2">
          {hasPcs ? (
            <NavLink
              to="/pcs"
              end
              className={({ isActive }) =>
                `px-3 py-2 rounded-xl text-sm border transition-colors ${isActive
                  ? "bg-indigo-500/20 border-indigo-400/50 text-white"
                  : "bg-zinc-950/20 border-zinc-800/60 text-zinc-300 hover:text-white hover:bg-zinc-950/35"
                }`
              }
            >
              Characters
            </NavLink>
          ) : null}

          <NavLink
            to="/pcs/bag"
            className={({ isActive }) =>
              `px-3 py-2 rounded-xl text-sm border transition-colors ${isActive
                ? "bg-indigo-500/20 border-indigo-400/50 text-white"
                : "bg-zinc-950/20 border-zinc-800/60 text-zinc-300 hover:text-white hover:bg-zinc-950/35"
              }`
            }
          >
            Bag of Holding
          </NavLink>
        </div>
        {/* Header */}
        <div className="mb-5 md:mb-7 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-white">
              Player Characters
            </h1>
            <p className="mt-1 text-xs md:text-sm text-zinc-400 max-w-2xl">
              {isLoading
                ? "Loading character profiles for the active campaign…"
                : hasPcs
                  ? "Character hub for stats, notes, relationships, conditions, arcs, and session links."
                  : isGMMode
                    ? "Party hub — Bag of Holding is available. Player character profiles will appear here once added to this campaign."
                    : "No characters assigned yet — check out the Bag of Holding"}
            </p>
          </div>

          <div className="w-full md:w-auto flex flex-col md:flex-row gap-3 md:items-center">
            {hasPcs ? (
              <div className="w-full md:w-104">
                <label className="sr-only" htmlFor="pc-search">
                  Search PCs
                </label>
                <input
                  id="pc-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, race, class, background…"
                  className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>
            ) : null}

            {isGMMode ? (
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleOpenImportPicker}
                  disabled={isImporting}
                  className="rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isImporting ? "Preparing import..." : "Import D&D Beyond PDF"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="rounded-xl bg-indigo-500/20 border border-indigo-400/50 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500/30 transition-colors"
                >
                  Add new PC
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <input
          ref={importInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleImportPdf}
          className="hidden"
        />

        {importMessage ? (
          <div className="mb-5 rounded-2xl border border-indigo-400/30 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-100">
            {importMessage}
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-6 text-zinc-300">
            <div className="text-base font-semibold text-white mb-1">Loading characters</div>
            <div className="text-sm text-zinc-400">
              Pulling character profiles for the active campaign.
            </div>
          </div>
        ) : !hasPcs ? (
          <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-6 text-zinc-300">
            <div className="text-base font-semibold text-white mb-1">
              {isGMMode ? "No PC profiles yet" : "No characters assigned yet — check out the Bag of Holding"}
            </div>
            {!isGMMode ? (
              <Link
                to="/pcs/bag"
                className="mt-3 inline-flex rounded-xl bg-indigo-500/20 border border-indigo-400/50 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500/30"
              >
                Bag of Holding
              </Link>
            ) : null}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-6 text-zinc-300">
            <div className="text-base font-semibold text-white mb-1">No matches</div>
            <div className="text-sm text-zinc-400">
              Try a broader search (e.g. “elf”, “cleric”, “chaotic”).
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
            {filtered.map((pc) => (
              <Link key={pc.id} to={`/pcs/${pc.id}`} className="group">
                <article className="h-full rounded-2xl bg-zinc-950/35 border border-zinc-800/70 shadow-[0_0_24px_rgba(0,0,0,0.35)] px-4 py-4 md:px-5 md:py-5 flex flex-col gap-3 hover:border-indigo-400/60 hover:bg-zinc-950/50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-sm md:text-base font-semibold leading-tight text-white truncate">
                        {pc.name || "Unnamed PC"}
                      </h2>
                      <p className="mt-0.5 text-[11px] md:text-xs text-zinc-400 truncate">
                        {pc.race || "—"}
                        {pc.class ? ` · ${pc.class}` : ""}
                        {pc.subclass ? ` — ${pc.subclass}` : ""}
                      </p>
                    </div>

                    <span className="shrink-0 inline-flex items-center justify-center rounded-full border border-indigo-400/70 bg-indigo-500/15 px-2.5 py-0.5 text-[10px] font-medium text-indigo-100 whitespace-nowrap">
                      {pc.level ? `Lv ${pc.level}` : (pc.status || "PC")}
                    </span>
                  </div>

                  <p className="text-[11px] md:text-xs text-zinc-200 line-clamp-2 min-h-[2.2em]">
                    {pc.background || pc.publicNotes || "No background yet."}
                  </p>

                  <div className="pt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] md:text-[11px] text-zinc-200">
                    <span className="inline-flex items-center rounded-full border border-pink-400/60 bg-pink-500/15 px-2 py-0.5">
                      PC
                    </span>

                    {pc.alignment ? (
                      <span className="inline-flex items-center rounded-full border border-zinc-700/70 bg-zinc-950/40 px-2 py-0.5 text-zinc-200">
                        {pc.alignment}
                      </span>
                    ) : null}

                    {pc.playerName ? (
                      <span className="inline-flex items-center rounded-full border border-zinc-700/70 bg-zinc-950/40 px-2 py-0.5 text-zinc-300">
                        Player: {pc.playerName}
                      </span>
                    ) : null}
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}

        {showImportReviewModal && importDraft ? (
          <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm p-4 pt-24 pb-8">
            <div className="w-full max-w-5xl rounded-2xl border border-zinc-800/80 bg-zinc-950/95 p-5 md:p-6 shadow-2xl max-h-[calc(100vh-6rem)] overflow-y-auto">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-lg md:text-xl font-semibold text-white">Review imported character</h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Source file: {importDraft.sourceFileName}
                  </p>
                </div>
	                <button
	                  type="button"
                    disabled={isSavingImportDraft}
	                  onClick={handleCloseImportReview}
	                  className="rounded-lg border border-zinc-800/70 bg-zinc-900/70 px-3 py-1.5 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800/70 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
	                >
                  Close
                </button>
              </div>

	              <div aria-disabled={isSavingImportDraft} className={`flex flex-col gap-5 ${isSavingImportDraft ? "pointer-events-none opacity-60" : ""}`}>
                <div className="flex gap-2 border-b border-zinc-800/70 pb-2">
                  {[
                    ["core", "Core"],
                    ["combat", "Combat Snapshot"],
                    ["checks", "Saving Throws & Skills"],
                    ["inventory", "Inventory & Proficiencies"],
                    ["identity", "Identity & Narrative"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setImportReviewTab(key)}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${importReviewTab === key
                        ? "bg-indigo-500/20 border-indigo-400/50 text-white"
                        : "bg-zinc-900/40 border-zinc-800/60 text-zinc-400 hover:text-white"
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {importReviewTab === "core" ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-4">
                      <h3 className="text-sm font-semibold text-white mb-3">Imported draft</h3>
                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <label className="block text-sm text-zinc-300 mb-1.5">Import target</label>
                          <select
                            value={importTargetCharacterId}
                            onChange={(e) => setImportTargetCharacterId(e.target.value)}
                            className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                          >
                            <option value="">Create as new character</option>
                            {pcs.map((pc) => (
                              <option key={pc.id} value={pc.id}>
                                {pc.name || "Unnamed PC"}
                              </option>
                            ))}
                          </select>
                          <p className="mt-1 text-xs text-zinc-500">
                            Select an existing PC to update its snapshot from this PDF, or leave this as a new character import.
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm text-zinc-300 mb-1.5">Character name</label>
                          <input
                            value={importDraft.character.name}
                            onChange={(e) =>
                              setImportDraft((prev) => ({
                                ...prev,
                                character: { ...prev.character, name: e.target.value },
                              }))
                            }
                            className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                            placeholder="Will come from parser"
                          />
                        </div>

                        <div>
                          <label className="block text-sm text-zinc-300 mb-1.5">Player name</label>
                          <input
                            value={importDraft.character.playerName}
                            onChange={(e) =>
                              setImportDraft((prev) => ({
                                ...prev,
                                character: { ...prev.character, playerName: e.target.value },
                              }))
                            }
                            className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                            placeholder="Optional"
                          />
                        </div>

                        <div>
                          <label className="block text-sm text-zinc-300 mb-1.5">Race / species</label>
                          <input
                            value={importDraft.character.race}
                            onChange={(e) =>
                              setImportDraft((prev) => ({
                                ...prev,
                                character: { ...prev.character, race: e.target.value },
                              }))
                            }
                            className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                            placeholder="Will come from parser"
                          />
                        </div>

                        <div>
                          <label className="block text-sm text-zinc-300 mb-1.5">Class</label>
                          <input
                            value={importDraft.character.class}
                            onChange={(e) =>
                              setImportDraft((prev) => ({
                                ...prev,
                                character: { ...prev.character, class: e.target.value },
                              }))
                            }
                            className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                            placeholder="Will come from parser"
                          />
                        </div>

                        <div>
                          <label className="block text-sm text-zinc-300 mb-1.5">Subclass</label>
                          <input
                            value={importDraft.character.subclass}
                            onChange={(e) =>
                              setImportDraft((prev) => ({
                                ...prev,
                                character: { ...prev.character, subclass: e.target.value },
                              }))
                            }
                            className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                            placeholder="Optional"
                          />
                        </div>

                        <div>
                          <label className="block text-sm text-zinc-300 mb-1.5">Level</label>
                          <input
                            type="number"
                            min="1"
                            value={importDraft.character.level}
                            onChange={(e) =>
                              setImportDraft((prev) => ({
                                ...prev,
                                character: {
                                  ...prev.character,
                                  level: Math.max(1, Number(e.target.value) || 1),
                                },
                              }))
                            }
                            className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                          />
                        </div>
                      </div>
                    </div>
                    {Array.isArray(importDraft.character.spellcasting) &&
                      importDraft.character.spellcasting.length > 0 ? (
                      <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-4">
                        <h3 className="text-sm font-semibold text-white mb-3">Spellcasting by class</h3>
                        {hasMultipleSpellcastingTracks(importDraft.character) ? (
                          <div className="mb-3 rounded-xl border border-indigo-400/20 bg-indigo-500/5 px-3.5 py-3 text-sm text-indigo-100">
                            <div className="font-medium">Multiclass spellcasting detected</div>
                            <div className="mt-1 text-xs text-indigo-200/80 leading-relaxed">
                              Review each casting track here. The shared combat summary intentionally hides single-track spellcasting fields when more than one class casts spells.
                            </div>
                          </div>
                        ) : null}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {importDraft.character.spellcasting.map((entry, index) => (
                            <div
                              key={`${entry.className || "spellcasting"}-${index}`}
                              className="rounded-xl border border-zinc-800/60 bg-zinc-950/30 p-4"
                            >
                              <div className="text-sm font-medium text-white mb-3">
                                {entry.className || `Spellcasting ${index + 1}`}
                              </div>

                              <div className="space-y-3">
                                <div className="grid grid-cols-[96px_1fr] items-center gap-3">
                                  <label className="text-sm text-zinc-300">Ability</label>
                                  <input
                                    value={entry.ability ?? ""}
                                    onChange={(e) =>
                                      setImportDraft((prev) => ({
                                        ...prev,
                                        character: {
                                          ...prev.character,
                                          spellcasting: (prev.character.spellcasting || []).map(
                                            (spellEntry, spellIndex) =>
                                              spellIndex === index
                                                ? {
                                                  ...spellEntry,
                                                  ability: e.target.value,
                                                }
                                                : spellEntry
                                          ),
                                        },
                                      }))
                                    }
                                    className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                                  />
                                </div>

                                <div className="grid grid-cols-[96px_1fr] items-center gap-3">
                                  <label className="text-sm text-zinc-300">Spell save</label>
                                  <input
                                    value={entry.spellSaveDC ?? ""}
                                    onChange={(e) =>
                                      setImportDraft((prev) => ({
                                        ...prev,
                                        character: {
                                          ...prev.character,
                                          spellcasting: (prev.character.spellcasting || []).map(
                                            (spellEntry, spellIndex) =>
                                              spellIndex === index
                                                ? {
                                                  ...spellEntry,
                                                  spellSaveDC: e.target.value,
                                                }
                                                : spellEntry
                                          ),
                                        },
                                      }))
                                    }
                                    className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                                  />
                                </div>

                                <div className="grid grid-cols-[96px_1fr] items-center gap-3">
                                  <label className="text-sm text-zinc-300">Attack bonus</label>
                                  <input
                                    value={entry.spellAttackBonus ?? ""}
                                    onChange={(e) =>
                                      setImportDraft((prev) => ({
                                        ...prev,
                                        character: {
                                          ...prev.character,
                                          spellcasting: (prev.character.spellcasting || []).map(
                                            (spellEntry, spellIndex) =>
                                              spellIndex === index
                                                ? {
                                                  ...spellEntry,
                                                  spellAttackBonus: e.target.value,
                                                }
                                                : spellEntry
                                          ),
                                        },
                                      }))
                                    }
                                    className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {importReviewTab === "inventory" ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-4">
                      <h3 className="text-sm font-semibold text-white mb-3">Inventory & currency</h3>

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                        {[
                          ["CP", importDraft.character.inventory?.currency?.cp ?? 0],
                          ["SP", importDraft.character.inventory?.currency?.sp ?? 0],
                          ["EP", importDraft.character.inventory?.currency?.ep ?? 0],
                          ["GP", importDraft.character.inventory?.currency?.gp ?? 0],
                          ["PP", importDraft.character.inventory?.currency?.pp ?? 0],
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className="rounded-xl border border-zinc-800/60 bg-zinc-950/30 px-3 py-3"
                          >
                            <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
                            <div className="mt-1 text-sm font-medium text-white">{value}</div>
                          </div>
                        ))}
                      </div>

                      <div>
                        <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Equipment</div>
                        {Array.isArray(importDraft.character.inventory?.equipment) &&
                          importDraft.character.inventory.equipment.length > 0 ? (
                          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                            {importDraft.character.inventory.equipment.map((item, index) => (
                              <div
                                key={`${item.name || "equipment"}-${index}`}
                                className="rounded-xl border border-zinc-800/60 bg-zinc-950/30 px-3 py-2.5"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="text-sm text-white font-medium">{item.name || "Unnamed item"}</div>
                                  <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
                                    <span>Qty: {item.qty ?? 1}</span>
                                    {item.weight ? <span>Weight: {item.weight}</span> : null}
                                    {item.attuned ? <span>Attuned</span> : null}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-zinc-500">No equipment imported yet.</p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-4">
                      <h3 className="text-sm font-semibold text-white mb-3">Proficiencies</h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[
                          ["Armor", importDraft.character.proficiencies?.armor],
                          ["Weapons", importDraft.character.proficiencies?.weapons],
                          ["Tools", importDraft.character.proficiencies?.tools],
                          ["Languages", importDraft.character.proficiencies?.languages],
                        ].map(([label, values]) => (
                          <div
                            key={label}
                            className="rounded-xl border border-zinc-800/60 bg-zinc-950/30 px-3 py-3"
                          >
                            <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">{label}</div>
                            {Array.isArray(values) && values.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {values.map((value, index) => (
                                  <span
                                    key={`${label}-${value}-${index}`}
                                    className="inline-flex items-center rounded-full border border-zinc-700/70 bg-zinc-900/60 px-2 py-0.5 text-xs text-zinc-200"
                                  >
                                    {value}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-zinc-500">No {String(label).toLowerCase()} imported.</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* removed spells tab */}

                <div className="space-y-4">
                  {importReviewTab === "core" ? (
                    <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-4 xl:p-5">
                      <h3 className="text-sm font-semibold text-white mb-3">Import review</h3>
                      <div className="space-y-3 text-sm text-zinc-300">
                        <div>
                          <span className="text-zinc-400">Confidence:</span>{" "}
                          <span className="text-white capitalize">{importDraft.review.confidence}</span>
                        </div>

                        <div>
                          <div className="text-zinc-400 mb-1">Warnings</div>
                          <ul className="space-y-1 list-disc pl-5 text-zinc-300">
                            {importDraft.review.warnings.map((warning) => (
                              <li key={warning}>{warning}</li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <div className="text-zinc-400 mb-1">Missing fields</div>
                          <div className="flex flex-wrap gap-2">
                            {importDraft.review.missingFields.map((field) => (
                              <span
                                key={field}
                                className="inline-flex items-center rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200"
                              >
                                {field}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {importReviewTab === "combat" ? (
                    <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-4">
                      <h3 className="text-sm font-semibold text-white mb-3">Ability scores</h3>
                      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                        {["str", "dex", "con", "int", "wis", "cha"].map((key) => (
                          <div key={key}>
                            <label className="block text-xs uppercase tracking-wide text-zinc-400 mb-1.5">
                              {key}
                            </label>
                            <input
                              type="number"
                              value={importDraft.character.stats?.abilities?.[key] ?? ""}
                              onChange={(e) =>
                                setImportDraft((prev) => ({
                                  ...prev,
                                  character: {
                                    ...prev.character,
                                    stats: {
                                      ...prev.character.stats,
                                      abilities: {
                                        ...prev.character.stats.abilities,
                                        [key]: e.target.value,
                                      },
                                    },
                                  },
                                }))
                              }
                              className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {importReviewTab === "combat" ? (
                    <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-4">
                      <h3 className="text-sm font-semibold text-white mb-3">Combat & casting</h3>
                      <div className="mb-3 rounded-xl border border-indigo-400/20 bg-indigo-500/5 px-3.5 py-3 text-sm text-indigo-100">
                        <div className="font-medium">Snapshot only</div>
                        <div className="mt-1 text-xs text-indigo-200/80 leading-relaxed">
                          Use D&D Beyond as the live tactical sheet during play. This import is intended as a campaign snapshot for core combat stats, spellcasting summary, and reference data.
                        </div>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 xl:gap-4 items-start">
                        {(hasMultipleSpellcastingTracks(importDraft.character)
                          ? [
                            ["AC", "ac"],
                            ["HP Max", "hpMax"],
                            ["Speed", "speed"],
                            ["Proficiency Bonus", "proficiencyBonus"],
                            ["Passive Perception", "passivePerception"],
                            ["Passive Insight", "passiveInsight"],
                            ["Passive Investigation", "passiveInvestigation"],
                          ]
                          : [
                            ["AC", "ac"],
                            ["HP Max", "hpMax"],
                            ["Speed", "speed"],
                            ["Proficiency Bonus", "proficiencyBonus"],
                            ["Spell Save DC", "spellSaveDC"],
                            ["Spell Attack Bonus", "spellAttackBonus"],
                            ["Passive Perception", "passivePerception"],
                            ["Passive Insight", "passiveInsight"],
                            ["Passive Investigation", "passiveInvestigation"],
                          ]).map(([label, key]) => (
                            <div key={key}>
                              <label className="block text-sm text-zinc-300 mb-1.5">{label}</label>
                              <input
                                value={importDraft.character.stats?.[key] ?? ""}
                                onChange={(e) =>
                                  setImportDraft((prev) => ({
                                    ...prev,
                                    character: {
                                      ...prev.character,
                                      stats: {
                                        ...prev.character.stats,
                                        [key]: e.target.value,
                                      },
                                    },
                                  }))
                                }
                                className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                              />
                            </div>
                          ))}

                        {!hasMultipleSpellcastingTracks(importDraft.character) ? (
                          <div>
                            <label className="block text-sm text-zinc-300 mb-1.5">Spellcasting Ability</label>
                            <input
                              value={importDraft.character.stats?.spellcastingAbility ?? ""}
                              onChange={(e) =>
                                setImportDraft((prev) => ({
                                  ...prev,
                                  character: {
                                    ...prev.character,
                                    stats: {
                                      ...prev.character.stats,
                                      spellcastingAbility: e.target.value,
                                    },
                                  },
                                }))
                              }
                              className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                            />
                          </div>
                        ) : null}

                        <div className="lg:col-span-2 xl:col-span-3">
                          <label className="block text-sm text-zinc-300 mb-1.5">Additional Senses</label>
                          <input
                            value={importDraft.character.stats?.additionalSenses ?? ""}
                            onChange={(e) =>
                              setImportDraft((prev) => ({
                                ...prev,
                                character: {
                                  ...prev.character,
                                  stats: {
                                    ...prev.character.stats,
                                    additionalSenses: e.target.value,
                                  },
                                },
                              }))
                            }
                            className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                          />
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {importReviewTab === "checks" ? (
                    <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-4">
                      <h3 className="text-sm font-semibold text-white mb-3">Saving throws</h3>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {importSaveConfig.map((save) => {
                          const entry = importDraft.character.stats?.saves?.[save.key] || {};
                          return (
                            <div key={save.key} className="rounded-xl border border-zinc-800/60 bg-zinc-950/30 p-3 space-y-2">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <div>
                                  <div className="text-sm text-white font-medium">{save.label}</div>
                                  <div className="text-[10px] uppercase tracking-wide text-zinc-500">{save.ability}</div>
                                </div>
                                <label className="inline-flex items-center gap-2 text-xs text-zinc-300 sm:self-start">
                                  <input
                                    type="checkbox"
                                    checked={!!entry.proficient}
                                    onChange={(e) =>
                                      setImportDraft((prev) => ({
                                        ...prev,
                                        character: {
                                          ...prev.character,
                                          stats: {
                                            ...prev.character.stats,
                                            saves: {
                                              ...(prev.character.stats?.saves || {}),
                                              [save.key]: {
                                                ...(prev.character.stats?.saves?.[save.key] || {}),
                                                proficient: e.target.checked,
                                              },
                                            },
                                          },
                                        },
                                      }))
                                    }
                                    className="rounded border-zinc-700 bg-zinc-900"
                                  />
                                  Proficient
                                </label>
                              </div>
                              <div className="text-xs text-zinc-500">
                                Imported modifier: {entry.mod ?? "—"}. Recalculated on save.
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {importReviewTab === "checks" ? (
                    <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-4">
                      <h3 className="text-sm font-semibold text-white mb-3">Skills</h3>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {importSkillConfig.map((skill) => {
                          const entry = importDraft.character.stats?.skills?.[skill.key] || {};
                          return (
                            <div key={skill.key} className="rounded-xl border border-zinc-800/60 bg-zinc-950/30 p-3 space-y-2">
                              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                <div>
                                  <div className="text-sm text-white font-medium">{skill.label}</div>
                                  <div className="text-[10px] uppercase tracking-wide text-zinc-500">{skill.ability}</div>
                                </div>
                                <div className="flex flex-col gap-1.5 text-xs text-zinc-300 sm:min-w-[110px]">
                                  <label className="inline-flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={!!entry.proficient}
                                      onChange={(e) =>
                                        setImportDraft((prev) => ({
                                          ...prev,
                                          character: {
                                            ...prev.character,
                                            stats: {
                                              ...prev.character.stats,
                                              skills: {
                                                ...(prev.character.stats?.skills || {}),
                                                [skill.key]: {
                                                  ...(prev.character.stats?.skills?.[skill.key] || {}),
                                                  proficient: e.target.checked,
                                                  expertise:
                                                    e.target.checked
                                                      ? !!prev.character.stats?.skills?.[skill.key]?.expertise
                                                      : false,
                                                },
                                              },
                                            },
                                          },
                                        }))
                                      }
                                      className="rounded border-zinc-700 bg-zinc-900"
                                    />
                                    Proficient
                                  </label>
                                  <label className="inline-flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={!!entry.expertise}
                                      onChange={(e) =>
                                        setImportDraft((prev) => ({
                                          ...prev,
                                          character: {
                                            ...prev.character,
                                            stats: {
                                              ...prev.character.stats,
                                              skills: {
                                                ...(prev.character.stats?.skills || {}),
                                                [skill.key]: {
                                                  ...(prev.character.stats?.skills?.[skill.key] || {}),
                                                  proficient: e.target.checked
                                                    ? true
                                                    : !!prev.character.stats?.skills?.[skill.key]?.proficient,
                                                  expertise: e.target.checked,
                                                },
                                              },
                                            },
                                          },
                                        }))
                                      }
                                      className="rounded border-zinc-700 bg-zinc-900"
                                    />
                                    Expertise
                                  </label>
                                </div>
                              </div>
                              <div className="text-xs text-zinc-500 leading-relaxed">
                                Imported modifier: {entry.mod ?? "—"}. Recalculated on save.
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {importReviewTab === "identity" ? (
                    <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-4">
                      <h3 className="text-sm font-semibold text-white mb-3">Identity & narrative</h3>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {[
                          ["Faith", "faith"],
                          ["Size", "size"],
                          ["Age", "age"],
                          ["Height", "height"],
                          ["Weight", "weight"],
                          ["Gender", "gender"],
                          ["Eyes", "eyes"],
                          ["Hair", "hair"],
                          ["Skin", "skin"],
                        ].map(([label, key]) => (
                          <div key={key}>
                            <label className="block text-sm text-zinc-300 mb-1.5">{label}</label>
                            <input
                              value={importDraft.character.identity?.[key] ?? ""}
                              onChange={(e) =>
                                setImportDraft((prev) => ({
                                  ...prev,
                                  character: {
                                    ...prev.character,
                                    identity: {
                                      ...prev.character.identity,
                                      [key]: e.target.value,
                                    },
                                  },
                                }))
                              }
                              className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 gap-4 mt-4">
                        {[
                          ["Personality Traits", "personalityTraits"],
                          ["Ideals", "ideals"],
                          ["Bonds", "bonds"],
                          ["Flaws", "flaws"],
                        ].map(([label, key]) => (
                          <div key={key}>
                            <label className="block text-sm text-zinc-300 mb-1.5">{label}</label>
                            <textarea
                              rows={2}
                              value={importDraft.character.narrative?.[key] ?? ""}
                              onChange={(e) =>
                                setImportDraft((prev) => ({
                                  ...prev,
                                  character: {
                                    ...prev.character,
                                    narrative: {
                                      ...prev.character.narrative,
                                      [key]: e.target.value,
                                    },
                                  },
                                }))
                              }
                              className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 rounded-2xl border border-zinc-800/70 bg-zinc-950/95 px-4 py-3">
	                    <button
	                      type="button"
                        disabled={isSavingImportDraft}
	                      onClick={handleCloseImportReview}
	                      className="rounded-xl border border-zinc-800/70 bg-zinc-900/70 px-4 py-2.5 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800/70 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
	                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateImportedPc}
                      disabled={
                        isSavingImportDraft ||
                        !selectedCampaignId ||
                        !importDraft.character.name.trim()
                      }
                      className="rounded-xl bg-indigo-500/20 border border-indigo-400/50 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSavingImportDraft
                        ? (importTargetCharacterId ? "Updating..." : "Creating...")
                        : (importTargetCharacterId ? "Update character from import" : "Create character from import")}
                    </button>
                </div>
		                </div>
              </div>
            </div>
          </div>
        ) : null}

        {showCreateModal ? (
          <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm p-4 pt-24 pb-8">
            <div className="w-full max-w-2xl rounded-2xl border border-zinc-800/80 bg-zinc-950/95 p-5 md:p-6 shadow-2xl max-h-[calc(100vh-8rem)] overflow-y-auto">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-lg md:text-xl font-semibold text-white">Add new PC</h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Create a player character by hand. PDF import can plug into this same character model later.
                  </p>
                </div>
	                <button
	                  type="button"
                    disabled={isSaving}
	                  onClick={() => {
                    setShowCreateModal(false);
                    setNewPc(createManualPcDraft());
                  }}
	                  className="rounded-lg border border-zinc-800/70 bg-zinc-900/70 px-3 py-1.5 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800/70 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
	                >
                  Close
                </button>
              </div>

	              <form onSubmit={handleCreatePc} className="space-y-4">
                  <fieldset disabled={isSaving} className="space-y-4 disabled:opacity-60">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-zinc-300 mb-1.5">Character name</label>
                    <input
                      required
                      value={newPc.name}
                      onChange={(e) => setNewPc((prev) => ({ ...prev, name: e.target.value }))}
                      className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      placeholder="Yasuke"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-300 mb-1.5">Player name</label>
                    <input
                      value={newPc.playerName}
                      onChange={(e) => setNewPc((prev) => ({ ...prev, playerName: e.target.value }))}
                      className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      placeholder="Player"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-300 mb-1.5">Race / species</label>
                    <input
                      value={newPc.race}
                      onChange={(e) => setNewPc((prev) => ({ ...prev, race: e.target.value }))}
                      className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      placeholder="Tiefling"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-300 mb-1.5">Class</label>
                    <input
                      value={newPc.class}
                      onChange={(e) => setNewPc((prev) => ({ ...prev, class: e.target.value }))}
                      className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      placeholder="Rogue"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-300 mb-1.5">Subclass</label>
                    <input
                      value={newPc.subclass}
                      onChange={(e) => setNewPc((prev) => ({ ...prev, subclass: e.target.value }))}
                      className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      placeholder="Soulknife"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-300 mb-1.5">Level</label>
                    <input
                      type="number"
                      min="1"
                      value={newPc.level}
                      onChange={(e) => setNewPc((prev) => ({ ...prev, level: e.target.value }))}
                      className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-300 mb-1.5">Alignment</label>
                    <input
                      value={newPc.alignment}
                      onChange={(e) => setNewPc((prev) => ({ ...prev, alignment: e.target.value }))}
                      className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      placeholder="Chaotic Neutral"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-300 mb-1.5">Visibility</label>
                    <select
                      value={newPc.visibility}
                      onChange={(e) => setNewPc((prev) => ({ ...prev, visibility: e.target.value }))}
                      className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    >
                      <option value="player">Player visible</option>
                      <option value="gm">GM only</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-zinc-300 mb-1.5">Background</label>
                  <textarea
                    value={newPc.background}
                    onChange={(e) => setNewPc((prev) => ({ ...prev, background: e.target.value }))}
                    rows={3}
                    className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    placeholder="Short character background or concept..."
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-300 mb-1.5">Public notes</label>
                  <textarea
                    value={newPc.publicNotes}
                    onChange={(e) => setNewPc((prev) => ({ ...prev, publicNotes: e.target.value }))}
                    rows={3}
                    className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    placeholder="What should players see right away?"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
	                    type="button"
	                    disabled={isSaving}
	                    onClick={() => {
                      setShowCreateModal(false);
                      setNewPc(createManualPcDraft());
                    }}
	                    className="rounded-xl border border-zinc-800/70 bg-zinc-900/70 px-4 py-2.5 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800/70 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
	                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || !selectedCampaignId}
                    className="rounded-xl bg-indigo-500/20 border border-indigo-400/50 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSaving ? "Saving..." : "Create PC"}
                  </button>
	                </div>
                  </fieldset>
	              </form>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
};

export default PCs;
