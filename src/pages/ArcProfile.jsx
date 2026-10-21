import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { useCampaign } from "../context/CampaignContext";
import { useMode } from "../context/ModeContext.jsx";
import { arcsRepo, milestonesRepo } from "../data/arcs/arcs.repo";
import { sessionsRepo } from "../data/sessions/sessions.repo";
import { itemsRepo } from "../data/items/items.repo";
import { npcsRepo } from "../data/npcs/npcs.repo";
import { loreRepo } from "../data/lore/lore.repo";
import { locationsRepo } from "../data/maps/locations.repo";
import { getAllCharacters } from "../data/characters/characters.repo";
import { addLink, loadLinks, removeLink, updateLink } from "../data/links/links.repo";
import { createLink } from "../domain/links/link.service";

const statuses = ["active", "progressing", "waiting", "resolved"];
const labelNames = { advanced: "advanced", pivoted: "pivoted", reached: "reached", mentioned: "mentioned" };
const makeMilestone = (arcId, position) => ({ id: crypto.randomUUID(), arcId, title: "", description: "", status: "active", visibility: "gm-only", position });

function EntityRelationshipSection({ endpointType, endpointId, entityType, title, entities, links, labels, isGM, editMode, onLinks }) {
  const [entityId, setEntityId] = useState("");
  const [label, setLabel] = useState(labels[0]);
  const [visibility, setVisibility] = useState("Player");
  const endpoint = (link) => link.entityA.type === endpointType && String(link.entityA.id) === String(endpointId) ? link.entityB : link.entityA;
  const related = links.filter((link) => endpoint(link).type === entityType && entities.some((entity) => String(entity.id) === String(endpoint(link).id)));
  const entityById = new Map(entities.map((entity) => [String(entity.id), entity]));
  const linkedIds = new Set(related.map((link) => String(endpoint(link).id)));
  if (!editMode && related.length === 0) return null;
  return <section className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-5"><h3 className="text-base font-semibold text-white">{title}</h3>
    {related.length === 0 ? <p className="mt-3 text-sm text-zinc-500">No linked {title.toLowerCase()} yet.</p> : <ul className="mt-3 space-y-2">{related.map((link) => { const entity = entityById.get(String(endpoint(link).id)); return <li key={link.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/10 px-3 py-2"><Link to={`/${entityType === "Map" ? "maps" : entityType === "PC" ? "pcs" : entityType === "NPC" ? "npcs" : entityType.toLowerCase()}/${entity.id}`} className="text-sm text-purple-200 hover:text-white">{entity.name || entity.title || "Untitled"}</Link><div className="flex flex-wrap items-center gap-2">{editMode ? <><select aria-label={`${title} relationship label`} value={link.label} onChange={(event) => onLinks(links.map((candidate) => candidate.id === link.id ? { ...candidate, label: event.target.value } : candidate))} className="rounded-lg border border-white/10 bg-zinc-950 px-2 py-1 text-xs text-white">{labels.map((option) => <option key={option}>{option}</option>)}</select><select aria-label={`${title} visibility`} value={link.visibility} onChange={(event) => onLinks(links.map((candidate) => candidate.id === link.id ? { ...candidate, visibility: event.target.value } : candidate))} className="rounded-lg border border-white/10 bg-zinc-950 px-2 py-1 text-xs text-white"><option value="Player">Player-visible</option><option value="GM">GM-only</option></select><button type="button" onClick={() => onLinks(links.filter((candidate) => candidate.id !== link.id))} className="text-xs text-rose-300">Remove</button></> : <span className="rounded-full border border-purple-300/15 bg-purple-300/10 px-2 py-1 text-[11px] text-purple-100">{link.label.replaceAll("_", " ")}{isGM && link.visibility === "GM" ? " · GM-only" : ""}</span>}</div></li>; })}</ul>}
    {isGM && editMode && <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_140px_auto]"><select aria-label={`${title} entity`} value={entityId} onChange={(event) => setEntityId(event.target.value)} className="min-w-0 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"><option value="">Choose {title.toLowerCase()}</option>{entities.filter((entity) => !linkedIds.has(String(entity.id))).map((entity) => <option key={entity.id} value={entity.id}>{entity.name || entity.title || "Untitled"}</option>)}</select><select aria-label={`${title} new relationship label`} value={label} onChange={(event) => setLabel(event.target.value)} className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white">{labels.map((option) => <option key={option}>{option.replaceAll("_", " ")}</option>)}</select><select aria-label={`${title} new relationship visibility`} value={visibility} onChange={(event) => setVisibility(event.target.value)} className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"><option value="Player">Player-visible</option><option value="GM">GM-only</option></select><button type="button" disabled={!entityId} onClick={() => { const link = createLink({ entityA: { type: endpointType, id: endpointId }, entityB: { type: entityType, id: entityId }, label, visibility }); onLinks([...links, link]); setEntityId(""); }} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 disabled:opacity-40">Add</button></div>}
  </section>;
}

function SessionRelationships({ endpointType, endpointId, sessions, links, isGM, editMode, onLinks }) {
  const [sessionId, setSessionId] = useState("");
  const [label, setLabel] = useState(endpointType === "Arc" ? "advanced" : "reached");
  const choices = endpointType === "Arc" ? ["advanced", "pivoted"] : ["advanced", "reached", "mentioned"];
  const related = links.filter((link) => {
    const base = link.entityA.type === endpointType && String(link.entityA.id) === String(endpointId) ? link.entityB : link.entityA;
    return base.type === "Session" && sessions.some((session) => String(session.id) === String(base.id));
  });
  const sessionsById = new Map(sessions.map((session) => [String(session.id), session]));
  const linked = new Set(related.map((link) => String((link.entityA.type === "Session" ? link.entityA : link.entityB).id)));

  function addSession() {
    if (!sessionId) return;
    const newLink = createLink({
      entityA: { type: endpointType, id: String(endpointId) },
      entityB: { type: "Session", id: sessionId },
      label,
      visibility: "Player",
    });
    onLinks([...links, newLink]); setSessionId("");
  }

  return <section className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-5">
    <div className="flex items-center justify-between gap-3"><h3 className="text-base font-semibold text-white">Sessions</h3>{editMode && isGM && <span className="text-xs text-zinc-500">Saved with Arc</span>}</div>
    {related.length === 0 ? <p className="mt-3 text-sm text-zinc-500">No linked sessions yet.</p> : <ul className="mt-3 space-y-2">{related.map((link) => {
      const sessionEndpoint = link.entityA.type === "Session" ? link.entityA : link.entityB;
      const session = sessionsById.get(String(sessionEndpoint.id));
      return <li key={link.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/10 px-3 py-2"><Link className="min-h-8 text-sm text-purple-200 hover:text-white focus-visible:outline-2 focus-visible:outline-purple-300" to={`/sessions/${session.id}`}>{session.name || "Untitled session"}</Link><div className="flex items-center gap-2">{editMode && isGM ? <select aria-label="Relationship type" value={link.label} onChange={(event) => onLinks(links.map((candidate) => candidate.id === link.id ? { ...candidate, label: event.target.value } : candidate))} className="rounded-lg border border-white/10 bg-zinc-950 px-2 py-1 text-xs text-zinc-200">{choices.map((choice) => <option key={choice} value={choice}>{labelNames[choice]}</option>)}</select> : <span className="rounded-full border border-purple-300/15 bg-purple-300/10 px-2 py-1 text-[11px] text-purple-100">{labelNames[link.label] || link.label}</span>}{editMode && isGM && <button type="button" onClick={() => onLinks(links.filter((candidate) => candidate.id !== link.id))} className="text-xs text-rose-300 hover:text-rose-200">Remove</button>}</div></li>;
    })}</ul>}
    {editMode && isGM && <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_auto]"><select aria-label="Session to link" value={sessionId} onChange={(event) => setSessionId(event.target.value)} className="min-w-0 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"><option value="">Choose a session</option>{sessions.filter((session) => !linked.has(String(session.id))).map((session) => <option key={session.id} value={session.id}>{session.name || "Untitled session"}</option>)}</select><select aria-label="New relationship type" value={label} onChange={(event) => setLabel(event.target.value)} className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white">{choices.map((choice) => <option key={choice} value={choice}>{labelNames[choice]}</option>)}</select><button type="button" disabled={!sessionId} onClick={addSession} className="inline-flex items-center justify-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 disabled:opacity-40"><Plus size={14}/> Add</button></div>}
  </section>;
}

export default function ArcProfile() {
  const { id } = useParams();
  const { selectedCampaignId } = useCampaign();
  const { isGM } = useMode();
  const [arc, setArc] = useState(null);
  const [draft, setDraft] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [milestoneDraft, setMilestoneDraft] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [entities, setEntities] = useState({ NPC: [], PC: [], Item: [], Map: [], Lore: [] });
  const [links, setLinks] = useState([]);
  const [originalLinks, setOriginalLinks] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  async function reload() {
    if (!selectedCampaignId || !id) return;
    const [loadedArc, loadedMilestones, loadedSessions, loadedLinks, itemRows, npcRows, loreRows, locationRows, characterRows] = await Promise.all([
      arcsRepo.getById(selectedCampaignId, id), milestonesRepo.getByArc(selectedCampaignId, id),
      sessionsRepo.getAll(selectedCampaignId), loadLinks(selectedCampaignId),
      itemsRepo.getAll(selectedCampaignId), npcsRepo.getAll(selectedCampaignId), loreRepo.getAll(selectedCampaignId),
      locationsRepo.getAll(selectedCampaignId), getAllCharacters(selectedCampaignId),
    ]);
    setArc(loadedArc); setDraft(loadedArc ? { ...loadedArc } : null);
    setMilestones(loadedMilestones); setSessions(loadedSessions || []);
    setEntities({ NPC: npcRows || [], PC: characterRows || [], Item: itemRows || [], Map: locationRows || [], Lore: loreRows || [] });
    const allowed = loadedLinks.filter((link) =>
      (link.entityA.type === "Arc" && String(link.entityA.id) === String(id)) ||
      (link.entityB.type === "Arc" && String(link.entityB.id) === String(id)) ||
      (link.entityA.type === "Milestone" && loadedMilestones.some((milestone) => milestone.id === link.entityA.id)) ||
      (link.entityB.type === "Milestone" && loadedMilestones.some((milestone) => milestone.id === link.entityB.id))
    );
    setLinks(allowed); setOriginalLinks(allowed);
  }

  useEffect(() => {
    let current = true;
    setLoading(true); setError("");
    Promise.all([
      arcsRepo.getById(selectedCampaignId, id), milestonesRepo.getByArc(selectedCampaignId, id),
      sessionsRepo.getAll(selectedCampaignId), loadLinks(selectedCampaignId),
      itemsRepo.getAll(selectedCampaignId), npcsRepo.getAll(selectedCampaignId), loreRepo.getAll(selectedCampaignId),
      locationsRepo.getAll(selectedCampaignId), getAllCharacters(selectedCampaignId),
    ]).then(([loadedArc, loadedMilestones, loadedSessions, loadedLinks, itemRows, npcRows, loreRows, locationRows, characterRows]) => {
      if (!current) return;
      setArc(loadedArc); setDraft(loadedArc ? { ...loadedArc } : null);
      setMilestones(loadedMilestones); setSessions(loadedSessions || []);
      setEntities({ NPC: npcRows || [], PC: characterRows || [], Item: itemRows || [], Map: locationRows || [], Lore: loreRows || [] });
      const allowed = loadedLinks.filter((link) =>
        (link.entityA.type === "Arc" && String(link.entityA.id) === String(id)) ||
        (link.entityB.type === "Arc" && String(link.entityB.id) === String(id)) ||
        (link.entityA.type === "Milestone" && loadedMilestones.some((milestone) => milestone.id === link.entityA.id)) ||
        (link.entityB.type === "Milestone" && loadedMilestones.some((milestone) => milestone.id === link.entityB.id))
      );
      setLinks(allowed); setOriginalLinks(allowed);
    }).catch(() => { if (current) setError("Unable to load this Arc. Try again."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [selectedCampaignId, id, isGM, reloadKey]);

  useEffect(() => {
    if (!isGM) {
      setEditMode(false);
      setMilestoneDraft(null);
      setDraft(null);
    }
  }, [isGM]);

  const milestoneMap = useMemo(() => new Map(milestones.map((item) => [item.id, item])), [milestones]);
  const effectiveEditMode = isGM && editMode;
  const safeArc = isGM || arc?.visibility === "public" ? arc : null;
  const safeMilestones = isGM ? milestones : milestones.filter((item) => item.visibility === "public" && arc?.visibility === "public");
  const safeLinks = isGM ? links : links.filter((link) => link.visibility === "Player");
  const safeSessions = isGM ? sessions : sessions.filter((session) => session.visibility === "public");
  const safeEntities = isGM ? entities : Object.fromEntries(Object.entries(entities).map(([type, rows]) => [
    type,
    rows.filter((entity) => entity.visibility === "public" || entity.isPlayerVisible === true),
  ]));
  const displayedArc = effectiveEditMode ? draft : safeArc;

  function startEdit() { if (!isGM || !arc) return; setDraft({ ...arc }); setLinks([...originalLinks]); setEditMode(true); setError(""); }
  function cancelEdit() { setDraft(arc ? { ...arc } : null); setLinks([...originalLinks]); setMilestoneDraft(null); setEditMode(false); setError(""); }

  async function saveArc(event) {
    event.preventDefault();
    if (!draft || !selectedCampaignId || saving) return;
    if (!draft.name.trim()) { setError("Enter an Arc name before saving."); return; }
    setSaving(true); setError("");
    try {
      const saved = await arcsRepo.upsert(selectedCampaignId, draft);
      const originalById = new Map(originalLinks.map((link) => [link.id, link]));
      const nextById = new Map(links.map((link) => [link.id, link]));
      for (const oldLink of originalLinks) if (!nextById.has(oldLink.id)) await removeLink(oldLink.id, selectedCampaignId);
      for (const newLink of links) {
        const oldLink = originalById.get(newLink.id);
        if (!oldLink) await addLink(newLink, selectedCampaignId);
        else if (oldLink.label !== newLink.label || oldLink.visibility !== newLink.visibility) await updateLink(newLink, selectedCampaignId);
      }
      await reload(); setArc(saved); setDraft(saved); setEditMode(false);
    } catch (saveError) {
      setError(saveError?.message || "Some changes could not be saved. Your draft remains available; review and retry.");
    } finally { setSaving(false); }
  }

  async function saveMilestone(event) {
    event.preventDefault();
    if (!milestoneDraft || !selectedCampaignId || saving) return;
    if (!milestoneDraft.title.trim()) { setError("Enter a milestone title before saving."); return; }
    setSaving(true); setError("");
    try {
      await milestonesRepo.upsert(selectedCampaignId, milestoneDraft);
      const updated = await milestonesRepo.getByArc(selectedCampaignId, id);
      setMilestones(updated); setMilestoneDraft(null);
    } catch (saveError) { setError(saveError?.message || "Unable to save this milestone. Your draft remains available."); }
    finally { setSaving(false); }
  }

  if (loading) return <main className="mx-auto max-w-5xl p-6"><p role="status" className="text-sm text-zinc-400">Loading Arc…</p></main>;
  if (!safeArc) return <main className="mx-auto max-w-5xl space-y-4 p-6"><Link to="/arcs" className="inline-flex items-center gap-2 text-sm text-zinc-300"><ArrowLeft size={16}/> Arcs</Link><div className="rounded-2xl border border-white/10 bg-white/5 p-8"><h1 className="text-xl font-semibold text-white">Arc not available</h1><p className="mt-2 text-sm text-zinc-400">{error || "This Arc may be hidden or unavailable in the current campaign."}</p>{error && <button type="button" onClick={() => { setLoading(true); setReloadKey((key) => key + 1); }} className="mt-4 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200">Retry</button>}</div></main>;

  return <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><Link to="/arcs" className="inline-flex min-h-10 items-center gap-2 text-sm text-zinc-300 hover:text-white"><ArrowLeft size={16}/> Arcs</Link>{isGM && !effectiveEditMode && <button type="button" onClick={startEdit} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-100 hover:bg-white/5">Edit Arc</button>}</div>
    <form onSubmit={saveArc} className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-7">
      {effectiveEditMode ? <div className="space-y-4"><label className="block text-sm text-zinc-300">Arc name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-2xl font-bold text-white" maxLength={160}/></label><label className="block text-sm text-zinc-300">Summary<textarea rows={4} value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm leading-6 text-white"/></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm text-zinc-300">Progress state<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-white">{statuses.map((status) => <option key={status}>{status}</option>)}</select></label><label className="text-sm text-zinc-300">Visibility<select value={draft.visibility} onChange={(event) => setDraft({ ...draft, visibility: event.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-white"><option value="gm-only">GM-only</option><option value="public">Player-visible</option></select></label></div><div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={cancelEdit} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300">Cancel</button><button disabled={saving} className="rounded-lg bg-purple-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save Arc"}</button></div></div> : <><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-300">Campaign Arc</p><h1 className="mt-2 break-words text-3xl font-bold text-white">{displayedArc?.name || "Untitled Arc"}</h1></div><span className="rounded-full border border-purple-300/20 bg-purple-300/10 px-3 py-1 text-xs text-purple-100">{displayedArc.status}</span></div><p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{displayedArc.summary || "No summary added yet."}</p>{isGM && <p className="mt-4 text-xs text-zinc-500">{arc.visibility === "public" ? "Player-visible" : "GM-only"}</p>}</>}
    </form>
    {error && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}

    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold text-white">Milestones</h2><p className="mt-1 text-sm text-zinc-400">Narrative markers you update as the story changes.</p></div>{isGM && !milestoneDraft && <button type="button" onClick={() => setMilestoneDraft(makeMilestone(id, milestones.length))} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/5"><Plus size={15}/> Add milestone</button>}</div>
      {safeMilestones.length === 0 && !milestoneDraft ? <p className="mt-4 rounded-xl border border-dashed border-white/10 p-5 text-sm text-zinc-500">No visible milestones yet.</p> : <div className="mt-4 space-y-3">{safeMilestones.map((milestone) => <article id={`milestone-${milestone.id}`} key={milestone.id} className="rounded-xl border border-white/10 bg-black/10 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-semibold text-white">{milestone.title || "Untitled milestone"}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-400">{milestone.description || "No details added."}</p></div><div className="flex items-center gap-2"><span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-300">{milestone.status}</span>{isGM && <button type="button" onClick={() => { setMilestoneDraft({ ...milestone }); setError(""); }} className="text-xs text-purple-200 hover:text-white">Edit</button>}</div></div>{isGM && <p className="mt-3 text-xs text-zinc-500">{milestone.visibility === "public" ? "Player-visible" : "GM-only"}</p>}<div className="mt-4"><SessionRelationships endpointType="Milestone" endpointId={milestone.id} sessions={safeSessions} links={safeLinks} isGM={isGM} editMode={effectiveEditMode} onLinks={setLinks}/></div></article>)}</div>}
      {milestoneDraft && isGM && <form onSubmit={saveMilestone} className="mt-4 space-y-3 rounded-xl border border-purple-300/20 bg-purple-300/[0.04] p-4"><h3 className="font-semibold text-white">{milestoneMap.has(milestoneDraft.id) ? "Edit milestone" : "New milestone"}</h3><label className="block text-sm text-zinc-300">Title<input autoFocus value={milestoneDraft.title} onChange={(event) => setMilestoneDraft({ ...milestoneDraft, title: event.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-white" maxLength={160}/></label><label className="block text-sm text-zinc-300">Details<textarea rows={3} value={milestoneDraft.description} onChange={(event) => setMilestoneDraft({ ...milestoneDraft, description: event.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-white"/></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm text-zinc-300">Progress state<select value={milestoneDraft.status} onChange={(event) => setMilestoneDraft({ ...milestoneDraft, status: event.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-white">{statuses.map((status) => <option key={status}>{status}</option>)}</select></label><label className="text-sm text-zinc-300">Visibility<select value={milestoneDraft.visibility} onChange={(event) => setMilestoneDraft({ ...milestoneDraft, visibility: event.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-white"><option value="gm-only">GM-only</option><option value="public">Player-visible</option></select></label></div><div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={() => setMilestoneDraft(null)} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300">Cancel</button><button disabled={saving} className="rounded-lg bg-purple-500 px-4 py-2 text-sm font-semibold text-white">{saving ? "Saving…" : "Save milestone"}</button></div></form>}
    </section>

    <SessionRelationships endpointType="Arc" endpointId={id} sessions={safeSessions} links={safeLinks} isGM={isGM} editMode={effectiveEditMode} onLinks={setLinks}/>
    <section className="space-y-3"><h2 className="text-xl font-semibold text-white">Related entities</h2>
      <EntityRelationshipSection endpointType="Arc" endpointId={id} entityType="NPC" title="NPCs" entities={safeEntities.NPC} links={safeLinks} labels={["involved", "antagonist", "ally"]} isGM={isGM} editMode={effectiveEditMode} onLinks={setLinks}/>
      <EntityRelationshipSection endpointType="Arc" endpointId={id} entityType="PC" title="Player characters" entities={safeEntities.PC} links={safeLinks} labels={["central_to", "affected_by"]} isGM={isGM} editMode={effectiveEditMode} onLinks={setLinks}/>
      <EntityRelationshipSection endpointType="Arc" endpointId={id} entityType="Item" title="Items" entities={safeEntities.Item} links={safeLinks} labels={["key_item"]} isGM={isGM} editMode={effectiveEditMode} onLinks={setLinks}/>
      <EntityRelationshipSection endpointType="Arc" endpointId={id} entityType="Map" title="Locations" entities={safeEntities.Map} links={safeLinks} labels={["set_in"]} isGM={isGM} editMode={effectiveEditMode} onLinks={setLinks}/>
      <EntityRelationshipSection endpointType="Arc" endpointId={id} entityType="Lore" title="Lore" entities={safeEntities.Lore} links={safeLinks} labels={["rooted_in"]} isGM={isGM} editMode={effectiveEditMode} onLinks={setLinks}/>
    </section>
    {safeMilestones.map((milestone) => <details key={`related-${milestone.id}`} className="rounded-xl border border-white/10 bg-white/[0.025] p-4"><summary className="cursor-pointer text-sm font-semibold text-zinc-200">Other relationships for {milestone.title || "milestone"}</summary><div className="mt-3 space-y-3">
      <EntityRelationshipSection endpointType="Milestone" endpointId={milestone.id} entityType="NPC" title="NPCs" entities={safeEntities.NPC} links={safeLinks} labels={["involved", "antagonist", "ally"]} isGM={isGM} editMode={effectiveEditMode} onLinks={setLinks}/>
      <EntityRelationshipSection endpointType="Milestone" endpointId={milestone.id} entityType="PC" title="Player characters" entities={safeEntities.PC} links={safeLinks} labels={["central_to", "affected_by"]} isGM={isGM} editMode={effectiveEditMode} onLinks={setLinks}/>
      <EntityRelationshipSection endpointType="Milestone" endpointId={milestone.id} entityType="Item" title="Items" entities={safeEntities.Item} links={safeLinks} labels={["key_item"]} isGM={isGM} editMode={effectiveEditMode} onLinks={setLinks}/>
      <EntityRelationshipSection endpointType="Milestone" endpointId={milestone.id} entityType="Map" title="Locations" entities={safeEntities.Map} links={safeLinks} labels={["set_in"]} isGM={isGM} editMode={effectiveEditMode} onLinks={setLinks}/>
      <EntityRelationshipSection endpointType="Milestone" endpointId={milestone.id} entityType="Lore" title="Lore" entities={safeEntities.Lore} links={safeLinks} labels={["rooted_in"]} isGM={isGM} editMode={effectiveEditMode} onLinks={setLinks}/>
    </div></details>)}
  </main>;
}
