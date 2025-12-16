// src/pages/ConditionProfile.jsx
import React, { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMode } from "../context/ModeContext.jsx";
import { mockConditions } from "../data/mockConditions";


const severityStyles = {
  Critical:
    "bg-pink-700/40 text-pink-200 border-pink-400/60 shadow-[0_0_10px_rgba(248,113,113,0.6)]",
  Severe:
    "bg-purple-700/40 text-pink-200 border-purple-400/60 shadow-[0_0_10px_rgba(214,35,255,0.6)]",
  Moderate:
    "bg-amber-300/20 text-amber-100 border-amber-300/60 shadow-[0_0_6px_rgba(252,211,77,0.35)]",
  Mild:
    "bg-emerald-300/20 text-emerald-100 border-emerald-300/60 shadow-[0_0_6px_rgba(52,211,153,0.35)]",
};

const trendStyles = {
  Worsening: "bg-rose-700/40 text-rose-200 border-rose-500/60",
  Rising: "bg-orange-700/30 text-orange-200 border-orange-500/50",
  Fluctuating: "bg-yellow-700/30 text-yellow-200 border-yellow-500/50",
  Improving: "bg-emerald-700/30 text-emerald-200 border-emerald-500/50",
};

const familyLabels = {
  corruption: "Corruption",
  divine: "Divine",
  curse: "Curse",
  pact: "Pact",
  strain: "Strain",
  other: "Other",
};

export default function ConditionProfile() {
  const { isGM } = useMode();
  const [searchParams] = useSearchParams();
  const isPlayerView = !isGM || searchParams.get("mode") === "player";
  const { id } = useParams();

  const condition = mockConditions.find((c) => c.id === id);

  const familyKey = (condition?.conditionFamily || "").toLowerCase();
  const isCorruption =
    familyKey === "corruption" || familyKey === "pact" || familyKey === "strain";
  const isBoon = familyKey === "boon" || familyKey === "divine";
  const isCurse = familyKey === "curse";

  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState(() => {
    if (!condition) return {};
    return {
      trackerName: condition.trackerName || "",
      summary: condition.summary || "",
      severity: condition.severity || "",
      trend: condition.trend || "",
      gmNotes: condition.gmNotes || "",
      history: (condition.history || []).join("\n"),
      linkedSessions: (condition.linkedSessions || []).join(", "),
      tags: (condition.tags || []).join(", "),
      conditionFamily: condition.conditionFamily || "",
      targetName: condition.targetName || "",
      targetType: condition.targetType || "",
      progress:
      typeof condition.progress === "number"
        ? String(condition.progress)
        : "",
    };
  });

  // Progress helper logic, must come after formData is defined
  const resolveProgressLabel = (value) => {
    if (value == null || value === "" || isNaN(Number(value))) return null;
    const n = Number(value);
    if (n <= 10) return "Dormant";
    if (n <= 40) return "Stirring";
    if (n <= 70) return "Peaking";
    return "Overwhelming";
  };

  const effectiveProgress =
    formData.progress && formData.progress !== ""
      ? Number(formData.progress)
      : typeof condition.progress === "number"
      ? Number(condition.progress)
      : null;

  const progressLabel = resolveProgressLabel(effectiveProgress);

  if (!condition) {
    return (
      <main className="flex-1 p-8 overflow-y-auto flex items-center justify-center">
        <div className="max-w-xl bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Condition Not Found</h1>
          <p className="text-zinc-400 text-sm">The requested condition does not exist.</p>
          <Link
            to="/conditions"
            className="mt-4 inline-block text-purple-400 hover:underline"
          >
            Back to Conditions List
          </Link>
        </div>
      </main>
    );
  }

  if (isPlayerView) {
    return (
      <main className="flex-1 p-8 overflow-y-auto flex items-center justify-center">
        <div className="max-w-xl bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">GM-Only Dashboard</h1>
          <p className="text-zinc-400 text-sm">
            Players, this is not your domain. Please leave before I start writing scenes you’ll have to survive later. 💜
          </p>
          <div className="mt-4">
            <Link to="/" className="text-purple-400 hover:underline">Return to Dashboard</Link>
          </div>
        </div>
      </main>
    );
  }

  function handleInputChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function toggleEdit() {
    setEditMode((prev) => !prev);
  }

  function saveChanges() {
    // For now, just toggle off edit mode.
    // In a real app, would handle saving to backend or context.
    setEditMode(false);
  }

  return (
    <main className="flex-1 p-8 overflow-y-auto w-full">
      <div className="mb-4 flex items-center justify-between text-sm">
        <Link
          to="/conditions"
          className="text-purple-300 hover:text-purple-100 flex items-center gap-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to Conditions</span>
        </Link>
        <button
          onClick={editMode ? saveChanges : toggleEdit}
          className="rounded-md border border-purple-400/60 bg-purple-500/20 px-3 py-1.5 text-xs font-semibold text-purple-100 hover:bg-purple-500/30 transition-colors"
        >
          {editMode ? "Save" : "Edit"}
        </button>
      </div>
      <div
        className={`mb-6 rounded-xl border p-5 backdrop-blur-md bg-gradient-to-br 
          from-rose-200/10 via-purple-300/10 to-indigo-500/10 border-white/15 
          shadow-[0_0_25px_rgba(214,35,255,0.35)] relative overflow-hidden`}
      >
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs uppercase tracking-[0.18em] text-purple-200/80">
                Condition Tracker
              </span>
              <span className="text-[11px] uppercase tracking-wide rounded-full bg-white/10 px-2 py-1 text-zinc-100">
                {familyLabels[(formData.conditionFamily || condition.conditionFamily || "").toLowerCase()] ||
                  formData.conditionFamily ||
                  condition.conditionFamily}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold text-white drop-shadow-[0_0_12px_rgba(214,35,255,0.6)]">
              {formData.trackerName || condition.trackerName}
            </h1>
            <p className="text-sm text-zinc-200 max-w-2xl drop-shadow-[0_0_5px_rgba(255,200,255,0.35)]">
              {formData.summary || condition.summary}
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-200 mt-2">
              <span className="rounded-full bg-black/20 px-2 py-1">
                Target: {formData.targetName || condition.targetName} ({formData.targetType || condition.targetType})
              </span>
              <span className="rounded-full bg-black/20 px-2 py-1">
                Last updated: {condition.lastUpdated}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3 min-w-[180px]">
            <div className="flex flex-wrap justify-end gap-2">
              <span
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${
                  severityStyles[formData.severity] || severityStyles[condition.severity] || ""
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-pink-300 animate-pulse" />
                {formData.severity || condition.severity || "Unknown"}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${
                  trendStyles[formData.trend] || trendStyles[condition.trend] || ""
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-orange-300" />
                {formData.trend || condition.trend || "No data"}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-black/40 overflow-hidden mt-2 border border-white/10">
              <div
                className={`h-full ${
                  isCorruption
                    ? "bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-500"
                    : isCurse
                    ? "bg-gradient-to-r from-rose-500 via-red-500 to-amber-400"
                    : isBoon
                    ? "bg-gradient-to-r from-emerald-400 via-teal-300 to-sky-300"
                    : "bg-gradient-to-r from-purple-300 via-indigo-300 to-slate-200"
                }`}
                style={{
                  width:
                    formData.progress && formData.progress !== ""
                      ? `${formData.progress}%`
                      : typeof condition.progress === "number"
                      ? `${condition.progress}%`
                      : "60%",
                }}
              />
            </div>
            <p className="text-[11px] text-zinc-300/80">
              Progress intensity gauge (purely cosmetic for now).
            </p>
            {progressLabel && (
          <div className="mt-1 text-[11px] uppercase tracking-wide text-purple-200/80">
            State: {progressLabel}
          </div>
        )}
          </div>
        </div>
        {isCorruption && (
          <div className="pointer-events-none absolute inset-0 opacity-50 mix-blend-screen bg-[radial-gradient(circle_at_20%_0,rgba(248,113,255,0.35),transparent_55%),radial-gradient(circle_at_80%_100%,rgba(59,130,246,0.35),transparent_55%)]" />
        )}
      </div>

      {/* TWO COLUMN LAYOUT */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* LEFT COLUMN – PLAYER INFORMATION (stacked cards) */}
        <div className="space-y-4">
          <section className="bg-black/40 border border-purple-500/25 rounded-xl p-5 backdrop-blur-md space-y-3">
            <h2 className="text-xl font-semibold text-white mb-1">Player-facing Summary</h2>
            <div>
              <h3 className="text-zinc-400 text-sm mb-1">Tracker Name</h3>
              {editMode ? (
                <input
                  type="text"
                  name="trackerName"
                  value={formData.trackerName || ""}
                  onChange={handleInputChange}
                  className="w-full rounded-md bg-white/10 border border-white/20 px-3 py-2 text-white text-base focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              ) : (
                <p className="text-white text-lg font-semibold">
                  {formData.trackerName || condition.trackerName}
                </p>
              )}
            </div>
            <div>
              <h3 className="text-zinc-400 text-sm mb-1">Summary</h3>
              {editMode ? (
                <textarea
                  name="summary"
                  value={formData.summary || ""}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full rounded-md bg-white/10 border border-white/20 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              ) : (
                <p className="text-zinc-300 whitespace-pre-wrap">
                  {formData.summary || condition.summary}
                </p>
              )}
            </div>
          </section>

          <section className="bg-black/40 border border-indigo-500/25 rounded-xl p-5 backdrop-blur-md space-y-3">
            <h2 className="text-xl font-semibold text-white mb-1">History</h2>
            {editMode ? (
              <textarea
                name="history"
                value={formData.history || ""}
                onChange={handleInputChange}
                rows={6}
                className="w-full rounded-md bg-white/10 border border-white/20 px-3 py-2 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Enter one history entry per line"
              />
            ) : (
              (() => {
                const entries =
                  (formData.history || "")
                    .split("\n")
                    .map((e) => e.trim())
                    .filter(Boolean);
                return entries.length > 0 ? (
                  <ul className="list-disc list-inside text-zinc-300 space-y-1">
                    {entries.map((entry, idx) => (
                      <li key={idx}>{entry}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-zinc-400 italic">No history entries.</p>
                );
              })()
            )}
          </section>
        </div>

        {/* RIGHT COLUMN – GM INFORMATION (stacked cards) */}
        <div className="space-y-4">
          <section className="bg-black/40 border border-fuchsia-500/25 rounded-xl p-5 backdrop-blur-md space-y-3">
            <h2 className="text-xl font-semibold text-white mb-1">DM Controls</h2>
            <div className="flex flex-wrap gap-3">
              <div>
                <h3 className="text-zinc-400 text-sm mb-1">Severity</h3>
                {editMode ? (
                  <select
                    name="severity"
                    value={formData.severity || ""}
                    onChange={handleInputChange}
                    className="rounded-md bg-white/10 border border-white/20 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select</option>
                    {Object.keys(severityStyles).map((sev) => (
                      <option key={sev} value={sev}>
                        {sev}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${
                      severityStyles[formData.severity] || severityStyles[condition.severity] || ""
                    }`}
                  >
                    {formData.severity || condition.severity}
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-zinc-400 text-sm mb-1">Trend</h3>
                {editMode ? (
                  <select
                    name="trend"
                    value={formData.trend || ""}
                    onChange={handleInputChange}
                    className="rounded-md bg-white/10 border border-white/20 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select</option>
                    {Object.keys(trendStyles).map((trend) => (
                      <option key={trend} value={trend}>
                        {trend}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${
                      trendStyles[formData.trend] || trendStyles[condition.trend] || ""
                    }`}
                  >
                    {formData.trend || condition.trend}
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-zinc-400 text-sm mb-1">Progress (0–100%)</h3>
                {editMode ? (
                  <input
                    type="number"
                    name="progress"
                    min={0}
                    max={100}
                    value={formData.progress || ""}
                    onChange={handleInputChange}
                    className="w-full rounded-md bg-white/10 border border-white/20 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                ) : (
                  <span className="inline-block bg-white/10 px-2 py-1 rounded text-sm text-zinc-200">
                    {formData.progress || condition.progress || "Not set"}%
                  </span>
                )}
              </div>
            </div>
          </section>

          <section className="bg-black/40 border border-purple-500/25 rounded-xl p-5 backdrop-blur-md space-y-3">
            <h2 className="text-xl font-semibold text-white mb-1">DM Notes</h2>
            {editMode ? (
              <textarea
                name="gmNotes"
                value={formData.gmNotes || ""}
                onChange={handleInputChange}
                rows={4}
                className="w-full rounded-md bg-white/10 border border-white/20 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            ) : (
              <p className="text-zinc-300 whitespace-pre-wrap">
                {formData.gmNotes || condition.gmNotes || "No GM notes available."}
              </p>
            )}
          </section>

          <section className="bg-black/40 border border-sky-500/25 rounded-xl p-5 backdrop-blur-md space-y-3">
            <h2 className="text-xl font-semibold text-white mb-1">Linked Sessions</h2>
            {editMode ? (
              <input
                type="text"
                name="linkedSessions"
                value={formData.linkedSessions || ""}
                onChange={handleInputChange}
                className="w-full rounded-md bg-white/10 border border-white/20 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Comma-separated sessions (e.g. S1, S3, S7)"
              />
            ) : formData.linkedSessions ? (
              <p className="text-zinc-300">{formData.linkedSessions}</p>
            ) : (
              <p className="text-zinc-400 italic">No linked sessions.</p>
            )}
          </section>
        </div>
      </div>

      {/* METADATA STRIP */}
      <section className="bg-black/40 border border-emerald-500/25 rounded-xl p-5 backdrop-blur-md mb-10">
        <h2 className="text-lg font-semibold text-white mb-2">Metadata</h2>
        <div className="flex flex-wrap gap-3 text-sm text-zinc-300">
          <span className="bg-white/10 px-2 py-1 rounded">ID: {condition.id}</span>

          {editMode ? (
            <>
              <select
                name="conditionFamily"
                value={formData.conditionFamily || ""}
                onChange={handleInputChange}
                className="rounded-md bg-white/10 border border-white/20 px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="" disabled>
                  Select family
                </option>
                {Object.keys(familyLabels).map((fam) => (
                  <option key={fam} value={fam}>
                    {familyLabels[fam]}
                  </option>
                ))}
              </select>

              <select
                name="targetName"
                value={formData.targetName || ""}
                onChange={handleInputChange}
                className="rounded-md bg-white/10 border border-white/20 px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">No target selected</option>
              </select>

              <select
                name="targetType"
                value={formData.targetType || ""}
                onChange={handleInputChange}
                className="rounded-md bg-white/10 border border-white/20 px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="" disabled>
                  Select type
                </option>
                <option value="PC">PC</option>
                <option value="NPC">NPC</option>
                <option value="Faction">Faction</option>
              </select>
            </>
          ) : (
            <>
              <span className="bg-white/10 px-2 py-1 rounded">
                Family: {formData.conditionFamily || condition.conditionFamily}
              </span>
              <span className="bg-white/10 px-2 py-1 rounded">
                Target: {formData.targetName || condition.targetName}
              </span>
              <span className="bg-white/10 px-2 py-1 rounded">
                Type: {formData.targetType || condition.targetType}
              </span>
            </>
          )}

          {editMode ? (
            <input
              type="text"
              name="tags"
              value={formData.tags || ""}
              onChange={handleInputChange}
              className="w-full rounded-md bg-white/10 border border-white/20 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Comma-separated tags"
            />
          ) : (
            (() => {
              const tags =
                (formData.tags || "")
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean);
              return tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag, idx) => (
                    <span key={idx} className="bg-purple-700/50 text-purple-300 px-2 py-1 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null;
            })()
          )}
        </div>
      </section>
    </main>
  );
}