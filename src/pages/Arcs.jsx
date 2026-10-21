import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { useMode } from "../context/ModeContext.jsx";
import { useCampaign } from "../context/CampaignContext";
import { arcsRepo } from "../data/arcs/arcs.repo";

const blankArc = () => ({ id: crypto.randomUUID(), name: "", summary: "", status: "active", visibility: "gm-only" });
const statuses = ["active", "progressing", "waiting", "resolved"];

export default function Arcs() {
  const navigate = useNavigate();
  const { selectedCampaignId } = useCampaign();
  const { isGM } = useMode();
  const [arcs, setArcs] = useState([]);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const visibleArcs = isGM ? arcs : arcs.filter((arc) => arc.visibility === "public");

  useEffect(() => {
    if (!isGM) { setDraft(null); setError(""); }
  }, [isGM]);

  useEffect(() => {
    let current = true;
    if (!selectedCampaignId) { setArcs([]); setLoading(false); return () => { current = false; }; }
    setLoading(true);
    arcsRepo.getAll(selectedCampaignId)
      .then((rows) => { if (current) { setArcs(rows); setError(""); } })
      .catch(() => { if (current) setError("Unable to load Arcs. Try again."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [selectedCampaignId, reloadKey]);

  async function saveArc(event) {
    event.preventDefault();
    if (!draft || !selectedCampaignId || saving) return;
    if (!draft.name.trim()) { setError("Enter an Arc name before saving."); return; }
    setSaving(true); setError("");
    try {
      const saved = await arcsRepo.upsert(selectedCampaignId, draft);
      setArcs((current) => [saved, ...current.filter((arc) => arc.id !== saved.id)]);
      setDraft(null);
      navigate(`/arcs/${saved.id}`);
    } catch (saveError) {
      setError(saveError?.message || "Unable to save this Arc. Your draft is still available.");
    } finally { setSaving(false); }
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-300">Campaign stories</p><h1 className="mt-1 text-3xl font-bold text-white">Arcs</h1><p className="mt-2 text-sm text-zinc-400">Track the story threads that move through your campaign.</p></div>
        {isGM && <button type="button" onClick={() => { setDraft(blankArc()); setError(""); }} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-purple-400/30 bg-purple-500/15 px-4 py-2 text-sm font-semibold text-purple-100 hover:bg-purple-500/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300"><Plus size={16}/> New Arc</button>}
      </header>

      {error && !draft && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200"><span>{error}</span><button type="button" onClick={() => { setError(""); setReloadKey((key) => key + 1); }} className="rounded-lg border border-rose-300/20 px-3 py-1.5 text-xs font-semibold text-rose-100 hover:bg-rose-300/10">Retry</button></div>}
      {draft && isGM && <form onSubmit={saveArc} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-white">Create Arc</h2>
        <label className="block text-sm text-zinc-300">Name<input autoFocus value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-white" maxLength={160}/></label>
        <label className="block text-sm text-zinc-300">Summary<textarea rows={3} value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-white"/></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm text-zinc-300">Progress state<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-white">{statuses.map((status) => <option key={status}>{status}</option>)}</select></label><label className="text-sm text-zinc-300">Visibility<select value={draft.visibility} onChange={(event) => setDraft({ ...draft, visibility: event.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-white"><option value="gm-only">GM-only</option><option value="public">Player-visible</option></select></label></div>
        {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={() => { setDraft(null); setError(""); }} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300">Cancel</button><button disabled={saving} className="rounded-lg bg-purple-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Create Arc"}</button></div>
      </form>}

      {loading ? <div role="status" className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm text-zinc-400">Loading Arcs…</div> : visibleArcs.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.025] p-10 text-center"><h2 className="text-lg font-semibold text-white">No visible Arcs yet</h2><p className="mt-1 text-sm text-zinc-400">{isGM ? "Create an Arc to give long-running stories a clear home." : "No player-visible Arcs are available in this campaign."}</p></div> : <section aria-label="Campaign Arcs" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{visibleArcs.map((arc) => <button key={arc.id} type="button" onClick={() => navigate(`/arcs/${arc.id}`)} className="group min-h-40 rounded-2xl border border-white/10 bg-white/5 p-5 text-left transition hover:border-purple-300/30 hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300"><div className="flex items-start justify-between gap-3"><h2 className="text-lg font-semibold text-white group-hover:text-purple-100">{arc.name || "Untitled Arc"}</h2><span className="shrink-0 rounded-full border border-purple-300/20 bg-purple-300/10 px-2.5 py-1 text-xs text-purple-100">{arc.status}</span></div><p className="mt-3 line-clamp-3 text-sm leading-6 text-zinc-400">{arc.summary || "No summary added yet."}</p>{isGM && <span className="mt-4 inline-flex rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-zinc-400">{arc.visibility === "public" ? "Player-visible" : "GM-only"}</span>}</button>)}</section>}
    </main>
  );
}
