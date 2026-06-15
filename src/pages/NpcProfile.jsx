// src/pages/NpcProfile.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, Lock, Plus, Trash2 } from "lucide-react";
import { useMode } from "../context/ModeContext.jsx";
import { useCampaign } from "../context/CampaignContext";
import { npcsRepo } from "../data/npcs/npcs.repo";
import {
  getNpcTypeIcon,
  normalizeNpcType,
  NPC_TYPE_LABELS,
  NPC_TYPES,
} from "../data/npcs/npcMeta.jsx";

const NPC_ROLES = ["ally", "neutral", "antagonist", "unknown"];
const NPC_STATUSES = ["active", "missing", "dead", "unknown"];
const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
const SIZE_OPTIONS = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"];
const CREATURE_TYPE_OPTIONS = [
  "Aberration",
  "Beast",
  "Celestial",
  "Construct",
  "Dragon",
  "Elemental",
  "Fey",
  "Fiend",
  "Giant",
  "Humanoid",
  "Monstrosity",
  "Ooze",
  "Plant",
  "Undead",
];
const ALIGNMENT_OPTIONS = [
  "Unaligned",
  "Lawful Good",
  "Neutral Good",
  "Chaotic Good",
  "Lawful Neutral",
  "Neutral",
  "Chaotic Neutral",
  "Lawful Evil",
  "Neutral Evil",
  "Chaotic Evil",
];
const REPEATING_STAT_SECTIONS = [
  ["traits", "Traits"],
  ["actions", "Actions"],
  ["bonusActions", "Bonus Actions"],
  ["reactions", "Reactions"],
  ["legendaryActions", "Legendary Actions"],
];

const ROLE_LABELS = {
  ally: "Ally",
  neutral: "Neutral",
  antagonist: "Antagonist",
  unknown: "Unknown",
};

const STATUS_LABELS = {
  active: "Active",
  missing: "Missing",
  dead: "Dead",
  unknown: "Unknown",
};

const STAT_FIELD_LABELS = {
  savingThrows: "Saving Throws",
  skills: "Skills",
  resistances: "Resistances",
  immunities: "Immunities",
  senses: "Senses",
  languages: "Languages",
  challenge: "Challenge",
  proficiencyBonus: "Proficiency Bonus",
};

function normalizeRole(value) {
  const role = String(value || "").trim().toLowerCase();
  return NPC_ROLES.includes(role) ? role : "unknown";
}

function normalizeStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  return NPC_STATUSES.includes(status) ? status : "unknown";
}

function renderInlineMarkdown(text) {
  const raw = String(text || "");
  const parts = [];
  const pattern = /(\*\*[^*]+\*\*|_[^_]+_|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      parts.push(raw.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={parts.length}>{token.slice(2, -2)}</strong>);
    } else {
      parts.push(<em key={parts.length}>{token.slice(1, -1)}</em>);
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < raw.length) {
    parts.push(raw.slice(lastIndex));
  }

  return parts.map((part, index) =>
    typeof part === "string" ? <React.Fragment key={index}>{part}</React.Fragment> : part
  );
}

function renderMarkdownBlock(value, placeholder = "") {
  const text = String(value || "").trim();
  if (!text) {
    return <p className="text-zinc-500 text-sm italic">{placeholder}</p>;
  }

  const nodes = [];
  let paragraphLines = [];
  let listItems = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    const content = paragraphLines.join("\n");
    nodes.push(
      <p key={`p-${nodes.length}`} className="whitespace-pre-line leading-6">
        {renderInlineMarkdown(content)}
      </p>
    );
    paragraphLines = [];
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    nodes.push(
      <ul key={`ul-${nodes.length}`} className="list-disc space-y-1 pl-5">
        {listItems.map((item, index) => (
          <li key={index}>{renderInlineMarkdown(item)}</li>
        ))}
      </ul>
    );
    listItems = [];
  };

  text.split("\n").forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();

      const level = heading[1].length;
      const className =
        level === 1
          ? "text-xl font-semibold text-white"
          : level === 2
            ? "text-lg font-semibold text-white"
            : "text-base font-semibold text-zinc-100";

      nodes.push(
        <h3 key={`h-${nodes.length}`} className={className}>
          {renderInlineMarkdown(heading[2])}
        </h3>
      );
      return;
    }

    const listItem = trimmed.match(/^[-*]\s+(.+)$/);
    if (listItem) {
      flushParagraph();
      listItems.push(listItem[1]);
      return;
    }

    flushList();
    paragraphLines.push(line.trimEnd());
  });

  flushParagraph();
  flushList();

  return <div className="space-y-3 text-sm text-zinc-300">{nodes}</div>;
}

function createEmptyStatBlock() {
  return {
    size: "",
    creatureType: "",
    tags: "",
    alignment: "",
    alignmentOverride: "",
    initiative: "",
    armorClass: "",
    hitPoints: "",
    speed: "",
    abilities: {
      str: "",
      dex: "",
      con: "",
      int: "",
      wis: "",
      cha: "",
    },
    abilitySaves: {
      str: "",
      dex: "",
      con: "",
      int: "",
      wis: "",
      cha: "",
    },
    savingThrows: "",
    skills: "",
    vulnerabilities: "",
    resistances: "",
    immunities: "",
    senses: "",
    languages: "",
    challenge: "",
    proficiencyBonus: "",
    traits: [],
    actions: [],
    bonusActions: [],
    reactions: [],
    legendaryActionsDescription: "",
    legendaryActions: [],
    lairActionsDescription: "",
    lairActions: [],
    spellcasting: "",
  };
}

function normalizeEntryList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => ({
    name: String(entry?.name || ""),
    text: String(entry?.text || ""),
  }));
}

function normalizeAbility(value) {
  if (value === "" || value === null || value === undefined) return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : "";
}

function normalizeStatBlock(value) {
  const source = value && typeof value === "object" ? value : {};
  const empty = createEmptyStatBlock();

  return {
    ...empty,
    size: String(source.size || ""),
    creatureType: String(source.creatureType || ""),
    tags: String(source.tags || ""),
    alignment: String(source.alignment || ""),
    alignmentOverride: String(source.alignmentOverride || ""),
    initiative: String(source.initiative || ""),
    armorClass: String(source.armorClass || ""),
    hitPoints: String(source.hitPoints || ""),
    speed: String(source.speed || ""),
    abilities: {
      ...empty.abilities,
      ...Object.fromEntries(
        ABILITIES.map((ability) => [ability, normalizeAbility(source.abilities?.[ability])])
      ),
    },
    abilitySaves: {
      ...empty.abilitySaves,
      ...Object.fromEntries(
        ABILITIES.map((ability) => [ability, String(source.abilitySaves?.[ability] || "")])
      ),
    },
    savingThrows: String(source.savingThrows || ""),
    skills: String(source.skills || ""),
    vulnerabilities: String(source.vulnerabilities || ""),
    resistances: String(source.resistances || ""),
    immunities: String(source.immunities || ""),
    senses: String(source.senses || ""),
    languages: String(source.languages || ""),
    challenge: String(source.challenge || ""),
    proficiencyBonus: String(source.proficiencyBonus || ""),
    traits: normalizeEntryList(source.traits),
    actions: normalizeEntryList(source.actions),
    bonusActions: normalizeEntryList(source.bonusActions),
    reactions: normalizeEntryList(source.reactions),
    legendaryActionsDescription: String(source.legendaryActionsDescription || ""),
    legendaryActions: normalizeEntryList(source.legendaryActions),
    lairActionsDescription: String(source.lairActionsDescription || ""),
    lairActions: normalizeEntryList(source.lairActions),
    spellcasting: String(source.spellcasting || ""),
  };
}

function hasText(value) {
  return String(value || "").trim().length > 0;
}

function hasEntryContent(entry) {
  return hasText(entry?.name) || hasText(entry?.text);
}

function isStatBlockEmpty(statBlock) {
  const block = normalizeStatBlock(statBlock);
  const topLevelFields = [
    "size",
    "creatureType",
    "tags",
    "alignment",
    "alignmentOverride",
    "initiative",
    "armorClass",
    "hitPoints",
    "speed",
    "savingThrows",
    "skills",
    "vulnerabilities",
    "resistances",
    "immunities",
    "senses",
    "languages",
    "challenge",
    "proficiencyBonus",
    "legendaryActionsDescription",
    "lairActionsDescription",
    "spellcasting",
  ];

  return (
    topLevelFields.every((field) => !hasText(block[field])) &&
    ABILITIES.every((ability) => block.abilities[ability] === "") &&
    ABILITIES.every((ability) => !hasText(block.abilitySaves[ability])) &&
    REPEATING_STAT_SECTIONS.every(([key]) => block[key].every((entry) => !hasEntryContent(entry))) &&
    block.lairActions.every((entry) => !hasEntryContent(entry))
  );
}

function abilityModifier(score) {
  if (score === "" || score === null || score === undefined) return "";
  const modifier = Math.floor((Number(score) - 10) / 2);
  return `${modifier >= 0 ? "+" : ""}${modifier}`;
}

function normalizeStatBlockVisibility(value) {
  return value === "public" ? "public" : "gm-only";
}

function buildDraft(npc) {
  return {
    id: npc?.id || "",
    name: npc?.name || "",
    title: npc?.title || "",
    aliases: normalizeAliases(npc?.aliases),
    type: normalizeNpcType(npc?.type),
    role: normalizeRole(npc?.role),
    status: normalizeStatus(npc?.status || "active"),
    visibility: npc?.visibility === "gm-only" ? "gm-only" : "public",
    summary: npc?.summary || "",
    description: npc?.description || "",
    gmNotes: npc?.gmNotes || "",
    imageUrl: npc?.imageUrl || "",
    statBlock: normalizeStatBlock(npc?.statBlock),
    statBlockVisibility: normalizeStatBlockVisibility(npc?.statBlockVisibility),
  };
}

function normalizeAliases(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const aliases = [];

  value.forEach((alias) => {
    const trimmed = String(alias || "").trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) return;
    seen.add(key);
    aliases.push(trimmed);
  });

  return aliases;
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function TextInput({ value, onChange, disabled, type = "text" }) {
  return (
    <input
      type={type}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-purple-500/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}

function TextArea({ value, onChange, disabled, rows = 4 }) {
  return (
    <textarea
      rows={rows}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-purple-500/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}

function SelectInput({ value, onChange, disabled, children }) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-2 text-sm text-white focus:border-purple-500/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </select>
  );
}

function PlaceholderCard({ title, children }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">{title}</h2>
      <p className="mt-2 text-sm text-zinc-500">{children}</p>
    </section>
  );
}

function StatBlockView({ statBlock }) {
  const block = normalizeStatBlock(statBlock);
  const creatureDescriptor =
    block.creatureType && block.tags
      ? `${block.creatureType} (${block.tags})`
      : block.creatureType || block.tags;
  const alignmentDescriptor = block.alignmentOverride || block.alignment;
  const hasHeader = [block.size, creatureDescriptor, alignmentDescriptor].some(hasText);
  const detailRows = [
    ["Initiative", block.initiative],
    ["Armor Class", block.armorClass],
    ["Hit Points", block.hitPoints],
    ["Speed", block.speed],
    ["Saving Throws", block.savingThrows],
    ["Skills", block.skills],
    ["Vulnerabilities", block.vulnerabilities],
    ["Resistances", block.resistances],
    ["Immunities", block.immunities],
    ["Senses", block.senses],
    ["Languages", block.languages],
    ["Challenge", block.challenge],
    ["Proficiency Bonus", block.proficiencyBonus],
  ].filter(([, value]) => hasText(value));
  const filledAbilities = ABILITIES.filter((ability) => block.abilities[ability] !== "");
  const visibleRepeatingSections = REPEATING_STAT_SECTIONS.map(([key, label]) => [
    key,
    label,
    block[key].filter(hasEntryContent),
  ]).filter(([key, , entries]) => key !== "legendaryActions" && entries.length > 0);
  const visibleLegendaryActions = block.legendaryActions.filter(hasEntryContent);
  const shouldShowLegendaryActions =
    hasText(block.legendaryActionsDescription) || visibleLegendaryActions.length > 0;
  const visibleLairActions = block.lairActions.filter(hasEntryContent);
  const shouldShowLairActions =
    hasText(block.lairActionsDescription) || visibleLairActions.length > 0;

  if (isStatBlockEmpty(block)) {
    return (
      <p className="rounded-xl border border-amber-200/10 bg-amber-100/5 px-4 py-3 text-sm text-zinc-500">
        No stat block added yet.
      </p>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-200/20 bg-[#21180f]/80 p-5 text-amber-50 shadow-inner">
      {hasHeader ? (
        <p className="text-sm italic text-amber-100/80">
          {[block.size, creatureDescriptor, alignmentDescriptor].filter(hasText).join(", ")}
        </p>
      ) : null}

      {detailRows.length > 0 ? (
        <div className="mt-4 space-y-1 border-y border-amber-200/20 py-3 text-sm">
          {detailRows.map(([label, value]) => (
            <p key={label}>
              <span className="font-semibold text-amber-200">{label}</span>{" "}
              <span className="text-amber-50/90">{value}</span>
            </p>
          ))}
        </div>
      ) : null}

      {filledAbilities.length > 0 ? (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {ABILITIES.map((ability) => {
            const score = block.abilities[ability];
            if (score === "") return null;
            return (
              <div key={ability} className="rounded-lg border border-amber-200/20 bg-black/20 p-2 text-center">
                <div className="text-[10px] font-bold uppercase tracking-wide text-amber-200">
                  {ability}
                </div>
                <div className="text-base font-semibold text-amber-50">{score}</div>
                <div className="text-xs text-amber-100/70">{abilityModifier(score)}</div>
                {hasText(block.abilitySaves[ability]) ? (
                  <div className="mt-1 text-[10px] uppercase tracking-wide text-amber-200/80">
                    Save {block.abilitySaves[ability]}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="2xl:columns-2 2xl:gap-6">
        {block.spellcasting ? (
          <div className="mt-5 break-inside-avoid border-t border-amber-200/20 pt-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-amber-200">Spellcasting</h3>
            <div className="mt-2">{renderMarkdownBlock(block.spellcasting)}</div>
          </div>
        ) : null}

        {visibleRepeatingSections.map(([key, label, entries]) => (
          <div key={key} className="mt-5 break-inside-avoid border-t border-amber-200/20 pt-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-amber-200">{label}</h3>
            <div className="mt-3 space-y-4">
              {entries.map((entry, index) => (
                <div key={`${key}-${index}`} className="break-inside-avoid">
                  {entry.name ? (
                    <h4 className="text-sm font-semibold text-amber-100">{entry.name}</h4>
                  ) : null}
                  {entry.text ? <div className="mt-1">{renderMarkdownBlock(entry.text)}</div> : null}
                </div>
              ))}
            </div>
          </div>
        ))}

        {shouldShowLegendaryActions ? (
          <div className="mt-5 break-inside-avoid border-t border-amber-200/20 pt-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-amber-200">
              Legendary Actions
            </h3>
            {block.legendaryActionsDescription ? (
              <div className="mt-2">{renderMarkdownBlock(block.legendaryActionsDescription)}</div>
            ) : null}
            {visibleLegendaryActions.length > 0 ? (
              <div className="mt-3 space-y-4">
                {visibleLegendaryActions.map((entry, index) => (
                  <div key={`legendaryActions-${index}`} className="break-inside-avoid">
                    {entry.name ? (
                      <h4 className="text-sm font-semibold text-amber-100">{entry.name}</h4>
                    ) : null}
                    {entry.text ? <div className="mt-1">{renderMarkdownBlock(entry.text)}</div> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {shouldShowLairActions ? (
          <div className="mt-5 break-inside-avoid border-t border-amber-200/20 pt-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-amber-200">
              Lair Actions
            </h3>
            {block.lairActionsDescription ? (
              <div className="mt-2">{renderMarkdownBlock(block.lairActionsDescription)}</div>
            ) : null}
            {visibleLairActions.length > 0 ? (
              <div className="mt-3 space-y-4">
                {visibleLairActions.map((entry, index) => (
                  <div key={`lairActions-${index}`} className="break-inside-avoid">
                    {entry.name ? (
                      <h4 className="text-sm font-semibold text-amber-100">{entry.name}</h4>
                    ) : null}
                    {entry.text ? <div className="mt-1">{renderMarkdownBlock(entry.text)}</div> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RepeatingSectionEditor({
  label,
  entries,
  disabled,
  onAdd,
  onRemove,
  onChange,
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-white">{label}</h4>
        <button
          type="button"
          disabled={disabled}
          onClick={onAdd}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-zinc-500">No entries yet.</p>
      ) : (
        entries.map((entry, index) => (
          <div key={index} className="space-y-2 rounded-xl border border-white/10 bg-black/10 p-3">
            <div className="flex items-center gap-2">
              <input
                value={entry.name}
                disabled={disabled}
                placeholder="Name"
                onChange={(e) => onChange(index, "name", e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-purple-500/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => onRemove(index)}
                className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-2 text-rose-100 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <TextArea
              rows={3}
              value={entry.text}
              disabled={disabled}
              onChange={(value) => onChange(index, "text", value)}
            />
          </div>
        ))
      )}
    </div>
  );
}

function StatBlockEditor({
  statBlock,
  disabled,
  onFieldChange,
  onAbilityChange,
  onEntryAdd,
  onEntryRemove,
  onEntryChange,
}) {
  const block = normalizeStatBlock(statBlock);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Basic Info</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Size">
            <SelectInput disabled={disabled} value={block.size} onChange={(value) => onFieldChange("size", value)}>
              <option value="">Select size</option>
              {SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Creature Type">
            <SelectInput disabled={disabled} value={block.creatureType} onChange={(value) => onFieldChange("creatureType", value)}>
              <option value="">Select type</option>
              {CREATURE_TYPE_OPTIONS.map((creatureType) => (
                <option key={creatureType} value={creatureType}>
                  {creatureType}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Subtype">
            <TextInput disabled={disabled} value={block.tags} onChange={(value) => onFieldChange("tags", value)} />
          </Field>
          <Field label="Alignment">
            <SelectInput disabled={disabled} value={block.alignment} onChange={(value) => onFieldChange("alignment", value)}>
              <option value="">Select alignment</option>
              {ALIGNMENT_OPTIONS.map((alignment) => (
                <option key={alignment} value={alignment}>
                  {alignment}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Alignment Override">
            <TextInput disabled={disabled} value={block.alignmentOverride} onChange={(value) => onFieldChange("alignmentOverride", value)} />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Defenses</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Initiative">
            <TextInput disabled={disabled} value={block.initiative} onChange={(value) => onFieldChange("initiative", value)} />
          </Field>
          <Field label="Armor Class">
            <TextInput disabled={disabled} value={block.armorClass} onChange={(value) => onFieldChange("armorClass", value)} />
          </Field>
          <Field label="Hit Points">
            <TextInput disabled={disabled} value={block.hitPoints} onChange={(value) => onFieldChange("hitPoints", value)} />
          </Field>
          <Field label="Speed">
            <TextInput disabled={disabled} value={block.speed} onChange={(value) => onFieldChange("speed", value)} />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Ability Scores</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ABILITIES.map((ability) => (
            <Field key={ability} label={ability.toUpperCase()}>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  disabled={disabled}
                  value={block.abilities[ability]}
                  onChange={(e) => onAbilityChange(ability, "score", e.target.value)}
                  placeholder="Score"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-purple-500/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
                <input
                  disabled={disabled}
                  value={block.abilitySaves[ability]}
                  onChange={(e) => onAbilityChange(ability, "save", e.target.value)}
                  placeholder="Save"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-purple-500/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </Field>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Proficiencies / Senses / Languages</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {["savingThrows", "skills", "senses", "languages", "challenge", "proficiencyBonus"].map((field) => (
            <Field key={field} label={STAT_FIELD_LABELS[field]}>
              <TextInput disabled={disabled} value={block[field]} onChange={(value) => onFieldChange(field, value)} />
            </Field>
          ))}
          <Field label="Resistances">
            <TextInput disabled={disabled} value={block.resistances} onChange={(value) => onFieldChange("resistances", value)} />
          </Field>
          <Field label="Vulnerabilities">
            <TextInput disabled={disabled} value={block.vulnerabilities} onChange={(value) => onFieldChange("vulnerabilities", value)} />
          </Field>
          <Field label="Immunities">
            <TextInput disabled={disabled} value={block.immunities} onChange={(value) => onFieldChange("immunities", value)} />
          </Field>
        </div>
      </section>

      {REPEATING_STAT_SECTIONS.filter(([key]) => key !== "legendaryActions").map(([key, label]) => (
        <RepeatingSectionEditor
          key={key}
          label={label}
          entries={block[key]}
          disabled={disabled}
          onAdd={() => onEntryAdd(key)}
          onRemove={(index) => onEntryRemove(key, index)}
          onChange={(index, field, value) => onEntryChange(key, index, field, value)}
        />
      ))}

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="text-sm font-semibold text-white">Legendary Actions</h3>
        <Field label="Description">
          <TextArea
            rows={4}
            disabled={disabled}
            value={block.legendaryActionsDescription}
            onChange={(value) => onFieldChange("legendaryActionsDescription", value)}
          />
        </Field>
        <RepeatingSectionEditor
          label="Legendary Action Entries"
          entries={block.legendaryActions}
          disabled={disabled}
          onAdd={() => onEntryAdd("legendaryActions")}
          onRemove={(index) => onEntryRemove("legendaryActions", index)}
          onChange={(index, field, value) => onEntryChange("legendaryActions", index, field, value)}
        />
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="text-sm font-semibold text-white">Lair Actions</h3>
        <Field label="Description">
          <TextArea
            rows={4}
            disabled={disabled}
            value={block.lairActionsDescription}
            onChange={(value) => onFieldChange("lairActionsDescription", value)}
          />
        </Field>
        <RepeatingSectionEditor
          label="Lair Action Entries"
          entries={block.lairActions}
          disabled={disabled}
          onAdd={() => onEntryAdd("lairActions")}
          onRemove={(index) => onEntryRemove("lairActions", index)}
          onChange={(index, field, value) => onEntryChange("lairActions", index, field, value)}
        />
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Spellcasting</h3>
        <TextArea
          rows={5}
          disabled={disabled}
          value={block.spellcasting}
          onChange={(value) => onFieldChange("spellcasting", value)}
        />
      </section>
    </div>
  );
}

export default function NpcProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isGM } = useMode();
  const { selectedCampaignId } = useCampaign();

  const [npc, setNpc] = useState(null);
  const [draft, setDraft] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isStatBlockCollapsed, setIsStatBlockCollapsed] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadNpc() {
      if (!selectedCampaignId || !id) {
        setNpc(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError("");
        const data = await npcsRepo.getById(selectedCampaignId, id);
        if (!cancelled) {
          setNpc(data);
          setDraft(data ? buildDraft(data) : null);
          setIsStatBlockCollapsed(data ? isStatBlockEmpty(data.statBlock) : true);
        }
      } catch (loadError) {
        console.error("[NpcProfile] Failed to load NPC", loadError);
        if (!cancelled) {
          setNpc(null);
          setError("Unable to load this NPC right now.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadNpc();

    return () => {
      cancelled = true;
    };
  }, [selectedCampaignId, id]);

  const visibleDescription = useMemo(
    () => [npc?.summary, npc?.description].filter(Boolean).join("\n\n"),
    [npc]
  );

  const updateDraft = (field, value) => {
    setDraft((current) => ({
      ...(current || buildDraft(npc)),
      [field]: value,
    }));
  };

  const updateAlias = (index, value) => {
    setDraft((current) => {
      const next = current || buildDraft(npc);
      const aliases = Array.isArray(next.aliases) ? [...next.aliases] : [];
      aliases[index] = value;
      return { ...next, aliases };
    });
  };

  const addAlias = () => {
    setDraft((current) => {
      const next = current || buildDraft(npc);
      return { ...next, aliases: [...(next.aliases || []), ""] };
    });
  };

  const removeAlias = (index) => {
    setDraft((current) => {
      const next = current || buildDraft(npc);
      return {
        ...next,
        aliases: (next.aliases || []).filter((_, aliasIndex) => aliasIndex !== index),
      };
    });
  };

  const updateStatBlock = (field, value) => {
    setDraft((current) => {
      const next = current || buildDraft(npc);
      return {
        ...next,
        statBlock: {
          ...normalizeStatBlock(next.statBlock),
          [field]: value,
        },
      };
    });
  };

  const updateAbility = (ability, field, value) => {
    setDraft((current) => {
      const next = current || buildDraft(npc);
      const block = normalizeStatBlock(next.statBlock);

      if (field === "save") {
        return {
          ...next,
          statBlock: {
            ...block,
            abilitySaves: {
              ...block.abilitySaves,
              [ability]: value,
            },
          },
        };
      }

      return {
        ...next,
        statBlock: {
          ...block,
          abilities: {
            ...block.abilities,
            [ability]: normalizeAbility(value),
          },
        },
      };
    });
  };

  const addStatEntry = (section) => {
    setDraft((current) => {
      const next = current || buildDraft(npc);
      const block = normalizeStatBlock(next.statBlock);
      return {
        ...next,
        statBlock: {
          ...block,
          [section]: [...block[section], { name: "", text: "" }],
        },
      };
    });
  };

  const removeStatEntry = (section, index) => {
    setDraft((current) => {
      const next = current || buildDraft(npc);
      const block = normalizeStatBlock(next.statBlock);
      return {
        ...next,
        statBlock: {
          ...block,
          [section]: block[section].filter((_, entryIndex) => entryIndex !== index),
        },
      };
    });
  };

  const updateStatEntry = (section, index, field, value) => {
    setDraft((current) => {
      const next = current || buildDraft(npc);
      const block = normalizeStatBlock(next.statBlock);
      return {
        ...next,
        statBlock: {
          ...block,
          [section]: block[section].map((entry, entryIndex) =>
            entryIndex === index ? { ...entry, [field]: value } : entry
          ),
        },
      };
    });
  };

  const handleStartEdit = () => {
    if (!isGM || !npc || isSaving || isDeleting) return;
    setDraft(buildDraft(npc));
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (isSaving) return;
    setDraft(buildDraft(npc));
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!isGM || !selectedCampaignId || !draft || isSaving) return;

    try {
      setIsSaving(true);
      const savedNpc = await npcsRepo.upsert(selectedCampaignId, {
        ...draft,
        name: draft.name.trim(),
        title: draft.title.trim(),
        aliases: normalizeAliases(draft.aliases),
        type: normalizeNpcType(draft.type),
        role: normalizeRole(draft.role),
        summary: draft.summary.trim(),
        description: draft.description.trim(),
        gmNotes: draft.gmNotes.trim(),
        imageUrl: draft.imageUrl.trim(),
        statBlock: normalizeStatBlock(draft.statBlock),
        statBlockVisibility: normalizeStatBlockVisibility(draft.statBlockVisibility),
      });
      setNpc(savedNpc);
      setDraft(buildDraft(savedNpc));
      setIsStatBlockCollapsed(isStatBlockEmpty(savedNpc.statBlock));
      setIsEditing(false);
    } catch (saveError) {
      console.error("[NpcProfile] Failed to save NPC", saveError);
      setError("Unable to save this NPC right now.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isGM || !selectedCampaignId || !npc || isDeleting || isSaving) return;
    const confirmed = window.confirm(`Delete ${npc.name || "this NPC"}?`);
    if (!confirmed) return;

    try {
      setIsDeleting(true);
      await npcsRepo.remove(selectedCampaignId, npc.id);
      navigate("/npcs");
    } catch (deleteError) {
      console.error("[NpcProfile] Failed to delete NPC", deleteError);
      setError("Unable to delete this NPC right now.");
      setIsDeleting(false);
    }
  };

  if (!selectedCampaignId) {
    return (
      <main className="flex-1 overflow-auto flex items-center justify-center p-8">
        <div className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <h1 className="text-xl font-semibold text-white">Select a campaign</h1>
          <p className="mt-2 text-sm text-zinc-400">
            NPC profiles are scoped to the active campaign.
          </p>
        </div>
      </main>
    );
  }

  if (isLoading) {
    return <main className="p-8 text-zinc-400">Loading NPC...</main>;
  }

  if (!npc) {
    return (
      <main className="p-8 text-white">
        <div className="max-w-xl bg-white/5 border border-white/10 rounded-2xl p-8">
          <h1 className="text-2xl font-bold">NPC not found</h1>
          <p className="mt-2 text-sm text-zinc-400">
            This NPC does not exist in the active campaign, or it is not visible in the current mode.
          </p>
          {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
          <button
            type="button"
            onClick={() => navigate("/npcs")}
            className="mt-5 px-4 py-2 bg-white/10 rounded-xl text-zinc-300 hover:bg-white/20"
          >
            Back to NPCs
          </button>
        </div>
      </main>
    );
  }

  if (!isGM && npc.visibility === "gm-only") {
    return (
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-xl mx-auto bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">DM Eyes Only</h1>
          <p className="text-zinc-400 text-sm mb-4">This NPC is marked GM-only.</p>
          <button
            type="button"
            className="mt-2 px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20"
            onClick={() => navigate("/npcs")}
          >
            Back to NPCs
          </button>
        </div>
      </main>
    );
  }

  const viewNpc = isEditing && draft ? draft : npc;
  const viewStatBlock = normalizeStatBlock(viewNpc.statBlock);
  const statBlockVisibility = normalizeStatBlockVisibility(viewNpc.statBlockVisibility);
  const canShowStatBlockCard = isGM || statBlockVisibility === "public";
  const hasRightColumnContent = isGM || canShowStatBlockCard;
  const TypeIcon = getNpcTypeIcon(viewNpc.type);

  return (
    <main className="p-4 sm:p-8">
      <div className="mb-6 flex flex-col gap-4">
        <button
          type="button"
          className="flex w-fit items-center gap-2 text-sm text-zinc-400 hover:text-white"
          onClick={() => navigate("/npcs")}
        >
          <ArrowLeft className="w-5 h-5" />
          Back to NPCs
        </button>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-4">
              <div className="w-16 h-16 shrink-0 overflow-hidden rounded-2xl bg-linear-to-br from-purple-500 to-pink-500 flex items-center justify-center text-2xl font-bold text-white">
                {viewNpc.imageUrl ? (
                  <img src={viewNpc.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <TypeIcon className="h-8 w-8" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[3fr_2fr]">
                      <Field label="Name">
                        <TextInput disabled={isSaving} value={draft?.name ?? ""} onChange={(value) => updateDraft("name", value)} />
                      </Field>
                      <Field label="Title">
                        <TextInput disabled={isSaving} value={draft?.title ?? ""} onChange={(value) => updateDraft("title", value)} />
                      </Field>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                          Aliases
                        </h2>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={addAlias}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Alias
                        </button>
                      </div>
                      {(draft?.aliases || []).length > 0 ? (
                        <div className="space-y-2">
                          {(draft?.aliases || []).map((alias, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <input
                                value={alias}
                                disabled={isSaving}
                                onChange={(e) => updateAlias(index, e.target.value)}
                                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-purple-500/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                              />
                              <button
                                type="button"
                                disabled={isSaving}
                                onClick={() => removeAlias(index)}
                                className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-2 text-rose-100 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-500">No aliases added.</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <Field label="Type">
                        <SelectInput disabled={isSaving} value={draft?.type ?? "NPC"} onChange={(value) => updateDraft("type", value)}>
                          {NPC_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {NPC_TYPE_LABELS[type]}
                            </option>
                          ))}
                        </SelectInput>
                      </Field>
                      <Field label="Role">
                        <SelectInput disabled={isSaving} value={draft?.role ?? "unknown"} onChange={(value) => updateDraft("role", value)}>
                          {NPC_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </SelectInput>
                      </Field>
                      <Field label="Status">
                        <SelectInput disabled={isSaving} value={draft?.status ?? "active"} onChange={(value) => updateDraft("status", value)}>
                          {NPC_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {STATUS_LABELS[status]}
                            </option>
                          ))}
                        </SelectInput>
                      </Field>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                        Visibility
                      </p>
                      <SelectInput disabled={isSaving} value={draft?.visibility ?? "public"} onChange={(value) => updateDraft("visibility", value)}>
                        <option value="public">Player-visible</option>
                        <option value="gm-only">GM-only</option>
                      </SelectInput>
                    </div>
                  </div>
                ) : (
                  <>
                    <h1 className="text-3xl font-bold text-white">{viewNpc.name || "Unnamed NPC"}</h1>
                    {viewNpc.title ? <p className="mt-1 text-sm text-zinc-400">{viewNpc.title}</p> : null}
                    {normalizeAliases(viewNpc.aliases).length > 0 ? (
                      <div className="mt-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                          Aliases
                        </p>
                        <p className="mt-1 text-sm text-zinc-300">
                          {normalizeAliases(viewNpc.aliases).join(" \u2022 ")}
                        </p>
                      </div>
                    ) : null}
                  </>
                )}

                {!isEditing ? (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <>
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                        <TypeIcon className="w-3 h-3" />
                        {NPC_TYPE_LABELS[normalizeNpcType(viewNpc.type)]}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                        {ROLE_LABELS[normalizeRole(viewNpc.role)]}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                        {STATUS_LABELS[normalizeStatus(viewNpc.status)]}
                      </span>
                      {viewNpc.visibility === "gm-only" ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-300">
                          <Lock className="w-3 h-3" />
                          GM-only
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                          <Eye className="w-3 h-3" />
                          Player-visible
                        </span>
                      )}
                    </>
                  </div>
                ) : null}
              </div>
            </div>

            {isGM ? (
              <div className="flex shrink-0 flex-wrap gap-2">
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                      className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={isSaving || !draft?.name?.trim()}
                      className="rounded-full border border-indigo-400/50 bg-indigo-500/20 px-3 py-1.5 text-xs text-white hover:bg-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSaving ? "Saving..." : "Save"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleStartEdit}
                      disabled={isDeleting}
                      className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="inline-flex items-center gap-1 rounded-full border border-rose-400/40 bg-rose-500/15 px-3 py-1.5 text-xs text-rose-100 hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 className="w-3 h-3" />
                      {isDeleting ? "Deleting..." : "Delete"}
                    </button>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </section>

        {error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}
      </div>

      <div
        className={`grid grid-cols-1 gap-6 ${
          hasRightColumnContent
            ? "xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)]"
            : ""
        }`}
      >
        <div className="space-y-6">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">Overview</h2>
            {isEditing ? (
              <fieldset disabled={isSaving} className="mt-4 space-y-4 disabled:opacity-60">
                <Field label="Appearance">
                  <TextInput value={draft?.summary ?? ""} onChange={(value) => updateDraft("summary", value)} />
                </Field>
                <Field label="Who They Are">
                  <TextArea rows={8} value={draft?.description ?? ""} onChange={(value) => updateDraft("description", value)} />
                </Field>
              </fieldset>
            ) : npc.summary || npc.description ? (
              <div className="mt-4 space-y-5">
                {npc.summary ? (
                  <div>
                    <h3 className="mb-1 text-sm font-semibold text-zinc-200">Appearance</h3>
                    {renderMarkdownBlock(npc.summary)}
                  </div>
                ) : null}
                {npc.description ? (
                  <div>
                    <h3 className="mb-1 text-sm font-semibold text-zinc-200">Who They Are</h3>
                    {renderMarkdownBlock(npc.description)}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 text-sm text-zinc-500">No public NPC details added yet.</p>
            )}
          </section>

          <PlaceholderCard title="Sessions">Session links coming soon</PlaceholderCard>
          <PlaceholderCard title="Relationships">Relationship links coming soon</PlaceholderCard>
          <PlaceholderCard title="Quests">Quest links coming soon</PlaceholderCard>
        </div>

        {hasRightColumnContent ? (
        <aside className="space-y-6">
          {isGM ? (
            <section className="rounded-2xl border border-rose-500/30 bg-white/5 p-6 backdrop-blur-sm">
              <h2 className="text-lg font-semibold text-rose-100">GM Notes</h2>
              {isEditing ? (
                <fieldset disabled={isSaving} className="mt-4 disabled:opacity-60">
                  <TextArea rows={8} value={draft?.gmNotes ?? ""} onChange={(value) => updateDraft("gmNotes", value)} />
                </fieldset>
              ) : (
                <div className="mt-4">{renderMarkdownBlock(npc.gmNotes, "No GM notes yet.")}</div>
              )}
            </section>
          ) : null}

          {canShowStatBlockCard ? (
            <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setIsStatBlockCollapsed((current) => !current)}
                  className="min-w-0 text-left"
                >
                  <h2 className="text-lg font-semibold text-white">Stat Block</h2>
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    {isStatBlockCollapsed ? "Expand" : "Collapse"}
                  </span>
                </button>

                {isGM ? (
                  isEditing ? (
                    <div className="flex shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5 p-0.5">
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => updateDraft("statBlockVisibility", "gm-only")}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                          statBlockVisibility === "gm-only"
                            ? "bg-red-500/20 text-red-200"
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        GM-only
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => updateDraft("statBlockVisibility", "public")}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                          statBlockVisibility === "public"
                            ? "bg-emerald-500/20 text-emerald-200"
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        Player-visible
                      </button>
                    </div>
                  ) : (
                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                        statBlockVisibility === "public"
                          ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                          : "border-red-500/40 bg-red-500/20 text-red-300"
                      }`}
                    >
                      {statBlockVisibility === "public" ? "Player-visible" : "GM-only"}
                    </span>
                  )
                ) : null}
              </div>

              {isEditing ? (
                <fieldset disabled={isSaving} className="mt-4 disabled:opacity-60">
                  <StatBlockEditor
                    statBlock={draft?.statBlock}
                    disabled={isSaving}
                    onFieldChange={updateStatBlock}
                    onAbilityChange={updateAbility}
                    onEntryAdd={addStatEntry}
                    onEntryRemove={removeStatEntry}
                    onEntryChange={updateStatEntry}
                  />
                </fieldset>
              ) : !isStatBlockCollapsed ? (
                <div className="mt-4">
                  {isStatBlockEmpty(viewStatBlock) ? (
                    <p className="rounded-xl border border-amber-200/10 bg-amber-100/5 px-4 py-3 text-sm text-zinc-500">
                      No stat block available for this NPC.
                    </p>
                  ) : (
                    <StatBlockView statBlock={viewStatBlock} />
                  )}
                </div>
              ) : null}
            </section>
          ) : null}
        </aside>
        ) : null}
      </div>
    </main>
  );
}
