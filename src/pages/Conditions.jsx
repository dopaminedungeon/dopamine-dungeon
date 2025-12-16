// src/pages/Conditions.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { mockConditions } from "../data/mockConditions";
import { useMode } from "../context/ModeContext.jsx";

const getProgressLabel = (value) => {
  if (value == null || value === "" || isNaN(Number(value))) return null;
  const n = Number(value);
  if (n <= 10) return "Dormant";
  if (n <= 40) return "Stirring";
  if (n <= 70) return "Peaking";
  return "Overwhelming";
};

export default function Conditions() {
  const { isGM } = useMode();
  const [selectedFamily, setSelectedFamily] = useState("All families");
  const [selectedTargetType, setSelectedTargetType] = useState("All targets");

  const allFamilies = Array.from(
    new Set(mockConditions.map((c) => c.conditionFamily).filter(Boolean))
  );

  const characterConditions = mockConditions.filter(
    (c) =>
      (c.conditionFamily ?? "").toLowerCase() !== "boon" &&
      (c.conditionFamily ?? "").toLowerCase() !== "curse"
  );
  const boonConditions = mockConditions.filter(
    (c) => (c.conditionFamily ?? "").toLowerCase() === "boon"
  );
  const curseConditions = mockConditions.filter(
    (c) => (c.conditionFamily ?? "").toLowerCase() === "curse"
  );
const isPlayerView = !isGM;
  if (isPlayerView) {
    return (
      <main className="flex-1 p-8 overflow-y-auto flex items-center justify-center">
        <div className="max-w-xl bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">GM-Only Dashboard</h1>
          <p className="text-zinc-400 text-sm">
            Players, this is not your domain. Please leave before I start writing scenes you’ll have to survive later. 💜
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 p-8 overflow-y-auto space-y-8">
            {/* PC CONDITIONS & TRACKERS */}
            <section className="space-y-4">
              <div className="flex items-baseline justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Party Conditions & Long-term Trackers
                  </h2>
                  <p className="text-sm text-zinc-400">
                    Blessings, curses, corruption and other ongoing effects on the
                    party.
                  </p>
                </div>
                <Link
                  to="/conditions"
                  className="text-xs text-indigo-300 hover:text-indigo-200 underline"
                >
                  View all
                </Link>
              </div>

            {/* FILTERS */}
            <section className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col text-xs text-zinc-400">
                  <span className="uppercase tracking-wide text-[10px] text-zinc-500 mb-1">
                    Family
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {["All families", ...allFamilies].map((family) => {
                      const isActive = selectedFamily === family;
                      const label =
                        family === "All families" ? "All" : family;
                      return (
                        <button
                          key={family}
                          type="button"
                          onClick={() => setSelectedFamily(family)}
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
                    Target type
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "All targets",
                      "PC",
                      "NPC",
                      "Item",
                      "Other",
                    ].map((type) => {
                      const isActive = selectedTargetType === type;
                      const label =
                        type === "All targets" ? "All" : type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setSelectedTargetType(type)}
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
                    setSelectedFamily("All families");
                    setSelectedTargetType("All targets");
                  }}
                  className="text-[11px] text-zinc-400 hover:text-zinc-200 underline underline-offset-2"
                >
                  Clear filters
                </button>
              </div>
            </section>

              <section className="space-y-3">
                <h3 className="text-md font-semibold text-purple-200">
                  Character Conditions &amp; Trackers
                </h3>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {characterConditions
                    .filter((condition) =>
                      selectedFamily === "All families"
                        ? true
                        : condition.conditionFamily === selectedFamily
                    )
                    .filter((condition) =>
                      selectedTargetType === "All targets"
                        ? true
                        : condition.targetType === selectedTargetType
                    )
                    .map((condition) => (
                      <Link
                        key={condition.id}
                        to={`/conditions/${condition.id}`}
                        className={`flex flex-col gap-3 rounded-xl border p-4 transition backdrop-blur-md 
    bg-gradient-to-br from-rose-200/10 via-purple-300/10 to-indigo-400/10 
    border-white/10 hover:from-purple-300/20 hover:to-indigo-500/20 
    ${condition.severity === "Severe" ? "shadow-[0_0_15px_rgba(214,35,255,0.4)] border-purple-500/40" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-xs uppercase tracking-wide text-zinc-400">
                              {condition.targetName} · {condition.conditionFamily}
                            </p>
                            <h3 className="text-base font-semibold text-white">
                              {condition.trackerName}
                            </h3>
                          </div>
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide
    ${condition.severity === "Severe" 
      ? "bg-purple-700/40 text-pink-200 shadow-[0_0_8px_rgba(214,35,255,0.6)]" 
      : condition.severity === "Moderate" 
      ? "bg-yellow-300/20 text-yellow-200" 
      : "bg-emerald-300/20 text-emerald-200"}`}
                          >
                            {condition.severity}
                          </span>
                        </div>

                        <p className="text-sm text-zinc-200 line-clamp-3 drop-shadow-[0_0_3px_rgba(255,200,255,0.25)]">
                          {condition.summary}
                        </p>
                        {typeof condition.progress === "number" && (
                          <div className="h-1.5 w-full rounded-full bg-black/40 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-fuchsia-400 via-purple-400 to-emerald-300"
                              style={{ width: `${condition.progress}%` }}
                            />
                          </div>
                        )}
                        {typeof condition.progress === "number" &&
                          getProgressLabel(condition.progress) && (
                            <div className="mt-1 text-[10px] uppercase tracking-wide text-purple-200/70">
                              {getProgressLabel(condition.progress)}
                            </div>
                          )}

                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                          <span
                            className={`rounded-full px-2 py-0.5 
    ${condition.trend === "Rising" 
      ? "bg-rose-300/20 text-rose-200" 
      : condition.trend === "Stable" 
      ? "bg-purple-300/20 text-purple-200" 
      : "bg-emerald-300/20 text-emerald-200"}`}
                          >
                            Trend: {condition.trend}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 
    ${condition.trend === "Rising" 
      ? "bg-rose-300/20 text-rose-200" 
      : condition.trend === "Stable" 
      ? "bg-purple-300/20 text-purple-200" 
      : "bg-emerald-300/20 text-emerald-200"}`}
                          >
                            Last updated: {condition.lastUpdated}
                          </span>
                        </div>
                      </Link>
                    ))}
                  {characterConditions.length === 0 && (
                    <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-zinc-400">
                      No character conditions yet.
                    </div>
                  )}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-md font-semibold text-emerald-200">
                  Boons &amp; Blessings
                </h3>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {boonConditions
                    .filter((condition) =>
                      selectedFamily === "All families"
                        ? true
                        : condition.conditionFamily === selectedFamily
                    )
                    .filter((condition) =>
                      selectedTargetType === "All targets"
                        ? true
                        : condition.targetType === selectedTargetType
                    )
                    .map((condition) => (
                      <Link
                        key={condition.id}
                        to={`/conditions/${condition.id}`}
                        className={`flex flex-col gap-3 rounded-xl border p-4 transition backdrop-blur-md 
    bg-gradient-to-br from-rose-200/10 via-purple-300/10 to-indigo-400/10 
    border-white/10 hover:from-purple-300/20 hover:to-indigo-500/20 
    ${condition.severity === "Severe" ? "shadow-[0_0_15px_rgba(214,35,255,0.4)] border-purple-500/40" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-xs uppercase tracking-wide text-zinc-400">
                              {condition.targetName} · {condition.conditionFamily}
                            </p>
                            <h3 className="text-base font-semibold text-white">
                              {condition.trackerName}
                            </h3>
                          </div>
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide
    ${condition.severity === "Severe" 
      ? "bg-purple-700/40 text-pink-200 shadow-[0_0_8px_rgba(214,35,255,0.6)]" 
      : condition.severity === "Moderate" 
      ? "bg-yellow-300/20 text-yellow-200" 
      : "bg-emerald-300/20 text-emerald-200"}`}
                          >
                            {condition.severity}
                          </span>
                        </div>

                        <p className="text-sm text-zinc-200 line-clamp-3 drop-shadow-[0_0_3px_rgba(255,200,255,0.25)]">
                          {condition.summary}
                        </p>
                        {typeof condition.progress === "number" && (
                          <div className="h-1.5 w-full rounded-full bg-black/40 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-fuchsia-400 via-purple-400 to-emerald-300"
                              style={{ width: `${condition.progress}%` }}
                            />
                          </div>
                        )}
                        {typeof condition.progress === "number" &&
                          getProgressLabel(condition.progress) && (
                            <div className="mt-1 text-[10px] uppercase tracking-wide text-purple-200/70">
                              {getProgressLabel(condition.progress)}
                            </div>
                          )}

                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                          <span
                            className={`rounded-full px-2 py-0.5 
    ${condition.trend === "Rising" 
      ? "bg-rose-300/20 text-rose-200" 
      : condition.trend === "Stable" 
      ? "bg-purple-300/20 text-purple-200" 
      : "bg-emerald-300/20 text-emerald-200"}`}
                          >
                            Trend: {condition.trend}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 
    ${condition.trend === "Rising" 
      ? "bg-rose-300/20 text-rose-200" 
      : condition.trend === "Stable" 
      ? "bg-purple-300/20 text-purple-200" 
      : "bg-emerald-300/20 text-emerald-200"}`}
                          >
                            Last updated: {condition.lastUpdated}
                          </span>
                        </div>
                      </Link>
                    ))}
                  {boonConditions.length === 0 && (
                    <div className="rounded-xl border border-dashed border-emerald-300/40 bg-emerald-300/5 p-4 text-sm text-emerald-100">
                      No active boons or blessings tracked.
                    </div>
                  )}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-md font-semibold text-rose-200">
                  Curses &amp; Afflictions
                </h3>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {curseConditions
                    .filter((condition) =>
                      selectedFamily === "All families"
                        ? true
                        : condition.conditionFamily === selectedFamily
                    )
                    .filter((condition) =>
                      selectedTargetType === "All targets"
                        ? true
                        : condition.targetType === selectedTargetType
                    )
                    .map((condition) => (
                      <Link
                        key={condition.id}
                        to={`/conditions/${condition.id}`}
                        className={`flex flex-col gap-3 rounded-xl border p-4 transition backdrop-blur-md 
    bg-gradient-to-br from-rose-200/10 via-purple-300/10 to-indigo-400/10 
    border-white/10 hover:from-purple-300/20 hover:to-indigo-500/20 
    ${condition.severity === "Severe" ? "shadow-[0_0_15px_rgba(214,35,255,0.4)] border-purple-500/40" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-xs uppercase tracking-wide text-zinc-400">
                              {condition.targetName} · {condition.conditionFamily}
                            </p>
                            <h3 className="text-base font-semibold text-white">
                              {condition.trackerName}
                            </h3>
                          </div>
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide
    ${condition.severity === "Severe" 
      ? "bg-purple-700/40 text-pink-200 shadow-[0_0_8px_rgba(214,35,255,0.6)]" 
      : condition.severity === "Moderate" 
      ? "bg-yellow-300/20 text-yellow-200" 
      : "bg-emerald-300/20 text-emerald-200"}`}
                          >
                            {condition.severity}
                          </span>
                        </div>

                        <p className="text-sm text-zinc-200 line-clamp-3 drop-shadow-[0_0_3px_rgba(255,200,255,0.25)]">
                          {condition.summary}
                        </p>
                        {typeof condition.progress === "number" && (
                          <div className="h-1.5 w-full rounded-full bg-black/40 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-fuchsia-400 via-purple-400 to-emerald-300"
                              style={{ width: `${condition.progress}%` }}
                            />
                          </div>
                        )}
                        {typeof condition.progress === "number" &&
                          getProgressLabel(condition.progress) && (
                            <div className="mt-1 text-[10px] uppercase tracking-wide text-purple-200/70">
                              {getProgressLabel(condition.progress)}
                            </div>
                          )}

                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                          <span
                            className={`rounded-full px-2 py-0.5 
    ${condition.trend === "Rising" 
      ? "bg-rose-300/20 text-rose-200" 
      : condition.trend === "Stable" 
      ? "bg-purple-300/20 text-purple-200" 
      : "bg-emerald-300/20 text-emerald-200"}`}
                          >
                            Trend: {condition.trend}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 
    ${condition.trend === "Rising" 
      ? "bg-rose-300/20 text-rose-200" 
      : condition.trend === "Stable" 
      ? "bg-purple-300/20 text-purple-200" 
      : "bg-emerald-300/20 text-emerald-200"}`}
                          >
                            Last updated: {condition.lastUpdated}
                          </span>
                        </div>
                      </Link>
                    ))}
                  {curseConditions.length === 0 && (
                    <div className="rounded-xl border border-dashed border-rose-300/40 bg-rose-300/5 p-4 text-sm text-rose-100">
                      No active curses. Yet.
                    </div>
                  )}
                </div>
              </section>

              {mockConditions.length === 0 && (
                <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-zinc-400">
                  No active conditions yet. The calm before the storm.
                </div>
              )}
            </section>
    </main>
  );
}