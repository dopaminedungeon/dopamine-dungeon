import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useCampaign } from "../context/CampaignContext";
import { useMode } from "../context/ModeContext.jsx";
import { arcsRepo, milestonesRepo } from "../data/arcs/arcs.repo";
import { loadLinks, addLink, removeLink, updateLink } from "../data/links/links.repo";
import { sessionsRepo } from "../data/sessions/sessions.repo";
import { createLink } from "../domain/links/link.service";
import ProgressTrack from "../components/ProgressTrack.jsx";

const STATUSES = ["active", "progressing", "waiting", "resolved"];
const INPUT = "mt-1 w-full min-w-0 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white focus:border-purple-400/50 focus:outline-none";

export default function MilestoneProfile() {
  const { arcId, milestoneId } = useParams();
  const { selectedCampaignId } = useCampaign();
  const { isGM } = useMode();
  const [arc, setArc] = useState(null);
  const [milestone, setMilestone] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [links, setLinks] = useState([]);
  const [originalLinks, setOriginalLinks] = useState([]);
  const [draft, setDraft] = useState(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedSession, setSelectedSession] = useState("");
  const [selectedLabel, setSelectedLabel] = useState("reached");

  useEffect(() => {
    let current = true;
    if (!isGM || !selectedCampaignId) { setLoading(false); return () => { current = false; }; }
    setLoading(true); setError("");
    Promise.all([arcsRepo.getById(selectedCampaignId, arcId), milestonesRepo.getByArc(selectedCampaignId, arcId), sessionsRepo.getAll(selectedCampaignId), loadLinks(selectedCampaignId)])
      .then(([loadedArc, allMilestones, loadedSessions, allLinks]) => {
        if (!current) return;
        const loaded = allMilestones.find((item) => String(item.id) === String(milestoneId));
        setArc(loadedArc); setMilestone(loaded || null); setDraft(loaded ? { ...loaded } : null); setSessions(loadedSessions || []);
        const related = allLinks.filter((link) => (link.entityA.type === "Milestone" && String(link.entityA.id) === String(milestoneId)) || (link.entityB.type === "Milestone" && String(link.entityB.id) === String(milestoneId)));
        setLinks(related); setOriginalLinks(related);
      }).catch((loadError) => { if (current) setError(loadError?.message || "Unable to load this milestone. Check your connection and retry."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [isGM, selectedCampaignId, arcId, milestoneId]);

  const sessionLinks = links.filter((link) => (link.entityA.type === "Session" || link.entityB.type === "Session"));
  const linkedSessionIds = new Set(sessionLinks.map((link) => String(link.entityA.type === "Session" ? link.entityA.id : link.entityB.id)));
  function cancel() { setDraft({ ...milestone }); setLinks([...originalLinks]); setEditing(false); setError(""); }
  async function save(event) {
    event.preventDefault();
    if (!selectedCampaignId || !draft || saving) return;
    if (!draft.title.trim()) { setError("Enter a milestone title before saving."); return; }
    setSaving(true); setError("");
    try {
      const saved = await milestonesRepo.upsert(selectedCampaignId, draft);
      const oldById = new Map(originalLinks.map((link) => [link.id, link]));
      const newById = new Map(links.map((link) => [link.id, link]));
      for (const old of originalLinks) if (!newById.has(old.id)) await removeLink(old.id, selectedCampaignId);
      for (const link of links) {
        const old = oldById.get(link.id);
        if (!old) await addLink(link, selectedCampaignId);
        else if (old.label !== link.label || old.visibility !== link.visibility) await updateLink(link, selectedCampaignId);
      }
      setMilestone(saved); setDraft({ ...saved }); setOriginalLinks([...links]); setEditing(false);
    } catch (saveError) { setError(`${saveError?.message || "Unable to save this milestone."} Your draft is retained. Profile and relationship saves are separate requests, so some relationship changes may already have saved; review and retry.`); }
    finally { setSaving(false); }
  }

  if (!isGM) return null;
  if (loading) return <main className="mx-auto max-w-5xl p-6"><p role="status">Loading milestone…</p></main>;
  if (!milestone || !arc) return <main className="mx-auto max-w-5xl p-6"><Link to={`/arcs/${arcId}`} className="text-sm text-zinc-300">Back to Arc</Link><p role="alert" className="mt-4 text-rose-200">{error || "This milestone is unavailable in the selected campaign."}</p></main>;

  return <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><Link to={`/arcs/${arcId}`} className="inline-flex min-h-10 items-center gap-2 text-sm text-zinc-300 hover:text-white"><ArrowLeft size={16}/> {arc.name || "Arc"}</Link><div className="flex gap-2">{editing ? <><button type="button" disabled={saving} onClick={cancel} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300">Cancel</button><button form="milestone-form" disabled={saving} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white">{saving ? "Saving…" : "Save changes"}</button></> : <button type="button" onClick={() => { setDraft({ ...milestone }); setLinks([...originalLinks]); setEditing(true); setError(""); }} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white">Edit</button>}</div></div>
    <form id="milestone-form" onSubmit={save} className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-7">
      {editing ? <div className="space-y-4"><label className="block text-sm text-zinc-300">Milestone title<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className={INPUT} maxLength={160}/></label><label className="block text-sm text-zinc-300">Details<textarea rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className={INPUT}/></label><label className="block text-sm text-zinc-300">Status<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })} className={INPUT}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label><ProgressTrack value={draft.progress} onChange={(progress) => setDraft({ ...draft, progress })} label="Progress" ariaLabel="Milestone progress"/></div> : <><p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-300">Milestone · {arc.type.replaceAll("_", " ")}</p><h1 className="mt-2 break-words text-3xl font-bold text-white">{milestone.title || "Untitled milestone"}</h1><p className="mt-2 text-sm text-zinc-400">Milestone in <Link to={`/arcs/${arcId}`} className="text-purple-200 hover:text-white">{arc.name || "Untitled Arc"}</Link></p><div className="mt-4"><ProgressTrack value={milestone.progress} label="Progress" ariaLabel="Milestone progress"/></div><p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{milestone.description || "No details added."}</p><span className="mt-4 inline-flex rounded-full border border-purple-300/20 bg-purple-300/10 px-3 py-1 text-xs capitalize text-purple-100">{milestone.status}</span></>}
      {editing && <div className="flex justify-end gap-2 border-t border-white/10 pt-4"><button type="button" disabled={saving} onClick={cancel} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300">Cancel</button><button disabled={saving} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white">{saving ? "Saving…" : "Save changes"}</button></div>}
    </form>
    {error && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
    <div className="grid gap-5 lg:grid-cols-2"><section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6"><h2 className="text-lg font-semibold text-white">Conditions for level up</h2>{editing ? <textarea aria-label="Conditions for level up" rows={7} value={draft.conditionsForLevelUp} onChange={(event) => setDraft({ ...draft, conditionsForLevelUp: event.target.value })} className={INPUT}/> : <p className="mt-3 min-h-24 whitespace-pre-wrap rounded-xl border border-white/10 bg-zinc-950/40 p-4 text-sm leading-6 text-zinc-300">{milestone.conditionsForLevelUp || "No level-up conditions added."}</p>}</section><section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6"><h2 className="text-lg font-semibold text-white">Intended level progression</h2>{editing ? <input aria-label="Intended level progression" value={draft.intendedLevelProgression} onChange={(event) => setDraft({ ...draft, intendedLevelProgression: event.target.value })} className={INPUT}/> : <p className="mt-3 rounded-xl border border-white/10 bg-zinc-950/40 p-4 text-sm text-zinc-300">{milestone.intendedLevelProgression || "Not specified."}</p>}</section></div>
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6"><h2 className="text-lg font-semibold text-white">Sessions</h2>{sessionLinks.length ? <ul className="mt-3 space-y-2">{sessionLinks.map((link) => { const id = String(link.entityA.type === "Session" ? link.entityA.id : link.entityB.id); const session = sessions.find((item) => String(item.id) === id); return <li key={link.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2"><Link to={`/sessions/${id}`} className="text-sm text-purple-200 hover:text-white">{session?.name || "Session"}</Link>{editing ? <div className="flex items-center gap-2"><select aria-label="Session relationship label" value={link.label} onChange={(event) => setLinks(links.map((item) => item.id === link.id ? { ...item, label: event.target.value } : item))} className="rounded-lg border border-white/10 bg-zinc-950 px-2 py-1 text-xs text-white"><option value="advanced">advanced</option><option value="reached">reached</option><option value="mentioned">mentioned</option></select><button type="button" onClick={() => setLinks(links.filter((item) => item.id !== link.id))} className="text-xs text-rose-300">Remove</button></div> : <span className="text-xs text-zinc-400">{link.label}</span>}</li>; })}</ul> : <p className="mt-3 text-sm text-zinc-500">No linked sessions yet.</p>}{editing && <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_auto]"><select aria-label="Session to link" value={selectedSession} onChange={(event) => setSelectedSession(event.target.value)} className={INPUT}><option value="">Choose session</option>{sessions.filter((item) => !linkedSessionIds.has(String(item.id))).map((item) => <option key={item.id} value={item.id}>{item.name || "Untitled session"}</option>)}</select><select aria-label="New session relationship label" value={selectedLabel} onChange={(event) => setSelectedLabel(event.target.value)} className={INPUT}><option value="reached">reached</option><option value="advanced">advanced</option><option value="mentioned">mentioned</option></select><button type="button" disabled={!selectedSession} onClick={() => { setLinks([...links, createLink({ entityA: { type: "Milestone", id: milestoneId }, entityB: { type: "Session", id: selectedSession }, label: selectedLabel, visibility: "GM" })]); setSelectedSession(""); }} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 disabled:opacity-40">Add</button></div>}</section>
  </main>;
}
