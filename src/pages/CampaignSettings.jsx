// src/pages/CampaignSettings.jsx
import React, { useMemo, useState, useEffect } from "react";
import InvitePlayerForm from "../components/invitations/InvitePlayerForm.jsx";
import { Plus, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import {
  addDoc,
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

const STATUS = ["active", "paused", "completed"];

export default function CampaignSettings() {
  const { isGM } = useMode();

  const { accessibleCampaigns, selectedCampaignId, selectCampaign, campaignRole } = useCampaign();
  const { selectedTenantId } = useTenant();

  const activeCampaign = useMemo(() => {
    return (
      (accessibleCampaigns || []).find(
        (c) => String(c.id ?? c.campaignId) === String(selectedCampaignId)
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

  const createCampaign = async (e) => {
    e?.preventDefault?.();

    const name = (createForm.name || "").trim();
    if (!name || !selectedTenantId) return;

    const newCampaign = {
      name,
      description: createForm.description || "",
      status: createForm.status || "active",
      system: createForm.system || "",
      tenantId: selectedTenantId,
      tags: "",
      startDate: "",
      endDate: "",
      playerSummary: "",
      publicLore: "",
      gmNotes: "",
      privateLore: "",
      hiddenFactions: "",
      hiddenTimelines: "",
      metaCommentary: "",
      createdAt: Date.now(),
      lastUpdated: Date.now(),
    };

    try {
      setSaveState({ type: null, message: "" });
      const ref = await addDoc(collection(db, "campaigns"), newCampaign);
      const created = { ...newCampaign, id: ref.id, campaignId: ref.id };

      if (typeof selectCampaign === "function") {
        selectCampaign(ref.id);
      }

      setDraft(created);
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

  if (!isGM || (campaignRole && campaignRole !== "owner" && campaignRole !== "gm")) {
    return (
      <div className="text-white p-6">
        <h1 className="text-2xl font-bold">Campaign Settings</h1>
        <p className="text-zinc-400 mt-2">GM-only. Nice try though 😈</p>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="text-white p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Campaign Settings</h1>
            <p className="text-zinc-400 mt-2">No active campaign selected.</p>
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
                  <label className="block text-sm text-zinc-400 mb-1">Name</label>
                  <input
                    value={createForm.name}
                    onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Description</label>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Status</label>
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
                    <label className="block text-sm text-zinc-400 mb-1">System / ruleset</label>
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
    const campaignId = draft?.id || draft?.campaignId || selectedCampaignId;
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
    const campaignId = draft?.id || draft?.campaignId || selectedCampaignId;
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

      setSaveState({ type: "success", message: "Campaign settings saved." });
    } catch (error) {
      console.error("[CampaignSettings] Failed to save campaign", error);
      setSaveState({ type: "error", message: "Could not save campaign settings." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full text-white">
      <main className="w-full px-6 py-6 md:px-10 md:py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Campaign Settings
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Configure the active campaign. (GM-only)
            </p>
          </div>

          <div className="flex gap-3 flex-wrap">
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
              <div className="mb-4 inline-flex items-center gap-2 text-emerald-300 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                {saveState.message}
              </div>
            )}

            {saveState.type === "error" && (
              <div className="mb-4 inline-flex items-center gap-2 text-red-300 text-sm">
                <AlertCircle className="w-4 h-4" />
                {saveState.message}
              </div>
            )}
          </div>
        </div>

        {/* Main columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Player-safe column */}
          <section className="rounded-2xl bg-zinc-950/35 border border-zinc-800/70 p-5">
            <h2 className="text-lg font-semibold mb-4">Public (player-safe)</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Name</label>
                <input
                  value={draft.name || ""}
                  onChange={(e) => update("name", e.target.value)}
                  className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Description</label>
                <textarea
                  value={draft.description || ""}
                  onChange={(e) => update("description", e.target.value)}
                  rows={3}
                  className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Status</label>
                  <select
                    value={draft.status || "active"}
                    onChange={(e) => update("status", e.target.value)}
                    className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  >
                    {STATUS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-1">
                    System / ruleset (optional)
                  </label>
                  <input
                    value={draft.system || ""}
                    onChange={(e) => update("system", e.target.value)}
                    placeholder="e.g. D&D 5e, Pathfinder 2e…"
                    className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Player summary</label>
                <textarea
                  value={draft.playerSummary || ""}
                  onChange={(e) => update("playerSummary", e.target.value)}
                  rows={4}
                  placeholder="What players generally know / the elevator pitch…"
                  className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">High-level intro / lore</label>
                <textarea
                  value={draft.publicLore || ""}
                  onChange={(e) => update("publicLore", e.target.value)}
                  rows={5}
                  placeholder="Public-facing intro lore / campaign premise…"
                  className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>
            </div>
          </section>

          {/* GM-only column */}
          <section className="rounded-2xl bg-zinc-950/35 border border-purple-500/30 p-5">
            <h2 className="text-lg font-semibold mb-4">GM-only</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">GM notes</label>
                <textarea
                  value={draft.gmNotes || ""}
                  onChange={(e) => update("gmNotes", e.target.value)}
                  rows={4}
                  placeholder="Private prep notes, reminders, table meta…"
                  className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Private campaign lore</label>
                <textarea
                  value={draft.privateLore || ""}
                  onChange={(e) => update("privateLore", e.target.value)}
                  rows={4}
                  placeholder="Secrets, true history, hidden truths…"
                  className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Hidden factions / arcs</label>
                <textarea
                  value={draft.hiddenFactions || ""}
                  onChange={(e) => update("hiddenFactions", e.target.value)}
                  rows={3}
                  placeholder="Who is pulling strings? Which arcs are actually happening?"
                  className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Hidden timelines</label>
                <textarea
                  value={draft.hiddenTimelines || ""}
                  onChange={(e) => update("hiddenTimelines", e.target.value)}
                  rows={3}
                  placeholder="Off-screen events / clocks / what advances between sessions…"
                  className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Meta commentary</label>
                <textarea
                  value={draft.metaCommentary || ""}
                  onChange={(e) => update("metaCommentary", e.target.value)}
                  rows={3}
                  placeholder="How you prep, themes, tone rules, pacing notes…"
                  className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>

              <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/40 p-4">
                <p className="text-sm text-zinc-300 font-medium mb-1">
                  Visibility defaults (placeholder)
                </p>
                <p className="text-xs text-zinc-500">
                  Later: default visibility rules for new Sessions / Lore / Items, etc.
                </p>
              </div>

              <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/40 p-4">
                <p className="text-sm text-zinc-300 font-medium mb-3">Invite player</p>
                <p className="mb-4 text-xs text-zinc-500">
                  Create a pending invitation for the active campaign.
                </p>
                <InvitePlayerForm />
              </div>
            </div>
          </section>
        </div>

        {/* Bottom metadata strip */}
        <section className="mt-5 rounded-2xl bg-zinc-950/35 border border-zinc-800/70 p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Metadata</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Tags</label>
              <input
                value={draft.tags || ""}
                onChange={(e) => update("tags", e.target.value)}
                placeholder="comma-separated (e.g. feywild, intrigue, horror)"
                className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              <p className="mt-1 text-xs text-zinc-500">Placeholder: we’ll switch to chips later.</p>
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-1">Start date</label>
              <input
                type="date"
                value={draft.startDate || ""}
                onChange={(e) => update("startDate", e.target.value)}
                className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-1">End date</label>
              <input
                type="date"
                value={draft.endDate || ""}
                onChange={(e) => update("endDate", e.target.value)}
                className="w-full rounded-xl bg-zinc-950/40 border border-zinc-800/70 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-zinc-800/70 bg-zinc-950/40 p-4">
            <p className="text-sm text-zinc-300 font-medium mb-1">Cross-links (placeholder)</p>
            <p className="text-xs text-zinc-500">
              Later: Sessions / NPCs / Items / Maps / Lore / Arcs / Quests counts and links for this campaign.
            </p>
          </div>
        </section>

        {/* Create campaign modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-zinc-950 border border-white/10 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">Create campaign</h2>

              <form className="space-y-4" onSubmit={createCampaign}>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Name</label>
                  <input
                    value={createForm.name}
                    onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Description</label>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Status</label>
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
                    <label className="block text-sm text-zinc-400 mb-1">System / ruleset</label>
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