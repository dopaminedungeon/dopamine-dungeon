import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useCampaign } from "../context/CampaignContext";
import { useMode } from "../context/ModeContext.jsx";
import { arcsRepo, milestonesRepo } from "../data/arcs/arcs.repo";
import { sessionsRepo } from "../data/sessions/sessions.repo";
import { itemsRepo } from "../data/items/items.repo";
import { npcsRepo } from "../data/npcs/npcs.repo";
import { loreRepo } from "../data/lore/lore.repo";
import { locationsRepo } from "../data/maps/locations.repo";
import { questsRepo } from "../data/quests/quests.repo";
import { getAllCharacters } from "../data/characters/characters.repo";
import { addLink, loadLinks, removeLink, updateLink } from "../data/links/links.repo";
import { createLink } from "../domain/links/link.service";
import ProgressTrack from "../components/ProgressTrack.jsx";

const statuses = ["active", "progressing", "waiting", "resolved"];
const arcTypes = [["character_arc", "Character arc"], ["main_story", "Main story"], ["supporting_arc", "Supporting arc"], ["milestone_progression", "Milestone progression"]];
const entityConfig = [
  ["NPC", "NPCs", ["involved", "antagonist", "ally"], "/npcs", "name"],
  ["Item", "Items", ["key_item"], "/items", "name"],
  ["Map", "Locations", ["set_in"], "/maps", "name"],
  ["Lore", "Lore", ["rooted_in"], "/lore", "title"],
  ["Quest", "Quests", ["advances", "belongs_to"], "/quests", "name"],
  ["PC", "Player characters", ["central_to", "affected_by"], "/pcs", "name"],
  ["Session", "Sessions", ["advanced", "pivoted"], "/sessions", "name"],
];
const emptyArc = { id: "", type: "main_story", name: "", summary: "", progress: 0, status: "active", visibility: "gm-only", plotHook: "", grimPortentsFrontiers: "", arcStructure: "", climaxConditions: "", resolutionFallout: "" };
const emptyMilestone = (arcId, position) => ({ id: crypto.randomUUID(), arcId, title: "", description: "", progress: 0, conditionsForLevelUp: "", intendedLevelProgression: "", status: "active", visibility: "gm-only", position });
const inputClass = "mt-1 w-full min-w-0 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white focus:border-purple-400/50 focus:outline-none";
const narrativeFields = [["plotHook", "Plot hook"], ["grimPortentsFrontiers", "Grim portents / frontiers"], ["arcStructure", "Arc structure"], ["climaxConditions", "Climax conditions"], ["resolutionFallout", "Resolution & fallout"]];

function titleOf(entity, key = "name") { return entity?.[key] || entity?.name || entity?.title || "Untitled"; }

function RelationshipSection({ type, title, labels, path, entities, links, endpointType = "Arc", endpointId, editMode, onChange, titleKey = "name", excludeLabels = [] }) {
  const [selectedId, setSelectedId] = useState("");
  const [selectedLabel, setSelectedLabel] = useState(labels[0]);
  const endpoint = (link) => link.entityA.type === endpointType && String(link.entityA.id) === String(endpointId) ? link.entityB : link.entityA;
  const related = links.filter((link) => endpoint(link).type === type && !excludeLabels.includes(link.label) && entities.some((entity) => String(entity.id) === String(endpoint(link).id)));
  const entityById = new Map(entities.map((entity) => [String(entity.id), entity]));
  const linkedIds = new Set(related.map((link) => String(endpoint(link).id)));
  if (!editMode && related.length === 0) return null;
  return <section className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5"><h3 className="text-base font-semibold text-white">{title}</h3>
    {related.length ? <ul className="mt-3 space-y-2">{related.map((link) => { const entity = entityById.get(String(endpoint(link).id)); return <li key={link.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/10 px-3 py-2"><Link to={`${path}/${entity.id}`} className="min-w-0 break-words text-sm text-purple-200 hover:text-white">{titleOf(entity, titleKey)}</Link><div className="flex flex-wrap items-center gap-2">{editMode ? <><select aria-label={`${title} relationship label`} value={link.label} onChange={(event) => onChange(links.map((candidate) => candidate.id === link.id ? { ...candidate, label: event.target.value } : candidate))} className="rounded-lg border border-white/10 bg-zinc-950 px-2 py-1 text-xs text-white">{labels.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}</select><button type="button" onClick={() => onChange(links.filter((candidate) => candidate.id !== link.id))} className="min-h-8 text-xs text-rose-300">Remove</button></> : <span className="rounded-full border border-purple-300/15 bg-purple-300/10 px-2 py-1 text-[11px] text-purple-100">{link.label.replaceAll("_", " ")}</span>}</div></li>; })}</ul> : <p className="mt-3 text-sm text-zinc-500">No linked {title.toLowerCase()} yet.</p>}
    {editMode && <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_160px_auto]"><select aria-label={`${title} entity`} value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className={inputClass}><option value="">Choose {title.toLowerCase()}</option>{entities.filter((entity) => !linkedIds.has(String(entity.id))).map((entity) => <option key={entity.id} value={entity.id}>{titleOf(entity, titleKey)}</option>)}</select><select aria-label={`${title} new relationship label`} value={selectedLabel} onChange={(event) => setSelectedLabel(event.target.value)} className={inputClass}>{labels.map((label) => <option key={label} value={label}>{label.replaceAll("_", " ")}</option>)}</select><button type="button" disabled={!selectedId} onClick={() => { onChange([...links, createLink({ entityA: { type: endpointType, id: endpointId }, entityB: { type, id: selectedId }, label: selectedLabel, visibility: "GM" })]); setSelectedId(""); }} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 disabled:opacity-40">Add</button></div>}
  </section>;
}

function AssignedPc({ arc, links, editMode, characters, onLinks }) {
  const assigned = links.find((link) => link.entityA.type === "Arc" && link.entityA.id === arc.id && link.entityB.type === "PC" && link.label === "assigned_to") ||
    links.find((link) => link.entityB.type === "Arc" && link.entityB.id === arc.id && link.entityA.type === "PC" && link.label === "assigned_to");
  const assignedId = assigned ? (assigned.entityA.type === "PC" ? assigned.entityA.id : assigned.entityB.id) : "";
  const pc = characters.find((character) => String(character.id) === String(assignedId));
  return <label className="block max-w-xl text-sm text-zinc-300">Assigned PC{editMode ? <select aria-label="Assigned PC" value={assignedId} onChange={(event) => {
    const without = links.filter((link) => !(link.label === "assigned_to" && ((link.entityA.type === "Arc" && link.entityA.id === arc.id) || (link.entityB.type === "Arc" && link.entityB.id === arc.id))));
    const next = event.target.value ? [...without, createLink({ entityA: { type: "Arc", id: arc.id }, entityB: { type: "PC", id: event.target.value }, label: "assigned_to", visibility: "GM" })] : without;
    onLinks(next);
  }} className={inputClass}><option value="">Unassigned</option>{characters.map((character) => <option key={character.id} value={character.id}>{titleOf(character)}</option>)}</select> : <span className="mt-1 block text-white">{pc ? titleOf(pc) : "Unassigned"}</span>}</label>;
}

export default function ArcProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { selectedCampaignId } = useCampaign();
  const { isGM } = useMode();
  const [arc, setArc] = useState(null);
  const [draft, setDraft] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [milestoneDraft, setMilestoneDraft] = useState(null);
  const [entities, setEntities] = useState({ NPC: [], PC: [], Item: [], Map: [], Lore: [], Quest: [], Session: [] });
  const [links, setLinks] = useState([]);
  const [originalLinks, setOriginalLinks] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let current = true;
    if (!isGM || !selectedCampaignId || !id) { setLoading(false); return () => { current = false; }; }
    setLoading(true); setError("");
    Promise.all([
      arcsRepo.getById(selectedCampaignId, id), milestonesRepo.getByArc(selectedCampaignId, id),
      npcsRepo.getAll(selectedCampaignId), getAllCharacters(selectedCampaignId), itemsRepo.getAll(selectedCampaignId),
      locationsRepo.getAll(selectedCampaignId), loreRepo.getAll(selectedCampaignId), questsRepo.all(selectedCampaignId),
      sessionsRepo.getAll(selectedCampaignId), loadLinks(selectedCampaignId),
    ]).then(([loadedArc, loadedMilestones, npcs, pcs, items, locations, lore, quests, sessions, loadedLinks]) => {
      if (!current) return;
      setArc(loadedArc); setDraft(loadedArc ? { ...emptyArc, ...loadedArc } : null);
      setMilestones(loadedMilestones); setEntities({ NPC: npcs || [], PC: pcs || [], Item: items || [], Map: locations || [], Lore: lore || [], Quest: quests?.quests || [], Session: sessions || [] });
      const milestoneIds = new Set(loadedMilestones.map((milestone) => String(milestone.id)));
      const selectedLinks = loadedLinks.filter((link) =>
        (link.entityA.type === "Arc" && String(link.entityA.id) === String(id)) || (link.entityB.type === "Arc" && String(link.entityB.id) === String(id)) ||
        (link.entityA.type === "Milestone" && milestoneIds.has(String(link.entityA.id))) || (link.entityB.type === "Milestone" && milestoneIds.has(String(link.entityB.id))));
      setLinks(selectedLinks); setOriginalLinks(selectedLinks);
    }).catch((loadError) => { if (current) setError(loadError?.message || "Unable to load this Arc. Check your connection and retry."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [selectedCampaignId, id, isGM, reloadKey]);

  const type = arcTypes.find(([value]) => value === arc?.type)?.[1] || "Main story";
  const isNarrative = arc?.type === "main_story" || arc?.type === "supporting_arc";
  const effectiveEdit = isGM && editMode;
  const milestoneIds = useMemo(() => new Set(milestones.map((item) => String(item.id))), [milestones]);

  function startEdit() { setDraft({ ...emptyArc, ...arc }); setLinks([...originalLinks]); setEditMode(true); setError(""); }
  function cancelEdit() { setDraft({ ...emptyArc, ...arc }); setLinks([...originalLinks]); setMilestoneDraft(null); setEditMode(false); setError(""); }

  async function saveArc(event) {
    event.preventDefault();
    if (!draft || !selectedCampaignId || saving) return;
    if (!draft.name.trim()) { setError("Enter an Arc title before saving."); return; }
    setSaving(true); setError("");
    try {
      const saved = await arcsRepo.upsert(selectedCampaignId, draft);
      const originals = new Map(originalLinks.map((link) => [link.id, link]));
      const next = new Map(links.map((link) => [link.id, link]));
      for (const oldLink of originalLinks) if (!next.has(oldLink.id)) await removeLink(oldLink.id, selectedCampaignId);
      for (const link of links) {
        const old = originals.get(link.id);
        if (!old) await addLink(link, selectedCampaignId);
        else if (old.label !== link.label || old.visibility !== link.visibility) await updateLink(link, selectedCampaignId);
      }
      setArc(saved); setDraft({ ...emptyArc, ...saved }); setOriginalLinks([...links]); setEditMode(false);
    } catch (saveError) { setError(`${saveError?.message || "Unable to save changes."} Your draft is retained. Profile and relationship saves are separate requests, so some relationship changes may already have saved; review and retry.`); }
    finally { setSaving(false); }
  }

  async function saveMilestone(event) {
    event.preventDefault();
    if (!milestoneDraft || !selectedCampaignId || saving) return;
    if (!milestoneDraft.title.trim()) { setError("Enter a milestone title before saving."); return; }
    setSaving(true); setError("");
    try {
      await milestonesRepo.upsert(selectedCampaignId, milestoneDraft);
      setMilestones(await milestonesRepo.getByArc(selectedCampaignId, id)); setMilestoneDraft(null);
    } catch (saveError) { setError(`${saveError?.message || "Unable to save this milestone."} The draft is retained; check your connection and retry.`); }
    finally { setSaving(false); }
  }

  async function deleteArc() {
    if (!window.confirm(`Delete ${arc.name || "this Arc"} and its milestones and relationships? Linked campaign entities will remain.`)) return;
    setDeleting(true); setError("");
    try { await arcsRepo.delete(selectedCampaignId, arc.id); navigate("/arcs", { replace: true }); }
    catch (deleteError) { setError(deleteError?.message || "Unable to delete this Arc. Its records were not removed; check your connection and retry."); setDeleting(false); }
  }

  if (!isGM) return null;
  if (loading) return <main className="mx-auto max-w-5xl p-6"><p role="status" className="text-sm text-zinc-400">Loading Arc…</p></main>;
  if (!arc) return <main className="mx-auto max-w-5xl space-y-4 p-6"><Link to="/arcs" className="inline-flex items-center gap-2 text-sm text-zinc-300"><ArrowLeft size={16}/> Arcs</Link><div className="rounded-2xl border border-white/10 bg-white/5 p-8"><h1 className="text-xl font-semibold text-white">Arc not available</h1><p className="mt-2 text-sm text-zinc-400">{error || "This Arc is unavailable in the selected campaign."}</p>{error && <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="mt-4 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200">Retry</button>}</div></main>;

  return <main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><Link to="/arcs" className="inline-flex min-h-10 items-center gap-2 text-sm text-zinc-300 hover:text-white"><ArrowLeft size={16}/> Arcs</Link><div className="flex flex-wrap gap-2">{effectiveEdit ? <><button type="button" disabled={saving} onClick={cancelEdit} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300">Cancel</button><button form="arc-form" disabled={saving} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white">{saving ? "Saving…" : "Save changes"}</button></> : <><button type="button" onClick={startEdit} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-100 hover:bg-white/5">Edit Arc</button><button type="button" disabled={deleting} onClick={deleteArc} className="inline-flex items-center gap-2 rounded-lg border border-rose-400/20 px-4 py-2 text-sm text-rose-200 hover:bg-rose-500/10"><Trash2 size={15}/> Delete Arc</button></>}</div></div>
    <form id="arc-form" onSubmit={saveArc} className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-7">
      {effectiveEdit ? <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm text-zinc-300">Type<select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })} className={inputClass}>{arcTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="block text-sm text-zinc-300">Status<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })} className={inputClass}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label></div><label className="block text-sm text-zinc-300">Arc title<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className={inputClass} maxLength={160}/></label><label className="block text-sm text-zinc-300">Summary<textarea rows={2} value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} className={inputClass}/></label><ProgressTrack value={draft.progress} onChange={(progress) => setDraft({ ...draft, progress })} label="Progress" ariaLabel="Arc progress"/>{draft.type === "character_arc" && <AssignedPc arc={arc} links={links} editMode characters={entities.PC} onLinks={setLinks}/>}</div> : <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto]"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-300">{type} · {arc.status}</p><h1 className="mt-2 break-words text-3xl font-bold text-white">{arc.name || "Untitled Arc"}</h1><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{arc.summary || "No summary added yet."}</p>{arc.type === "character_arc" && <div className="mt-4"><AssignedPc arc={arc} links={links} editMode={false} characters={entities.PC} onLinks={setLinks}/></div>}</div><div className="w-full min-w-52 lg:w-72"><p className="mb-2 text-xs font-semibold uppercase text-zinc-400">Status</p><span className="rounded-full border border-purple-300/20 bg-purple-300/10 px-3 py-1 text-xs capitalize text-purple-100">{arc.status}</span></div><div className="lg:col-span-2"><ProgressTrack value={arc.progress} label="Progress" ariaLabel="Arc progress"/></div></div>}
      {effectiveEdit && <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 pt-4"><button type="button" disabled={saving} onClick={cancelEdit} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300">Cancel</button><button disabled={saving} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white">{saving ? "Saving…" : "Save changes"}</button></div>}
    </form>
    {error && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}

    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
      {isNarrative && <section aria-label="Arc narrative" className="space-y-3">{narrativeFields.map(([field, label]) => <article key={field} className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5"><h2 className="font-semibold text-white">{label}</h2>{effectiveEdit ? <textarea aria-label={label} rows={4} value={draft[field] || ""} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} className={`${inputClass} resize-y leading-6`}/> : <p className="mt-2 min-h-8 whitespace-pre-wrap text-sm leading-6 text-zinc-400">{arc[field] || "Not added yet."}</p>}</article>)}</section>}
      <div className="min-w-0 space-y-3"><h2 className="text-xl font-semibold text-white">Connections</h2><p className="-mt-2 text-sm text-zinc-400">Campaign entities linked to this Arc</p>{entityConfig.map(([type, title, labels, path, titleKey]) => <RelationshipSection key={type} type={type} title={title} labels={labels} path={path} titleKey={titleKey} entities={entities[type] || []} links={links} endpointId={id} editMode={effectiveEdit} onChange={setLinks} excludeLabels={type === "PC" ? ["assigned_to"] : []}/>)}</div>
    </div>

    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold text-white">Milestones</h2><p className="mt-1 text-sm text-zinc-400">Narrative markers you update as the story changes.</p></div>{!milestoneDraft && <button type="button" onClick={() => { setMilestoneDraft(emptyMilestone(id, milestones.length)); setError(""); }} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/5"><Plus size={15}/> Add milestone</button>}</div>
      {milestones.length === 0 && !milestoneDraft ? <p className="mt-4 rounded-xl border border-dashed border-white/10 p-5 text-sm text-zinc-500">No milestones yet.</p> : <div className="mt-4 space-y-3">{milestones.map((milestone) => <article key={milestone.id} className="rounded-xl border border-white/10 bg-black/10 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><Link to={`/arcs/${id}/milestones/${milestone.id}`} className="font-semibold text-purple-100 hover:text-white">{milestone.title || "Untitled milestone"}</Link><p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm leading-6 text-zinc-400">{milestone.description || "No details added."}</p><div className="mt-3 max-w-md"><ProgressTrack value={milestone.progress} label="Progress" ariaLabel="Milestone progress"/></div></div><span className="rounded-full border border-white/10 px-2.5 py-1 text-xs capitalize text-zinc-300">{milestone.status}</span><button type="button" onClick={() => { setMilestoneDraft({ ...milestone }); setError(""); }} className="min-h-8 text-xs text-purple-200 hover:text-white">Edit</button></div><div className="mt-3"><RelationshipSection type="Session" title="Sessions" labels={["advanced", "reached", "mentioned"]} path="/sessions" entities={entities.Session} links={links} endpointType="Milestone" endpointId={milestone.id} editMode={effectiveEdit} onChange={setLinks}/></div></article>)}</div>}
      {milestoneDraft && <form onSubmit={saveMilestone} className="mt-4 space-y-3 rounded-xl border border-purple-300/20 bg-purple-300/[0.04] p-4"><h3 className="font-semibold text-white">{milestoneIds.has(String(milestoneDraft.id)) ? "Edit milestone" : "New milestone"}</h3><label className="block text-sm text-zinc-300">Title<input autoFocus value={milestoneDraft.title} onChange={(event) => setMilestoneDraft({ ...milestoneDraft, title: event.target.value })} className={inputClass} maxLength={160}/></label><label className="block text-sm text-zinc-300">Details<textarea rows={3} value={milestoneDraft.description} onChange={(event) => setMilestoneDraft({ ...milestoneDraft, description: event.target.value })} className={inputClass}/></label><ProgressTrack value={milestoneDraft.progress} onChange={(progress) => setMilestoneDraft({ ...milestoneDraft, progress })} label="Progress" ariaLabel="Milestone progress"/><label className="block text-sm text-zinc-300">Conditions for level up<textarea rows={5} value={milestoneDraft.conditionsForLevelUp} onChange={(event) => setMilestoneDraft({ ...milestoneDraft, conditionsForLevelUp: event.target.value })} className={inputClass}/></label><label className="block text-sm text-zinc-300">Intended level progression<input value={milestoneDraft.intendedLevelProgression} onChange={(event) => setMilestoneDraft({ ...milestoneDraft, intendedLevelProgression: event.target.value })} className={inputClass}/></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm text-zinc-300">Status<select value={milestoneDraft.status} onChange={(event) => setMilestoneDraft({ ...milestoneDraft, status: event.target.value })} className={inputClass}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label><label className="text-sm text-zinc-300">Visibility<select value={milestoneDraft.visibility} onChange={(event) => setMilestoneDraft({ ...milestoneDraft, visibility: event.target.value })} className={inputClass}><option value="gm-only">GM-only</option><option value="public">Player-visible</option></select></label></div><div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={() => { setMilestoneDraft(null); setError(""); }} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300">Cancel</button><button disabled={saving} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white">{saving ? "Saving…" : "Save milestone"}</button></div></form>}
    </section>
  </main>;
}
