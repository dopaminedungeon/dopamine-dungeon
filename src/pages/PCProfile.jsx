// src/pages/PCProfile.jsx
import { useParams, Link } from "react-router-dom";
import { useMode } from "../context/ModeContext.jsx";
import { mockPCs } from "../data/mockPCs";

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

const PCProfile = () => {
  const { pcId } = useParams();
  const mode = useMode();
  const isGMMode = Boolean(mode?.isGMMode ?? mode?.isGM);

  const pc = (Array.isArray(mockPCs) ? mockPCs : []).find((p) => p.id === pcId);

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
  const skills = stats.skills || {};

  const hpLabel =
    stats.hpMax != null ? `${stats.hpCurrent ?? stats.hpMax}/${stats.hpMax}` : "—";
  const acLabel = stats.ac ?? "—";
  const speedLabel = stats.speed != null ? `${stats.speed} ft.` : "—";
  const initLabel = stats.initiativeMod != null ? `${stats.initiativeMod >= 0 ? "+" : ""}${stats.initiativeMod}` : "—";
  const profLabel = stats.proficiencyBonus != null ? `${stats.proficiencyBonus >= 0 ? "+" : ""}${stats.proficiencyBonus}` : "—";

  const spellInfo = stats.spellcastingAbility
    ? `${stats.spellcastingAbility} • DC ${stats.spellSaveDC ?? "?"} • +${stats.spellAttackBonus ?? "?"}`
    : "—";

  return (
    <div className="p-6 md:p-8 text-white">
      <div className="space-y-6">
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
                Level {pc.level} {pc.race} {pc.class}
              </span>
            </h1>
            <p className="text-xs md:text-sm text-zinc-400 max-w-2xl">
              {pc.background || pc.publicNotes || "A brave disaster waiting to happen."}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2 text-right">
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
              {isGMMode ? "GM mode: full details visible" : "Player mode: some sections may be hidden"}
            </span>
          </div>
        </header>

        {/* Hero card */}
        <section className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row gap-4 md:gap-6 shadow-[0_0_40px_rgba(15,23,42,0.75)] backdrop-blur-sm">
          {/* Left: avatar placeholder + identity */}
          <div className="flex items-start gap-4 flex-1">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-gradient-to-br from-indigo-500/40 via-purple-500/30 to-emerald-400/30 border border-white/15 flex items-center justify-center text-xs text-zinc-100 uppercase tracking-wide">
              {pc.name?.slice(0, 2)}
            </div>

            <div className="space-y-2 flex-1">
              <div>
                <h2 className="text-lg md:text-xl font-semibold leading-tight">
                  {pc.name}
                </h2>
                <p className="text-[11px] md:text-xs text-zinc-300">
                  {pc.race} · {pc.class}
                  {pc.subclass ? ` — ${pc.subclass}` : ""}
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-3 text-[11px] md:text-xs min-w-[200px]">
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
            <div className="rounded-xl bg-black/50 border border-white/15 px-3 py-2 flex flex-col">
              <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                Spellcasting
              </span>
              <span className="font-semibold text-zinc-100">{spellInfo}</span>
            </div>
          </div>
        </section>

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
            Visibility: {pc.isPlayerVisible ? "Player-visible" : "GM-only"}
          </span>
        </section>

        {/* Two-column layout */}
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6">
          {/* Left / main column: abilities and skills */}
          <div className="xl:col-span-2 space-y-4">
            {/* Abilities */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold tracking-tight">Ability Scores</h3>
                <span className="text-[10px] text-zinc-400">Core stats</span>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
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
                      className="rounded-xl bg-black/50 border border-white/15 px-3 py-2 flex flex-col items-center gap-1 text-[11px] md:text-xs"
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

            {/* Skills */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold tracking-tight">Skills</h3>
                <span className="text-[10px] text-zinc-400">
                  Ability checks &amp; proficiencies
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] md:text-xs">
                {skillConfig.map((skill) => {
                  const entry = skills[skill.key] || {};
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
                        {proficient && (
                          <span className="inline-flex items-center rounded-full bg-emerald-500/20 border border-emerald-400/50 px-2 py-0.5 text-[10px] text-emerald-100">
                            Prof
                          </span>
                        )}
                        <span className="font-semibold text-zinc-100 min-w-[2.5rem] text-right">
                          {modLabel}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Placeholder: cross-link sections */}
            <div className="bg-white/5 border border-dashed border-white/15 rounded-2xl p-4 md:p-5 text-[11px] md:text-xs text-zinc-400">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold tracking-tight text-zinc-200">
                  Cross-links (coming soon)
                </h3>
                <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                  Sessions • Arcs • Conditions • Relationships
                </span>
              </div>
              <p>
                This section will surface all related sessions, arcs, corruption trackers,
                and relationships for this PC once cross-linking is implemented.
              </p>
            </div>
          </div>

          {/* Right column: notes & GM section */}
          <div className="space-y-4">
            {/* Public notes */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold tracking-tight">Public Notes</h3>
                <span className="text-[10px] text-zinc-400">Player-facing</span>
              </div>
              <p className="text-[11px] md:text-xs text-zinc-300 whitespace-pre-wrap">
                {pc.publicNotes || "No public notes yet."}
              </p>
            </div>

            {/* GM notes */}
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

            {/* Future: conditions / corruption summary */}
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
          </div>
        </section>
      </div>
    </div>
  );
};

export default PCProfile;
