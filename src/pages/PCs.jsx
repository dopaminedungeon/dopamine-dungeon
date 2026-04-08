import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { getAllCharacters, upsertCharacter } from "../data/characters/characters.repo";
import { importCharacterFromDdbPdf } from "../data/characters/characterImport.service";
import { useCampaign } from "../context/CampaignContext";
import { useMode } from "../context/ModeContext";
import { useAuth } from "../context/AuthContext";

function createManualPcDraft() {
  return {
    name: "",
    playerName: "",
    race: "",
    class: "",
    subclass: "",
    level: 1,
    alignment: "",
    background: "",
    publicNotes: "",
    visibility: "player",
    isPlayerVisible: true,
    stats: {
      abilities: {
        str: { score: undefined, mod: undefined },
        dex: { score: undefined, mod: undefined },
        con: { score: undefined, mod: undefined },
        int: { score: undefined, mod: undefined },
        wis: { score: undefined, mod: undefined },
        cha: { score: undefined, mod: undefined },
      },
      saves: {},
      skills: {},
      hpCurrent: undefined,
      hpMax: undefined,
      ac: undefined,
      initiativeMod: undefined,
      speed: undefined,
      spellcastingAbility: "",
      spellSaveDC: undefined,
      spellAttackBonus: undefined,
      proficiencyBonus: undefined,
      passivePerception: undefined,
      passiveInsight: undefined,
      passiveInvestigation: undefined,
      additionalSenses: "",
      defenses: {
        resistances: [],
        immunities: [],
        vulnerabilities: [],
        notes: "",
      },
    },
  };
}

const PCs = () => {
  const { selectedCampaignId } = useCampaign();
  const { mode } = useMode();
  const { user } = useAuth();

  const [pcs, setPcs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPc, setNewPc] = useState(createManualPcDraft());
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [showImportReviewModal, setShowImportReviewModal] = useState(false);
  const [importDraft, setImportDraft] = useState(null);
  const [isSavingImportDraft, setIsSavingImportDraft] = useState(false);
  const importInputRef = useRef(null);

  useEffect(() => {
    const loadCharacters = async () => {
      if (!selectedCampaignId) {
        setPcs([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const characters = await getAllCharacters(selectedCampaignId);

        const playerVisibleCharacters = characters.filter((character) => {
          if (String(mode).toLowerCase() === "gm") {
            return true;
          }

          if (character.ownerUserId && character.ownerUserId === user?.uid) {
            return true;
          }

          if (character.visibility === "player") {
            return true;
          }

          return character.isPlayerVisible === true;
        });

        setPcs(playerVisibleCharacters);
      } catch (error) {
        console.error("[PCs] Failed to load characters", error);
        setPcs([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadCharacters();
  }, [selectedCampaignId, mode, user?.uid]);

  const isGMMode = String(mode).toLowerCase() === "gm";

  const refreshCharacters = async () => {
    if (!selectedCampaignId) {
      setPcs([]);
      return;
    }

    const characters = await getAllCharacters(selectedCampaignId);

    const playerVisibleCharacters = characters.filter((character) => {
      if (String(mode).toLowerCase() === "gm") {
        return true;
      }

      if (character.ownerUserId && character.ownerUserId === user?.uid) {
        return true;
      }

      if (character.visibility === "player") {
        return true;
      }

      return character.isPlayerVisible === true;
    });

    setPcs(playerVisibleCharacters);
  };

  const handleCreatePc = async (e) => {
    e.preventDefault();
    if (!selectedCampaignId || !newPc.name.trim()) return;

    try {
      setIsSaving(true);

      const level = Math.max(1, Number(newPc.level) || 1);
      const characterToSave = {
        ...newPc,
        name: newPc.name.trim(),
        playerName: newPc.playerName.trim(),
        race: newPc.race.trim(),
        class: newPc.class.trim(),
        subclass: newPc.subclass.trim(),
        alignment: newPc.alignment.trim(),
        background: newPc.background.trim(),
        publicNotes: newPc.publicNotes.trim(),
        level,
        classes: newPc.class.trim()
          ? [
            {
              className: newPc.class.trim(),
              level,
              subclass: newPc.subclass.trim(),
              spellcastingAbility: "",
            },
          ]
          : [],
        visibility: newPc.visibility,
        isPlayerVisible: newPc.visibility === "player",
        ownerUserId: user?.uid || "",
      };

      await upsertCharacter(selectedCampaignId, characterToSave);
      await refreshCharacters();
      setShowCreateModal(false);
      setNewPc(createManualPcDraft());
    } catch (error) {
      console.error("[PCs] Failed to create character", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenImportPicker = () => {
    setImportMessage("");
    setImportDraft(null);
    setShowImportReviewModal(false);
    importInputRef.current?.click();
  };

  const handleImportPdf = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      setImportMessage("");

      const result = await importCharacterFromDdbPdf(file);

      if (!result?.ok || !result?.draft) {
        throw new Error(result?.error || "Failed to prepare character import draft.");
      }

      const mappedDraft = {
        sourceFileName: result.draft?.character?.importMeta?.filename || file.name,
        character: (() => {
          const c = result.draft?.character || {};
          const primaryClass =
            Array.isArray(c.classes) && c.classes.length > 0 ? c.classes[0] : null;

          return {
            name: c.name || "",
            race: c.race || "",
            class: primaryClass?.className || c.class || "",
            subclass: primaryClass?.subclass || c.subclass || "",
            level: primaryClass?.level || c.level || 1,
            background: c.background || "",
            alignment: c.alignment || "",
            playerName: c.playerName || "",
            publicNotes: c.publicNotes || "",

            identity: {
              faith: c.identity?.faith || "",
              size: c.identity?.size || "",
              age: c.age || c.identity?.age || "",
              height: c.identity?.height || "",
              weight: c.identity?.weight || "",
              gender: c.identity?.gender || "",
              eyes: c.identity?.eyes || "",
              hair: c.identity?.hair || "",
              skin: c.identity?.skin || "",
            },

            stats: {
              hpMax: c.stats?.hpMax ?? "",
              ac: c.stats?.ac ?? "",
              speed: c.stats?.speed ?? "",
              initiativeMod: c.stats?.initiativeMod ?? "",
              proficiencyBonus: c.stats?.proficiencyBonus ?? "",
              spellcastingAbility: c.stats?.spellcastingAbility || "",
              spellSaveDC: c.stats?.spellSaveDC ?? "",
              spellAttackBonus: c.stats?.spellAttackBonus ?? "",
              passivePerception: c.stats?.passivePerception ?? "",
              passiveInsight: c.stats?.passiveInsight ?? "",
              passiveInvestigation: c.stats?.passiveInvestigation ?? "",
              additionalSenses: c.stats?.additionalSenses || "",
              abilities: {
                str: c.stats?.abilities?.str?.score ?? "",
                dex: c.stats?.abilities?.dex?.score ?? "",
                con: c.stats?.abilities?.con?.score ?? "",
                int: c.stats?.abilities?.int?.score ?? "",
                wis: c.stats?.abilities?.wis?.score ?? "",
                cha: c.stats?.abilities?.cha?.score ?? "",
              },
            },

            narrative: {
              personalityTraits: c.narrative?.personalityTraits || "",
              ideals: c.narrative?.ideals || "",
              bonds: c.narrative?.bonds || "",
              flaws: c.narrative?.flaws || "",
            },
          };
        })(),
        review: {
          confidence: result.draft?.review?.confidence || "medium",
          warnings: Array.isArray(result.draft?.review?.warnings)
            ? result.draft.review.warnings
            : [],
          missingFields: Array.isArray(result.draft?.review?.missingFields)
            ? result.draft.review.missingFields
            : [],
        },
      };

      setImportDraft(mappedDraft);
      setShowImportReviewModal(true);
      setImportMessage(
        `Import draft prepared for ${mappedDraft.sourceFileName}. Review the character before saving.`
      );
    } catch (error) {
      console.error("[PCs] Failed to start PDF import", error);
      setImportMessage("Failed to start PDF import.");
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  };

  const handleCloseImportReview = () => {
    setShowImportReviewModal(false);
    setImportDraft(null);
  };

  const handleCreateImportedPc = async () => {
    if (!selectedCampaignId || !importDraft?.character?.name?.trim()) return;

    try {
      setIsSavingImportDraft(true);

      const characterLevel = Math.max(1, Number(importDraft.character.level) || 1);
      const importedCharacterToSave = {
        name: importDraft.character.name.trim(),
        playerName: (importDraft.character.playerName || "").trim(),
        race: (importDraft.character.race || "").trim(),
        class: (importDraft.character.class || "").trim(),
        subclass: (importDraft.character.subclass || "").trim(),
        level: characterLevel,
        alignment: (importDraft.character.alignment || "").trim(),
        background: (importDraft.character.background || "").trim(),
        publicNotes: (importDraft.character.publicNotes || "").trim(),
        visibility: "player",
        isPlayerVisible: true,
        ownerUserId: user?.uid || "",

        classes: importDraft.character.class?.trim()
          ? [
              {
                className: importDraft.character.class.trim(),
                level: characterLevel,
                subclass: (importDraft.character.subclass || "").trim(),
                spellcastingAbility:
                  (importDraft.character.stats?.spellcastingAbility || "").trim(),
              },
            ]
          : [],

        identity: {
          faith: (importDraft.character.identity?.faith || "").trim(),
          size: (importDraft.character.identity?.size || "").trim(),
          height: (importDraft.character.identity?.height || "").trim(),
          weight: (importDraft.character.identity?.weight || "").trim(),
          gender: (importDraft.character.identity?.gender || "").trim(),
          eyes: (importDraft.character.identity?.eyes || "").trim(),
          hair: (importDraft.character.identity?.hair || "").trim(),
          skin: (importDraft.character.identity?.skin || "").trim(),
        },

        stats: {
          abilities: {
            str: {
              score: Number(importDraft.character.stats?.abilities?.str) || undefined,
            },
            dex: {
              score: Number(importDraft.character.stats?.abilities?.dex) || undefined,
            },
            con: {
              score: Number(importDraft.character.stats?.abilities?.con) || undefined,
            },
            int: {
              score: Number(importDraft.character.stats?.abilities?.int) || undefined,
            },
            wis: {
              score: Number(importDraft.character.stats?.abilities?.wis) || undefined,
            },
            cha: {
              score: Number(importDraft.character.stats?.abilities?.cha) || undefined,
            },
          },
          hpMax: Number(importDraft.character.stats?.hpMax) || undefined,
          hpCurrent: Number(importDraft.character.stats?.hpMax) || undefined,
          ac: Number(importDraft.character.stats?.ac) || undefined,
          speed: Number(importDraft.character.stats?.speed) || undefined,
          initiativeMod:
            Number(importDraft.character.stats?.initiativeMod) || undefined,
          proficiencyBonus:
            Number(importDraft.character.stats?.proficiencyBonus) || undefined,
          spellcastingAbility:
            (importDraft.character.stats?.spellcastingAbility || "").trim(),
          spellSaveDC:
            Number(importDraft.character.stats?.spellSaveDC) || undefined,
          spellAttackBonus:
            Number(importDraft.character.stats?.spellAttackBonus) || undefined,
          passivePerception:
            Number(importDraft.character.stats?.passivePerception) || undefined,
          passiveInsight:
            Number(importDraft.character.stats?.passiveInsight) || undefined,
          passiveInvestigation:
            Number(importDraft.character.stats?.passiveInvestigation) || undefined,
          additionalSenses:
            (importDraft.character.stats?.additionalSenses || "").trim(),
        },

        narrative: {
          personalityTraits:
            (importDraft.character.narrative?.personalityTraits || "").trim(),
          ideals: (importDraft.character.narrative?.ideals || "").trim(),
          bonds: (importDraft.character.narrative?.bonds || "").trim(),
          flaws: (importDraft.character.narrative?.flaws || "").trim(),
        },

        importMeta: {
          source: "dndbeyond-pdf",
          importedAt: new Date().toISOString(),
          filename: importDraft.sourceFileName || "",
          warnings: Array.isArray(importDraft.review?.warnings)
            ? importDraft.review.warnings
            : [],
          confidence: importDraft.review?.confidence || "medium",
        },
      };

      await upsertCharacter(selectedCampaignId, importedCharacterToSave);
      await refreshCharacters();
      setShowImportReviewModal(false);
      setImportDraft(null);
      setImportMessage(`Imported character created from ${importedCharacterToSave.name}.`);
    } catch (error) {
      console.error("[PCs] Failed to create imported character", error);
      setImportMessage(error?.message || "Failed to create imported character.");
    } finally {
      setIsSavingImportDraft(false);
    }
  };

  const hasPcs = pcs.length > 0;

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
        {/* Subsection nav */}
        <div className="mb-4 flex items-center gap-2">
          {hasPcs ? (
            <NavLink
              to="/pcs"
              end
              className={({ isActive }) =>
                `px-3 py-2 rounded-xl text-sm border transition-colors ${isActive
                  ? "bg-indigo-500/20 border-indigo-400/50 text-white"
                  : "bg-zinc-950/20 border-zinc-800/60 text-zinc-300 hover:text-white hover:bg-zinc-950/35"
                }`
              }
            >
              Characters
            </NavLink>
          ) : null}

          <NavLink
            to="/pcs/bag"
            className={({ isActive }) =>
              `px-3 py-2 rounded-xl text-sm border transition-colors ${isActive
                ? "bg-indigo-500/20 border-indigo-400/50 text-white"
                : "bg-zinc-950/20 border-zinc-800/60 text-zinc-300 hover:text-white hover:bg-zinc-950/35"
              }`
            }
          >
            Bag of Holding
          </NavLink>
        </div>
        {/* Header */}
        <div className="mb-5 md:mb-7 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-white">
              Player Characters
            </h1>
            <p className="mt-1 text-xs md:text-sm text-zinc-400 max-w-2xl">
              {isLoading
                ? "Loading character profiles for the active campaign…"
                : hasPcs
                  ? "Character hub for stats, notes, relationships, conditions, arcs, and session links."
                  : "Party hub — Bag of Holding is available. Player character profiles will appear here once added to this campaign."}
            </p>
          </div>

          <div className="w-full md:w-auto flex flex-col md:flex-row gap-3 md:items-center">
            {hasPcs ? (
              <div className="w-full md:w-104">
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
            ) : null}

            {isGMMode ? (
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleOpenImportPicker}
                  disabled={isImporting}
                  className="rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isImporting ? "Preparing import..." : "Import D&D Beyond PDF"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="rounded-xl bg-indigo-500/20 border border-indigo-400/50 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500/30 transition-colors"
                >
                  Add new PC
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <input
          ref={importInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleImportPdf}
          className="hidden"
        />

        {importMessage ? (
          <div className="mb-5 rounded-2xl border border-indigo-400/30 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-100">
            {importMessage}
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-6 text-zinc-300">
            <div className="text-base font-semibold text-white mb-1">Loading characters</div>
            <div className="text-sm text-zinc-400">
              Pulling character profiles for the active campaign.
            </div>
          </div>
        ) : !hasPcs ? (
          <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-6 text-zinc-300">
            <div className="text-base font-semibold text-white mb-1">No PC profiles yet</div>
          </div>
        ) : filtered.length === 0 ? (
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
                        {pc.race || "—"}
                        {pc.class ? ` · ${pc.class}` : ""}
                        {pc.subclass ? ` — ${pc.subclass}` : ""}
                      </p>
                    </div>

                    <span className="shrink-0 inline-flex items-center justify-center rounded-full border border-indigo-400/70 bg-indigo-500/15 px-2.5 py-0.5 text-[10px] font-medium text-indigo-100 whitespace-nowrap">
                      {pc.level ? `Lv ${pc.level}` : (pc.status || "PC")}
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

        {showImportReviewModal && importDraft ? (
          <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm p-4 pt-24 pb-8">
            <div className="w-full max-w-3xl rounded-2xl border border-zinc-800/80 bg-zinc-950/95 p-5 md:p-6 shadow-2xl max-h-[calc(100vh-8rem)] overflow-y-auto">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-lg md:text-xl font-semibold text-white">Review imported character</h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Source file: {importDraft.sourceFileName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseImportReview}
                  className="rounded-lg border border-zinc-800/70 bg-zinc-900/70 px-3 py-1.5 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800/70 transition-colors"
                >
                  Close
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-5">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-4">
                    <h3 className="text-sm font-semibold text-white mb-3">Imported draft</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-zinc-300 mb-1.5">Character name</label>
                        <input
                          value={importDraft.character.name}
                          onChange={(e) =>
                            setImportDraft((prev) => ({
                              ...prev,
                              character: { ...prev.character, name: e.target.value },
                            }))
                          }
                          className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                          placeholder="Will come from parser"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-zinc-300 mb-1.5">Player name</label>
                        <input
                          value={importDraft.character.playerName}
                          onChange={(e) =>
                            setImportDraft((prev) => ({
                              ...prev,
                              character: { ...prev.character, playerName: e.target.value },
                            }))
                          }
                          className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                          placeholder="Optional"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-zinc-300 mb-1.5">Race / species</label>
                        <input
                          value={importDraft.character.race}
                          onChange={(e) =>
                            setImportDraft((prev) => ({
                              ...prev,
                              character: { ...prev.character, race: e.target.value },
                            }))
                          }
                          className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                          placeholder="Will come from parser"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-zinc-300 mb-1.5">Class</label>
                        <input
                          value={importDraft.character.class}
                          onChange={(e) =>
                            setImportDraft((prev) => ({
                              ...prev,
                              character: { ...prev.character, class: e.target.value },
                            }))
                          }
                          className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                          placeholder="Will come from parser"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-zinc-300 mb-1.5">Subclass</label>
                        <input
                          value={importDraft.character.subclass}
                          onChange={(e) =>
                            setImportDraft((prev) => ({
                              ...prev,
                              character: { ...prev.character, subclass: e.target.value },
                            }))
                          }
                          className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                          placeholder="Optional"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-zinc-300 mb-1.5">Level</label>
                        <input
                          type="number"
                          min="1"
                          value={importDraft.character.level}
                          onChange={(e) =>
                            setImportDraft((prev) => ({
                              ...prev,
                              character: {
                                ...prev.character,
                                level: Math.max(1, Number(e.target.value) || 1),
                              },
                            }))
                          }
                          className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-4">
                    <h3 className="text-sm font-semibold text-white mb-3">Import review</h3>
                    <div className="space-y-3 text-sm text-zinc-300">
                      <div>
                        <span className="text-zinc-400">Confidence:</span>{" "}
                        <span className="text-white capitalize">{importDraft.review.confidence}</span>
                      </div>

                      <div>
                        <div className="text-zinc-400 mb-1">Warnings</div>
                        <ul className="space-y-1 list-disc pl-5 text-zinc-300">
                          {importDraft.review.warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <div className="text-zinc-400 mb-1">Missing fields</div>
                        <div className="flex flex-wrap gap-2">
                          {importDraft.review.missingFields.map((field) => (
                            <span
                              key={field}
                              className="inline-flex items-center rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200"
                            >
                              {field}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-dashed border-indigo-400/30 bg-indigo-500/5 p-4 text-sm text-indigo-100">
                    Next step: replace this placeholder draft with parsed PDF output from the importer service. For now, you can still confirm the reviewed draft and create a character manually from this scaffold.
                  </div>

                  <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-4">
                    <h3 className="text-sm font-semibold text-white mb-3">Ability scores</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {["str", "dex", "con", "int", "wis", "cha"].map((key) => (
                        <div key={key}>
                          <label className="block text-xs uppercase tracking-wide text-zinc-400 mb-1.5">
                            {key}
                          </label>
                          <input
                            type="number"
                            value={importDraft.character.stats?.abilities?.[key] ?? ""}
                            onChange={(e) =>
                              setImportDraft((prev) => ({
                                ...prev,
                                character: {
                                  ...prev.character,
                                  stats: {
                                    ...prev.character.stats,
                                    abilities: {
                                      ...prev.character.stats.abilities,
                                      [key]: e.target.value,
                                    },
                                  },
                                },
                              }))
                            }
                            className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-4">
                    <h3 className="text-sm font-semibold text-white mb-3">Combat & casting</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        ["AC", "ac"],
                        ["HP Max", "hpMax"],
                        ["Speed", "speed"],
                        ["Initiative", "initiativeMod"],
                        ["Proficiency Bonus", "proficiencyBonus"],
                        ["Spell Save DC", "spellSaveDC"],
                        ["Spell Attack Bonus", "spellAttackBonus"],
                        ["Passive Perception", "passivePerception"],
                        ["Passive Insight", "passiveInsight"],
                        ["Passive Investigation", "passiveInvestigation"],
                      ].map(([label, key]) => (
                        <div key={key}>
                          <label className="block text-sm text-zinc-300 mb-1.5">{label}</label>
                          <input
                            value={importDraft.character.stats?.[key] ?? ""}
                            onChange={(e) =>
                              setImportDraft((prev) => ({
                                ...prev,
                                character: {
                                  ...prev.character,
                                  stats: {
                                    ...prev.character.stats,
                                    [key]: e.target.value,
                                  },
                                },
                              }))
                            }
                            className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                          />
                        </div>
                      ))}

                      <div>
                        <label className="block text-sm text-zinc-300 mb-1.5">Spellcasting Ability</label>
                        <input
                          value={importDraft.character.stats?.spellcastingAbility ?? ""}
                          onChange={(e) =>
                            setImportDraft((prev) => ({
                              ...prev,
                              character: {
                                ...prev.character,
                                stats: {
                                  ...prev.character.stats,
                                  spellcastingAbility: e.target.value,
                                },
                              },
                            }))
                          }
                          className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-zinc-300 mb-1.5">Additional Senses</label>
                        <input
                          value={importDraft.character.stats?.additionalSenses ?? ""}
                          onChange={(e) =>
                            setImportDraft((prev) => ({
                              ...prev,
                              character: {
                                ...prev.character,
                                stats: {
                                  ...prev.character.stats,
                                  additionalSenses: e.target.value,
                                },
                              },
                            }))
                          }
                          className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-4">
                    <h3 className="text-sm font-semibold text-white mb-3">Identity & narrative</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        ["Faith", "faith"],
                        ["Size", "size"],
                        ["Age", "age"],
                        ["Height", "height"],
                        ["Weight", "weight"],
                        ["Gender", "gender"],
                        ["Eyes", "eyes"],
                        ["Hair", "hair"],
                        ["Skin", "skin"],
                      ].map(([label, key]) => (
                        <div key={key}>
                          <label className="block text-sm text-zinc-300 mb-1.5">{label}</label>
                          <input
                            value={importDraft.character.identity?.[key] ?? ""}
                            onChange={(e) =>
                              setImportDraft((prev) => ({
                                ...prev,
                                character: {
                                  ...prev.character,
                                  identity: {
                                    ...prev.character.identity,
                                    [key]: e.target.value,
                                  },
                                },
                              }))
                            }
                            className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 gap-4 mt-4">
                      {[
                        ["Personality Traits", "personalityTraits"],
                        ["Ideals", "ideals"],
                        ["Bonds", "bonds"],
                        ["Flaws", "flaws"],
                      ].map(([label, key]) => (
                        <div key={key}>
                          <label className="block text-sm text-zinc-300 mb-1.5">{label}</label>
                          <textarea
                            rows={2}
                            value={importDraft.character.narrative?.[key] ?? ""}
                            onChange={(e) =>
                              setImportDraft((prev) => ({
                                ...prev,
                                character: {
                                  ...prev.character,
                                  narrative: {
                                    ...prev.character.narrative,
                                    [key]: e.target.value,
                                  },
                                },
                              }))
                            }
                            className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={handleCloseImportReview}
                      className="rounded-xl border border-zinc-800/70 bg-zinc-900/70 px-4 py-2.5 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800/70 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateImportedPc}
                      disabled={
                        isSavingImportDraft ||
                        !selectedCampaignId ||
                        !importDraft.character.name.trim()
                      }
                      className="rounded-xl bg-indigo-500/20 border border-indigo-400/50 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSavingImportDraft ? "Creating..." : "Create character from draft"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {showCreateModal ? (
          <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm p-4 pt-24 pb-8">
            <div className="w-full max-w-2xl rounded-2xl border border-zinc-800/80 bg-zinc-950/95 p-5 md:p-6 shadow-2xl max-h-[calc(100vh-8rem)] overflow-y-auto">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-lg md:text-xl font-semibold text-white">Add new PC</h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Create a player character by hand. PDF import can plug into this same character model later.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewPc(createManualPcDraft());
                  }}
                  className="rounded-lg border border-zinc-800/70 bg-zinc-900/70 px-3 py-1.5 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800/70 transition-colors"
                >
                  Close
                </button>
              </div>

              <form onSubmit={handleCreatePc} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-zinc-300 mb-1.5">Character name</label>
                    <input
                      required
                      value={newPc.name}
                      onChange={(e) => setNewPc((prev) => ({ ...prev, name: e.target.value }))}
                      className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      placeholder="Yasuke"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-300 mb-1.5">Player name</label>
                    <input
                      value={newPc.playerName}
                      onChange={(e) => setNewPc((prev) => ({ ...prev, playerName: e.target.value }))}
                      className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      placeholder="Player"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-300 mb-1.5">Race / species</label>
                    <input
                      value={newPc.race}
                      onChange={(e) => setNewPc((prev) => ({ ...prev, race: e.target.value }))}
                      className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      placeholder="Tiefling"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-300 mb-1.5">Class</label>
                    <input
                      value={newPc.class}
                      onChange={(e) => setNewPc((prev) => ({ ...prev, class: e.target.value }))}
                      className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      placeholder="Rogue"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-300 mb-1.5">Subclass</label>
                    <input
                      value={newPc.subclass}
                      onChange={(e) => setNewPc((prev) => ({ ...prev, subclass: e.target.value }))}
                      className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      placeholder="Soulknife"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-300 mb-1.5">Level</label>
                    <input
                      type="number"
                      min="1"
                      value={newPc.level}
                      onChange={(e) => setNewPc((prev) => ({ ...prev, level: e.target.value }))}
                      className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-300 mb-1.5">Alignment</label>
                    <input
                      value={newPc.alignment}
                      onChange={(e) => setNewPc((prev) => ({ ...prev, alignment: e.target.value }))}
                      className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      placeholder="Chaotic Neutral"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-300 mb-1.5">Visibility</label>
                    <select
                      value={newPc.visibility}
                      onChange={(e) => setNewPc((prev) => ({ ...prev, visibility: e.target.value }))}
                      className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    >
                      <option value="player">Player visible</option>
                      <option value="gm">GM only</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-zinc-300 mb-1.5">Background</label>
                  <textarea
                    value={newPc.background}
                    onChange={(e) => setNewPc((prev) => ({ ...prev, background: e.target.value }))}
                    rows={3}
                    className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    placeholder="Short character background or concept..."
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-300 mb-1.5">Public notes</label>
                  <textarea
                    value={newPc.publicNotes}
                    onChange={(e) => setNewPc((prev) => ({ ...prev, publicNotes: e.target.value }))}
                    rows={3}
                    className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    placeholder="What should players see right away?"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setNewPc(createManualPcDraft());
                    }}
                    className="rounded-xl border border-zinc-800/70 bg-zinc-900/70 px-4 py-2.5 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800/70 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || !selectedCampaignId}
                    className="rounded-xl bg-indigo-500/20 border border-indigo-400/50 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSaving ? "Saving..." : "Create PC"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
};

export default PCs;
