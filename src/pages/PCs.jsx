import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { mockPCs } from "../data/mockPCs";

const safeArray = (v) => (Array.isArray(v) ? v : []);

const PCs = () => {
  const pcs = useMemo(() => safeArray(mockPCs), []);
  const [query, setQuery] = useState("");

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
        {/* Header */}
        <div className="mb-5 md:mb-7 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-white">
              Player Characters
            </h1>
            <p className="mt-1 text-xs md:text-sm text-zinc-400 max-w-2xl">
              Character hub for stats, notes, relationships, conditions, arcs, and session links.
            </p>
          </div>

          {/* Search */}
          <div className="w-full md:w-[420px]">
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
        </div>

        {/* Empty state */}
        {filtered.length === 0 ? (
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
                        {pc.race || "—"} · {pc.class || "—"}
                        {pc.subclass ? ` — ${pc.subclass}` : ""}
                      </p>
                    </div>

                    <span className="shrink-0 inline-flex items-center justify-center rounded-full border border-indigo-400/70 bg-indigo-500/15 px-2.5 py-0.5 text-[10px] font-medium text-indigo-100 whitespace-nowrap">
                      Lv {pc.level ?? "?"}
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
      </main>
    </div>
  );
};

export default PCs;
