import { useEffect, useMemo, useState } from "react";
import { useParams, Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useMode } from "../context/ModeContext.jsx";
import { useAuth } from "../context/AuthContext";
import { useCampaign } from "../context/CampaignContext";
import { getCharacterById, removeCharacter, upsertCharacter } from "../data/characters/characters.repo";
import { getApiCharacterAssignments, unassignApiCharacter } from "../data/api/apiClient";

const abilityLabels = {
  str: "STR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "WIS",
  cha: "CHA",
};

const skillConfig = [
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

const saveConfig = [
  { key: "strength", label: "Strength", ability: "STR" },
  { key: "dexterity", label: "Dexterity", ability: "DEX" },
  { key: "constitution", label: "Constitution", ability: "CON" },
  { key: "intelligence", label: "Intelligence", ability: "INT" },
  { key: "wisdom", label: "Wisdom", ability: "WIS" },
  { key: "charisma", label: "Charisma", ability: "CHA" },
];

const profileTabs = [
  { key: "stats", label: "Stats & Saving Throws" },
  { key: "skills", label: "Skills" },
  { key: "inventory", label: "Inventory & Proficiencies" },
  { key: "narrative", label: "Narrative & DM Notes" },
];

function formatSignedNumber(value) {
  if (typeof value !== "number") return "—";
  return `${value >= 0 ? "+" : ""}${value}`;
}

function formatFeetLabel(value) {
  if (value == null || value === "") return "—";
  if (typeof value === "string") {
    return value.includes("ft") ? value : `${value} ft.`;
  }
  return `${value} ft.`;
}

function formatList(values = []) {
  if (!Array.isArray(values) || values.length === 0) return "—";
  return values.filter(Boolean).join(", ");
}

function formatCurrencyLabel(currency = {}) {
  if (!currency || typeof currency !== "object") return "—";

  const summary = Object.entries(currency)
    .filter(([, amount]) => Number(amount) > 0)
    .map(([coin, amount]) => `${amount} ${coin}`)
    .join(" • ");

  return summary || "—";
}

function formatEntryPreview(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return value.name || value.description || value.label || "Unnamed entry";
  }
  return String(value);
}

function normalizeSkillEntry(skills, key, fallbackKeys = []) {
  if (skills?.[key]) return skills[key];

  for (const fallbackKey of fallbackKeys) {
    if (skills?.[fallbackKey]) return skills[fallbackKey];
  }

  return {};
}

function buildEditDraftFromPc(pc) {
  const stats = pc?.stats || {};
  const identity = pc?.identity || {};
  const narrative = pc?.narrative || {};

  return {
    name: pc?.name || "",
    playerName: pc?.playerName || "",
    race: pc?.race || "",
    class: pc?.class || "",
    subclass: pc?.subclass || "",
    level: pc?.level ?? "",
    alignment: pc?.alignment || "",
    background: pc?.background || "",
    publicNotes: pc?.publicNotes || "",
    gmNotes: pc?.gmNotes || "",
    secrets: pc?.secrets || "",
    identity: {
      faith: identity.faith || "",
      size: identity.size || "",
      height: identity.height || "",
      weight: identity.weight || "",
      gender: identity.gender || "",
      eyes: identity.eyes || "",
      hair: identity.hair || "",
      skin: identity.skin || "",
    },
    stats: {
      hpMax: stats.hpMax ?? "",
      hpCurrent: stats.hpCurrent ?? "",
      ac: stats.ac ?? "",
      speed: stats.speed ?? "",
      initiativeMod: stats.initiativeMod ?? "",
      proficiencyBonus: stats.proficiencyBonus ?? "",
      spellcastingAbility: stats.spellcastingAbility || "",
      spellSaveDC: stats.spellSaveDC ?? "",
      spellAttackBonus: stats.spellAttackBonus ?? "",
      passivePerception: stats.passivePerception ?? "",
      passiveInsight: stats.passiveInsight ?? "",
      passiveInvestigation: stats.passiveInvestigation ?? "",
      additionalSenses: stats.additionalSenses || "",
      saves: stats.saves || {},
      skills: stats.skills || {},
      abilities: {
        str: stats.abilities?.str?.score ?? "",
        dex: stats.abilities?.dex?.score ?? "",
        con: stats.abilities?.con?.score ?? "",
        int: stats.abilities?.int?.score ?? "",
        wis: stats.abilities?.wis?.score ?? "",
        cha: stats.abilities?.cha?.score ?? "",
      },
    },
    narrative: {
      personalityTraits: narrative.personalityTraits || "",
      ideals: narrative.ideals || "",
      bonds: narrative.bonds || "",
      flaws: narrative.flaws || "",
    },
    spellcasting: Array.isArray(pc?.spellcasting)
      ? pc.spellcasting.map((entry) => ({
        className: entry?.className || "",
        ability: entry?.ability || "",
        spellSaveDC: entry?.spellSaveDC ?? "",
        spellAttackBonus: entry?.spellAttackBonus ?? "",
      }))
      : [],
  };
}

function toOptionalNumber(value) {
  if (value === "" || value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const skillAbilityMap = {
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

const saveAbilityMap = {
  strength: "str",
  dexterity: "dex",
  constitution: "con",
  intelligence: "int",
  wisdom: "wis",
  charisma: "cha",
};

function getAbilityModifier(score) {
  if (typeof score !== "number" || Number.isNaN(score)) return undefined;
  return Math.floor((score - 10) / 2);
}

function buildDerivedSaves(existingSaves = {}, abilityScores = {}, proficiencyBonus = 0) {
  return Object.fromEntries(
    Object.entries(saveAbilityMap).map(([saveKey, abilityKey]) => {
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

function buildDerivedSkills(existingSkills = {}, abilityScores = {}, proficiencyBonus = 0) {
  return Object.fromEntries(
    Object.entries(skillAbilityMap).map(([skillKey, abilityKey]) => {
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

const PCProfile = () => {
  const { pcId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isGM } = useMode();
  const { user } = useAuth();
  const { selectedCampaignId } = useCampaign();
  const isGMMode = Boolean(isGM);

  const [pc, setPc] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUnassigning, setIsUnassigning] = useState(false);
  const [activeTab, setActiveTab] = useState("stats");
  const [assignmentMeta, setAssignmentMeta] = useState({
    assignments: [],
    pendingAssignedCharacterIds: [],
  });

  const refreshAssignmentMeta = async () => {
    if (!selectedCampaignId) {
      setAssignmentMeta({ assignments: [], pendingAssignedCharacterIds: [] });
      return;
    }

    const assignments = await getApiCharacterAssignments(selectedCampaignId);
    setAssignmentMeta({
      assignments: assignments.assignments || [],
      pendingAssignedCharacterIds: assignments.pendingAssignedCharacterIds || [],
    });
  };

  useEffect(() => {
    const loadPc = async () => {
      if (!pcId || !selectedCampaignId) {
        setPc(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const [character, assignments] = await Promise.all([
          getCharacterById(selectedCampaignId, pcId),
          getApiCharacterAssignments(selectedCampaignId),
        ]);
        setPc(character);
        setAssignmentMeta({
          assignments: assignments.assignments || [],
          pendingAssignedCharacterIds: assignments.pendingAssignedCharacterIds || [],
        });
      } catch (error) {
        console.error("[PCProfile] Failed to load character", error);
        setPc(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadPc();
  }, [pcId, selectedCampaignId]);

  const handleStartEdit = () => {
    if (!pc || isSaving || isDeleting || isUnassigning) return;
    setEditDraft(buildEditDraftFromPc(pc));
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (isSaving) return;
    setIsEditing(false);
    setEditDraft(null);
  };

  const handleSaveEdit = async () => {
    if (isSaving || !pc || !selectedCampaignId || !editDraft) return;

    try {
      setIsSaving(true);

      const characterLevel = Math.max(1, Number(editDraft.level) || 1);
      const nextAbilityScores = {
        ...(pc.stats?.abilities || {}),
        str: {
          ...(pc.stats?.abilities?.str || {}),
          score: toOptionalNumber(editDraft.stats?.abilities?.str),
        },
        dex: {
          ...(pc.stats?.abilities?.dex || {}),
          score: toOptionalNumber(editDraft.stats?.abilities?.dex),
        },
        con: {
          ...(pc.stats?.abilities?.con || {}),
          score: toOptionalNumber(editDraft.stats?.abilities?.con),
        },
        int: {
          ...(pc.stats?.abilities?.int || {}),
          score: toOptionalNumber(editDraft.stats?.abilities?.int),
        },
        wis: {
          ...(pc.stats?.abilities?.wis || {}),
          score: toOptionalNumber(editDraft.stats?.abilities?.wis),
        },
        cha: {
          ...(pc.stats?.abilities?.cha || {}),
          score: toOptionalNumber(editDraft.stats?.abilities?.cha),
        },
      };

      Object.keys(nextAbilityScores).forEach((key) => {
        nextAbilityScores[key] = {
          ...nextAbilityScores[key],
          mod: getAbilityModifier(nextAbilityScores[key]?.score),
        };
      });

      const nextProficiencyBonus = toOptionalNumber(editDraft.stats?.proficiencyBonus) ?? 0;
      const nextSaves = buildDerivedSaves(editDraft.stats?.saves || pc.stats?.saves || {}, nextAbilityScores, nextProficiencyBonus);
      const nextSkills = buildDerivedSkills(editDraft.stats?.skills || pc.stats?.skills || {}, nextAbilityScores, nextProficiencyBonus);
      const nextInitiative = nextAbilityScores.dex?.mod;
      const nextPassivePerception =
        toOptionalNumber(editDraft.stats?.passivePerception) ??
        (typeof nextSkills.perception?.mod === "number" ? 10 + nextSkills.perception.mod : undefined);
      const nextPassiveInsight =
        toOptionalNumber(editDraft.stats?.passiveInsight) ??
        (typeof nextSkills.insight?.mod === "number" ? 10 + nextSkills.insight.mod : undefined);
      const nextPassiveInvestigation =
        toOptionalNumber(editDraft.stats?.passiveInvestigation) ??
        (typeof nextSkills.investigation?.mod === "number" ? 10 + nextSkills.investigation.mod : undefined);

      const nextSpellcastingEntries = Array.isArray(editDraft.spellcasting)
        ? editDraft.spellcasting
          .map((entry) => ({
            className: String(entry?.className || "").trim(),
            ability: String(entry?.ability || "").trim().toUpperCase(),
            spellSaveDC: toOptionalNumber(entry?.spellSaveDC),
            spellAttackBonus: toOptionalNumber(entry?.spellAttackBonus),
          }))
          .filter(
            (entry) =>
              entry.className ||
              entry.ability ||
              entry.spellSaveDC !== undefined ||
              entry.spellAttackBonus !== undefined
          )
        : [];

      const primarySpellcastingEntry = nextSpellcastingEntries[0] || null;

      const updatedCharacter = {
        ...pc,
        name: editDraft.name.trim(),
        playerName: (editDraft.playerName || "").trim(),
        race: (editDraft.race || "").trim(),
        class: (editDraft.class || "").trim(),
        subclass: (editDraft.subclass || "").trim(),
        level: characterLevel,
        alignment: (editDraft.alignment || "").trim(),
        background: (editDraft.background || "").trim(),
        publicNotes: (editDraft.publicNotes || "").trim(),
        gmNotes: (editDraft.gmNotes || "").trim(),
        secrets: (editDraft.secrets || "").trim(),
        identity: {
          ...(pc.identity || {}),
          faith: (editDraft.identity?.faith || "").trim(),
          size: (editDraft.identity?.size || "").trim(),
          height: (editDraft.identity?.height || "").trim(),
          weight: (editDraft.identity?.weight || "").trim(),
          gender: (editDraft.identity?.gender || "").trim(),
          eyes: (editDraft.identity?.eyes || "").trim(),
          hair: (editDraft.identity?.hair || "").trim(),
          skin: (editDraft.identity?.skin || "").trim(),
        },
        stats: {
          ...(pc.stats || {}),
          hpMax: toOptionalNumber(editDraft.stats?.hpMax),
          hpCurrent:
            toOptionalNumber(editDraft.stats?.hpCurrent) ??
            toOptionalNumber(editDraft.stats?.hpMax),
          ac: toOptionalNumber(editDraft.stats?.ac),
          speed: String(editDraft.stats?.speed || "").trim(),
          initiativeMod: nextInitiative,
          proficiencyBonus: nextProficiencyBonus || undefined,
          spellcastingAbility:
            primarySpellcastingEntry?.ability ||
            (editDraft.stats?.spellcastingAbility || "").trim(),
          spellSaveDC:
            primarySpellcastingEntry?.spellSaveDC ??
            toOptionalNumber(editDraft.stats?.spellSaveDC),
          spellAttackBonus:
            primarySpellcastingEntry?.spellAttackBonus ??
            toOptionalNumber(editDraft.stats?.spellAttackBonus),
          passivePerception: nextPassivePerception,
          passiveInsight: nextPassiveInsight,
          passiveInvestigation: nextPassiveInvestigation,
          additionalSenses: (editDraft.stats?.additionalSenses || "").trim(),
          abilities: nextAbilityScores,
          saves: nextSaves,
          skills: nextSkills,
        },
        narrative: {
          ...(pc.narrative || {}),
          personalityTraits: (editDraft.narrative?.personalityTraits || "").trim(),
          ideals: (editDraft.narrative?.ideals || "").trim(),
          bonds: (editDraft.narrative?.bonds || "").trim(),
          flaws: (editDraft.narrative?.flaws || "").trim(),
        },
        classes: Array.isArray(pc.classes) && pc.classes.length > 0
          ? pc.classes.map((entry, index) =>
            index === 0
              ? {
                ...entry,
                className: (editDraft.class || "").trim(),
                level: characterLevel,
                subclass: (editDraft.subclass || "").trim(),
                spellcastingAbility:
                  nextSpellcastingEntries[index]?.ability ||
                  (editDraft.stats?.spellcastingAbility || "").trim(),
              }
              : entry
          )
          : (editDraft.class || "").trim()
            ? [
              {
                className: (editDraft.class || "").trim(),
                level: characterLevel,
                subclass: (editDraft.subclass || "").trim(),
                spellcastingAbility:
                  nextSpellcastingEntries[0]?.ability ||
                  (editDraft.stats?.spellcastingAbility || "").trim(),
              },
            ]
            : [],
        spellcasting: nextSpellcastingEntries,
      };

      await upsertCharacter(selectedCampaignId, updatedCharacter);
      setPc(updatedCharacter);
      setIsEditing(false);
      setEditDraft(null);
    } catch (error) {
      console.error("[PCProfile] Failed to save character", error);
    } finally {
      setIsSaving(false);
    }
  };

	  const handleDeleteCharacter = async () => {
	    if (isDeleting || isSaving || isUnassigning || !pc || !selectedCampaignId) return;
    if (isAssignedToPendingInvitation) return;

    const confirmed = window.confirm(
      acceptedAssignmentForPc
        ? "Deleting this character will also unassign it from the player."
        : `Delete ${pc.name || "this character"}? This removes the character from Dopamine Dungeon.`
    );

    if (!confirmed) return;

    try {
      setIsDeleting(true);
      await removeCharacter(selectedCampaignId, pc.id);
      navigate(`/pcs${location.search || ""}`);
    } catch (error) {
      console.error("[PCProfile] Failed to delete character", error);
      setIsDeleting(false);
    }
  };
  const acceptedAssignmentForPc = useMemo(
    () =>
      assignmentMeta.assignments.find(
        (assignment) => String(assignment.characterId) === String(pc?.id)
      ) || null,
    [assignmentMeta.assignments, pc?.id]
  );
  const isAssignedToPendingInvitation = useMemo(
    () => assignmentMeta.pendingAssignedCharacterIds.includes(String(pc?.id || "")),
    [assignmentMeta.pendingAssignedCharacterIds, pc?.id]
  );
  const handleUnassignCharacter = async () => {
    if (isUnassigning || isSaving || isDeleting || !selectedCampaignId || !acceptedAssignmentForPc) return;

    const confirmed = window.confirm("Unassign this character from the player?");
    if (!confirmed) return;

    try {
      setIsUnassigning(true);
      await unassignApiCharacter(selectedCampaignId, {
        assignmentId: acceptedAssignmentForPc.id,
      });
      await refreshAssignmentMeta();
    } finally {
      setIsUnassigning(false);
    }
  };
  const activeEditDraft = useMemo(() => editDraft || buildEditDraftFromPc(pc), [editDraft, pc]);

  const canPlayerViewPc =
    isGMMode ||
    !pc ||
    pc.visibility === "player" ||
    pc.isPlayerVisible === true ||
    (pc.ownerUserId && pc.ownerUserId === user?.uid);

  // Hard gate: players should not be able to open GM-only / restricted PCs via direct URL
  // unless the character is explicitly theirs.
  if (!canPlayerViewPc && pc) {
    return (
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-xl mx-auto bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">DM Eyes Only</h1>
          <p className="text-zinc-400 text-sm mb-4">
            This player character is marked GM-only. Players don’t get to see it until it’s revealed in play. 💜
          </p>
          <Link
            to="/pcs"
            className="inline-flex items-center justify-center mt-2 px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20"
          >
            Back to PCs
          </Link>
        </div>
      </main>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8 text-white">
        <div className="max-w-md space-y-3">
          <h1 className="text-xl font-semibold">Loading PC…</h1>
          <p className="text-sm text-zinc-400">
            Pulling the character profile from the dungeon archives.
          </p>
        </div>
      </div>
    );
  }

  if (!pc) {
    return (
      <div className="p-8 text-white">
        <div className="max-w-md space-y-3">
          <h1 className="text-xl font-semibold">PC not found</h1>
          <p className="text-sm text-zinc-400">
            We couldn&apos;t find a player character with ID{" "}
            <span className="font-mono text-zinc-100">{pcId}</span>.
          </p>
          <Link
            to="/pcs"
            className="inline-flex items-center justify-center mt-2 px-4 py-2 rounded-full bg-indigo-500/90 hover:bg-indigo-400 text-sm font-medium text-white transition"
          >
            Back to PCs
          </Link>
        </div>
      </div>
    );
  }
  const stats = pc.stats || {};
  const abilities = stats.abilities || {};
  const saves = stats.saves || {};
  const rawSkills = stats.skills || {};
  const defenses = stats.defenses || {};
  const identity = pc.identity || {};
  const narrative = pc.narrative || {};
  const proficiencies = pc.proficiencies || {};
  const inventory = pc.inventory || {};
  const equipment = Array.isArray(inventory.equipment) ? inventory.equipment : [];
  const spells = Array.isArray(pc.spells) ? pc.spells : [];
  const actions = pc.actions || {};
  const weapons = Array.isArray(actions.weapons) ? actions.weapons : [];
  const actionEntries = Array.isArray(actions.actions) ? actions.actions : [];
  const bonusActionEntries = Array.isArray(actions.bonusActions) ? actions.bonusActions : [];
  const reactionEntries = Array.isArray(actions.reactions) ? actions.reactions : [];
  const otherActionEntries = Array.isArray(actions.other) ? actions.other : [];
  const features = Array.isArray(pc.features) ? pc.features : [];
  const feats = Array.isArray(pc.feats) ? pc.feats : [];
  const classes = Array.isArray(pc.classes) ? pc.classes : [];
  const spellcastingEntries = Array.isArray(pc.spellcasting)
    ? pc.spellcasting.filter(
      (entry) => entry && (entry.className || entry.ability || entry.spellSaveDC != null || entry.spellAttackBonus != null)
    )
    : [];

  const normalizedSkills = {
    acrobatics: normalizeSkillEntry(rawSkills, "acrobatics"),
    animalHandling: normalizeSkillEntry(rawSkills, "animalHandling", ["animal"]),
    arcana: normalizeSkillEntry(rawSkills, "arcana"),
    athletics: normalizeSkillEntry(rawSkills, "athletics"),
    deception: normalizeSkillEntry(rawSkills, "deception"),
    history: normalizeSkillEntry(rawSkills, "history"),
    insight: normalizeSkillEntry(rawSkills, "insight"),
    intimidation: normalizeSkillEntry(rawSkills, "intimidation"),
    investigation: normalizeSkillEntry(rawSkills, "investigation"),
    medicine: normalizeSkillEntry(rawSkills, "medicine"),
    nature: normalizeSkillEntry(rawSkills, "nature"),
    perception: normalizeSkillEntry(rawSkills, "perception"),
    performance: normalizeSkillEntry(rawSkills, "performance"),
    persuasion: normalizeSkillEntry(rawSkills, "persuasion"),
    religion: normalizeSkillEntry(rawSkills, "religion"),
    sleightOfHand: normalizeSkillEntry(rawSkills, "sleightOfHand", ["sleightofHand"]),
    stealth: normalizeSkillEntry(rawSkills, "stealth"),
    survival: normalizeSkillEntry(rawSkills, "survival"),
  };

  const hpLabel =
    stats.hpMax != null ? `${stats.hpCurrent ?? stats.hpMax}/${stats.hpMax}` : "—";
  const acLabel = stats.ac ?? "—";
  const speedLabel = formatFeetLabel(stats.speed);
  const initLabel = formatSignedNumber(stats.initiativeMod);
  const profLabel = formatSignedNumber(stats.proficiencyBonus);

  const spellInfo = spellcastingEntries.length > 0
    ? spellcastingEntries
      .map((entry) => {
        const parts = [
          entry.className || null,
          entry.ability || null,
          entry.spellSaveDC != null ? `DC ${entry.spellSaveDC}` : null,
          typeof entry.spellAttackBonus === "number"
            ? formatSignedNumber(entry.spellAttackBonus)
            : null,
        ].filter(Boolean);

        return parts.join(" • ");
      })
      .join(" / ")
    : stats.spellcastingAbility
      ? `${stats.spellcastingAbility} • DC ${stats.spellSaveDC ?? "?"} • ${formatSignedNumber(stats.spellAttackBonus)}`
      : "—";

  const classSummary =
    classes.length > 0
      ? classes
        .map((entry) =>
          [entry.className, entry.level ? entry.level : null, entry.subclass ? `(${entry.subclass})` : null]
            .filter(Boolean)
            .join(" ")
        )
        .join(" / ")
      : [pc.class, pc.subclass ? `(${pc.subclass})` : null].filter(Boolean).join(" ") || "—";

  const sensesSummary = [
    stats.passivePerception != null ? `Perception ${stats.passivePerception}` : null,
    stats.passiveInsight != null ? `Insight ${stats.passiveInsight}` : null,
    stats.passiveInvestigation != null ? `Investigation ${stats.passiveInvestigation}` : null,
    stats.additionalSenses || null,
  ]
    .filter(Boolean)
    .join(" • ") || "—";

  const currencySummary = formatCurrencyLabel(inventory.currency);

  // Modal-based edit UI removed in favor of inline editor.

  return (
    <div className="p-6 md:p-8 text-white">
      <div className="space-y-6">
        {!isGMMode ? (
          <div className="mb-4 flex items-center gap-2">
            <Link
              to="/pcs"
              className="px-3 py-2 rounded-xl text-sm border transition-colors bg-indigo-500/20 border-indigo-400/50 text-white"
            >
              Characters
            </Link>
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
        ) : null}

        {/* Title + Back */}
        <header className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Link
                to="/pcs"
                className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-100 transition"
              >
                <span className="text-lg leading-none">←</span>
                <span>Back to PCs</span>
              </Link>
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-3">
              {pc.name}
              <span className="inline-flex items-center rounded-full bg-indigo-500/20 border border-indigo-400/40 px-3 py-1 text-[11px] font-medium text-indigo-100">
                {pc.level ? `Level ${pc.level} ` : ""}
                {pc.race || pc.type || "Character"}
                {classSummary !== "—" ? ` ${classSummary}` : ""}
              </span>
            </h1>
            <p className="text-xs md:text-sm text-zinc-400 max-w-2xl">
              {pc.background || pc.publicNotes || "A brave disaster waiting to happen."}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2 text-right">
            {isGMMode && (
              <div className="flex flex-wrap justify-end gap-2">
	                <button
	                  type="button"
	                  onClick={handleStartEdit}
	                  disabled={isSaving || isDeleting || isUnassigning}
	                  className="inline-flex items-center rounded-full bg-white/10 border border-white/15 px-3 py-1 text-[11px] font-medium text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50 transition"
	                >
                  Edit In Profile
                </button>
                <button
                  type="button"
                  onClick={handleDeleteCharacter}
	                  disabled={isDeleting || isSaving || isUnassigning || isAssignedToPendingInvitation}
                  title={
                    isAssignedToPendingInvitation
                      ? "Unable to delete this character because it is assigned to a pending invitation."
                      : undefined
                  }
                  className="inline-flex items-center rounded-full bg-rose-500/15 border border-rose-400/40 px-3 py-1 text-[11px] font-medium text-rose-100 hover:bg-rose-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {isDeleting ? "Deleting..." : "Delete Character"}
                </button>
                {acceptedAssignmentForPc ? (
                  <button
	                    type="button"
	                    onClick={handleUnassignCharacter}
	                    disabled={isSaving || isDeleting || isUnassigning}
	                    className="inline-flex items-center rounded-full bg-white/10 border border-white/15 px-3 py-1 text-[11px] font-medium text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50 transition"
	                  >
	                    {isUnassigning ? "Unassigning..." : "Unassign Character"}
	                  </button>
                ) : null}
              </div>
            )}
            {pc.ddbCharacterUrl && (
              <a
                href={pc.ddbCharacterUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-full bg-indigo-500/15 border border-indigo-400/60 px-3 py-1 text-[11px] font-medium text-indigo-100 hover:bg-indigo-500/25 transition"
              >
                Open in D&amp;D Beyond ↗
              </a>
            )}
            <span className="inline-flex items-center rounded-full bg-purple-500/20 border border-purple-400/50 px-3 py-1 text-[11px] font-medium text-purple-100">
              Player Character
            </span>
            <span className="text-[11px] text-zinc-400">
              {isGMMode ? "GM mode: full details visible" : "Player mode: visibility rules apply"}
            </span>
          </div>
        </header>

        {/* Hero card */}
        <section className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row gap-4 md:gap-6 shadow-[0_0_40px_rgba(15,23,42,0.75)] backdrop-blur-sm">
          {/* Left: avatar placeholder + identity */}
          <div className="flex items-start gap-4 flex-1">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-linear-to-br from-indigo-500/40 via-purple-500/30 to-emerald-400/30 border border-white/15 flex items-center justify-center text-xs text-zinc-100 uppercase tracking-wide">
              {pc.name?.slice(0, 2)}
            </div>

            <div className="space-y-2 flex-1">
              <div>
                <h2 className="text-lg md:text-xl font-semibold leading-tight">
                  {pc.name}
                </h2>
                <p className="text-[11px] md:text-xs text-zinc-300">
                  {pc.race || pc.type || "—"}
                  {classSummary !== "—" ? ` · ${classSummary}` : ""}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-[10px] md:text-[11px] text-zinc-200">
                {pc.alignment && (
                  <span className="inline-flex items-center rounded-full bg-black/50 border border-white/15 px-2 py-0.5">
                    {pc.alignment}
                  </span>
                )}
                {pc.background && (
                  <span className="inline-flex items-center rounded-full bg-black/50 border border-white/15 px-2 py-0.5">
                    {pc.background}
                  </span>
                )}
                {pc.age != null && (
                  <span className="inline-flex items-center rounded-full bg-black/50 border border-white/15 px-2 py-0.5">
                    Age {pc.age}
                  </span>
                )}
                {pc.playerName && (
                  <span className="inline-flex items-center rounded-full bg-black/50 border border-white/15 px-2 py-0.5">
                    Player: {pc.playerName}
                  </span>
                )}
              </div>

              {pc.publicNotes && (
                <p className="text-[11px] md:text-xs text-zinc-300 max-w-xl">
                  {pc.publicNotes}
                </p>
              )}
            </div>
          </div>

          {/* Right: core combat stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-3 text-[11px] md:text-xs min-w-50">
            <div className="rounded-xl bg-black/50 border border-white/15 px-3 py-2 flex flex-col">
              <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                Hit Points
              </span>
              <span className="font-semibold text-zinc-100">{hpLabel}</span>
            </div>
            <div className="rounded-xl bg-black/50 border border-white/15 px-3 py-2 flex flex-col">
              <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                Armor Class
              </span>
              <span className="font-semibold text-zinc-100">{acLabel}</span>
            </div>
            <div className="rounded-xl bg-black/50 border border-white/15 px-3 py-2 flex flex-col">
              <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                Speed
              </span>
              <span className="font-semibold text-zinc-100">{speedLabel}</span>
            </div>
            <div className="rounded-xl bg-black/50 border border-white/15 px-3 py-2 flex flex-col">
              <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                Initiative
              </span>
              <span className="font-semibold text-zinc-100">{initLabel}</span>
            </div>
            <div className="rounded-xl bg-black/50 border border-white/15 px-3 py-2 flex flex-col">
              <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                Proficiency
              </span>
              <span className="font-semibold text-zinc-100">{profLabel}</span>
            </div>
            <div className="rounded-xl bg-black/50 border border-white/15 px-3 py-2 flex flex-col col-span-2 sm:col-span-3">
              <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                Spellcasting
              </span>
              <span className="font-semibold text-zinc-100 leading-relaxed">{spellInfo}</span>
            </div>
          </div>
        </section>

        {isEditing ? (
	          <fieldset disabled={isSaving} className="bg-white/5 border border-indigo-400/40 rounded-2xl p-4 md:p-5 space-y-4 disabled:opacity-60">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-indigo-100">
                  Edit Character In Profile
                </h3>
                <p className="text-[11px] md:text-xs text-zinc-400 mt-1">
                  Update the full saved character here, then save directly back to Firebase.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
	                  type="button"
	                  onClick={handleCancelEdit}
	                  disabled={isSaving}
	                  className="rounded-xl border border-zinc-800/70 bg-zinc-900/70 px-4 py-2.5 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800/70 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
	                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="rounded-xl bg-indigo-500/20 border border-indigo-400/50 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSaving ? "Saving..." : "Save Character"}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-4">
              <h4 className="text-sm font-semibold text-white mb-3">Core details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  ["Character name", "name"],
                  ["Player name", "playerName"],
                  ["Race / species", "race"],
                  ["Class", "class"],
                  ["Subclass", "subclass"],
                  ["Level", "level"],
                  ["Alignment", "alignment"],
                  ["Background", "background"],
                ].map(([label, key]) => (
                  <div key={key}>
                    <label className="block text-sm text-zinc-300 mb-1.5">{label}</label>
                    <input
                      type={key === "level" ? "number" : "text"}
                      min={key === "level" ? "1" : undefined}
                      value={activeEditDraft[key] ?? ""}
                      onChange={(e) =>
                        setEditDraft((prev) => ({
                          ...(prev || buildEditDraftFromPc(pc)),
                          [key]: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-4">
              <h4 className="text-sm font-semibold text-white mb-3">Ability scores</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {["str", "dex", "con", "int", "wis", "cha"].map((key) => (
                  <div key={key}>
                    <label className="block text-xs uppercase tracking-wide text-zinc-400 mb-1.5">
                      {key}
                    </label>
                    <input
                      type="number"
                      value={activeEditDraft.stats?.abilities?.[key] ?? ""}
                      onChange={(e) =>
                        setEditDraft((prev) => ({
                          ...(prev || buildEditDraftFromPc(pc)),
                          stats: {
                            ...((prev || buildEditDraftFromPc(pc)).stats || {}),
                            abilities: {
                              ...(((prev || buildEditDraftFromPc(pc)).stats || {}).abilities || {}),
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

            <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-4">
              <h4 className="text-sm font-semibold text-white mb-3">Combat & casting</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  ["HP Max", "hpMax"],
                  ["HP Current", "hpCurrent"],
                  ["Armor Class", "ac"],
                  ["Speed", "speed"],
                  ["Proficiency Bonus", "proficiencyBonus"],
                  ["Spell Save DC", "spellSaveDC"],
                  ["Spell Attack Bonus", "spellAttackBonus"],
                  ["Spellcasting Ability", "spellcastingAbility"],
                  ["Additional Senses", "additionalSenses"],
                ].map(([label, key]) => (
                  <div key={key}>
                    <label className="block text-sm text-zinc-300 mb-1.5">{label}</label>
                    <input
                      value={activeEditDraft.stats?.[key] ?? ""}
                      onChange={(e) =>
                        setEditDraft((prev) => ({
                          ...(prev || buildEditDraftFromPc(pc)),
                          stats: {
                            ...((prev || buildEditDraftFromPc(pc)).stats || {}),
                            [key]: e.target.value,
                          },
                        }))
                      }
                      className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    />
                  </div>
                ))}
              </div>
            </div>
            {Array.isArray(activeEditDraft.spellcasting) && activeEditDraft.spellcasting.length > 0 ? (
              <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-4">
                <h4 className="text-sm font-semibold text-white mb-3">Spellcasting by class</h4>
                <div className="space-y-3">
                  {activeEditDraft.spellcasting.map((entry, index) => (
                    <div
                      key={`${entry.className || "spellcasting"}-${index}`}
                      className="rounded-xl border border-zinc-800/60 bg-zinc-950/30 p-3 space-y-3"
                    >
                      <div className="text-sm font-medium text-white">
                        {entry.className || `Spellcasting ${index + 1}`}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm text-zinc-300 mb-1.5">Ability</label>
                          <input
                            value={entry.ability ?? ""}
                            onChange={(e) =>
                              setEditDraft((prev) => ({
                                ...(prev || buildEditDraftFromPc(pc)),
                                spellcasting: ((prev || buildEditDraftFromPc(pc)).spellcasting || []).map((spellEntry, spellIndex) =>
                                  spellIndex === index
                                    ? {
                                      ...spellEntry,
                                      ability: e.target.value,
                                    }
                                    : spellEntry
                                ),
                              }))
                            }
                            className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-zinc-300 mb-1.5">Spell Save DC</label>
                          <input
                            value={entry.spellSaveDC ?? ""}
                            onChange={(e) =>
                              setEditDraft((prev) => ({
                                ...(prev || buildEditDraftFromPc(pc)),
                                spellcasting: ((prev || buildEditDraftFromPc(pc)).spellcasting || []).map((spellEntry, spellIndex) =>
                                  spellIndex === index
                                    ? {
                                      ...spellEntry,
                                      spellSaveDC: e.target.value,
                                    }
                                    : spellEntry
                                ),
                              }))
                            }
                            className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-zinc-300 mb-1.5">Spell Attack Bonus</label>
                          <input
                            value={entry.spellAttackBonus ?? ""}
                            onChange={(e) =>
                              setEditDraft((prev) => ({
                                ...(prev || buildEditDraftFromPc(pc)),
                                spellcasting: ((prev || buildEditDraftFromPc(pc)).spellcasting || []).map((spellEntry, spellIndex) =>
                                  spellIndex === index
                                    ? {
                                      ...spellEntry,
                                      spellAttackBonus: e.target.value,
                                    }
                                    : spellEntry
                                ),
                              }))
                            }
                            className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-zinc-500">
                  Multiclass spellcasting tracks are stored separately. The top summary uses the first track as the primary fallback.
                </p>
              </div>
            ) : null}

            <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-4">
              <h4 className="text-sm font-semibold text-white mb-3">Saving throws</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {saveConfig.map((save) => {
                  const entry = activeEditDraft.stats?.saves?.[save.key] || {};
                  return (
                    <div key={save.key} className="rounded-xl border border-zinc-800/60 bg-zinc-950/30 p-3 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm text-white font-medium">{save.label}</div>
                          <div className="text-[10px] uppercase tracking-wide text-zinc-500">{save.ability}</div>
                        </div>
                        <label className="inline-flex items-center gap-2 text-xs text-zinc-300">
                          <input
                            type="checkbox"
                            checked={!!entry.proficient}
                            onChange={(e) =>
                              setEditDraft((prev) => ({
                                ...(prev || buildEditDraftFromPc(pc)),
                                stats: {
                                  ...((prev || buildEditDraftFromPc(pc)).stats || {}),
                                  saves: {
                                    ...(((prev || buildEditDraftFromPc(pc)).stats || {}).saves || {}),
                                    [save.key]: {
                                      ...((((prev || buildEditDraftFromPc(pc)).stats || {}).saves || {})[save.key] || {}),
                                      proficient: e.target.checked,
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
                        Modifier recalculates from ability score + proficiency bonus when saved.
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-4">
              <h4 className="text-sm font-semibold text-white mb-3">Skills</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {skillConfig.map((skill) => {
                  const entry = activeEditDraft.stats?.skills?.[skill.key] || {};
                  return (
                    <div key={skill.key} className="rounded-xl border border-zinc-800/60 bg-zinc-950/30 p-3 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm text-white font-medium">{skill.label}</div>
                          <div className="text-[10px] uppercase tracking-wide text-zinc-500">{skill.ability}</div>
                        </div>
                        <div className="flex flex-col gap-2 text-xs text-zinc-300">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!!entry.proficient}
                              onChange={(e) =>
                                setEditDraft((prev) => ({
                                  ...(prev || buildEditDraftFromPc(pc)),
                                  stats: {
                                    ...((prev || buildEditDraftFromPc(pc)).stats || {}),
                                    skills: {
                                      ...(((prev || buildEditDraftFromPc(pc)).stats || {}).skills || {}),
                                      [skill.key]: {
                                        ...((((prev || buildEditDraftFromPc(pc)).stats || {}).skills || {})[skill.key] || {}),
                                        proficient: e.target.checked,
                                        expertise:
                                          e.target.checked
                                            ? !!((((prev || buildEditDraftFromPc(pc)).stats || {}).skills || {})[skill.key]?.expertise)
                                            : false,
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
                                setEditDraft((prev) => ({
                                  ...(prev || buildEditDraftFromPc(pc)),
                                  stats: {
                                    ...((prev || buildEditDraftFromPc(pc)).stats || {}),
                                    skills: {
                                      ...(((prev || buildEditDraftFromPc(pc)).stats || {}).skills || {}),
                                      [skill.key]: {
                                        ...((((prev || buildEditDraftFromPc(pc)).stats || {}).skills || {})[skill.key] || {}),
                                        proficient: e.target.checked
                                          ? true
                                          : !!((((prev || buildEditDraftFromPc(pc)).stats || {}).skills || {})[skill.key]?.proficient),
                                        expertise: e.target.checked,
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
                      <div className="text-xs text-zinc-500">
                        Modifier recalculates from ability score and proficiency when saved.
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-4">
              <h4 className="text-sm font-semibold text-white mb-3">Identity</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  ["Faith", "faith"],
                  ["Size", "size"],
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
                      value={activeEditDraft.identity?.[key] ?? ""}
                      onChange={(e) =>
                        setEditDraft((prev) => ({
                          ...(prev || buildEditDraftFromPc(pc)),
                          identity: {
                            ...((prev || buildEditDraftFromPc(pc)).identity || {}),
                            [key]: e.target.value,
                          },
                        }))
                      }
                      className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-4">
              <h4 className="text-sm font-semibold text-white mb-3">Notes & narrative</h4>
              <div className="grid grid-cols-1 gap-4">
                {[
                  ["Public Notes", "publicNotes", "root"],
                  ["GM Notes", "gmNotes", "root"],
                  ["Secrets", "secrets", "root"],
                  ["Personality Traits", "personalityTraits", "narrative"],
                  ["Ideals", "ideals", "narrative"],
                  ["Bonds", "bonds", "narrative"],
                  ["Flaws", "flaws", "narrative"],
                ].map(([label, key, scope]) => (
                  <div key={key}>
                    <label className="block text-sm text-zinc-300 mb-1.5">{label}</label>
                    <textarea
                      rows={scope === "root" ? 3 : 2}
                      value={scope === "root" ? activeEditDraft[key] ?? "" : activeEditDraft.narrative?.[key] ?? ""}
                      onChange={(e) =>
                        setEditDraft((prev) =>
                          scope === "root"
                            ? {
                              ...(prev || buildEditDraftFromPc(pc)),
                              [key]: e.target.value,
                            }
                            : {
                              ...(prev || buildEditDraftFromPc(pc)),
                              narrative: {
                                ...((prev || buildEditDraftFromPc(pc)).narrative || {}),
                                [key]: e.target.value,
                              },
                            }
                        )
                      }
                      className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    />
                  </div>
                ))}
              </div>
            </div>
	          </fieldset>
        ) : null}

        {/* Metadata strip */}
        <section className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 flex flex-wrap gap-2 text-[10px] md:text-[11px] text-zinc-300">
          <span className="inline-flex items-center gap-1 rounded-full bg-black/50 border border-white/10 px-2 py-0.5 font-mono text-[10px]">
            ID: {pc.id}
          </span>
          {pc.ddbCharacterId && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/50 border border-white/10 px-2 py-0.5 font-mono text-[10px]">
              DDB ID: {pc.ddbCharacterId}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full bg-black/50 border border-white/10 px-2 py-0.5">
            Mode: {isGMMode ? "GM" : "Player"}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-black/50 border border-emerald-400/40 px-2 py-0.5 text-emerald-200">
            Visibility: {pc.visibility || (pc.isPlayerVisible ? "player" : "gm")}
          </span>
        </section>

        <section className="bg-white/5 border border-white/10 rounded-2xl p-3 md:p-4 flex flex-wrap gap-2">
          {profileTabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition ${isActive
                  ? "bg-indigo-500/20 border-indigo-400/50 text-indigo-100"
                  : "bg-black/30 border-white/10 text-zinc-300 hover:bg-white/10 hover:text-white"
                  }`}
              >
                {tab.label}
              </button>
            );
          })}
        </section>

        {/* Two-column layout */}
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6">
          {/* Left / main column: abilities and skills */}
          <div className={activeTab === "narrative" ? "hidden" : "xl:col-span-3 space-y-4"}>
            {/* Abilities */}
            {activeTab === "stats" ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold tracking-tight">Ability Scores</h3>
                  <span className="text-[10px] text-zinc-400">Core stats</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                  {Object.entries(abilityLabels).map(([key, label]) => {
                    const ability = abilities[key] || {};
                    const score = ability.score ?? "—";
                    const mod = ability.mod;
                    const modLabel =
                      typeof mod === "number"
                        ? `${mod >= 0 ? "+" : ""}${mod}`
                        : "—";
                    return (
                      <div
                        key={key}
                        className="rounded-xl bg-black/50 border border-white/15 px-4 py-3 flex flex-col items-center gap-1.5 text-xs md:text-sm"
                      >
                        <span className="text-[10px] uppercase tracking-wide text-zinc-400">
                          {label}
                        </span>
                        <span className="text-lg font-semibold text-zinc-100">
                          {score}
                        </span>
                        <span className="text-[11px] text-zinc-300">{modLabel}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Skills */}
            {activeTab === "skills" ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold tracking-tight">Skills</h3>
                  <span className="text-[10px] text-zinc-400">
                    Ability checks &amp; proficiencies
                  </span>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 text-xs md:text-sm">
                  {skillConfig.map((skill) => {
                    const entry = normalizedSkills[skill.key] || {};
                    const mod = entry.mod;
                    const modLabel =
                      typeof mod === "number"
                        ? `${mod >= 0 ? "+" : ""}${mod}`
                        : "—";
                    const proficient = !!entry.proficient;
                    return (
                      <div
                        key={skill.key}
                        className="flex items-center justify-between gap-2 rounded-lg bg-black/50 border border-white/10 px-3 py-1.5"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium text-zinc-100">
                            {skill.label}
                          </span>
                          <span className="text-[10px] text-zinc-500">
                            {skill.ability}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {entry.expertise ? (
                            <span className="inline-flex items-center rounded-full bg-cyan-500/20 border border-cyan-400/50 px-2 py-0.5 text-[10px] text-cyan-100">
                              Exp
                            </span>
                          ) : proficient ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-500/20 border border-emerald-400/50 px-2 py-0.5 text-[10px] text-emerald-100">
                              Prof
                            </span>
                          ) : null}
                          <span className="font-semibold text-zinc-100 min-w-10 text-right">
                            {modLabel}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {activeTab === "stats" ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold tracking-tight">Saving Throws</h3>
                  <span className="text-[10px] text-zinc-400">Core defenses</span>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 text-xs md:text-sm">
                  {saveConfig.map((save) => {
                    const entry = saves[save.key] || {};
                    const modLabel = formatSignedNumber(entry.mod);
                    const proficient = !!entry.proficient;
                    return (
                      <div
                        key={save.key}
                        className="flex items-center justify-between gap-2 rounded-lg bg-black/50 border border-white/10 px-3 py-1.5"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium text-zinc-100">{save.label}</span>
                          <span className="text-[10px] text-zinc-500">{save.ability}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {proficient && (
                            <span className="inline-flex items-center rounded-full bg-emerald-500/20 border border-emerald-400/50 px-2 py-0.5 text-[10px] text-emerald-100">
                              Prof
                            </span>
                          )}
                          <span className="font-semibold text-zinc-100 min-w-10 text-right">
                            {modLabel}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {activeTab === "stats" ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold tracking-tight">Identity & Senses</h3>
                  <span className="text-[10px] text-zinc-400">Imported details</span>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 text-xs md:text-sm">
                  {[
                    ["Faith", identity.faith],
                    ["Size", identity.size],
                    ["Height", identity.height],
                    ["Weight", identity.weight],
                    ["Gender", identity.gender],
                    ["Eyes", identity.eyes],
                    ["Hair", identity.hair],
                    ["Skin", identity.skin],
                  ]
                    .filter(([, value]) => value)
                    .map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-lg bg-black/50 border border-white/10 px-3 py-2 flex flex-col"
                      >
                        <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                          {label}
                        </span>
                        <span className="text-zinc-100">{value}</span>
                      </div>
                    ))}
                </div>

                <div className="rounded-xl bg-black/50 border border-white/10 px-3 py-3 text-[11px] md:text-xs text-zinc-300">
                  <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">
                    Senses
                  </div>
                  <p>{sensesSummary}</p>
                </div>
              </div>
            ) : null}

            {activeTab === "inventory" ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold tracking-tight">Inventory & Proficiencies</h3>
                  <span className="text-[10px] text-zinc-400">Imported support data</span>
                  <span className="text-[10px] text-zinc-500">
                    {equipment.length} items • {features.length} features • {feats.length} feats
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-[11px] md:text-xs">
                  {[
                    ["CP", inventory.currency?.cp ?? 0],
                    ["SP", inventory.currency?.sp ?? 0],
                    ["EP", inventory.currency?.ep ?? 0],
                    ["GP", inventory.currency?.gp ?? 0],
                    ["PP", inventory.currency?.pp ?? 0],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-lg bg-black/50 border border-white/10 px-3 py-2 flex flex-col"
                    >
                      <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                        {label}
                      </span>
                      <span className="text-zinc-100 font-medium">{value}</span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] md:text-xs">
                  {[
                    ["Languages", formatList(proficiencies.languages)],
                    ["Armor", formatList(proficiencies.armor)],
                    ["Weapons", formatList(proficiencies.weapons)],
                    ["Tools", formatList(proficiencies.tools)],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-lg bg-black/50 border border-white/10 px-3 py-2 flex flex-col"
                    >
                      <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                        {label}
                      </span>
                      <span className="text-zinc-100">{value}</span>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl bg-black/50 border border-white/10 px-3 py-3 text-[11px] md:text-xs text-zinc-300">
                  <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-2">
                    Equipment
                  </div>
                  {equipment.length > 0 ? (
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {equipment.map((item, index) => (
                        <div
                          key={`${item.name || "equipment"}-${index}`}
                          className="rounded-lg bg-white/5 border border-white/10 px-3 py-2"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium text-zinc-100">{item.name || "Unnamed item"}</span>
                            <span className="text-zinc-400 text-right">
                              Qty: {item.qty ?? 1}
                              {item.weight ? ` • Weight: ${item.weight}` : ""}
                              {item.attuned ? " • Attuned" : ""}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-zinc-500">No equipment imported yet.</p>
                  )}
                </div>
              </div>
            ) : null}

          </div>

          {/* Right column: notes & GM section */}
          <div className={activeTab === "narrative" ? "xl:col-span-3 space-y-4" : "hidden"}>
            {activeTab === "narrative" ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold tracking-tight">Narrative Summary</h3>
                  <span className="text-[10px] text-zinc-400">Player-facing</span>
                </div>

                <div className="space-y-3 text-[11px] md:text-xs text-zinc-300">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Public Notes</div>
                    <p className="whitespace-pre-wrap">{pc.publicNotes || "No public notes yet."}</p>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Personality Traits</div>
                    <p className="whitespace-pre-wrap">{narrative.personalityTraits || "No personality traits recorded."}</p>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Ideals</div>
                    <p className="whitespace-pre-wrap">{narrative.ideals || "No ideals recorded."}</p>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Bonds</div>
                    <p className="whitespace-pre-wrap">{narrative.bonds || "No bonds recorded."}</p>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Flaws</div>
                    <p className="whitespace-pre-wrap">{narrative.flaws || "No flaws recorded."}</p>
                  </div>
                </div>
              </div>
            ) : null}

            {/* GM notes */}
            {activeTab === "narrative" ? (
              <div className="bg-white/5 border border-rose-500/40 rounded-2xl p-4 md:p-5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold tracking-tight text-rose-100">
                    GM Notes
                  </h3>
                  <span className="text-[10px] text-rose-300/90">
                    Hidden from players
                  </span>
                </div>

                {isGMMode ? (
                  <>
                    <p className="text-[11px] md:text-xs text-zinc-200 whitespace-pre-wrap">
                      {pc.gmNotes || "No GM notes yet."}
                    </p>
                    {pc.secrets && (
                      <div className="mt-2 rounded-lg bg-black/60 border border-rose-500/40 px-3 py-2 text-[11px] md:text-xs text-rose-100">
                        <div className="text-[10px] uppercase tracking-wide text-rose-300 mb-1">
                          Secrets
                        </div>
                        <p className="whitespace-pre-wrap">{pc.secrets}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-[11px] md:text-xs text-zinc-500 italic">
                    GM-only notes are hidden in player mode.
                  </p>
                )}
              </div>
            ) : null}

            {/* Future: conditions / corruption summary */}
            {activeTab === "narrative" ? (
              <div className="bg-white/5 border border-purple-500/40 rounded-2xl p-4 md:p-5 text-[11px] md:text-xs text-zinc-300">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-semibold tracking-tight text-purple-100">
                    Conditions &amp; Corruption (planned)
                  </h3>
                  <span className="text-[10px] uppercase tracking-wide text-purple-300/80">
                    Powered by Conditions module
                  </span>
                </div>
                <p>
                  Once wired, this panel will summarize active conditions and corruption
                  trackers targeting this PC, pulled from the Conditions module.
                </p>
              </div>
            ) : null}
            {activeTab === "narrative" && isGMMode && pc.importMeta?.source ? (
              <div className="bg-white/5 border border-indigo-400/40 rounded-2xl p-4 md:p-5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold tracking-tight text-indigo-100">
                    Import Metadata
                  </h3>
                  <span className="text-[10px] text-indigo-200/80">GM only</span>
                </div>
                <div className="text-[11px] md:text-xs text-zinc-300 space-y-1">
                  <p><span className="text-zinc-500">Source:</span> {pc.importMeta.source}</p>
                  {pc.importMeta.filename && (
                    <p><span className="text-zinc-500">File:</span> {pc.importMeta.filename}</p>
                  )}
                  {pc.importMeta.confidence && (
                    <p><span className="text-zinc-500">Confidence:</span> {pc.importMeta.confidence}</p>
                  )}
                  {Array.isArray(pc.importMeta.warnings) && pc.importMeta.warnings.length > 0 && (
                    <div className="pt-1">
                      <div className="text-zinc-500 mb-1">Warnings</div>
                      <ul className="list-disc pl-5 space-y-1 text-zinc-200">
                        {pc.importMeta.warnings.map((warning, index) => (
                          <li key={`${warning}-${index}`}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
};

export default PCProfile;
