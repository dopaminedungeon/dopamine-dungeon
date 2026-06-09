// src/pages/CampaignSettings.jsx
import React, { useMemo, useState, useEffect } from "react";
import InvitePlayerForm from "../components/invitations/InvitePlayerForm.jsx";
import {
  Plus,
  CheckCircle2,
  AlertCircle,
  Trash2,
  MoreHorizontal,
  UserMinus,
  MailX,
} from "lucide-react";
import {
  collection,
  doc,
  updateDoc,
  deleteDoc,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { useMode } from "../context/ModeContext.jsx";
import { useCampaign } from "../context/CampaignContext.jsx";
import { useTenant } from "../context/TenantContext.jsx";
import { db } from "../firebase/firebase";
import {
  assignApiCharacter,
  getApiCampaignPeople,
  getApiCharacterAssignments,
  removeApiCampaignMember,
  revokeApiCampaignInvite,
  unassignApiCharacter,
} from "../data/api/apiClient.ts";
import { getAllCharacters } from "../data/characters/characters.repo";

const STATUS = ["active", "paused", "completed"];

export default function CampaignSettings() {
  const { isGM } = useMode();

  const {
    accessibleCampaigns,
    selectedCampaignId,
    selectCampaign,
    createCampaign: createCampaignFromContext,
    campaignRole,
    refreshCampaigns,
  } = useCampaign();
  const { selectedTenantId } = useTenant();

  const activeCampaign = useMemo(() => {
    return (
      (accessibleCampaigns || []).find(
        (campaign) =>
          String(campaign.campaignId ?? "") === String(selectedCampaignId) ||
          String(campaign.postgresCampaignId ?? "") === String(selectedCampaignId)
      ) || null
    );
  }, [accessibleCampaigns, selectedCampaignId]);

  const [draft, setDraft] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveState, setSaveState] = useState({ type: null, message: "" });
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    status: "active",
    system: "",
  });
  const [campaignPeople, setCampaignPeople] = useState([]);
  const [campaignPeopleLoading, setCampaignPeopleLoading] = useState(false);
  const [openActionsId, setOpenActionsId] = useState(null);
  const [campaignPeopleVersion, setCampaignPeopleVersion] = useState(0);
  const [campaignCharacters, setCampaignCharacters] = useState([]);
  const [assignableCharacters, setAssignableCharacters] = useState([]);
  const [assignmentRows, setAssignmentRows] = useState([]);
  const [assignmentSelectionByUserId, setAssignmentSelectionByUserId] = useState({});

  const createCampaign = async (e) => {
    e?.preventDefault?.();

    const name = (createForm.name || "").trim();
    if (!name || !selectedTenantId) return;

    try {
      setSaveState({ type: null, message: "" });

      const created = await createCampaignFromContext({
        name,
        description: createForm.description || "",
        system: createForm.system || "",
      });

      const createdId = created?.campaignId || created?.id || null;

      if (typeof refreshCampaigns === "function") {
        await refreshCampaigns();
      }

      if (createdId && typeof selectCampaign === "function") {
        await Promise.resolve(selectCampaign(createdId));
      }

      setDraft(created || null);
      setShowCreate(false);
      setCreateForm({ name: "", description: "", status: "active", system: "" });
      setSaveState({ type: "success", message: "Campaign created." });
    } catch (error) {
      console.error("[CampaignSettings] Failed to create campaign", error);
      setSaveState({ type: "error", message: "Could not create campaign." });
    }
  };

  useEffect(() => {
    // Sync the draft whenever the active campaign changes.
    // If there is no active campaign, keep whatever is in draft (e.g. right after creating).
    if (activeCampaign) setDraft({ ...activeCampaign });
  }, [selectedCampaignId, activeCampaign]);

  useEffect(() => {
    const loadCampaignPeople = async () => {
      if (!selectedCampaignId) {
        setCampaignPeople([]);
        return;
      }

      try {
        setCampaignPeopleLoading(true);

        const [response, characters, assignmentData] = await Promise.all([
          getApiCampaignPeople(selectedCampaignId),
          getAllCharacters(selectedCampaignId),
          getApiCharacterAssignments(selectedCampaignId),
        ]);
        const blockedCharacterIds = new Set([
          ...(assignmentData.assignedCharacterIds || []),
          ...(assignmentData.pendingAssignedCharacterIds || []),
        ]);
        setCampaignPeople(response.people || []);
        setAssignmentRows(assignmentData.assignments || []);
        setCampaignCharacters(characters || []);
        setAssignableCharacters(
          (characters || []).filter((character) => !blockedCharacterIds.has(character.id))
        );
      } catch (error) {
        console.error("[CampaignSettings] Failed to load campaign people", error);
        setCampaignPeople([]);
        setAssignmentRows([]);
        setCampaignCharacters([]);
        setAssignableCharacters([]);
      } finally {
        setCampaignPeopleLoading(false);
      }
    };

    loadCampaignPeople();
  }, [selectedCampaignId, saveState.type, saveState.message, campaignPeopleVersion]);

  if (!isGM || (campaignRole && campaignRole !== "owner" && campaignRole !== "gm")) {
    return (
      <div className="text-white p-6">
        <h1 className="text-2xl font-bold">Campaign Settings</h1>
        <p className="text-zinc-300/75 mt-2">GM-only. Nice try though 😈</p>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="text-white p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Campaign Settings</h1>
            <p className="text-zinc-300/75 mt-2">No active campaign selected.</p>
          </div>

          {isGM && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-linear-to-r from-indigo-500 to-purple-500 text-white font-medium hover:opacity-90"
            >
              <Plus className="w-5 h-5" />
              Add campaign
            </button>
          )}
        </div>

        {/* Create campaign modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-zinc-950 border border-white/10 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">Create campaign</h2>

              <form className="space-y-4" onSubmit={createCampaign}>
                <div>
                  <label className="block text-sm text-zinc-300/75 mb-1">Name</label>
                  <input
                    value={createForm.name}
                    onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-300/75 mb-1">Description</label>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-zinc-300/75 mb-1">Status</label>
                    <select
                      value={createForm.status}
                      onChange={(e) => setCreateForm((p) => ({ ...p, status: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
                    >
                      {STATUS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-300/75 mb-1">System / ruleset</label>
                    <input
                      value={createForm.system}
                      onChange={(e) => setCreateForm((p) => ({ ...p, system: e.target.value }))}
                      placeholder="e.g. D&D 5e"
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="px-4 py-2 rounded-xl bg-white/5 text-zinc-300 hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-linear-to-r from-blue-500 to-cyan-500 text-white font-medium hover:opacity-90"
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  const update = (key, value) => setDraft((p) => ({ ...p, [key]: value }));

  async function deleteSubcollectionDocs(campaignId, subcollectionName) {
    const snap = await getDocs(collection(db, "campaigns", campaignId, subcollectionName));
    if (snap.empty) return;

    const batch = writeBatch(db);
    snap.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
  }

  const onDeleteCampaign = async () => {
    const campaignId = draft?.campaignId || selectedCampaignId;
    if (!campaignId) return;

    const confirmed = window.confirm(
      "Delete this campaign and all associated sessions, items, and bag data? This cannot be undone."
    );
    if (!confirmed) return;

    try {
      setDeleting(true);
      setSaveState({ type: null, message: "" });

      await deleteSubcollectionDocs(campaignId, "sessions");
      await deleteSubcollectionDocs(campaignId, "items");
      await deleteSubcollectionDocs(campaignId, "meta");
      await deleteDoc(doc(db, "campaigns", campaignId));

      if (typeof refreshCampaigns === "function") {
        await refreshCampaigns();
      }

      setDraft(null);
      setSaveState({ type: "success", message: "Campaign deleted." });
    } catch (error) {
      console.error("[CampaignSettings] Failed to delete campaign", error);
      setSaveState({ type: "error", message: "Could not delete campaign." });
    } finally {
      setDeleting(false);
    }
  };

  const onSave = async () => {
    const campaignId = draft?.campaignId || selectedCampaignId;
    if (!draft || !campaignId) return;

    try {
      setSaving(true);
      setSaveState({ type: null, message: "" });

      await updateDoc(doc(db, "campaigns", campaignId), {
        name: draft.name || "",
        description: draft.description || "",
        status: draft.status || "active",
        system: draft.system || "",
        playerSummary: draft.playerSummary || "",
        publicLore: draft.publicLore || "",
        gmNotes: draft.gmNotes || "",
        privateLore: draft.privateLore || "",
        hiddenFactions: draft.hiddenFactions || "",
        hiddenTimelines: draft.hiddenTimelines || "",
        metaCommentary: draft.metaCommentary || "",
        tags: draft.tags || "",
        startDate: draft.startDate || "",
        endDate: draft.endDate || "",
        lastUpdated: Date.now(),
      });

      if (typeof refreshCampaigns === "function") {
        await refreshCampaigns();
      }

      if (typeof selectCampaign === "function") {
        await Promise.resolve(selectCampaign(campaignId));
      }

      setSaveState({ type: "success", message: "Campaign settings saved." });
    } catch (error) {
      console.error("[CampaignSettings] Failed to save campaign", error);
      setSaveState({ type: "error", message: "Could not save campaign settings." });
    } finally {
      setSaving(false);
    }
  };

  const onRevokeInvite = async (inviteDocId) => {
    const campaignId = draft?.campaignId || selectedCampaignId;
    if (!inviteDocId || !campaignId) return;

    const confirmed = window.confirm("Revoke this pending invitation?");
    if (!confirmed) return;

    try {
      await revokeApiCampaignInvite(campaignId, inviteDocId);
      setOpenActionsId(null);
      setCampaignPeopleVersion((value) => value + 1);
      setSaveState({ type: "success", message: "Invitation revoked." });
    } catch (error) {
      console.error("[CampaignSettings] Failed to revoke invitation", error);
      setSaveState({ type: "error", message: "Could not revoke invitation." });
    }
  };

  const onRemoveCampaignMember = async (memberDocId) => {
    const campaignId = draft?.campaignId || selectedCampaignId;
    if (!memberDocId || !campaignId) return;

    const confirmed = window.confirm("Remove this member from the campaign?");
    if (!confirmed) return;

    try {
      await removeApiCampaignMember(campaignId, memberDocId);
      setOpenActionsId(null);
      setCampaignPeopleVersion((value) => value + 1);
      setSaveState({ type: "success", message: "Campaign member removed." });
    } catch (error) {
      console.error("[CampaignSettings] Failed to remove campaign member", error);
      setSaveState({ type: "error", message: "Could not remove campaign member." });
    }
  };

  const getAssignmentForCharacter = (characterId) =>
    assignmentRows.find((assignment) => assignment.characterId === characterId) || null;

  const getCharacterName = (characterId) =>
    campaignCharacters.find((character) => character.id === characterId)?.name ||
    characterId;

  const onAssignCharacter = async (person) => {
    const campaignId = draft?.campaignId || selectedCampaignId;
    const characterId = assignmentSelectionByUserId[person.userId];
    if (!campaignId || !person?.userId || !characterId) return;

    try {
      await assignApiCharacter(campaignId, person.userId, characterId);
      setAssignmentSelectionByUserId((current) => ({ ...current, [person.userId]: "" }));
      setCampaignPeopleVersion((value) => value + 1);
      setSaveState({ type: "success", message: "Character assigned." });
    } catch (error) {
      console.error("[CampaignSettings] Failed to assign character", error);
      setSaveState({ type: "error", message: "Could not assign character." });
    }
  };

  const onUnassignCharacter = async (characterId) => {
    const campaignId = draft?.campaignId || selectedCampaignId;
    const assignment = getAssignmentForCharacter(characterId);
    if (!campaignId || !assignment) return;

    try {
      await unassignApiCharacter(campaignId, { assignmentId: assignment.id });
      setCampaignPeopleVersion((value) => value + 1);
      setSaveState({ type: "success", message: "Character unassigned." });
    } catch (error) {
      console.error("[CampaignSettings] Failed to unassign character", error);
      setSaveState({ type: "error", message: "Could not unassign character." });
    }
  };

  return (
    <div className="w-full text-white">
      <main className="w-full px-6 py-5 md:px-8 md:py-6">
        {/* Header */}
        <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Campaign Settings
            </h1>
            <p className="mt-1 text-sm text-zinc-300/85 max-w-xl">
              Configure the active campaign. (GM-only)
            </p>
          </div>

          <div className="flex gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-linear-to-r from-indigo-500 to-purple-500 text-white font-medium hover:opacity-90"
            >
              <Plus className="w-5 h-5" />
              Add campaign
            </button>

            <button
              type="button"
              onClick={() => {
                setDraft(activeCampaign ? { ...activeCampaign } : null);
                setSaveState({ type: null, message: "" });
              }}
              className="px-4 py-2 rounded-xl bg-white/5 text-zinc-300 hover:bg-white/10"
            >
              Reset
            </button>

            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-linear-to-r from-blue-500 to-cyan-500 text-white font-medium hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>

            <button
              type="button"
              onClick={onDeleteCampaign}
              disabled={deleting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/40 text-red-200 hover:bg-red-500/25 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              {deleting ? "Deleting..." : "Delete Campaign"}
            </button>
            {saveState.type === "success" && (
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-emerald-200 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                {saveState.message}
              </div>
            )}

            {saveState.type === "error" && (
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1.5 text-red-200 text-sm">
                <AlertCircle className="w-4 h-4" />
                {saveState.message}
              </div>
            )}
          </div>
        </div>

        {/* Main sections */}
        <div className="space-y-4">
          {/* Player-safe campaign info */}
          <section className="relative overflow-hidden rounded-3xl border border-fuchsia-500/20 bg-zinc-950/55 p-5 shadow-[0_0_0_1px_rgba(168,85,247,0.05),0_0_48px_rgba(99,102,241,0.10)] before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.18),transparent_34%),radial-gradient(circle_at_75%_35%,rgba(59,130,246,0.12),transparent_30%),radial-gradient(circle_at_bottom_center,rgba(168,85,247,0.08),transparent_38%)] before:opacity-100 before:content-['']">
            <div className="relative z-10">
              <h2 className="text-lg font-semibold mb-2">Campaign overview</h2>
              <p className="mb-4 text-sm text-zinc-300/70">
                Public-facing campaign identity and player-safe summary.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-zinc-200/95 mb-1">Name</label>
                  <input
                    value={draft.name || ""}
                    onChange={(e) => update("name", e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-400/80 shadow-inner shadow-black/10 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20"
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-200/95 mb-1">Description</label>
                  <textarea
                    value={draft.description || ""}
                    onChange={(e) => update("description", e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-400/80 shadow-inner shadow-black/10 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-zinc-200/95 mb-1">Status</label>
                    <select
                      value={draft.status || "active"}
                      onChange={(e) => update("status", e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white shadow-inner shadow-black/10 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20"
                    >
                      {STATUS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-200/95 mb-1">
                      System / ruleset (optional)
                    </label>
                    <input
                      value={draft.system || ""}
                      onChange={(e) => update("system", e.target.value)}
                      placeholder="e.g. D&D 5e, Pathfinder 2e…"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-400/80 shadow-inner shadow-black/10 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-zinc-200/95 mb-1">Player summary</label>
                  <textarea
                    value={draft.playerSummary || ""}
                    onChange={(e) => update("playerSummary", e.target.value)}
                    rows={4}
                    placeholder="What players generally know / the elevator pitch…"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-400/80 shadow-inner shadow-black/10 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20"
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-200/95 mb-1">High-level intro / lore</label>
                  <textarea
                    value={draft.publicLore || ""}
                    onChange={(e) => update("publicLore", e.target.value)}
                    rows={5}
                    placeholder="Public-facing intro lore / campaign premise…"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-400/80 shadow-inner shadow-black/10 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* GM-only notes */}
          <section className="relative overflow-hidden rounded-3xl border border-fuchsia-500/22 bg-zinc-950/55 p-5 shadow-[0_0_0_1px_rgba(217,70,239,0.05),0_0_44px_rgba(168,85,247,0.10)] before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_left,rgba(217,70,239,0.15),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.12),transparent_36%),radial-gradient(circle_at_center,rgba(168,85,247,0.07),transparent_42%)] before:opacity-100 before:content-['']">
            <div className="relative z-10">
              <h2 className="text-lg font-semibold mb-2">GM-only notes</h2>
              <p className="mb-4 text-sm text-zinc-300/70">
                Hidden campaign truth, prep notes, secret timelines, and anything the players are not supposed to see.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-zinc-200/95 mb-1">GM notes</label>
                  <textarea
                    value={draft.gmNotes || ""}
                    onChange={(e) => update("gmNotes", e.target.value)}
                    rows={4}
                    placeholder="Private prep notes, reminders, table meta…"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-400/80 shadow-inner shadow-black/10 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20"
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-200/95 mb-1">Private campaign lore</label>
                  <textarea
                    value={draft.privateLore || ""}
                    onChange={(e) => update("privateLore", e.target.value)}
                    rows={4}
                    placeholder="Secrets, true history, hidden truths…"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-400/80 shadow-inner shadow-black/10 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20"
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-200/95 mb-1">Hidden factions / arcs</label>
                  <textarea
                    value={draft.hiddenFactions || ""}
                    onChange={(e) => update("hiddenFactions", e.target.value)}
                    rows={3}
                    placeholder="Who is pulling strings? Which arcs are actually happening?"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-400/80 shadow-inner shadow-black/10 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20"
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-200/95 mb-1">Hidden timelines</label>
                  <textarea
                    value={draft.hiddenTimelines || ""}
                    onChange={(e) => update("hiddenTimelines", e.target.value)}
                    rows={3}
                    placeholder="Off-screen events / clocks / what advances between sessions…"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-400/80 shadow-inner shadow-black/10 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20"
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-200/95 mb-1">Meta commentary</label>
                  <textarea
                    value={draft.metaCommentary || ""}
                    onChange={(e) => update("metaCommentary", e.target.value)}
                    rows={3}
                    placeholder="How you prep, themes, tone rules, pacing notes…"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-400/80 shadow-inner shadow-black/10 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20"
                  />
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-[0_0_24px_rgba(168,85,247,0.05)]">
                  <p className="text-sm text-zinc-300 font-medium mb-1">
                    Visibility defaults (placeholder)
                  </p>
                  <p className="text-sm text-zinc-300/75">
                    Later: default visibility rules for new Sessions / Lore / Items, etc.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Campaign people & characters */}
          <section className="relative overflow-visible rounded-3xl border border-cyan-400/18 bg-zinc-950/55 p-5 shadow-[0_0_0_1px_rgba(34,211,238,0.04),0_0_42px_rgba(34,211,238,0.08)] before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.14),transparent_30%),radial-gradient(circle_at_left,rgba(168,85,247,0.12),transparent_34%),radial-gradient(circle_at_bottom_center,rgba(59,130,246,0.08),transparent_40%)] before:opacity-100 before:content-['']">
            <div className="relative z-10">
              <h2 className="text-lg font-semibold mb-2">Campaign people & characters</h2>
              <p className="mb-4 text-sm text-zinc-300/70">
                Invite players, review current campaign membership, track invite status, and manage character assignments.
              </p>

              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3.5 mb-4 shadow-[0_0_20px_rgba(168,85,247,0.04)]">
                <p className="text-sm text-zinc-200 font-medium mb-2">Invite player</p>
                <p className="mb-3 text-xs text-zinc-300/70">
                  Create a pending invitation for the active campaign. Character assignment support will live here.
                </p>
                <InvitePlayerForm
                  onInvitationCreated={() => {
                    setCampaignPeopleVersion((value) => value + 1);
                    setSaveState({ type: "success", message: "Invitation created." });
                  }}
                />
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-[0_0_24px_rgba(168,85,247,0.05)]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm text-zinc-200 font-medium">Current campaign members & invites</p>
                  <span className="text-xs text-zinc-300/70">
                    {campaignPeopleLoading ? "Loading…" : `${campaignPeople.length} record${campaignPeople.length === 1 ? "" : "s"}`}
                  </span>
                </div>

                {campaignPeopleLoading ? (
                  <p className="text-sm text-zinc-300/75">Loading campaign members and invitations…</p>
                ) : campaignPeople.length === 0 ? (
                  <p className="text-sm text-zinc-300/75">No members or pending invites for this campaign yet.</p>
                ) : (
                  <div className="overflow-x-auto overflow-y-visible pb-24">
                    <table className="w-full min-w-[920px] border-separate border-spacing-y-2">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-[0.18em] text-zinc-400/80">
                          <th className="pb-2 pr-4 font-medium">Person</th>
                          <th className="pb-2 pr-4 font-medium">Invite status</th>
                          <th className="pb-2 pr-4 font-medium">Workspace role</th>
                          <th className="pb-2 pr-4 font-medium">Campaign role</th>
                          <th className="pb-2 pr-4 font-medium">Assigned characters</th>
                          <th className="pb-2 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {campaignPeople.map((person) => (
                          <tr key={person.id} className="align-top">
                            <td className="rounded-l-2xl border-y border-l border-white/10 bg-white/[0.025] px-4 py-3">
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-zinc-100">{person.label}</p>
                                <p className="text-xs text-zinc-400">{person.email}</p>
                                {person.userId ? (
                                  <p className="text-[11px] text-zinc-500">User ID: {person.userId}</p>
                                ) : null}
                              </div>
                            </td>
                            <td className="border-y border-white/10 bg-white/[0.025] py-3">
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${person.status === "accepted"
                                  ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                                  : "border-amber-400/20 bg-amber-400/10 text-amber-200"
                                  }`}
                              >
                                {person.status}
                              </span>
                            </td>
                            <td className="border-y border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-zinc-200">
                              {person.workspaceRole}
                            </td>
                            <td className="border-y border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-zinc-200">
                              {person.campaignRole}
                            </td>
                            <td className="border-y border-white/10 bg-white/[0.025] px-4 py-3">
                              {person.characterIds?.length ? (
                                <div className="flex flex-wrap gap-2">
                                  {person.characterIds.map((characterId) => (
                                    <button
                                      type="button"
                                      key={`${person.id}-${characterId}`}
                                      onClick={() => onUnassignCharacter(characterId)}
                                      className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-xs text-cyan-100 hover:bg-cyan-400/20"
                                      title="Unassign this character"
                                    >
                                      {getCharacterName(characterId)} ×
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-zinc-500">No characters assigned</span>
                              )}
                              {person.type === "member" && person.userId ? (
                                <div className="mt-2 flex gap-2">
                                  <select
                                    value={assignmentSelectionByUserId[person.userId] || ""}
                                    disabled={assignableCharacters.length === 0}
                                    onChange={(event) =>
                                      setAssignmentSelectionByUserId((current) => ({
                                        ...current,
                                        [person.userId]: event.target.value,
                                      }))
                                    }
                                    className="min-w-[160px] rounded-lg border border-white/10 bg-zinc-950 px-2 py-1 text-xs text-white disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <option value="">
                                      {assignableCharacters.length === 0
                                        ? "No available PCs"
                                        : "Assign PC..."}
                                    </option>
                                    {assignableCharacters.map((character) => (
                                      <option key={character.id} value={character.id}>
                                        {character.name || character.id}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => onAssignCharacter(person)}
                                    disabled={
                                      assignableCharacters.length === 0 ||
                                      !assignmentSelectionByUserId[person.userId]
                                    }
                                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    Assign
                                  </button>
                                </div>
                              ) : null}
                            </td>
                            <td className="rounded-r-2xl border-y border-r border-white/10 bg-white/[0.025] px-4 py-3">
                              <div className="relative flex justify-end overflow-visible">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenActionsId((current) =>
                                      current === person.id ? null : person.id
                                    )
                                  }
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-200 transition hover:bg-white/[0.06]"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>

                                {openActionsId === person.id ? (
                                  <div className="absolute right-0 top-11 z-30 min-w-[200px] overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 shadow-[0_12px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl">
                                    {person.type === "invite" ? (
                                      <button
                                        type="button"
                                        onClick={() => onRevokeInvite(person.docId)}
                                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-200 transition hover:bg-red-400/10"
                                      >
                                        <MailX className="h-4 w-4" />
                                        Revoke invite
                                      </button>
                                    ) : (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOpenActionsId(null);
                                            window.alert("Character assignment actions are next up in #84.");
                                          }}
                                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-zinc-200 transition hover:bg-white/[0.06]"
                                        >
                                          <Plus className="h-4 w-4" />
                                          Assign character
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => onRemoveCampaignMember(person.docId)}
                                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-200 transition hover:bg-red-400/10"
                                        >
                                          <UserMinus className="h-4 w-4" />
                                          Remove from campaign
                                        </button>
                                      </>
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Bottom metadata strip */}
        <section className="relative mt-4 overflow-hidden rounded-3xl border border-fuchsia-500/16 bg-zinc-950/55 p-5 shadow-[0_0_0_1px_rgba(168,85,247,0.04),0_0_36px_rgba(99,102,241,0.08)] before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.12),transparent_34%),radial-gradient(circle_at_right,rgba(59,130,246,0.08),transparent_30%)] before:opacity-100 before:content-['']">
          <div className="relative z-10">
            <h3 className="text-base font-semibold text-white mb-2">Metadata</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-zinc-200/95 mb-1">Tags</label>
                <input
                  value={draft.tags || ""}
                  onChange={(e) => update("tags", e.target.value)}
                  placeholder="comma-separated (e.g. feywild, intrigue, horror)"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-400/80 shadow-inner shadow-black/10 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20"
                />
                <p className="mt-1 text-sm text-zinc-300/75">Placeholder: we’ll switch to chips later.</p>
              </div>

              <div>
                <label className="block text-sm text-zinc-200/95 mb-1">Start date</label>
                <input
                  type="date"
                  value={draft.startDate || ""}
                  onChange={(e) => update("startDate", e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white shadow-inner shadow-black/10 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-200/95 mb-1">End date</label>
                <input
                  type="date"
                  value={draft.endDate || ""}
                  onChange={(e) => update("endDate", e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white shadow-inner shadow-black/10 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20"
                />
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.025] p-3.5 shadow-[0_0_20px_rgba(168,85,247,0.04)]">
              <p className="text-sm text-zinc-300 font-medium mb-1">Cross-links (placeholder)</p>
              <p className="text-sm text-zinc-300/75">
                Later: Sessions / NPCs / Items / Maps / Lore / Arcs / Quests counts and links for this campaign.
              </p>
            </div>
          </div>
        </section>

        {/* Create campaign modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-zinc-950 border border-white/10 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">Create campaign</h2>

              <form className="space-y-4" onSubmit={createCampaign}>
                <div>
                  <label className="block text-sm text-zinc-300/75 mb-1">Name</label>
                  <input
                    value={createForm.name}
                    onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-300/75 mb-1">Description</label>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-zinc-300/75 mb-1">Status</label>
                    <select
                      value={createForm.status}
                      onChange={(e) => setCreateForm((p) => ({ ...p, status: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
                    >
                      {STATUS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-300/75 mb-1">System / ruleset</label>
                    <input
                      value={createForm.system}
                      onChange={(e) => setCreateForm((p) => ({ ...p, system: e.target.value }))}
                      placeholder="e.g. D&D 5e"
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="px-4 py-2 rounded-xl bg-white/5 text-zinc-300 hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-linear-to-r from-blue-500 to-cyan-500 text-white font-medium hover:opacity-90"
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
