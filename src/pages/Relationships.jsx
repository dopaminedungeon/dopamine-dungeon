import React, { useState } from "react";
import { useMode } from "../context/ModeContext";
import { Link, Navigate } from "react-router-dom";
import { Landmark, Users, ArrowRight } from "lucide-react";
import { mockRelationships } from "../data/mockRelationships";


export default function Relationships() {
  const { isGM } = useMode();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    // Derived entities for filters and matrix
  const pcNames = Array.from(
    new Set(
      mockRelationships.flatMap((rel) => {
        if (rel.type === "PC ↔ PC") {
          return [rel.entityA, rel.entityB];
        }
        if (rel.type === "PC ↔ NPC") {
          return [rel.entityA];
        }
        return [];
      })
    )
  );

  const factionNames = Array.from(
    new Set(
      mockRelationships
        .filter((rel) => rel.type === "PC ↔ Faction")
        .map((rel) => rel.entityB)
    )
  );


  // Filters
  const [selectedPc, setSelectedPc] = useState("All PCs");
  const [selectedValence, setSelectedValence] = useState("All valences");
  const [selectedFaction, setSelectedFaction] = useState("All factions");

  // If the PLAYER somehow gets here: gently but firmly yeet them
  if (!isGM) {
    return (
      <main className="flex-1 p-10 text-center">
        <div className="max-w-lg mx-auto bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur">
          <h2 className="text-2xl font-bold text-white mb-2">
            DM-Only Secrets Zone
          </h2>
          <p className="text-zinc-400 text-sm">
            Players, this is not your domain.
            <br />
            Please leave before I start writing scenes you&apos;ll have to survive later. 💜
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      <main className="flex-1 p-10 space-y-8 overflow-auto">
            {/* HEADER */}
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-4xl font-bold text-white tracking-tight">
                  Relationship Tracking
                </h1>
                <p className="text-zinc-400 text-sm mt-1">
                  How your little chaos gremlins feel about each other, their patrons,
                  and the institutions they keep accidentally upsetting.
                </p>
              </div>

              <button
                className="px-5 py-2 rounded-xl bg-purple-600/80 text-white font-medium hover:bg-purple-700 transition"
                onClick={() => setIsAddModalOpen(true)}
              >
                + Add Relationship
              </button>
            </div>

            {/* FILTERS */}
            <section className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col text-xs text-zinc-400">
                  <span className="uppercase tracking-wide text-[10px] text-zinc-500 mb-1">
                    Focus on PC
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {["All PCs", ...pcNames].map((pc) => {
                      const isActive = selectedPc === pc;
                      const label = pc === "All PCs" ? "All" : pc;
                      return (
                        <button
                          key={pc}
                          type="button"
                          onClick={() => setSelectedPc(pc)}
                          className={`px-3 py-1.5 rounded-full text-[11px] border transition ${
                            isActive
                              ? "bg-indigo-500/80 border-indigo-300 text-white"
                              : "bg-black/40 border-white/15 text-zinc-300 hover:bg-black/60"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col text-xs text-zinc-400">
                  <span className="uppercase tracking-wide text-[10px] text-zinc-500 mb-1">
                    Relationship mood
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "All valences",
                      "Positive",
                      "Negative",
                      "Neutral",
                      "Volatile",
                      "Complicated",
                    ].map((val) => {
                      const isActive = selectedValence === val;
                      const label = val === "All valences" ? "All" : val;
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setSelectedValence(val)}
                          className={`px-3 py-1.5 rounded-full text-[11px] border transition ${
                            isActive
                              ? "bg-purple-500/80 border-purple-300 text-white"
                              : "bg-black/40 border-white/15 text-zinc-300 hover:bg-black/60"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPc("All PCs");
                    setSelectedValence("All valences");
                  }}
                  className="text-[11px] text-zinc-400 hover:text-zinc-200 underline underline-offset-2"
                >
                  Clear filters
                </button>
              </div>
            </section>


            {/* PARTY DYNAMICS (PC ↔ PC) */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-300" />
                Party Dynamics (PC ↔ PC)
              </h2>
              <p className="text-xs text-zinc-400">
                Internal bonds, rivalries and trauma connections between player characters.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {mockRelationships
                  .filter((rel) => rel.type === "PC ↔ PC")
                  .filter((rel) =>
                    selectedPc === "All PCs"
                      ? true
                      : rel.entityA === selectedPc || rel.entityB === selectedPc
                  )
                  .filter((rel) =>
                    selectedValence === "All valences"
                      ? true
                      : rel.valence === selectedValence
                  )
                  .map((rel) => (
                    <RelationshipCard key={rel.id} rel={rel} />
                  ))}
              </div>
            </section>

            {/* PC ↔ NPC BONDS */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-pink-300" />
                PC ↔ NPC Bonds
              </h2>
              <p className="text-xs text-zinc-400">
                Mentors, rivals, tragic exes and suspiciously helpful strangers.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {mockRelationships
                  .filter((rel) => rel.type === "PC ↔ NPC")
                  .filter((rel) =>
                    selectedPc === "All PCs"
                      ? true
                      : rel.entityA === selectedPc
                  )
                  .filter((rel) =>
                    selectedValence === "All valences"
                      ? true
                      : rel.valence === selectedValence
                  )
                  .map((rel) => (
                    <RelationshipCard key={rel.id} rel={rel} />
                  ))}
              </div>
            </section>

            {/* FACTION REPUTATION */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Landmark className="w-5 h-5 text-purple-300" />
                Faction Reputation (PC ↔ Faction)
              </h2>
              <p className="text-xs text-zinc-400">
                How the big powers of the world feel about this particular group of problems.
              </p>

              <div className="flex justify-end mb-2">
                <div className="flex flex-col text-xs text-zinc-400">
                  <span className="uppercase tracking-wide text-[10px] text-zinc-500 mb-1">
                    Faction filter
                  </span>
                  <select
                    value={selectedFaction}
                    onChange={(e) => setSelectedFaction(e.target.value)}
                    className="bg-black/40 border border-white/15 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="All factions">All factions</option>
                    {factionNames.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {mockRelationships
                  .filter((rel) => rel.type === "PC ↔ Faction")
                  .filter((rel) =>
                    selectedFaction === "All factions"
                      ? true
                      : rel.entityB === selectedFaction
                  )
                  .filter((rel) =>
                    selectedValence === "All valences"
                      ? true
                      : rel.valence === selectedValence
                  )
                  .map((rel) => (
                    <RelationshipCard key={rel.id} rel={rel} />
                  ))}
              </div>
            </section>
      </main>

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-xl">
            <h2 className="text-xl font-semibold text-white mb-2">
              Add Relationship (Coming Soon)
            </h2>
            <p className="text-sm text-zinc-400 mb-4">
              This will become a full form once Firebase and PC/NPC selectors are wired in.
              For now, consider this a reminder that future-you is extremely powerful.
            </p>
            <div className="flex justify-end">
              <button
                className="px-4 py-2 rounded-xl bg-purple-600/80 text-white font-medium hover:bg-purple-700 transition"
                onClick={() => setIsAddModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RelationshipCard({ rel }) {
  const isFaction = rel.type === "PC ↔ Faction";

  const statusColor =
    rel.status === "Active"
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
      : rel.status === "Broken"
      ? "bg-red-500/20 text-red-300 border-red-500/30"
      : "bg-zinc-500/20 text-zinc-200 border-zinc-500/30";

  const valenceColor =
    rel.valence === "Positive"
      ? "text-emerald-300"
      : rel.valence === "Negative"
      ? "text-red-300"
      : rel.valence === "Volatile"
      ? "text-amber-300"
      : "text-zinc-300";

  return (
    <Link
      to={`/relationships/${rel.id}`}
      className="group bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur hover:bg-white/10 transition-all"
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-white">
            {rel.entityA} ↔ {rel.entityB}
          </h3>
          <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
            {rel.summary}
          </p>
        </div>

        <ArrowRight className="w-5 h-5 text-zinc-400 group-hover:text-white transition" />
      </div>

      {/* TYPE & STATUS */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
          {rel.type}
        </span>
        <span className={`text-xs px-3 py-1 rounded-full border ${statusColor}`}>
          {rel.status}
        </span>
        {rel.valence && (
          <span className={`text-xs font-medium ${valenceColor}`}>
            {rel.valence}
          </span>
        )}
      </div>

      {/* EXTRA INFO */}
      <div className="flex items-center justify-between text-xs text-zinc-400 mb-3">
        <span>Intensity: {rel.intensity}</span>
        {rel.lastChanged && <span>Last change: {rel.lastChanged}</span>}
      </div>

      {/* FACTION REPUTATION */}
      {isFaction && typeof rel.reputationScore === "number" && (
        <div className="mb-3">
          <p className="text-xs text-zinc-400 mb-1">Reputation</p>
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-full ${
                  i < rel.reputationScore ? "bg-purple-400" : "bg-zinc-700"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* TAGS */}
      <div className="flex flex-wrap gap-2 mt-3">
        {rel.tags.map((t) => (
          <span
            key={t}
            className="text-xs px-2 py-1 rounded bg-white/10 text-zinc-300 border border-white/10"
          >
            {t}
          </span>
        ))}
      </div>
    </Link>
  );
}