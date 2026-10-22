import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { useMode } from "../context/ModeContext.jsx";
import { useCampaign } from "../context/CampaignContext";
import { arcsRepo } from "../data/arcs/arcs.repo";
import ProgressTrack from "../components/ProgressTrack.jsx";

const arcTypes = [
  ["character_arc", "Character arc"],
  ["main_story", "Main story"],
  ["supporting_arc", "Supporting arc"],
  ["milestone_progression", "Milestone progression"],
];
const statuses = ["active", "progressing", "waiting", "resolved"];
const blankArc = () => ({
  id: crypto.randomUUID(), type: "main_story", name: "", summary: "", status: "active",
  progress: 0, plotHook: "", grimPortentsFrontiers: "", arcStructure: "",
  climaxConditions: "", resolutionFallout: "", visibility: "gm-only",
});

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
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    let current = true;
    if (!selectedCampaignId || !isGM) { setArcs([]); setLoading(false); return () => { current = false; }; }
    setLoading(true);
    arcsRepo.getAll(selectedCampaignId)
      .then((rows) => { if (current) { setArcs(rows); setError(""); } })
      .catch(() => { if (current) setError("Unable to load Arcs. Try again."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [selectedCampaignId, reloadKey, isGM]);

  const filteredArcs = useMemo(() => arcs.filter((arc) => {
    const text = `${arc.name} ${arc.summary}`.toLowerCase();
    return (!query.trim() || text.includes(query.trim().toLowerCase())) && (typeFilter === "all" || arc.type === typeFilter);
  }), [arcs, query, typeFilter]);

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
      setError(saveError?.message || "Unable to save this Arc. Your draft is still available; check your connection and retry.");
    } finally { setSaving(false); }
  }

  if (!isGM) return null;
  return <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-300">Campaign stories</p><h1 className="mt-1 text-3xl font-bold text-white">Arcs</h1><p className="mt-2 text-sm text-zinc-400">Track story threads and milestone progression across your campaign.</p></div>
      <button type="button" onClick={() => { setDraft(blankArc()); setError(""); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300"><Plus size={16}/> Add new arc</button>
    </header>

    <section aria-label="Arc controls" className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <label className="relative block"><span className="sr-only">Search arcs</span><Search aria-hidden="true" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search arcs..." className="min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950/70 py-2 pl-10 pr-3 text-sm text-white placeholder:text-zinc-500 focus:border-purple-400/50 focus:outline-none"/></label>
      <div className="flex flex-wrap gap-2" aria-label="Filter by Arc type">
        <button type="button" aria-pressed={typeFilter === "all"} onClick={() => setTypeFilter("all")} className={`min-h-10 rounded-full border px-4 py-2 text-sm ${typeFilter === "all" ? "border-purple-400 bg-purple-600 text-white" : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"}`}>All</button>
        {arcTypes.map(([value, label]) => <button key={value} type="button" aria-pressed={typeFilter === value} onClick={() => setTypeFilter(value)} className={`min-h-10 rounded-full border px-4 py-2 text-sm ${typeFilter === value ? "border-purple-400 bg-purple-600 text-white" : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"}`}>{label}</button>)}
      </div>
    </section>

    {error && !draft && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200"><span>{error}</span><button type="button" onClick={() => { setError(""); setReloadKey((key) => key + 1); }} className="rounded-lg border border-rose-300/20 px-3 py-1.5 text-xs font-semibold text-rose-100 hover:bg-rose-300/10">Retry</button></div>}
    {draft && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setDraft(null); }}>
      <form role="dialog" aria-modal="true" aria-labelledby="create-arc-title" onSubmit={saveArc} className="my-auto max-h-[calc(100vh-2rem)] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900 p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3"><h2 id="create-arc-title" className="text-xl font-semibold text-white">Add new arc</h2><button type="button" aria-label="Close" disabled={saving} onClick={() => { setDraft(null); setError(""); }} className="rounded-lg px-2 text-zinc-400 hover:text-white">×</button></div>
        <label className="block text-sm text-zinc-300">Title<input autoFocus value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-white" maxLength={160}/></label>
        <label className="block text-sm text-zinc-300">Type<select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-white">{arcTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="block text-sm text-zinc-300">Summary<textarea rows={3} value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-white"/></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm text-zinc-300">Status<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-white">{statuses.map((status) => <option key={status}>{status}</option>)}</select></label><label className="text-sm text-zinc-300">Progress ({draft.progress}%)<input type="range" min="0" max="100" value={draft.progress} onChange={(event) => setDraft({ ...draft, progress: Number(event.target.value) })} className="mt-2 block w-full accent-purple-500"/></label></div>
        {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={saving} onClick={() => { setDraft(null); setError(""); }} className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-zinc-300">Cancel</button><button disabled={saving} className="rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Create arc"}</button></div>
      </form>
    </div>}

    {loading ? <div role="status" className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm text-zinc-400">Loading Arcs…</div> : filteredArcs.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.025] p-10 text-center"><h2 className="text-lg font-semibold text-white">{arcs.length ? "No matching Arcs" : "No Arcs yet"}</h2><p className="mt-1 text-sm text-zinc-400">{arcs.length ? "Try changing your search or type filter." : "Add an Arc to give a long-running story a clear home."}</p></div> : <div className="space-y-7">
      {statuses.map((status) => {
        const group = filteredArcs.filter((arc) => arc.status === status);
        if (!group.length) return null;
        return <section key={status} aria-labelledby={`arc-status-${status}`} className="space-y-3"><h2 id={`arc-status-${status}`} className="text-xl font-bold capitalize text-white">{status}</h2><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{group.map((arc) => <button key={arc.id} type="button" onClick={() => navigate(`/arcs/${arc.id}`)} className="group min-w-0 rounded-2xl border border-white/10 bg-white/[0.045] p-5 text-left transition hover:border-purple-300/30 hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300"><span className="text-[11px] font-bold uppercase tracking-wide text-purple-300">{arcTypes.find(([value]) => value === arc.type)?.[1] || "Main story"}</span><h3 className="mt-3 break-words text-lg font-semibold text-white group-hover:text-purple-100">{arc.name || "Untitled Arc"}</h3><p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-zinc-400">{arc.summary || "No summary added yet."}</p><div className="mt-4"><ProgressTrack value={arc.progress} label="Progress" ariaLabel="Arc progress"/></div><span className="mt-3 inline-flex rounded-full border border-purple-300/15 bg-purple-300/10 px-3 py-1 text-xs font-semibold capitalize text-purple-100">{arc.status}</span></button>)}</div></section>;
      })}
    </div>}
  </main>;
}
