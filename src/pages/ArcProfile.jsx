import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useCampaign } from "../context/CampaignContext";
import { useMode } from "../context/ModeContext.jsx";
import { arcsRepo } from "../data/arcs/arcs.repo";
import { sessionsRepo } from "../data/sessions/sessions.repo";
import { itemsRepo } from "../data/items/items.repo";
import { npcsRepo } from "../data/npcs/npcs.repo";
import { loreRepo } from "../data/lore/lore.repo";
import { locationsRepo } from "../data/maps/locations.repo";
import { questsRepo } from "../data/quests/quests.repo";
import { getAllCharacters } from "../data/characters/characters.repo";
import { loadLinks, saveLinkDraft } from "../data/links/links.repo";
import { createLink } from "../domain/links/link.service";
import ProgressTrack from "../components/ProgressTrack.jsx";
import { MarkdownContent } from "../components/MarkdownContent.jsx";

const statuses = ["active", "progressing", "waiting", "resolved"];
const arcTypes = [["character_arc", "Character arc"], ["main_story", "Main story"], ["supporting_arc", "Supporting arc"]];
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
const inputClass = "mt-1 w-full min-w-0 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white focus:border-purple-400/50 focus:outline-none";
const narrativeFields = [["plotHook", "Plot hook"], ["grimPortentsFrontiers", "Grim portents / frontiers"], ["arcStructure", "Arc structure"], ["climaxConditions", "Climax conditions"], ["resolutionFallout", "Resolution & fallout"]];

function titleOf(entity, key = "name") { return entity?.[key] || entity?.name || entity?.title || "Untitled"; }
function isAssignedToArc(link, arcId) {
  return link.label === "assigned_to" && (
    (link.entityA.type === "Arc" && String(link.entityA.id) === String(arcId)) ||
    (link.entityB.type === "Arc" && String(link.entityB.id) === String(arcId))
  );
}

function RelationshipSection({ type, title, labels, path, entities, links, endpointType = "Arc", endpointId, editMode, onChange, titleKey = "name", excludeLabels = [], disabled = false }) {
  const [selectedId, setSelectedId] = useState("");
  const [selectedLabel, setSelectedLabel] = useState(labels[0]);
  const endpoint = (link) => link.entityA.type === endpointType && String(link.entityA.id) === String(endpointId) ? link.entityB : link.entityA;
  const related = links.filter((link) => endpoint(link).type === type && !excludeLabels.includes(link.label) && entities.some((entity) => String(entity.id) === String(endpoint(link).id)));
  const entityById = new Map(entities.map((entity) => [String(entity.id), entity]));
  const hasRelationship = (entityId, label) => related.some((link) =>
    String(endpoint(link).id) === String(entityId) && link.label === label);
  if (!editMode && related.length === 0) return null;
  return <section className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5"><h3 className="text-base font-semibold text-white">{title}</h3>
    {related.length ? <ul className="mt-3 space-y-2">{related.map((link) => { const entity = entityById.get(String(endpoint(link).id)); return <li key={link.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/10 px-3 py-2"><Link to={`${path}/${entity.id}`} className="min-w-0 break-words text-sm text-purple-200 hover:text-white">{titleOf(entity, titleKey)}</Link><div className="flex flex-wrap items-center gap-2">{editMode ? <><select disabled={disabled} aria-label={`${title} relationship label`} value={link.label} onChange={(event) => onChange(links.map((candidate) => candidate.id === link.id ? { ...candidate, label: event.target.value } : candidate))} className="rounded-lg border border-white/10 bg-zinc-950 px-2 py-1 text-xs text-white disabled:opacity-50">{labels.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}</select><button type="button" disabled={disabled} onClick={() => onChange(links.filter((candidate) => candidate.id !== link.id))} className="min-h-8 text-xs text-rose-300 disabled:opacity-50">Remove</button></> : <span className="rounded-full border border-purple-300/15 bg-purple-300/10 px-2 py-1 text-[11px] text-purple-100">{link.label.replaceAll("_", " ")}</span>}</div></li>; })}</ul> : <p className="mt-3 text-sm text-zinc-500">No linked {title.toLowerCase()} yet.</p>}
    {editMode && <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_160px_auto]"><select disabled={disabled} aria-label={`${title} entity`} value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className={inputClass}><option value="">Choose {title.toLowerCase()}</option>{entities.filter((entity) => !hasRelationship(entity.id, selectedLabel)).map((entity) => <option key={entity.id} value={entity.id}>{titleOf(entity, titleKey)}</option>)}</select><select disabled={disabled} aria-label={`${title} new relationship label`} value={selectedLabel} onChange={(event) => setSelectedLabel(event.target.value)} className={inputClass}>{labels.map((label) => <option key={label} value={label}>{label.replaceAll("_", " ")}</option>)}</select><button type="button" disabled={disabled || !selectedId} onClick={() => { onChange([...links, createLink({ entityA: { type: endpointType, id: endpointId }, entityB: { type, id: selectedId }, label: selectedLabel, visibility: "GM" })]); setSelectedId(""); }} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 disabled:opacity-40">Add</button></div>}
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
      arcsRepo.getById(selectedCampaignId, id),
      npcsRepo.getAll(selectedCampaignId), getAllCharacters(selectedCampaignId), itemsRepo.getAll(selectedCampaignId),
      locationsRepo.getAll(selectedCampaignId), loreRepo.getAll(selectedCampaignId), questsRepo.all(selectedCampaignId),
      sessionsRepo.getAll(selectedCampaignId), loadLinks(selectedCampaignId),
    ]).then(([loadedArc, npcs, pcs, items, locations, lore, quests, sessions, loadedLinks]) => {
      if (!current) return;
      setArc(loadedArc); setDraft(loadedArc ? { ...emptyArc, ...loadedArc } : null);
      setEntities({ NPC: npcs || [], PC: pcs || [], Item: items || [], Map: locations || [], Lore: lore || [], Quest: quests?.quests || [], Session: sessions || [] });
      const selectedLinks = loadedLinks.filter((link) =>
        (link.entityA.type === "Arc" && String(link.entityA.id) === String(id)) ||
        (link.entityB.type === "Arc" && String(link.entityB.id) === String(id)));
      setLinks(selectedLinks); setOriginalLinks(selectedLinks);
    }).catch((loadError) => { if (current) setError(loadError?.message || "Unable to load this Arc. Check your connection and retry."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [selectedCampaignId, id, isGM, reloadKey]);

  const type = arcTypes.find(([value]) => value === arc?.type)?.[1] || "Main story";
  const isNarrative = arc?.type === "character_arc" || arc?.type === "main_story" || arc?.type === "supporting_arc";
  const effectiveEdit = isGM && editMode;
  const busy = saving || deleting;

  function startEdit() { setDraft({ ...emptyArc, ...arc }); setLinks([...originalLinks]); setEditMode(true); setError(""); }
  function cancelEdit() { if (busy) return; setDraft({ ...emptyArc, ...arc }); setLinks([...originalLinks]); setEditMode(false); setError(""); }

  async function saveArc(event) {
    event.preventDefault();
    if (!draft || !selectedCampaignId || saving) return;
    if (!draft.name.trim()) { setError("Enter an Arc title before saving."); return; }
    setSaving(true); setError("");
    try {
      const saved = await arcsRepo.upsert(selectedCampaignId, draft);
      const refreshed = await saveLinkDraft(selectedCampaignId, "Arc", id, links, originalLinks);
      const savedLinks = refreshed.filter((link) =>
        (link.entityA.type === "Arc" && String(link.entityA.id) === String(id)) ||
        (link.entityB.type === "Arc" && String(link.entityB.id) === String(id)));
      setArc(saved); setDraft({ ...emptyArc, ...saved }); setLinks(savedLinks); setOriginalLinks(savedLinks); setEditMode(false);
    } catch (saveError) { setError(`${saveError?.message || "Unable to save changes."} Your draft is retained. Profile and relationship saves are separate requests, so some relationship changes may already have saved; review and retry.`); }
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
    <div className="flex flex-wrap items-center justify-between gap-3"><Link to="/arcs" className="inline-flex min-h-10 items-center gap-2 text-sm text-zinc-300 hover:text-white"><ArrowLeft size={16}/> Arcs</Link><div className="flex flex-wrap gap-2">{effectiveEdit ? <><button type="button" disabled={busy} onClick={cancelEdit} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 disabled:opacity-50">Cancel</button><button form="arc-form" disabled={busy} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save changes"}</button></> : <><button type="button" disabled={busy} onClick={startEdit} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-100 hover:bg-white/5 disabled:opacity-50">Edit Arc</button><button type="button" disabled={busy} onClick={deleteArc} className="inline-flex items-center gap-2 rounded-lg border border-rose-400/20 px-4 py-2 text-sm text-rose-200 hover:bg-rose-500/10 disabled:opacity-50"><Trash2 size={15}/> {deleting ? "Deleting…" : "Delete Arc"}</button></>}</div></div>
    <form id="arc-form" onSubmit={saveArc} className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-7">
      {effectiveEdit ? <fieldset disabled={busy} className="space-y-4 disabled:opacity-60"><div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm text-zinc-300">Type<select value={draft.type} onChange={(event) => { const nextType = event.target.value; setDraft({ ...draft, type: nextType }); if (nextType !== "character_arc") setLinks(links.filter((link) => !isAssignedToArc(link, id))); }} className={inputClass}>{arcTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="block text-sm text-zinc-300">Status<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })} className={inputClass}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label></div><label className="block text-sm text-zinc-300">Arc title<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className={inputClass} maxLength={160}/></label><label className="block text-sm text-zinc-300">Summary<textarea rows={2} value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} className={inputClass}/></label><ProgressTrack value={draft.progress} onChange={(progress) => setDraft({ ...draft, progress })} label="Progress" ariaLabel="Arc progress"/>{draft.type === "character_arc" && <AssignedPc arc={arc} links={links} editMode characters={entities.PC} onLinks={setLinks}/>}</fieldset> : <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto]"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-300">{type} · {arc.status}</p><h1 className="mt-2 break-words text-3xl font-bold text-white">{arc.name || "Untitled Arc"}</h1><MarkdownContent content={arc.summary} placeholder="No summary added yet." className="mt-2"/>{arc.type === "character_arc" && <div className="mt-4"><AssignedPc arc={arc} links={links} editMode={false} characters={entities.PC} onLinks={setLinks}/></div>}</div><div className="w-full min-w-52 lg:w-72"><p className="mb-2 text-xs font-semibold uppercase text-zinc-400">Status</p><span className="rounded-full border border-purple-300/20 bg-purple-300/10 px-3 py-1 text-xs capitalize text-purple-100">{arc.status}</span></div><div className="lg:col-span-2"><ProgressTrack value={arc.progress} label="Progress" ariaLabel="Arc progress"/></div></div>}
      {effectiveEdit && <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 pt-4"><button type="button" disabled={busy} onClick={cancelEdit} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 disabled:opacity-50">Cancel</button><button disabled={busy} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save changes"}</button></div>}
    </form>
    {error && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}

    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
      {isNarrative && <section aria-label="Arc narrative" className="space-y-3">{narrativeFields.map(([field, label]) => <article key={field} className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5"><h2 className="font-semibold text-white">{label}</h2>{effectiveEdit ? <textarea disabled={busy} aria-label={label} rows={4} value={draft[field] || ""} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} className={`${inputClass} resize-y leading-6`}/> : <div className="mt-2 min-h-8"><MarkdownContent content={arc[field]} placeholder="Not added yet."/></div>}</article>)}</section>}
      <div className="min-w-0 space-y-3"><h2 className="text-xl font-semibold text-white">Connections</h2><p className="-mt-2 text-sm text-zinc-400">Campaign entities linked to this Arc</p>{entityConfig.map(([type, title, labels, path, titleKey]) => <RelationshipSection key={type} type={type} title={title} labels={labels} path={path} titleKey={titleKey} entities={entities[type] || []} links={links} endpointId={id} editMode={effectiveEdit} disabled={busy} onChange={setLinks} excludeLabels={type === "PC" ? ["assigned_to"] : []}/>)}</div>
    </div>

  </main>;
}
