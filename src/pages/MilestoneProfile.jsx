import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useCampaign } from "../context/CampaignContext";
import { useMode } from "../context/ModeContext.jsx";
import { arcsRepo, milestonesRepo } from "../data/arcs/arcs.repo";
import ProgressTrack from "../components/ProgressTrack.jsx";
import { MarkdownContent } from "../components/MarkdownContent.jsx";

const STATUSES = ["active", "progressing", "waiting", "resolved"];
const INPUT = "mt-1 w-full min-w-0 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white focus:border-purple-400/50 focus:outline-none";

export default function MilestoneProfile() {
  const { arcId, milestoneId } = useParams();
  const { selectedCampaignId } = useCampaign();
  const { isGM } = useMode();
  const [arc, setArc] = useState(null);
  const [milestone, setMilestone] = useState(null);
  const [draft, setDraft] = useState(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let current = true;
    if (!isGM || !selectedCampaignId) { setLoading(false); return () => { current = false; }; }
    setLoading(true); setError("");
    Promise.all([arcsRepo.getById(selectedCampaignId, arcId), milestonesRepo.getByArc(selectedCampaignId, arcId)])
      .then(([loadedArc, allMilestones]) => {
        if (!current) return;
        const loaded = allMilestones.find((item) => String(item.id) === String(milestoneId));
        setArc(loadedArc); setMilestone(loaded || null); setDraft(loaded ? { ...loaded } : null);
      }).catch((loadError) => { if (current) setError(loadError?.message || "Unable to load this milestone. Check your connection and retry."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [isGM, selectedCampaignId, arcId, milestoneId, reloadKey]);

  function cancel() { if (saving) return; setDraft({ ...milestone }); setEditing(false); setError(""); }
  async function save(event) {
    event.preventDefault();
    if (!selectedCampaignId || !draft || saving) return;
    if (!draft.title.trim()) { setError("Enter a milestone title before saving."); return; }
    setSaving(true); setError("");
    try {
      const saved = await milestonesRepo.upsert(selectedCampaignId, draft);
      setMilestone(saved); setDraft({ ...saved }); setEditing(false);
    } catch (saveError) { setError(`${saveError?.message || "Unable to save this milestone."} Your draft is retained; check your connection and retry.`); }
    finally { setSaving(false); }
  }

  if (!isGM) return null;
  if (loading) return <main className="mx-auto max-w-5xl p-6"><p role="status">Loading milestone…</p></main>;
  if (!milestone || !arc) return <main className="mx-auto max-w-5xl p-6"><Link to={`/arcs/${arcId}`} className="text-sm text-zinc-300">Back to Arc</Link><p role="alert" className="mt-4 text-rose-200">{error || "This milestone is unavailable in the selected campaign."}</p>{error && <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="mt-3 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200">Retry</button>}</main>;

  return <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><Link to={`/arcs/${arcId}`} className="inline-flex min-h-10 items-center gap-2 text-sm text-zinc-300 hover:text-white"><ArrowLeft size={16}/> {arc.name || "Arc"}</Link><div className="flex gap-2">{editing ? <><button type="button" disabled={saving} onClick={cancel} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 disabled:opacity-50">Cancel</button><button form="milestone-form" disabled={saving} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save changes"}</button></> : <button type="button" disabled={saving} onClick={() => { setDraft({ ...milestone }); setEditing(true); setError(""); }} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Edit</button>}</div></div>
    <form id="milestone-form" onSubmit={save} className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-7">
      {editing ? <fieldset disabled={saving} className="space-y-4 disabled:opacity-60"><label className="block text-sm text-zinc-300">Milestone title<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className={INPUT} maxLength={160}/></label><label className="block text-sm text-zinc-300">Details<textarea rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className={INPUT}/></label><label className="block text-sm text-zinc-300">Status<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })} className={INPUT}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label><ProgressTrack value={draft.progress} onChange={(progress) => setDraft({ ...draft, progress })} label="Progress" ariaLabel="Milestone progress"/></fieldset> : <><p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-300">Milestone · {arc.type.replaceAll("_", " ")}</p><h1 className="mt-2 break-words text-3xl font-bold text-white">{milestone.title || "Untitled milestone"}</h1><p className="mt-2 text-sm text-zinc-400">Milestone in <Link to={`/arcs/${arcId}`} className="text-purple-200 hover:text-white">{arc.name || "Untitled Arc"}</Link></p><div className="mt-4"><ProgressTrack value={milestone.progress} label="Progress" ariaLabel="Milestone progress"/></div><div className="mt-4"><MarkdownContent content={milestone.description} placeholder="No details added."/></div><span className="mt-4 inline-flex rounded-full border border-purple-300/20 bg-purple-300/10 px-3 py-1 text-xs capitalize text-purple-100">{milestone.status}</span></>}
      {editing && <div className="flex justify-end gap-2 border-t border-white/10 pt-4"><button type="button" disabled={saving} onClick={cancel} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300">Cancel</button><button disabled={saving} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white">{saving ? "Saving…" : "Save changes"}</button></div>}
    </form>
    {error && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
    <div className="grid gap-5 lg:grid-cols-2"><section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6"><h2 className="text-lg font-semibold text-white">Conditions for level up</h2>{editing ? <textarea disabled={saving} aria-label="Conditions for level up" rows={7} value={draft.conditionsForLevelUp} onChange={(event) => setDraft({ ...draft, conditionsForLevelUp: event.target.value })} className={INPUT}/> : <div className="mt-3 min-h-24 rounded-xl border border-white/10 bg-zinc-950/40 p-4"><MarkdownContent content={milestone.conditionsForLevelUp} placeholder="No level-up conditions added."/></div>}</section><section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6"><h2 className="text-lg font-semibold text-white">Intended level progression</h2>{editing ? <input disabled={saving} aria-label="Intended level progression" value={draft.intendedLevelProgression} onChange={(event) => setDraft({ ...draft, intendedLevelProgression: event.target.value })} className={INPUT}/> : <div className="mt-3 rounded-xl border border-white/10 bg-zinc-950/40 p-4"><MarkdownContent content={milestone.intendedLevelProgression} placeholder="Not specified."/></div>}</section></div>
  </main>;
}
