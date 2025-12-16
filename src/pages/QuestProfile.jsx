// src/pages/QuestProfile.jsx
import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMode } from "../context/ModeContext.jsx";
import { ArrowLeft, Tag, Link as LinkIcon } from "lucide-react";
import { mockQuest } from "../data/mockQuests.js";

const statusOptions = [
  { value: "not-started", label: "Not started", color: "bg-zinc-700 text-zinc-200" },
  { value: "active", label: "Active", color: "bg-emerald-500/20 text-emerald-300" },
  { value: "completed", label: "Completed", color: "bg-purple-500/20 text-purple-300" },
  { value: "failed", label: "Failed", color: "bg-red-500/20 text-red-300" },
];

const typeOptions = [
  { value: "main-arc", label: "Main arc" },
  { value: "side-quest", label: "Side quest" },
  { value: "character-arc", label: "Character arc" },
  { value: "world-arc", label: "World arc" },
];

export default function QuestProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isGM } = useMode();


  const initialQuest = id === "1" ? mockQuest : {
    id,
    name: `Quest #${id}`,
    tagline: "New quest skeleton. Fill me with schemes.",
    status: "not-started",
    type: "side-quest",
    campaign: "Varionath Core",
    playerSummary: "",
    playerSteps: [],
    visibleConsequences: "",
    playerRewards: "",
    gmSummary: "",
    gmSteps: [],
    gmConsequences: "",
    gmRewards: "",
    tags: [],
    linkedSessionsCount: 0,
    linkedNpcsCount: 0,
    linkedItemsCount: 0,
    linkedMapsCount: 0,
    linkedLoreCount: 0,
  };

  const [isEditing, setIsEditing] = useState(false);
  const [quest, setQuest] = useState(initialQuest);
  const [tagInput, setTagInput] = useState(initialQuest.tags.join(", "));

  const currentStatus = statusOptions.find((s) => s.value === quest.status) || statusOptions[0];

  const handleFieldChange = (field, value) => {
    setQuest((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleMultilineChange = (field, text) => {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    setQuest((prev) => ({
      ...prev,
      [field]: lines,
    }));
  };

  const tagString = isEditing ? tagInput : quest.tags.join(", ");

  const handleTagInputChange = (value) => {
    setTagInput(value);
    const tags = value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    setQuest((prev) => ({
      ...prev,
      tags,
    }));
  };

  const renderStepsText = (steps) => {
    if (!steps || steps.length === 0) return "";
    return steps.join("\n");
  };

  // Quests are GM-only for now – hard gate (must be after hooks to avoid hook-order issues)
  if (!isGM) {
    return (
      <div className="p-8">
        <button
          className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Dashboard
        </button>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
          <h1 className="text-3xl font-bold text-white mb-3">GM Quest Notebook Only 💜</h1>
          <p className="text-zinc-300 mb-2">
            Nice try, adventurer. This page is for scheming, foreshadowing, and emotionally compromising your characters in peace.
          </p>
          <p className="text-zinc-400 text-sm">
            Ask your DM nicely if you think you&apos;re allowed to see this. Otherwise, consider this a{" "}
            <span className="text-purple-300 font-medium">forbidden quest log</span>{" "}
            and go roleplay doing your laundry in-game.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 overflow-auto">
      {/* Back button and Edit toggle */}
      <div className="flex items-center justify-between mb-6">
        <button
          className="flex items-center gap-2 text-zinc-400 hover:text-white"
          onClick={() => navigate("/quests")}
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Quests
        </button>

        <button
          onClick={() => setIsEditing((prev) => !prev)}
          className="px-4 py-2 rounded-xl border border-purple-500/60 text-purple-200 text-sm font-medium hover:bg-purple-500/10 transition-colors"
        >
          {isEditing ? "Done" : "Edit"}
        </button>
      </div>

      {/* Header card */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex-1">
            {isEditing ? (
              <input
                type="text"
                value={quest.name}
                onChange={(e) => handleFieldChange("name", e.target.value)}
                className="w-full bg-transparent border-b border-white/10 text-2xl md:text-3xl font-bold text-white pb-1 focus:outline-none focus:border-purple-400"
                placeholder="Quest name"
              />
            ) : (
              <h1 className="text-2xl md:text-3xl font-bold text-white">{quest.name || "Untitled Quest"}</h1>
            )}

            {isEditing ? (
              <input
                type="text"
                value={quest.tagline}
                onChange={(e) => handleFieldChange("tagline", e.target.value)}
                className="mt-2 w-full bg-transparent border-b border-white/10 text-sm text-zinc-300 pb-1 focus:outline-none focus:border-purple-400"
                placeholder="One-line description"
              />
            ) : (
              <p className="mt-2 text-sm text-zinc-300">{quest.tagline || "Add a one-line description for this quest."}</p>
            )}
          </div>

          <div className="flex flex-col items-start md:items-end gap-3 min-w-[200px]">
            {/* Status pill options */}
            <div className="flex flex-wrap gap-2 justify-end">
              {statusOptions.map((status) => {
                const isActive = quest.status === status.value;
                return (
                  <button
                    key={status.value}
                    type="button"
                    onClick={() => isEditing && handleFieldChange("status", status.value)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border ${
                      isActive
                        ? status.color + " border-white/40"
                        : "bg-black/20 text-zinc-400 border-white/10"
                    } ${isEditing ? "cursor-pointer" : "cursor-default"}`}
                  >
                    {status.label}
                  </button>
                );
              })}
            </div>

            {/* Type selector */}
            <div className="flex flex-wrap gap-2 justify-end">
              {typeOptions.map((type) => {
                const isActive = quest.type === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => isEditing && handleFieldChange("type", type.value)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border ${
                      isActive
                        ? "bg-purple-500/20 text-purple-200 border-purple-400/60"
                        : "bg-black/20 text-zinc-400 border-white/10"
                    } ${isEditing ? "cursor-pointer" : "cursor-default"}`}
                  >
                    {type.label}
                  </button>
                );
              })}
            </div>

            {/* Campaign */}
            <div className="text-xs text-zinc-400">
              <span className="uppercase tracking-wide">Campaign: </span>
              <span className="text-zinc-100 font-medium">{quest.campaign || "Unassigned"}</span>
              <span className="ml-2 text-[10px] uppercase tracking-wide text-zinc-500">(Managed via Campaigns module)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        {/* Player-facing / surface info */}
        <div className="space-y-4">
          {/* Player Summary */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-zinc-200 mb-2">Player-safe Summary</h2>
            {isEditing ? (
              <textarea
                rows={4}
                value={quest.playerSummary}
                onChange={(e) => handleFieldChange("playerSummary", e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-400 resize-none"
                placeholder="What the party believes this quest is about."
              />
            ) : (
              <p className="text-sm text-zinc-300 whitespace-pre-line min-h-[3rem]">
                {quest.playerSummary ||
                  "No player-safe summary yet. Future you will appreciate a few sentences here."}
              </p>
            )}
          </section>

          {/* Visible Steps */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-zinc-200 mb-2">Visible Steps & Milestones</h2>
            {isEditing ? (
              <textarea
                rows={5}
                value={renderStepsText(quest.playerSteps)}
                onChange={(e) => handleMultilineChange("playerSteps", e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-400 resize-none"
                placeholder={"One step per line.\nE.g. Talk to Kiyomi in the Moonlit Archive."}
              />
            ) : quest.playerSteps && quest.playerSteps.length > 0 ? (
              <ul className="list-disc list-inside text-sm text-zinc-300 space-y-1">
                {quest.playerSteps.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">
                No visible steps yet. You can outline what the party thinks the next moves are.
              </p>
            )}
          </section>

          {/* Visible Consequences */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-zinc-200 mb-2">Visible Consequences</h2>
            {isEditing ? (
              <textarea
                rows={3}
                value={quest.visibleConsequences}
                onChange={(e) => handleFieldChange("visibleConsequences", e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-400 resize-none"
                placeholder="What the world clearly shows as consequences so far."
              />
            ) : (
              <p className="text-sm text-zinc-300 whitespace-pre-line min-h-[3rem]">
                {quest.visibleConsequences ||
                  "You can describe how the world visibly changes as the quest progresses."}
              </p>
            )}
          </section>

          {/* Player Rewards */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-zinc-200 mb-2">Player-Facing Rewards</h2>
            {isEditing ? (
              <textarea
                rows={3}
                value={quest.playerRewards}
                onChange={(e) => handleFieldChange("playerRewards", e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-400 resize-none"
                placeholder="What rewards the players are aware of (or expect)."
              />
            ) : (
              <p className="text-sm text-zinc-300 whitespace-pre-line min-h-[3rem]">
                {quest.playerRewards ||
                  "Note down gold, boons, titles, or other rewards the party thinks they'll get."}
              </p>
            )}
          </section>
        </div>

        {/* GM-only side */}
        <div className="space-y-4">
          <section className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-rose-200 mb-2">True Objective & GM Summary</h2>
            {isEditing ? (
              <textarea
                rows={4}
                value={quest.gmSummary}
                onChange={(e) => handleFieldChange("gmSummary", e.target.value)}
                className="w-full bg-black/30 border border-rose-500/40 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-rose-400 resize-none"
                placeholder="What this quest is actually about, from your evil architect POV."
              />
            ) : (
              <p className="text-sm text-zinc-200 whitespace-pre-line min-h-[3rem]">
                {quest.gmSummary ||
                  "Spell out the real purpose of this quest, including ties to arcs, deities, and Nexus bullshit."}
              </p>
            )}
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-rose-200 mb-2">Hidden Steps & Twists</h2>
            {isEditing ? (
              <textarea
                rows={5}
                value={renderStepsText(quest.gmSteps)}
                onChange={(e) => handleMultilineChange("gmSteps", e.target.value)}
                className="w-full bg-black/30 border border-rose-500/40 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-rose-400 resize-none"
                placeholder={"One secret step per line.\nE.g. Cult in Waldenmont completes a partial ritual that backfires."}
              />
            ) : quest.gmSteps && quest.gmSteps.length > 0 ? (
              <ul className="list-disc list-inside text-sm text-zinc-200 space-y-1">
                {quest.gmSteps.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-400">Use this to outline how the quest advances behind the scenes.</p>
            )}
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-rose-200 mb-2">Hidden Consequences</h2>
            {isEditing ? (
              <textarea
                rows={3}
                value={quest.gmConsequences}
                onChange={(e) => handleFieldChange("gmConsequences", e.target.value)}
                className="w-full bg-black/30 border border-rose-500/40 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-rose-400 resize-none"
                placeholder="How this will blow up in their faces later, even if they succeed."
              />
            ) : (
              <p className="text-sm text-zinc-200 whitespace-pre-line min-h-[3rem]">
                {quest.gmConsequences || "Document the long-tail effects that only you know about (yet)."}
              </p>
            )}
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-rose-200 mb-2">GM-Only Rewards & Fallout</h2>
            {isEditing ? (
              <textarea
                rows={3}
                value={quest.gmRewards}
                onChange={(e) => handleFieldChange("gmRewards", e.target.value)}
                className="w-full bg-black/30 border border-rose-500/40 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-rose-400 resize-none"
                placeholder="What this quest gives YOU as the DM: leverage, reveals, new toys."
              />
            ) : (
              <p className="text-sm text-zinc-200 whitespace-pre-line min-h-[3rem]">
                {quest.gmRewards || "Reward yourself too: note what this quest unlocks in terms of story power."}
              </p>
            )}
          </section>
        </div>
      </div>

      {/* Metadata strip */}
      <section className="bg-black/40 border border-white/10 rounded-2xl px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Tags */}
        <div className="flex items-start gap-3">
          <Tag className="w-4 h-4 text-purple-300 mt-1" />
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">Tags (GM-only)</p>
            {isEditing ? (
              <input
                type="text"
                value={tagString}
                onChange={(e) => handleTagInputChange(e.target.value)}
                className="w-full md:w-80 bg-black/40 border border-white/15 rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-purple-400"
                placeholder="nexus, langendris, last-shadow"
              />
            ) : quest.tags && quest.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {quest.tags.map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded-full bg-purple-500/15 text-[11px] text-purple-200 border border-purple-500/30"
                  >
                    {t}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">
                No tags yet. Add a few in Edit mode to group this quest with arcs, locations, and lore.
              </p>
            )}
          </div>
        </div>

        {/* Linked counts */}
        <div className="flex flex-wrap gap-4 text-xs text-zinc-400">
          <div className="flex items-center gap-1.5">
            <LinkIcon className="w-3 h-3" />
            <span className="text-zinc-500">Sessions:</span>
            <span className="text-zinc-200">{quest.linkedSessionsCount ?? 0}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <LinkIcon className="w-3 h-3" />
            <span className="text-zinc-500">NPCs:</span>
            <span className="text-zinc-200">{quest.linkedNpcsCount ?? 0}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <LinkIcon className="w-3 h-3" />
            <span className="text-zinc-500">Items:</span>
            <span className="text-zinc-200">{quest.linkedItemsCount ?? 0}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <LinkIcon className="w-3 h-3" />
            <span className="text-zinc-500">Maps:</span>
            <span className="text-zinc-200">{quest.linkedMapsCount ?? 0}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <LinkIcon className="w-3 h-3" />
            <span className="text-zinc-500">Lore:</span>
            <span className="text-zinc-200">{quest.linkedLoreCount ?? 0}</span>
          </div>
        </div>
      </section>
    </div>
  );
}