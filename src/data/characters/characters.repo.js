import { apiFetch } from "../api/apiClient";
import { createEmptyCharacter } from "./character.model";

function normalizeAbilityEntry(entry = {}) {
  return {
    score: typeof entry?.score === "number" ? entry.score : undefined,
    mod: typeof entry?.mod === "number" ? entry.mod : undefined,
  };
}

function normalizeSaveOrSkillMap(input = {}) {
  const out = {};
  for (const [key, value] of Object.entries(input || {})) {
    out[key] = {
      mod: typeof value?.mod === "number" ? value.mod : undefined,
      proficient: value?.proficient === true,
      expertise: value?.expertise === true,
    };
  }
  return out;
}

function stripUndefinedDeep(value) {
  if (Array.isArray(value)) {
    return value.map(stripUndefinedDeep);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, stripUndefinedDeep(entryValue)])
    );
  }

  return value;
}

function normalizeCharacter(input = {}) {
  const base = createEmptyCharacter();

  return {
    ...base,
    ...input,

    id: input?.id || base.id,
    name: input?.name || base.name,
    level: Number(input?.level) || base.level,

    classes: Array.isArray(input?.classes)
      ? input.classes.map((entry) => ({
          className: entry?.className || "",
          level: Number(entry?.level) || 0,
          subclass: entry?.subclass || "",
          spellcastingAbility: entry?.spellcastingAbility || "",
        }))
      : [],

    identity: {
      ...base.identity,
      ...(input?.identity || {}),
    },

    proficiencies: {
      ...base.proficiencies,
      ...(input?.proficiencies || {}),
      armor: Array.isArray(input?.proficiencies?.armor) ? input.proficiencies.armor : [],
      weapons: Array.isArray(input?.proficiencies?.weapons) ? input.proficiencies.weapons : [],
      tools: Array.isArray(input?.proficiencies?.tools) ? input.proficiencies.tools : [],
      languages: Array.isArray(input?.proficiencies?.languages) ? input.proficiencies.languages : [],
    },

    inventory: {
      currency: {
        cp: Number(input?.inventory?.currency?.cp) || 0,
        sp: Number(input?.inventory?.currency?.sp) || 0,
        ep: Number(input?.inventory?.currency?.ep) || 0,
        gp: Number(input?.inventory?.currency?.gp) || 0,
        pp: Number(input?.inventory?.currency?.pp) || 0,
      },
      equipment: Array.isArray(input?.inventory?.equipment)
        ? input.inventory.equipment.map((item) => ({
            name: item?.name || "",
            qty: Number(item?.qty) || 1,
            weight: item?.weight || "",
            attuned: item?.attuned === true,
            notes: item?.notes || "",
          }))
        : [],
    },

    actions: {
      raw: input?.actions?.raw || "",
      weapons: Array.isArray(input?.actions?.weapons)
        ? input.actions.weapons.map((weapon) => ({
            name: weapon?.name || "",
            attackBonus: weapon?.attackBonus || "",
            damage: weapon?.damage || "",
            notes: weapon?.notes || "",
          }))
        : [],
    },

    spells: Array.isArray(input?.spells)
      ? input.spells.map((spell) => ({
          className: spell?.className || "",
          levelGroup: spell?.levelGroup || "",
          name: spell?.name || "",
          source: spell?.source || "",
          saveOrAttack: spell?.saveOrAttack || "",
          castingTime: spell?.castingTime || "",
          range: spell?.range || "",
          components: spell?.components || "",
          duration: spell?.duration || "",
          notes: spell?.notes || "",
          preparedState: spell?.preparedState || "unknown",
        }))
      : [],

    narrative: {
      ...base.narrative,
      ...(input?.narrative || {}),
    },

    importMeta: {
      ...base.importMeta,
      ...(input?.importMeta || {}),
      warnings: Array.isArray(input?.importMeta?.warnings) ? input.importMeta.warnings : [],
    },

    stats: {
      ...base.stats,
      ...(input?.stats || {}),

      abilities: {
        str: normalizeAbilityEntry(input?.stats?.abilities?.str),
        dex: normalizeAbilityEntry(input?.stats?.abilities?.dex),
        con: normalizeAbilityEntry(input?.stats?.abilities?.con),
        int: normalizeAbilityEntry(input?.stats?.abilities?.int),
        wis: normalizeAbilityEntry(input?.stats?.abilities?.wis),
        cha: normalizeAbilityEntry(input?.stats?.abilities?.cha),
      },

      saves: normalizeSaveOrSkillMap(input?.stats?.saves || {}),
      skills: normalizeSaveOrSkillMap(input?.stats?.skills || {}),

      defenses: {
        ...base.stats.defenses,
        ...(input?.stats?.defenses || {}),
        resistances: Array.isArray(input?.stats?.defenses?.resistances)
          ? input.stats.defenses.resistances
          : [],
        immunities: Array.isArray(input?.stats?.defenses?.immunities)
          ? input.stats.defenses.immunities
          : [],
        vulnerabilities: Array.isArray(input?.stats?.defenses?.vulnerabilities)
          ? input.stats.defenses.vulnerabilities
          : [],
      },
    },
  };
}

export async function getAllCharacters(campaignId) {
  if (!campaignId) return [];
  const response = await apiFetch(
    `/api/characters?campaignId=${encodeURIComponent(campaignId)}`
  );
  return (Array.isArray(response.characters) ? response.characters : []).map((character) =>
    normalizeCharacter(character)
  );
}

export async function getCharacterById(campaignId, id) {
  if (!campaignId || !id) return null;
  const response = await apiFetch(
    `/api/characters?campaignId=${encodeURIComponent(
      campaignId
    )}&characterId=${encodeURIComponent(id)}`
  );
  return response.character ? normalizeCharacter(response.character) : null;
}

export async function upsertCharacter(campaignId, input) {
  if (!campaignId) throw new Error("campaignId is required");
  const normalized = normalizeCharacter(input);
  const apiSafeCharacter = stripUndefinedDeep(normalized);
  const response = await apiFetch(
    `/api/characters?campaignId=${encodeURIComponent(campaignId)}`,
    {
      method: "PUT",
      body: JSON.stringify({ character: apiSafeCharacter }),
    }
  );
  return normalizeCharacter(response.character || normalized);
}

export async function removeCharacter(campaignId, id) {
  if (!campaignId || !id) return;
  await apiFetch(
    `/api/characters?campaignId=${encodeURIComponent(
      campaignId
    )}&characterId=${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    }
  );
}

export { normalizeCharacter };
