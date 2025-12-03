// src/pages/LoreProfile.jsx
import React, { useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import GradientBackground from "../components/GradientBackground";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { useMode } from "../context/ModeContext.jsx";
import { ArrowLeft, Tag } from "lucide-react";

// Mock lore entries with basic template hints
const MOCK_LORE = {
  1: {
    id: 1,
    title: "Chronicles of Varionath",
    type: "World",
    template: "concept", // generic world/meta concept
    category: "World Overview",
    summary:
      "High-level overview of Varionath, its planes, the Veins of Reality, and the central metaphysical rules.",
    playerFacing:
      "Varionath is a fractured world stitched together by ancient powers. Most folk only know the surface level of these stories.",
    gmNotes:
      "Use this as the top node that links to Nexus Points, major factions, and pantheon entries. This is GM-only scaffolding for now.",
    visibility: "gm-only",
    tags: ["core", "world", "varionath"],
  },
  2: {
    id: 2,
    title: "Nexus Points",
    type: "Concept",
    template: "concept",
    category: "Magic",
    summary:
      "Ancient loci where senses, magic, and reality itself become unstable. Each is tied to a specific 'sense' or aspect.",
    playerFacing:
      "Legends speak of places where the world grows thin and strange phenomena occur. Most think they are myths.",
    gmNotes:
      "Tie into your Nexus document + Shadow Dragon stuff. This is the backbone of the campaign's deeper arc.",
    visibility: "gm-only",
    tags: ["nexus", "senses", "metaphysics"],
  },
};

// Map internal template key to a nice label
const TEMPLATE_LABELS = {
  deity: "Deity / Higher Entity",
  faction: "Faction / Organization",
  location: "Location",
  event: "Event / Historical Moment",
  concept: "Concept / Mechanic",
  generic: "Lore",
};

// Option arrays for dropdowns
const CATEGORY_OPTIONS = [
  "World",
  "Magic",
  "History",
  "Pantheon",
  "Factions",
  "Location",
  "System",
];
const TYPE_OPTIONS = [
  "World",
  "Concept",
  "Deity",
  "Faction",
  "Location",
  "Event",
];
const TEMPLATE_OPTIONS = [
  { value: "deity", label: "Deity / Higher Entity" },
  { value: "faction", label: "Faction / Organization" },
  { value: "location", label: "Location" },
  { value: "event", label: "Event / Historical Moment" },
  { value: "concept", label: "Concept / Mechanic" },
];

function getTemplateKind(data) {
  const raw = (data.template || data.type || "").toLowerCase();

  if (raw.includes("deity") || raw.includes("god") || raw.includes("archfey") || raw.includes("demon"))
    return "deity";
  if (raw.includes("faction") || raw.includes("order") || raw.includes("guild") || raw.includes("house"))
    return "faction";
  if (
    raw.includes("city") ||
    raw.includes("district") ||
    raw.includes("location") ||
    raw.includes("temple") ||
    raw.includes("nexus")
  )
    return "location";
  if (
    raw.includes("event") ||
    raw.includes("war") ||
    raw.includes("battle") ||
    raw.includes("cataclysm") ||
    raw.includes("ritual") ||
    raw.includes("prophecy")
  )
    return "event";
  if (
    raw.includes("concept") ||
    raw.includes("mechanic") ||
    raw.includes("magic") ||
    raw.includes("system") ||
    raw.includes("plane")
  )
    return "concept";

  return "generic";
}

// Helper to render a simple text area or paragraph
function EditableBlock({ label, value, onChange, isEditing }) {
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold text-white">{label}</h3>

      {isEditing ? (
        <textarea
          rows={4}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm text-zinc-200 focus:outline-none focus:border-purple-300 whitespace-pre-line"
        />
      ) : (
        <p className="text-sm text-zinc-300 whitespace-pre-line">
          {value && value.trim().length > 0
            ? value
            : "— nothing recorded here yet —"}
        </p>
      )}
    </div>
  );
}

// Player column renderer
function renderPlayerColumn(kind, data, isEditing, handleFieldChange) {
  switch (kind) {
    case "deity":
      return (
        <section className="space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <EditableBlock
              label="Player-facing description"
              value={data.playerFacing}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("playerFacing", val)}
            />
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
            <EditableBlock
              label="Portfolio & symbols"
              value={data.portfolioSymbols}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("portfolioSymbols", val)}
            />
            <EditableBlock
              label="Worship & practices"
              value={data.worshipPractices}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("worshipPractices", val)}
            />
            <EditableBlock
              label="Known myths & stories"
              value={data.knownMythsStories}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("knownMythsStories", val)}
            />
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <EditableBlock
              label="Relationships (player view)"
              value={data.relationshipsPlayer}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("relationshipsPlayer", val)}
            />
          </div>
        </section>
      );

    case "faction":
      return (
        <section className="space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <EditableBlock
              label="Public description"
              value={data.playerFacing}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("playerFacing", val)}
            />
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
            <EditableBlock
              label="Structure & ranks (player view)"
              value={data.structureRanksPlayer}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("structureRanksPlayer", val)}
            />
            <EditableBlock
              label="Known members"
              value={data.knownMembers}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("knownMembers", val)}
            />
            <EditableBlock
              label="Reputation & influence"
              value={data.reputationInfluence}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("reputationInfluence", val)}
            />
            <EditableBlock
              label="Player-facing activities"
              value={data.playerActivities}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("playerActivities", val)}
            />
          </div>
        </section>
      );

    case "location":
      return (
        <section className="space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <EditableBlock
              label="Descriptive overview"
              value={data.playerFacing}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("playerFacing", val)}
            />
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
            <EditableBlock
              label="Player-known features"
              value={data.playerKnownFeatures}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("playerKnownFeatures", val)}
            />
            <EditableBlock
              label="Known NPCs & factions"
              value={data.knownNpcsFactions}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("knownNpcsFactions", val)}
            />
            <EditableBlock
              label="Player experience history"
              value={data.playerExperienceHistory}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("playerExperienceHistory", val)}
            />
          </div>
        </section>
      );

    case "event":
      return (
        <section className="space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <EditableBlock
              label="What's known in the world"
              value={data.playerFacing}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("playerFacing", val)}
            />
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
            <EditableBlock
              label="Consequences everyone sees"
              value={data.publicConsequences}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("publicConsequences", val)}
            />
            <EditableBlock
              label="Player-obtained knowledge"
              value={data.playerObtainedKnowledge}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("playerObtainedKnowledge", val)}
            />
          </div>
        </section>
      );

    case "concept":
      return (
        <section className="space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <EditableBlock
              label="How it's understood in-world"
              value={data.playerFacing}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("playerFacing", val)}
            />
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
            <EditableBlock
              label="Common myths & misconceptions"
              value={data.mythsMisconceptions}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("mythsMisconceptions", val)}
            />
            <EditableBlock
              label="Practical player info"
              value={data.practicalPlayerInfo}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("practicalPlayerInfo", val)}
            />
          </div>
        </section>
      );

    default:
      // Generic fallback
      return (
        <section className="space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <EditableBlock
              label="Player-facing lore"
              value={data.playerFacing}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("playerFacing", val)}
            />
          </div>
        </section>
      );
  }
}

// GM column renderer
function renderGMColumn(kind, data, isEditing, handleFieldChange) {
  switch (kind) {
    case "deity":
      return (
        <section className="space-y-4">
          <div className="bg-purple-950/40 border border-purple-500/40 rounded-2xl p-5 space-y-4">
            <EditableBlock
              label="True nature & origin"
              gmOnly
              value={data.gmTrueNature}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("gmTrueNature", val)}
            />
            <EditableBlock
              label="Hidden domains / corruptions"
              gmOnly
              value={data.hiddenDomains}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("hiddenDomains", val)}
            />
            <EditableBlock
              label="Avatars, manifestations & stat refs"
              gmOnly
              value={data.avatarsManifestations}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("avatarsManifestations", val)}
            />
            <EditableBlock
              label="Secret agendas & long game"
              gmOnly
              value={data.secretAgendas}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("secretAgendas", val)}
            />
            <EditableBlock
              label="Hooks & contracts"
              gmOnly
              value={data.hooksContracts}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("hooksContracts", val)}
            />
            <EditableBlock
              label="Foreshadowing & clue map"
              gmOnly
              value={data.foreshadowingClues}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("foreshadowingClues", val)}
            />
          </div>
        </section>
      );

    case "faction":
      return (
        <section className="space-y-4">
          <div className="bg-purple-950/40 border border-purple-500/40 rounded-2xl p-5 space-y-4">
            <EditableBlock
              label="True goals & hidden agendas"
              gmOnly
              value={data.trueGoals}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("trueGoals", val)}
            />
            <EditableBlock
              label="Inner circle / secret structure"
              gmOnly
              value={data.innerCircle}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("innerCircle", val)}
            />
            <EditableBlock
              label="Resources & capabilities"
              gmOnly
              value={data.resourcesCapabilities}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("resourcesCapabilities", val)}
            />
            <EditableBlock
              label="Faction clocks / timers"
              gmOnly
              value={data.factionClocks}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("factionClocks", val)}
            />
            <EditableBlock
              label="Secret history"
              gmOnly
              value={data.secretHistory}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("secretHistory", val)}
            />
            <EditableBlock
              label="Foreshadowing & planned moves"
              gmOnly
              value={data.plannedMoves}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("plannedMoves", val)}
            />
          </div>
        </section>
      );

    case "location":
      return (
        <section className="space-y-4">
          <div className="bg-purple-950/40 border border-purple-500/40 rounded-2xl p-5 space-y-4">
            <EditableBlock
              label="Hidden features & secrets"
              gmOnly
              value={data.hiddenFeatures}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("hiddenFeatures", val)}
            />
            <EditableBlock
              label="True state of the location"
              gmOnly
              value={data.trueState}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("trueState", val)}
            />
            <EditableBlock
              label="Encounter staging"
              gmOnly
              value={data.encounterStaging}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("encounterStaging", val)}
            />
            <EditableBlock
              label="Off-screen events here"
              gmOnly
              value={data.offScreenEvents}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("offScreenEvents", val)}
            />
            <EditableBlock
              label="Foreshadowing"
              gmOnly
              value={data.foreshadowing}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("foreshadowing", val)}
            />
          </div>
        </section>
      );

    case "event":
      return (
        <section className="space-y-4">
          <div className="bg-purple-950/40 border border-purple-500/40 rounded-2xl p-5 space-y-4">
            <EditableBlock
              label="True version of events"
              gmOnly
              value={data.trueVersion}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("trueVersion", val)}
            />
            <EditableBlock
              label="Hidden actors"
              gmOnly
              value={data.hiddenActors}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("hiddenActors", val)}
            />
            <EditableBlock
              label="Deep consequences"
              gmOnly
              value={data.deepConsequences}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("deepConsequences", val)}
            />
            <EditableBlock
              label="Ties to PCs & future"
              gmOnly
              value={data.tiesToPCs}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("tiesToPCs", val)}
            />
          </div>
        </section>
      );

    case "concept":
      return (
        <section className="space-y-4">
          <div className="bg-purple-950/40 border border-purple-500/40 rounded-2xl p-5 space-y-4">
            <EditableBlock
              label="True rules of the mechanic"
              gmOnly
              value={data.trueRules}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("trueRules", val)}
            />
            <EditableBlock
              label="Edge cases & exploits"
              gmOnly
              value={data.edgeCases}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("edgeCases", val)}
            />
            <EditableBlock
              label="Integration with other systems"
              gmOnly
              value={data.integrationNotes}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("integrationNotes", val)}
            />
            <EditableBlock
              label="Reveal plan"
              gmOnly
              value={data.revealPlan}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("revealPlan", val)}
            />
            <EditableBlock
              label="GM notes"
              gmOnly
              value={data.gmNotes}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("gmNotes", val)}
            />
          </div>
        </section>
      );

    default:
      return (
        <section className="space-y-4">
          <div className="bg-purple-950/40 border border-purple-500/40 rounded-2xl p-5">
            <EditableBlock
              label="GM notes"
              gmOnly
              value={data.gmNotes}
              isEditing={isEditing}
              onChange={(val) => handleFieldChange("gmNotes", val)}
            />
          </div>
        </section>
      );
  }
}

export default function LoreProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isGM } = useMode();

  const isGMMode = isGM && searchParams.get("mode") !== "player";

  const lore = MOCK_LORE[id];

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(
    lore || {
      title: "",
      type: "",
      template: "",
      category: "",
      summary: "",
      playerFacing: "",
      gmNotes: "",
      visibility: "gm-only",
      tags: [],
    }
  );
  const [tagInput, setTagInput] = useState((lore?.tags || []).join(", "));

  if (!lore) {
    return (
      <GradientBackground>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 ml-64 p-8 text-white">
            <button
              className="flex items-center gap-2 text-zinc-400 hover:text-white mb-4"
              onClick={() =>
                navigate(`/lore${isGMMode ? "?mode=gm" : "?mode=player"}`)
              }
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Lore Hub
            </button>
            <h1 className="text-3xl font-bold mb-2">Lore Entry Not Found</h1>
            <p className="text-zinc-400 text-sm">
              This lore ID doesn&apos;t exist in the mock data yet.
            </p>
          </div>
        </div>
      </GradientBackground>
    );
  }

  const effectiveData = { ...lore, ...formData };
  const templateKind = getTemplateKind(effectiveData);
  const templateLabel = TEMPLATE_LABELS[templateKind] || "Lore";

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const toggleVisibility = () => {
    setFormData((prev) => ({
      ...prev,
      visibility: prev.visibility === "gm-only" ? "player" : "gm-only",
    }));
  };

  return (
    <GradientBackground>
      <div className="flex min-h-screen">
        <Sidebar />

        <div className="flex-1 flex flex-col ml-64">
          <TopBar title={effectiveData.title} />

          <main className="flex-1 p-8 overflow-auto">
            {/* Back link + Edit toggle */}
            <div className="flex items-center justify-between mb-6">
              <button
                className="flex items-center gap-2 text-zinc-400 hover:text-white"
                onClick={() =>
                  navigate(`/lore${isGMMode ? "?mode=gm" : "?mode=player"}`)
                }
              >
                <ArrowLeft className="w-5 h-5" />
                Back to Lore Hub
              </button>

              {isGMMode && (
                <button
                  onClick={() => setIsEditing((prev) => !prev)}
                  className="px-4 py-1.5 rounded-full text-sm border border-white/15 bg-white/5 text-zinc-200 hover:bg-white/10 transition-colors"
                >
                  {isEditing ? "Done" : "Edit"}
                </button>
              )}
            </div>

            {/* Core identity card */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2">
                  {/* Category • Type • Template label */}
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    {isGMMode && isEditing ? (
                      <span className="flex gap-2 items-center flex-wrap">
                        <select
                          value={effectiveData.category || ""}
                          onChange={(e) => handleFieldChange("category", e.target.value)}
                          className="px-2 py-1 rounded-md bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-purple-400"
                        >
                          <option value="" disabled>
                            Category
                          </option>
                          {CATEGORY_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                        <span>•</span>
                        <select
                          value={effectiveData.type || ""}
                          onChange={(e) => handleFieldChange("type", e.target.value)}
                          className="px-2 py-1 rounded-md bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-purple-400"
                        >
                          <option value="" disabled>
                            Type
                          </option>
                          {TYPE_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                        <span>•</span>
                        <select
                          value={effectiveData.template || ""}
                          onChange={(e) => handleFieldChange("template", e.target.value)}
                          className="px-2 py-1 rounded-md bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-purple-400"
                        >
                          <option value="" disabled>
                            Template
                          </option>
                          {TEMPLATE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </span>
                    ) : (
                      <>
                        {effectiveData.category || "Uncategorized"} {" • "}
                        {effectiveData.type || "Lore"} {" • "}
                        {templateLabel}
                      </>
                    )}
                  </p>

                  {/* Title */}
                  {isEditing ? (
                    <input
                      type="text"
                      value={effectiveData.title || ""}
                      onChange={(e) =>
                        handleFieldChange("title", e.target.value)
                      }
                      className="w-full max-w-xl px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-2xl font-bold text-white focus:outline-none focus:border-purple-400"
                    />
                  ) : (
                    <h1 className="text-3xl font-bold text-white">
                      {effectiveData.title}
                    </h1>
                  )}

                  {/* Summary / tagline */}
                  {isEditing ? (
                    <textarea
                      rows={3}
                      value={effectiveData.summary || ""}
                      onChange={(e) =>
                        handleFieldChange("summary", e.target.value)
                      }
                      className="w-full max-w-2xl mt-2 px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm text-zinc-200 focus:outline-none focus:border-purple-400"
                    />
                  ) : (
                    <p className="text-zinc-400 text-sm mt-2">
                      {effectiveData.summary}
                    </p>
                  )}
                </div>

                {/* GM-only metadata on the right */}
                <div className="flex flex-col items-end gap-2">

                  {isGMMode && (
                    <>
                      {/* Visibility pills */}
                      {isEditing ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleFieldChange("visibility", "player")}
                            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs border transition-colors ${
                              effectiveData.visibility === "player"
                                ? "bg-emerald-500/20 border-emerald-400/60 text-emerald-100"
                                : "bg-transparent border-emerald-400/40 text-emerald-200/70"
                            }`}
                          >
                            Player-visible
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFieldChange("visibility", "gm-only")}
                            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs border transition-colors ${
                              effectiveData.visibility === "gm-only"
                                ? "bg-red-500/20 border-red-400/60 text-red-100"
                                : "bg-transparent border-red-400/40 text-red-200/70"
                            }`}
                          >
                            GM only
                          </button>
                        </div>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs border ${
                            effectiveData.visibility === "gm-only"
                              ? "bg-red-500/20 border-red-400/60 text-red-100"
                              : "bg-emerald-500/20 border-emerald-400/60 text-emerald-100"
                          }`}
                        >
                          {effectiveData.visibility === "gm-only"
                            ? "GM only"
                            : "Player-visible"}
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-400/40 text-xs text-purple-200">
                        <Tag className="w-3 h-3" />
                        Core lore node
                      </span>

                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Two-column layout: Player vs GM */}
            <div
              className={`grid gap-6 ${
                isGMMode ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
              }`}
            >
              {/* Player-facing */}
              {renderPlayerColumn(
                templateKind,
                effectiveData,
                isEditing && isGMMode,
                (field, value) => handleFieldChange(field, value)
              )}

              {/* GM-only column */}
              {isGMMode &&
                renderGMColumn(
                  templateKind,
                  effectiveData,
                  isEditing && isGMMode,
                  (field, value) => handleFieldChange(field, value)
                )}
            </div>

{/* Metadata strip – GM ONLY */}
{isGMMode && (
  <>
    <div className="mt-8 flex flex-wrap gap-4 text-[11px] text-zinc-500 border-t border-white/5 pt-4">
      <span>Campaign: Chronicles of Varionath (mock)</span>
      <span>Entry ID: {lore.id}</span>
      <span>Template: {templateLabel}</span>
      <span>Type: {effectiveData.type || "Lore"}</span>
      <span>Category: {effectiveData.category || "Uncategorized"}</span>
      <span>
        Visibility:{" "}
        {effectiveData.visibility === "gm-only"
          ? "GM only"
          : "Player-visible"}
      </span>
      <span>Mode: GM</span>
    </div>
    {/* Tags row */}
    <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
      <span>Tags:</span>
      {isEditing ? (
        <input
          type="text"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onBlur={() => {
            const parsed = tagInput
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean);
            handleFieldChange("tags", parsed);
          }}
          className="w-full max-w-xs px-2 py-1 rounded-md bg-black/40 border border-white/10 text-xs text-zinc-200 focus:outline-none focus:border-purple-400"
          placeholder="Comma-separated tags"
        />
      ) : (
        (effectiveData.tags && effectiveData.tags.length > 0) ? (
          <div className="flex flex-wrap gap-1">
            {effectiveData.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-zinc-300"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-zinc-600">— none —</span>
        )
      )}
    </div>
  </>
)}
          </main>
        </div>
      </div>
    </GradientBackground>
  );
}