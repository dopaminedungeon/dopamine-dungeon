import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { useMode } from "../context/ModeContext.jsx";
import { useCampaign } from "../context/CampaignContext";
import { arcsRepo, milestonesRepo } from "../data/arcs/arcs.repo";
import { getAllCharacters } from "../data/characters/characters.repo";
import { addLink } from "../data/links/links.repo";
import { createLink } from "../domain/links/link.service";
import ProgressTrack from "../components/ProgressTrack.jsx";
import { formatLevelProgression } from "../domain/arcs/level-progression.js";

const arcTypes = [
  ["character_arc", "Character arc"],
  ["main_story", "Main story"],
  ["supporting_arc", "Supporting arc"],
];
const filterTypes = [["all", "All"], ...arcTypes, ["milestone_progression", "Milestone progression"]];
const statuses = ["active", "progressing", "waiting", "resolved"];
const inputClass = "mt-1 w-full min-w-0 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white focus:border-purple-400/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";
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
  const [milestones, setMilestones] = useState([]);
  const [pcs, setPcs] = useState([]);
  const [draft, setDraft] = useState(null);
  const [createMode, setCreateMode] = useState("arc");
  const [assignedPcId, setAssignedPcId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const creationOpen = Boolean(draft);

  const closeCreation = useCallback(() => {
    if (saving) return;
    setDraft(null); setError("");
  }, [saving]);

  useEffect(() => {
    if (!creationOpen || typeof document === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => { if (event.key === "Escape") closeCreation(); };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKeyDown); };
  }, [creationOpen, closeCreation]);

  useEffect(() => {
    let current = true;
    if (!selectedCampaignId || !isGM) { setArcs([]); setMilestones([]); setPcs([]); setLoading(false); return () => { current = false; }; }
    setLoading(true); setError("");
    Promise.all([arcsRepo.getAll(selectedCampaignId), milestonesRepo.getAll(selectedCampaignId), getAllCharacters(selectedCampaignId)])
      .then(([arcRows, milestoneRows, pcRows]) => { if (current) { setArcs(arcRows || []); setMilestones(milestoneRows || []); setPcs(pcRows || []); } })
      .catch((failure) => { if (current) setError(failure?.message || "Unable to load Arcs and Milestones. Try again."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [selectedCampaignId, reloadKey, isGM]);

  const entries = useMemo(() => [
    ...arcs.filter((arc) => arc.type !== "milestone_progression").map((arc) => ({ ...arc, entryType: "arc", title: arc.name, description: arc.summary })),
    ...milestones.map((milestone) => ({ ...milestone, entryType: "milestone", type: "milestone_progression", title: milestone.title, description: milestone.description })),
    ...arcs.filter((arc) => arc.type === "milestone_progression").map((arc) => ({ ...arc, entryType: "legacy-arc", title: arc.name, description: arc.summary })),
  ], [arcs, milestones]);
  const filteredArcs = useMemo(() => entries.filter((entry) => {
    const text = `${entry.title} ${entry.description || ""} ${entry.type}`.toLowerCase();
    const typeMatches = typeFilter === "all" || (typeFilter === "milestone_progression"
      ? entry.type === "milestone_progression"
      : entry.entryType === "arc" && entry.type === typeFilter);
    return (!query.trim() || text.includes(query.trim().toLowerCase())) && typeMatches;
  }), [entries, query, typeFilter]);

  function openArcCreation() {
    setCreateMode("arc"); setAssignedPcId(""); setDraft(blankArc()); setError("");
  }

  function openMilestoneCreation() {
    setCreateMode("milestone");
    setDraft({ id: crypto.randomUUID(), arcId: null, title: "", description: "", progress: 0, status: "active", conditionsForLevelUp: "", intendedLevelProgression: "", visibility: "gm-only", position: 0 });
    setError("");
  }

  async function saveArc(event) {
    event.preventDefault();
    if (!draft || !selectedCampaignId || saving) return;
    const isMilestone = createMode === "milestone";
    if (!(isMilestone ? draft.title : draft.name).trim()) { setError(`Enter a ${isMilestone ? "Milestone" : "Arc"} name before saving.`); return; }
    setSaving(true); setError("");
    try {
      if (isMilestone) {
        const saved = await milestonesRepo.upsert(selectedCampaignId, draft);
        setMilestones((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
        setDraft(null);
        navigate(`/milestones/${encodeURIComponent(saved.id)}`);
      } else {
        const saved = await arcsRepo.upsert(selectedCampaignId, draft);
        if (saved.type === "character_arc" && assignedPcId) {
          await addLink(createLink({ entityA: { type: "Arc", id: saved.id }, entityB: { type: "PC", id: assignedPcId }, label: "assigned_to", visibility: "GM" }), selectedCampaignId);
        }
        setArcs((current) => [saved, ...current.filter((arc) => arc.id !== saved.id)]);
        setDraft(null);
        navigate(`/arcs/${saved.id}`);
      }
    } catch (saveError) {
      setError(`${saveError?.message || "Unable to save."} Your draft is still available; retry after checking the connection. Arc and Assigned PC saves are separate requests.`);
    } finally { setSaving(false); }
  }

  if (!isGM) return null;
  return <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-300">Campaign stories</p><h1 className="mt-1 text-3xl font-bold text-white">Arcs</h1><p className="mt-2 text-sm text-zinc-400">Track story threads and milestone progression across your campaign.</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={openArcCreation} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300"><Plus size={16}/> Add new arc</button><button type="button" onClick={openMilestoneCreation} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-100 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300"><Plus size={16}/> Add milestone</button></div>
    </header>

    <section aria-label="Arc controls" className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <label className="relative block"><span className="sr-only">Search arcs</span><Search aria-hidden="true" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search arcs..." className="min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950/70 py-2 pl-10 pr-3 text-sm text-white placeholder:text-zinc-500 focus:border-purple-400/50 focus:outline-none"/></label>
      <div className="flex flex-wrap gap-2" aria-label="Filter by Arc type">
        {filterTypes.map(([value, label]) => <button key={value} type="button" aria-pressed={typeFilter === value} onClick={() => setTypeFilter(value)} className={`min-h-10 rounded-full border px-4 py-2 text-sm ${typeFilter === value ? "border-purple-400 bg-purple-600 text-white" : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"}`}>{label}</button>)}
      </div>
    </section>

    {error && !draft && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200"><span>{error}</span><button type="button" onClick={() => { setError(""); setReloadKey((key) => key + 1); }} className="rounded-lg border border-rose-300/20 px-3 py-1.5 text-xs font-semibold text-rose-100 hover:bg-rose-300/10">Retry</button></div>}
    {draft && typeof document !== "undefined" && createPortal(<div className="fixed inset-0 z-[100] flex items-start justify-center overflow-hidden bg-black/70 p-3 pt-4 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) closeCreation(); }}><div role="dialog" aria-modal="true" aria-labelledby="create-arc-title" className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-xl sm:max-h-[calc(100dvh-2rem)]"><form className="flex min-h-0 flex-1 flex-col" onSubmit={saveArc}><div className="shrink-0 border-b border-white/10 p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div><h2 id="create-arc-title" className="text-xl font-bold text-white">{createMode === "milestone" ? "Add milestone progression" : "Add new arc"}</h2><p className="mt-1 text-xs text-zinc-500">Campaign-only story records for GMs.</p></div><button type="button" aria-label="Close" disabled={saving} onClick={closeCreation} className="rounded-lg px-2 text-zinc-400 hover:text-white disabled:opacity-50">×</button></div></div><div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6"><fieldset disabled={saving} className="space-y-4 disabled:opacity-60">
        {createMode === "milestone" ? <><label className="block text-sm text-zinc-300">Milestone title<input autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className={inputClass} maxLength={160}/></label><label className="block text-sm text-zinc-300">Details<textarea rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className={inputClass}/></label><label className="block text-sm text-zinc-300">Conditions for level up<textarea rows={5} value={draft.conditionsForLevelUp} onChange={(event) => setDraft({ ...draft, conditionsForLevelUp: event.target.value })} className={inputClass}/></label><label className="block text-sm text-zinc-300">Intended level progression<input value={draft.intendedLevelProgression} onChange={(event) => setDraft({ ...draft, intendedLevelProgression: event.target.value })} className={inputClass}/></label></> : <><label className="block text-sm text-zinc-300">Title<input autoFocus value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className={inputClass} maxLength={160}/></label><label className="block text-sm text-zinc-300">Type<select value={draft.type} onChange={(event) => { setDraft({ ...draft, type: event.target.value }); if (event.target.value !== "character_arc") setAssignedPcId(""); }} className={inputClass}>{arcTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{draft.type === "character_arc" && <label className="block text-sm text-zinc-300">Assigned PC<select value={assignedPcId} onChange={(event) => setAssignedPcId(event.target.value)} className={inputClass}><option value="">Unassigned</option>{pcs.map((pc) => <option key={pc.id} value={pc.id}>{pc.name || "Untitled PC"}</option>)}</select></label>}<label className="block text-sm text-zinc-300">Summary<textarea rows={3} value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} className={inputClass}/></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm text-zinc-300">Status<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })} className={inputClass}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label><div><ProgressTrack value={draft.progress} onChange={(progress) => setDraft({ ...draft, progress })} label="Progress" ariaLabel="Arc progress"/></div></div></>}
        </fieldset>{error && <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>}</div><div className="shrink-0 border-t border-white/10 p-5 sm:p-6"><div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" disabled={saving} onClick={closeCreation} className="w-full rounded-xl border border-white/10 px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/5 disabled:opacity-50 sm:w-auto">Cancel</button><button disabled={saving} className="w-full rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto">{saving ? "Saving…" : createMode === "milestone" ? "Create milestone" : "Create arc"}</button></div></div></form></div></div>, document.body)}

    {loading ? <div role="status" className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm text-zinc-400">Loading Arcs…</div> : filteredArcs.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.025] p-10 text-center"><h2 className="text-lg font-semibold text-white">{entries.length ? "No matching Arcs or Milestones" : "No Arcs yet"}</h2><p className="mt-1 text-sm text-zinc-400">{entries.length ? "Try changing your search or type filter." : "Add an Arc to give a long-running story a clear home."}</p></div> : <div className="space-y-7">
      {statuses.map((status) => {
        const group = filteredArcs.filter((arc) => arc.status === status);
        if (!group.length) return null;
        return <section key={status} aria-labelledby={`arc-status-${status}`} className="space-y-3"><h2 id={`arc-status-${status}`} className="text-xl font-bold capitalize text-white">{status}</h2><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{group.map((entry) => { const label = entry.entryType === "milestone" || entry.entryType === "legacy-arc" ? "Milestone progression" : arcTypes.find(([value]) => value === entry.type)?.[1] || "Main story"; const path = entry.entryType === "milestone" ? `/milestones/${encodeURIComponent(entry.id)}` : `/arcs/${encodeURIComponent(entry.id)}`; return <button key={`${entry.entryType}-${entry.id}`} type="button" onClick={() => navigate(path)} className="group min-w-0 rounded-2xl border border-white/10 bg-white/[0.045] p-5 text-left transition hover:border-purple-300/30 hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300"><span className="text-[11px] font-bold uppercase tracking-wide text-purple-300">{label}</span><h3 className="mt-3 break-words text-lg font-semibold text-white group-hover:text-purple-100">{entry.title || "Untitled"}</h3><p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-zinc-400">{entry.description || "No summary added yet."}</p>{entry.entryType === "milestone" && entry.arcId && <p className="mt-2 text-xs text-zinc-500">Milestone in {arcs.find((arc) => arc.id === entry.arcId)?.name || "Arc"}</p>}{entry.entryType === "milestone" && entry.intendedLevelProgression && <p className="mt-2 text-xs font-medium text-zinc-300">Level progression: {formatLevelProgression(entry.intendedLevelProgression)}</p>}<div className="mt-4"><ProgressTrack value={entry.progress} label="Progress" ariaLabel={`${label} progress`}/></div><span className="mt-3 inline-flex rounded-full border border-purple-300/15 bg-purple-300/10 px-3 py-1 text-xs font-semibold capitalize text-purple-100">{entry.status}</span></button>; })}</div></section>;
      })}
    </div>}
  </main>;
}
