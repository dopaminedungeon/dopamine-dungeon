// src/pages/RelationshipProfile.jsx
import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMode } from "../context/ModeContext";
import { mockRelationships } from "../data/mockRelationships";

export default function RelationshipProfile() {
  const { isGM } = useMode();
  const { id } = useParams();

  if (!isGM) {
    return (
      <main className="flex-1 p-10 flex items-center justify-center">
        <div className="max-w-lg mx-auto bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur">
          <h2 className="text-2xl font-bold text-white mb-2">DM-Only Secrets Zone</h2>
          <p className="text-zinc-400 text-sm">
            Players, this is not your domain.
            <br />
            Please leave before I start writing scenes you&apos;ll have to survive later. 💜
          </p>
        </div>
      </main>
    );
  }

  const relationship = mockRelationships.find((rel) => rel.id === id) || null;

  if (!relationship) {
    return (
      <main className="flex-1 p-10 overflow-auto w-full">
        <Link
          to="/relationships"
          className="text-purple-300 hover:text-purple-100 text-sm mb-4 inline-block"
        >
          ← Back to Relationships
        </Link>
        <p className="text-zinc-300">
          I couldn&apos;t find a relationship with id <code>{id}</code>.
        </p>
      </main>
    );
  }

  const isFaction = relationship.type === "PC ↔ Faction";

  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    summary: relationship.summary || "",
    playerPerception: relationship.playerPerception || "",
    gmTruth: relationship.gmTruth || "",
    emotionalContext: "",
    narrativeBeats: "",
    history: (relationship.history || []).join("\n"),
    linkedSessions: (relationship.linkedSessions || []).join(", "),
    factionNotes: "",
    tags: (relationship.tags || []).join(", "),
    status: relationship.status || "",
    valence: relationship.valence || "",
    lastChanged: relationship.lastChanged || "",
    intensity:
      typeof relationship.intensity === "number"
        ? String(relationship.intensity)
        : "",
    reputationScore:
      typeof relationship.reputationScore === "number"
        ? String(relationship.reputationScore)
        : "",
    publicReputation:
      typeof relationship.publicReputation === "number"
        ? String(relationship.publicReputation)
        : "",
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleEdit = () => setEditMode((prev) => !prev);

  const handleSave = () => {
    // In a future version this is where you would persist to a backend.
    setEditMode(false);
  };

  const baseStatus = formData.status || relationship.status || "";
  const baseValence = formData.valence || relationship.valence || "";
  const baseLastChanged = formData.lastChanged || relationship.lastChanged || "";
  const baseIntensity =
    formData.intensity !== "" && formData.intensity != null
      ? formData.intensity
      : relationship.intensity;
  const baseReputation =
    formData.reputationScore !== "" && formData.reputationScore != null
      ? formData.reputationScore
      : relationship.reputationScore;
  const basePublic =
    formData.publicReputation !== "" && formData.publicReputation != null
      ? formData.publicReputation
      : relationship.publicReputation;

  const statusColor =
    baseStatus === "Active"
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
      : baseStatus === "Broken"
      ? "bg-red-500/20 text-red-300 border-red-500/30"
      : "bg-zinc-500/20 text-zinc-200 border-zinc-500/30";

  const valenceColor =
    baseValence === "Positive"
      ? "text-emerald-300"
      : baseValence === "Negative"
      ? "text-red-300"
      : baseValence === "Volatile"
      ? "text-amber-300"
      : baseValence === "Complicated"
      ? "text-purple-300"
      : "text-zinc-300";

  return (
    <main className="flex-1 p-10 overflow-auto w-full">
      {/* Back link */}
      <div className="mb-4 flex items-center justify-between text-sm">
        <Link
          to="/relationships"
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
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          <span>Back to Relationships</span>
        </Link>

        <button
          onClick={editMode ? handleSave : toggleEdit}
          className="rounded-md border border-purple-400/60 bg-purple-500/20 px-3 py-1.5 text-xs font-semibold text-purple-100 hover:bg-purple-500/30 transition-colors"
        >
          {editMode ? "Save" : "Edit"}
        </button>
      </div>

      {/* HERO CARD */}
      <div className="mb-6 rounded-xl border border-white/15 p-5 backdrop-blur-md bg-gradient-to-br from-purple-500/10 via-slate-900/60 to-black/80 shadow-[0_0_25px_rgba(88,28,135,0.45)]">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-purple-200/80">
              Relationship Tracker
            </span>
            <h1 className="text-2xl md:text-3xl font-semibold text-white">
              {relationship.entityA} ↔ {relationship.entityB}
            </h1>
            <p className="text-sm text-zinc-200 max-w-2xl">
              {formData.summary || relationship.summary}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-300 mt-2">
              <span className="rounded-full bg-black/30 px-3 py-1 border border-white/10">
                {relationship.type}
              </span>
              <span className={`rounded-full px-3 py-1 border ${statusColor}`}>
                {baseStatus}
              </span>
              {baseValence && (
                <span className={`font-medium ${valenceColor}`}>{baseValence}</span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 min-w-[180px] text-xs text-zinc-300">
            <div>
              <span className="text-zinc-400">Intensity: </span>
              <span className="text-white font-semibold">{baseIntensity}/5</span>
            </div>
            {baseLastChanged && (
              <div>
                <span className="text-zinc-400">Last change: </span>
                <span className="text-white">{baseLastChanged}</span>
              </div>
            )}
            {isFaction && baseReputation != null && baseReputation !== "" && (
              <div className="mt-2 w-full">
                <p className="text-xs text-zinc-400 mb-1 text-right">Reputation</p>
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-2 flex-1 rounded-full ${
                        i < Number(baseReputation) ? "bg-purple-400" : "bg-zinc-700"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TWO COLUMN LAYOUT */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* LEFT COLUMN */}
        <div className="space-y-4">
          <section className="bg-black/40 border border-purple-500/25 rounded-xl p-5 backdrop-blur-md space-y-3">
            <h2 className="text-lg font-semibold text-white mb-1">Player Perception</h2>
            {editMode ? (
              <textarea
                name="playerPerception"
                value={formData.playerPerception}
                onChange={handleInputChange}
                rows={5}
                className="w-full rounded-md bg-white/10 border border-white/20 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="How does the party *think* this relationship looks?"
              />
            ) : (
              <p className="text-sm text-zinc-300 whitespace-pre-wrap">
                {formData.playerPerception ||
                  relationship.playerPerception ||
                  "Use this space to describe how the party believes this relationship works, in their own biased little minds."}
              </p>
            )}
          </section>

          <section className="bg-black/40 border border-sky-500/25 rounded-xl p-5 backdrop-blur-md space-y-3">
            <h2 className="text-lg font-semibold text-white mb-1">History &amp; Linked Sessions</h2>
            {editMode ? (
              <div className="space-y-3 text-sm">
                <div>
                  <h3 className="text-xs uppercase tracking-wide text-zinc-400 mb-1">History Entries</h3>
                  <textarea
                    name="history"
                    value={formData.history}
                    onChange={handleInputChange}
                    rows={5}
                    className="w-full rounded-md bg-white/10 border border-white/20 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="One entry per line (e.g. Session 5: First betrayal)."
                  />
                </div>
                <div>
                  <h3 className="text-xs uppercase tracking-wide text-zinc-400 mb-1">Linked Sessions</h3>
                  <input
                    type="text"
                    name="linkedSessions"
                    value={formData.linkedSessions}
                    onChange={handleInputChange}
                    className="w-full rounded-md bg-white/10 border border-white/20 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Comma-separated sessions (e.g. Session 5, Session 8)"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div>
                  <h3 className="text-xs uppercase tracking-wide text-zinc-400 mb-1">History</h3>
                  {(() => {
                    const entries = (formData.history || "")
                      .split("\n")
                      .map((e) => e.trim())
                      .filter(Boolean);
                    if (entries.length === 0) {
                      return <p className="text-zinc-400 italic">No history entries yet.</p>;
                    }
                    return (
                      <div className="relative pl-4">
                        <div className="absolute left-[6px] top-1 bottom-1 w-px bg-zinc-700/70" />
                        <ul className="space-y-2 text-zinc-300 text-sm">
                          {entries.map((entry, idx) => (
                            <li key={idx} className="relative flex gap-2">
                              <span className="absolute -left-[6px] mt-1 h-2 w-2 rounded-full bg-purple-400 shadow-[0_0_6px_rgba(168,85,247,0.7)]" />
                              <span>{entry}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <h3 className="text-xs uppercase tracking-wide text-zinc-400 mb-1">Linked Sessions</h3>
                  {(() => {
                    const sessions = (formData.linkedSessions || "")
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    if (sessions.length === 0) {
                      return <p className="text-zinc-400 italic">No linked sessions.</p>;
                    }
                    return (
                      <div className="flex flex-wrap gap-2">
                        {sessions.map((s) => (
                          <span key={s} className="bg-white/10 px-2 py-1 rounded text-xs">{s}</span>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </section>

          <section className="bg-black/40 border border-indigo-500/25 rounded-xl p-5 backdrop-blur-md space-y-3">
            <h2 className="text-lg font-semibold text-white mb-1">Narrative Beats</h2>
            {editMode ? (
              <textarea
                name="narrativeBeats"
                value={formData.narrativeBeats}
                onChange={handleInputChange}
                rows={5}
                className="w-full rounded-md bg-white/10 border border-white/20 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Key beats: first meeting, betrayals, confessions, turning points..."
              />
            ) : (
              <p className="text-sm text-zinc-300 whitespace-pre-wrap">
                {formData.narrativeBeats ||
                  "You can later extend this section to a proper timeline (first meeting, betrayal, confession, etc.). For now, this is a free-text placeholder."}
              </p>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-4">
          <section className="bg-black/40 border border-purple-500/25 rounded-xl p-5 backdrop-blur-md space-y-3">
            <h2 className="text-lg font-semibold text-white mb-1">GM Truth</h2>
            {editMode ? (
              <textarea
                name="gmTruth"
                value={formData.gmTruth}
                onChange={handleInputChange}
                rows={5}
                className="w-full rounded-md bg-white/10 border border-white/20 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="What is actually true about this relationship, regardless of what the players think."
              />
            ) : (
              <p className="text-sm text-zinc-300 whitespace-pre-wrap">
                {formData.gmTruth ||
                  relationship.gmTruth ||
                  "Use this space to write the real shape of this bond: what each side truly wants, fears, and would never admit out loud."}
              </p>
            )}
          </section>

          <section className="bg-black/40 border border-rose-500/25 rounded-xl p-5 backdrop-blur-md space-y-3">
            <h2 className="text-lg font-semibold text-white mb-1">Relationship State</h2>
            <div className="grid grid-cols-1 gap-3 text-sm text-zinc-200">
              <div>
                <h3 className="text-xs uppercase tracking-wide text-zinc-400 mb-1">Status</h3>
                {editMode ? (
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full rounded-md bg-white/10 border border-white/20 px-3 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select status</option>
                    <option value="Active">Active</option>
                    <option value="Strained">Strained</option>
                    <option value="Broken">Broken</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                ) : (
                  <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs">{baseStatus || "Not set"}</span>
                )}
              </div>

              <div>
                <h3 className="text-xs uppercase tracking-wide text-zinc-400 mb-1">Valence</h3>
                {editMode ? (
                  <select
                    name="valence"
                    value={formData.valence}
                    onChange={handleInputChange}
                    className="w-full rounded-md bg-white/10 border border-white/20 px-3 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select valence</option>
                    <option value="Positive">Positive</option>
                    <option value="Negative">Negative</option>
                    <option value="Neutral">Neutral</option>
                    <option value="Volatile">Volatile</option>
                    <option value="Complicated">Complicated</option>
                  </select>
                ) : (
                  <span className={`inline-block text-xs ${valenceColor}`}>{baseValence || "Not set"}</span>
                )}
              </div>

              <div>
                <h3 className="text-xs uppercase tracking-wide text-zinc-400 mb-1">Intensity (1–5)</h3>
                {editMode ? (
                  <input
                    type="number"
                    name="intensity"
                    min={1}
                    max={5}
                    value={formData.intensity}
                    onChange={handleInputChange}
                    className="w-full rounded-md bg-white/10 border border-white/20 px-3 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                ) : (
                  <span className="inline-block bg-white/10 px-2 py-1 rounded">{baseIntensity || "–"}/5</span>
                )}
              </div>

              <div>
                <h3 className="text-xs uppercase tracking-wide text-zinc-400 mb-1">Last Change</h3>
                {editMode ? (
                  <input
                    type="text"
                    name="lastChanged"
                    value={formData.lastChanged}
                    onChange={handleInputChange}
                    className="w-full rounded-md bg-white/10 border border-white/20 px-3 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g. Session 12"
                  />
                ) : (
                  <span className="inline-block bg-white/10 px-2 py-1 rounded">{baseLastChanged || "Not set"}</span>
                )}
              </div>

              {isFaction && (
                <div className="space-y-2">
                  <div>
                    <h3 className="text-xs uppercase tracking-wide text-zinc-400 mb-1">Public Reputation (0–5)</h3>
                    {editMode ? (
                      <input
                        type="number"
                        name="publicReputation"
                        min={0}
                        max={5}
                        value={formData.publicReputation}
                        onChange={handleInputChange}
                        className="w-full rounded-md bg-white/10 border border-white/20 px-3 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    ) : (
                      <span className="inline-block bg-white/10 px-2 py-1 rounded">{basePublic ?? "–"}/5</span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs uppercase tracking-wide text-zinc-400 mb-1">GM Reputation (0–5)</h3>
                    {editMode ? (
                      <input
                        type="number"
                        name="reputationScore"
                        min={0}
                        max={5}
                        value={formData.reputationScore}
                        onChange={handleInputChange}
                        className="w-full rounded-md bg-white/10 border border-white/20 px-3 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    ) : (
                      <span className="inline-block bg-white/10 px-2 py-1 rounded">{baseReputation ?? "–"}/5</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          {isFaction && (
            <section className="bg-black/40 border border-fuchsia-500/25 rounded-xl p-5 backdrop-blur-md space-y-3">
              <h2 className="text-lg font-semibold text-white mb-1">Faction Notes</h2>
              {editMode ? (
                <textarea
                  name="factionNotes"
                  value={formData.factionNotes}
                  onChange={handleInputChange}
                  rows={5}
                  className="w-full rounded-md bg-white/10 border border-white/20 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Track demands, favors owed, red lines, and what would flip this faction."
                />
              ) : (
                <p className="text-sm text-zinc-300 whitespace-pre-wrap">
                  {formData.factionNotes ||
                    "Track how this faction's stance towards the party evolves: demands, favors owed, red lines, and what would flip them from ally to enemy (or the reverse)."}
                </p>
              )}
            </section>
          )}

          <section className="bg-black/40 border border-emerald-500/25 rounded-xl p-5 backdrop-blur-md space-y-3">
            <h2 className="text-lg font-semibold text-white mb-1">Tags &amp; Flags</h2>
            {editMode ? (
              <input
                type="text"
                name="tags"
                value={formData.tags}
                onChange={handleInputChange}
                className="w-full rounded-md bg-white/10 border border-white/20 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Comma-separated tags (e.g. betrayal, patron, war crimes)"
              />
            ) : (() => {
              const tags = (formData.tags || "")
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean);
              return tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-1 rounded-full bg-purple-700/40 text-purple-200 border border-purple-400/40"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-400 italic">
                  No tags yet. Add some keywords to help future-you search this later.
                </p>
              );
            })()}
          </section>
        </div>
      </div>

      {/* METADATA STRIP */}
      <section className="bg-black/40 border border-white/15 rounded-xl p-5 backdrop-blur-md mb-10">
        <h2 className="text-base font-semibold text-white mb-2">Metadata</h2>
        <div className="flex flex-wrap gap-3 text-xs text-zinc-300">
          <span className="bg-white/10 px-2 py-1 rounded">ID: {relationship.id}</span>
          <span className="bg-white/10 px-2 py-1 rounded">Type: {relationship.type}</span>
          {baseLastChanged && (
            <span className="bg-white/10 px-2 py-1 rounded">Last change: {baseLastChanged}</span>
          )}
          <span className="bg-white/10 px-2 py-1 rounded">Intensity: {baseIntensity || "–"}/5</span>
          {isFaction && basePublic != null && basePublic !== "" && (
            <span className="bg-white/10 px-2 py-1 rounded">Public rep: {basePublic}/5</span>
          )}
          {isFaction && baseReputation != null && baseReputation !== "" && (
            <span className="bg-white/10 px-2 py-1 rounded">GM rep: {baseReputation}/5</span>
          )}
        </div>
      </section>
    </main>
  );
}