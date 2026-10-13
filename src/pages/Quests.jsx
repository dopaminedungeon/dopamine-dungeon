import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Compass, Feather, Flag, PackageSearch, Plus, ScrollText, Search, Shield, Swords } from "lucide-react";
import { useCampaign } from "../context/CampaignContext";
import { useMode } from "../context/ModeContext.jsx";
import { MarkdownContent } from "../components/MarkdownContent.jsx";
import { QUEST_SECTIONS, QUEST_STATUSES, QUEST_TYPES } from "../domain/quests/quest.types";
import { questsRepo } from "../data/quests/quests.repo";
import { addLink, loadLinks, removeLink, updateLink } from "../data/links/links.repo";
import { createLink } from "../domain/links/link.service";

const ICONS = { fetch: PackageSearch, delivery: Flag, combat: Swords, investigation: Search,
  negotiation: Feather, survival: Shield, discovery: Compass };
const INPUT = "w-full min-w-0 rounded-xl border border-white/10 bg-zinc-950/60 px-3 py-2 text-sm text-white focus:border-violet-300 focus:outline-none";
const BUTTON = "rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-50";
const SECTION = "min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-4";
const NARRATIVE = [["shortDescription", "Short description"], ["hook", "The hook"], ["journey", "The journey"]];
const emptyRefs = { sessions: [], npcs: [], items: [], locations: [] };
const RELATED = [
  { type: "Session", key: "sessions", path: "/sessions", title: "Sessions", labels: ["related", "advanced", "progressed"] },
  { type: "NPC", key: "npcs", path: "/npcs", title: "NPCs", labels: ["target", "ally"] },
  { type: "Item", key: "items", path: "/items", title: "Items", labels: ["requires", "rewards", "unlocks"] },
  { type: "Map", key: "locations", path: "/maps", title: "Additional locations", labels: ["takes_place_in"] },
];
const managedLabels = new Set(["started", "completed", "failed", "given_by", "leads_to", "assigned_to"]);

function blankQuest(id) {
  return { id, name: "", type: QUEST_TYPES[0].id, status: "Planned", visibility: "gm-only", progress: 0,
    startSessionId: "", endSessionId: "", endDate: "", giverId: "", mainLocationId: "",
    shortDescription: "", hook: "", journey: "", aftermath: "",
    sectionVisibility: Object.fromEntries(QUEST_SECTIONS.map((key) => [key, "gm-only"])),
    mainObjectives: [], secondaryObjectives: [] };
}

function TypeIcon({ type, size = 20 }) {
  return React.createElement(ICONS[type] || ScrollText, { size, className: "shrink-0 text-violet-300", "aria-hidden": true });
}

function Progress({ value }) {
  return <div className="space-y-1" aria-label={`Quest progress ${value}%`}>
    <div className="flex justify-between text-xs text-zinc-400"><span>Progress</span><span>{value}%</span></div>
    <div className="h-2 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-linear-to-r from-purple-500 to-pink-400" style={{ width: `${value}%` }} /></div>
  </div>;
}

function Visibility({ value, onChange, ariaLabel = "Visibility" }) {
  return onChange ? <select aria-label={ariaLabel} className={INPUT} value={value} onChange={(event) => onChange(event.target.value)}>
    <option value="gm-only">GM-only</option><option value="public">Player-visible</option>
  </select> : <span className={`rounded-full border px-2 py-0.5 text-xs ${value === "public" ? "border-emerald-400/30 text-emerald-200" : "border-rose-400/30 text-rose-200"}`}>
    {value === "public" ? "Player-visible" : "GM-only"}</span>;
}

function RefLink({ id, rows, to }) {
  const row = rows.find((entry) => entry.id === id);
  return row ? <Link className="break-words text-violet-200 underline-offset-2 hover:underline" to={`${to}/${encodeURIComponent(id)}`}>{row.name}</Link> : null;
}

function QuestCard({ quest, refs, isGM }) {
  const ended = quest.status === "Completed" || quest.status === "Abandoned";
  return <article className="block min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-4 hover:border-violet-400/40">
    <div className="flex min-w-0 items-start gap-3"><TypeIcon type={quest.type} /><div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2"><h3 className="break-words font-semibold text-white"><Link className="hover:underline" to={`/quests/${encodeURIComponent(quest.id)}`}>{quest.name}</Link></h3>{isGM && <Visibility value={quest.visibility} />}</div>
      {quest.shortDescription && <p className="mt-2 line-clamp-3 break-words text-sm text-zinc-300">{quest.shortDescription}</p>}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
        {quest.startSessionId && <span>Start: <RefLink id={quest.startSessionId} rows={refs.sessions} to="/sessions" /></span>}
        {ended && quest.endSessionId && <span>End: <RefLink id={quest.endSessionId} rows={refs.sessions} to="/sessions" /></span>}
        {ended && quest.endDate && <span>Ended: {quest.endDate}</span>}
        {quest.giverId && <span>Giver: <RefLink id={quest.giverId} rows={refs.npcs} to="/npcs" /></span>}
        {quest.mainLocationId && <span>Destination: <RefLink id={quest.mainLocationId} rows={refs.locations} to="/maps" /></span>}
      </div><div className="mt-3"><Progress value={quest.progress} /></div>
    </div></div>
  </article>;
}

function ObjectiveList({ title, field, quest, editing, update, isGM }) {
  const entries = quest[field] || [];
  const main = field === "mainObjectives";
  if (!editing && entries.every((entry) => !entry.description)) return null;
  const shown = editing && main && entries.length === 0
    ? [{ id: "", type: QUEST_TYPES[0].id, description: "", visibility: "gm-only" }] : entries;
  const setEntry = (index, key, value) => {
    if (main && entries.length === 0) update(field, [{ id: crypto.randomUUID(), ...shown[0], [key]: value }]);
    else update(field, entries.map((entry, at) => at === index ? { ...entry, [key]: value } : entry));
  };
  const move = (index, direction) => { const next = [...entries]; const other = index + direction;
    if (other < 0 || other >= next.length) return;
    [next[index], next[other]] = [next[other], next[index]]; update(field, next); };
  return <section className={SECTION}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold text-white">{title}</h2>
      {editing && !main && <button type="button" className={BUTTON} onClick={() => update(field, [...entries,
        { id: crypto.randomUUID(), type: QUEST_TYPES[0].id, description: "", visibility: "gm-only" }])}>Add secondary objective</button>}
    </div>
    <div className="mt-3 space-y-3">{shown.map((entry, index) => <div key={entry.id || "main-empty"} className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3">
      {editing ? <div className="space-y-2">
        <label className="block text-xs text-zinc-400">Type<select className={INPUT} value={entry.type} onChange={(event) => setEntry(index, "type", event.target.value)}>{QUEST_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}</select></label>
        <label className="block text-xs text-zinc-400">Description<textarea className={INPUT} rows={3} value={entry.description} onChange={(event) => setEntry(index, "description", event.target.value)} /></label>
        <div className="flex flex-wrap items-center gap-2"><Visibility ariaLabel={`${main ? "Main" : "Secondary"} objective visibility ${index + 1}`} value={entry.visibility} onChange={(value) => setEntry(index, "visibility", value)} />
          {!main && <><button type="button" className={BUTTON} disabled={index === 0} onClick={() => move(index, -1)}>Move up</button>
            <button type="button" className={BUTTON} disabled={index === entries.length - 1} onClick={() => move(index, 1)}>Move down</button>
            <button type="button" className={BUTTON} onClick={() => update(field, entries.filter((_, at) => at !== index))}>Remove</button></>}</div>
      </div> : entry.description ? <><div className="flex flex-wrap items-center gap-2 text-sm text-zinc-300"><TypeIcon type={entry.type} size={16} /><span>{QUEST_TYPES.find((type) => type.id === entry.type)?.label}</span>{isGM && <Visibility value={entry.visibility} />}</div>
        <MarkdownContent content={entry.description} /></> : null}
    </div>)}</div>
  </section>;
}

function otherEndpoint(link, questId) {
  return link.entityA.type === "Quest" && link.entityA.id === questId ? link.entityB : link.entityA;
}

function QuestLinkSection({ group, questId, refs, links, mainLocationId, editing, isGM, saving, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [label, setLabel] = useState(group.labels[0]);
  const [visibility, setVisibility] = useState("Player");
  const entries = links.filter((link) => { const other = otherEndpoint(link, questId);
    return other.type === group.type && group.labels.includes(link.label) && refs[group.key].some((row) => row.id === other.id); });
  const available = refs[group.key].filter((row) => row.id !== (group.type === "Map" ? mainLocationId : "") &&
    row.name.toLowerCase().includes(query.toLowerCase()) && !links.some((link) => {
      const other = otherEndpoint(link, questId); return other.type === group.type && other.id === row.id;
    })).slice(0, 30);
  return <section className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-5">
    <div className="flex items-start justify-between gap-3"><h2 className="text-lg font-semibold text-white">{group.title}</h2>
      {editing && <button type="button" className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/10" disabled={saving} onClick={() => setOpen(!open)}>{open ? "Close" : `Add ${group.type === "Map" ? "Location" : group.type}`}</button>}</div>
    {editing && open && <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-black/10 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_160px_140px]">
        <input aria-label={`Search ${group.title.toLowerCase()}`} className={INPUT} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${group.title.toLowerCase()}...`} />
        <select aria-label="Relationship" className={INPUT} value={label} onChange={(event) => setLabel(event.target.value)}>{group.labels.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}</select>
        <select aria-label="Relationship visibility" className={INPUT} value={visibility} onChange={(event) => setVisibility(event.target.value)}><option value="Player">Player-visible</option><option value="GM">GM-only</option></select>
      </div>
      <div className="max-h-48 overflow-auto rounded-xl border border-white/10">{available.length ? available.map((row) => <button key={row.id} type="button" className="block w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/5" onClick={() => {
        onChange([...links, createLink({ entityA: { type: "Quest", id: questId }, entityB: { type: group.type, id: row.id }, label, visibility })]);
        setOpen(false); setQuery("");
      }}>{row.name}</button>) : <p className="px-3 py-2 text-sm text-zinc-500">No results.</p>}</div>
    </div>}
    {entries.length ? <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">{entries.map((link) => {
      const other = otherEndpoint(link, questId); const row = refs[group.key].find((entry) => entry.id === other.id);
      return <div key={link.id} className="group relative min-w-0 rounded-xl border border-white/10 bg-black/15 p-4">
        {editing && <button type="button" disabled={saving} onClick={() => onChange(links.filter((entry) => entry.id !== link.id))} className="absolute right-3 top-3 text-xs text-red-300 hover:text-red-200">Remove</button>}
        <Link to={`${group.path}/${encodeURIComponent(other.id)}`} className="block max-w-full break-words pr-12 text-sm font-semibold text-white hover:text-purple-200">{row?.name}</Link>
        <div className="mt-3 flex flex-wrap gap-2">{editing ? <><select aria-label={`Relationship for ${row?.name}`} className={INPUT} value={link.label} onChange={(event) => onChange(links.map((entry) => entry.id === link.id ? { ...entry, label: event.target.value } : entry))}>{group.labels.map((option) => <option key={option}>{option}</option>)}</select>
          <select aria-label={`Visibility for ${row?.name}`} className={INPUT} value={link.visibility} onChange={(event) => onChange(links.map((entry) => entry.id === link.id ? { ...entry, visibility: event.target.value } : entry))}><option value="Player">Player-visible</option><option value="GM">GM-only</option></select></>
          : <><span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-300">{link.label.replaceAll("_", " ")}</span>{isGM && <span className="text-xs text-zinc-400">{link.visibility === "Player" ? "Player-visible" : "GM-only"}</span>}</>}</div>
      </div>;
    })}</div> : <p className="mt-3 text-sm text-zinc-500">No linked {group.title.toLowerCase()} yet.</p>}
  </section>;
}

export default function Quests() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { selectedCampaignId } = useCampaign();
  const { isGM } = useMode();
  const [quests, setQuests] = useState([]);
  const [quest, setQuest] = useState(null);
  const [refs, setRefs] = useState(emptyRefs);
  const [draft, setDraft] = useState(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [visibilityFilter, setVisibilityFilter] = useState("All");
  const [showCreateModal, setShowCreateModal] = useState(id === "new");
  const [createDraft, setCreateDraft] = useState(() => blankQuest(crypto.randomUUID()));
  const [createError, setCreateError] = useState("");
  const createNameRef = useRef(null);
  const createButtonRef = useRef(null);
  const [links, setLinks] = useState([]);
  const [draftLinks, setDraftLinks] = useState([]);
  const [linkError, setLinkError] = useState("");
  const isNew = id === "new";
  const isList = !id || isNew;

  const closeCreate = useCallback(() => {
    if (savingRef.current) return;
    setShowCreateModal(false); setCreateError(""); setCreateDraft(blankQuest(crypto.randomUUID()));
    if (isNew) navigate("/quests", { replace: true });
    else createButtonRef.current?.focus();
  }, [isNew, navigate]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setEditing(false); setSaveError("");
    if (!selectedCampaignId) { setQuests([]); setQuest(null); setLoading(false); return; }
    const request = isList ? questsRepo.all(selectedCampaignId) : questsRepo.one(selectedCampaignId, id);
    request.then((result) => {
      if (!active) return;
      setRefs(result.references || emptyRefs);
      if (isList) setQuests(result.quests || []); else setQuest(result.quest);
    }).catch(() => { if (active) setError("Could not load quests. Please try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedCampaignId, id, isList, isGM]);

  useEffect(() => {
    let active = true;
    setLinks([]); setLinkError("");
    if (!isList && selectedCampaignId) loadLinks(selectedCampaignId).then((rows) => {
      if (active) setLinks(rows.filter((link) => (link.entityA.type === "Quest" && link.entityA.id === id) ||
        (link.entityB.type === "Quest" && link.entityB.id === id)));
    }).catch(() => { if (active) setLinkError("Could not load quest relationships. Please try again."); });
    return () => { active = false; };
  }, [id, isList, selectedCampaignId, isGM]);

  useEffect(() => {
    if (!showCreateModal) return;
    const previous = document.activeElement;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    createNameRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !savingRef.current) { event.preventDefault(); closeCreate(); }
      if (event.key !== "Tab") return;
      const dialog = document.querySelector('[role="dialog"][aria-label="Create a quest"]');
      const focusable = [...(dialog?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])') || [])];
      if (!focusable.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); document.body.style.overflow = priorOverflow; previous?.focus?.(); };
  }, [showCreateModal, closeCreate]);

  const filtered = useMemo(() => quests.filter((entry) => {
    const text = [entry.name, entry.shortDescription, entry.type].join(" ").toLowerCase();
    return text.includes(search.trim().toLowerCase()) && (statusFilter === "All" || entry.status === statusFilter) &&
      (typeFilter === "All" || entry.type === typeFilter) && (!isGM || visibilityFilter === "All" || entry.visibility === visibilityFilter);
  }), [quests, search, statusFilter, typeFilter, visibilityFilter, isGM]);
  const value = editing ? draft : quest;
  const update = (field, next) => setDraft((current) => ({ ...current, [field]: next }));
  const ended = value?.status === "Completed" || value?.status === "Abandoned";

  async function create(event) {
    event.preventDefault();
    if (savingRef.current || !selectedCampaignId) return;
    if (!createDraft.name.trim()) { setCreateError("Quest name is required."); return; }
    savingRef.current = true; setSaving(true); setCreateError("");
    try {
      const result = await questsRepo.save(selectedCampaignId, createDraft);
      setQuests((current) => [...current.filter((row) => row.id !== result.quest.id), result.quest]);
      setShowCreateModal(false); setCreateDraft(blankQuest(crypto.randomUUID()));
      if (isNew) navigate("/quests", { replace: true });
    } catch (failure) { setCreateError(failure?.message || "Could not create quest. Please try again."); }
    finally { savingRef.current = false; setSaving(false); }
  }

  async function applyDraftLinks(campaignId, questId, desired, original, mainLocationId) {
    const current = (await loadLinks(campaignId)).filter((link) =>
      ((link.entityA.type === "Quest" && link.entityA.id === questId) || (link.entityB.type === "Quest" && link.entityB.id === questId)) && !managedLabels.has(link.label));
    const wanted = desired.filter((link) => !(otherEndpoint(link, questId).type === "Map" && otherEndpoint(link, questId).id === mainLocationId));
    const desiredIds = new Set(wanted.map((link) => link.id));
    const originalIds = new Set(original.filter((link) => !managedLabels.has(link.label)).map((link) => link.id));
    const currentById = new Map(current.map((link) => [link.id, link]));
    for (const link of current) if (originalIds.has(link.id) && !desiredIds.has(link.id)) await removeLink(link.id, campaignId);
    for (const link of wanted) {
      const prior = currentById.get(link.id);
      if (!prior) await addLink(link, campaignId);
      else if (prior.label !== link.label || prior.visibility !== link.visibility) await updateLink(link, campaignId);
    }
  }

  async function save(event) {
    event.preventDefault();
    if (savingRef.current) return;
    if (!selectedCampaignId || !draft?.name.trim()) { setSaveError("Quest name is required."); return; }
    savingRef.current = true; setSaving(true); setSaveError("");
    try {
      const result = await questsRepo.save(selectedCampaignId, draft);
      try { await applyDraftLinks(selectedCampaignId, id, draftLinks, links, draft.mainLocationId); }
      catch (failure) { setSaveError(`Quest saved, but relationships could not be saved. Retry to finish. ${failure?.message || ""}`); return; }
      setQuest(result.quest); setDraft(null); setEditing(false);
      try { setLinks((await loadLinks(selectedCampaignId)).filter((link) =>
        (link.entityA.type === "Quest" && link.entityA.id === id) || (link.entityB.type === "Quest" && link.entityB.id === id))); }
      catch { setLinkError("Quest saved, but relationships could not refresh. Reload to try again."); }
    } catch (failure) { setSaveError(failure?.message || "Could not save quest. Please try again."); }
    finally { savingRef.current = false; setSaving(false); }
  }

  if (loading) return <main className="app-page-wide flex items-center justify-center" role="status">Loading quests...</main>;
  if (error) return <main className="app-page-wide space-y-3"><p role="alert" className="text-red-200">{error}</p><button className={BUTTON} onClick={() => window.location.reload()}>Retry</button></main>;
  if (isList) return <main className="app-page-wide flex-1 overflow-auto">
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:flex-wrap">
      <div className="relative w-full min-w-0 md:min-w-64 md:flex-[1_1_16rem]"><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
        <input aria-label="Search quests" className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-11 pr-3 text-white placeholder-zinc-500 transition-all focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 sm:py-3 sm:pl-12 sm:pr-4" placeholder="Search quests..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      <div className="flex gap-2 overflow-x-auto whitespace-nowrap pr-1 [-webkit-overflow-scrolling:touch]">{["All", ...QUEST_STATUSES].map((status) => <button key={status} type="button" onClick={() => setStatusFilter(status)} className={`shrink-0 rounded-xl px-3 py-2.5 font-medium transition-all sm:px-4 sm:py-3 ${statusFilter === status ? "bg-emerald-500 text-white" : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"}`}>{status}</button>)}</div>
      <select aria-label="Filter quest type" className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-medium text-zinc-200 focus:border-emerald-500/50 focus:outline-none sm:py-3 md:w-auto" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="All">All types</option>{QUEST_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}</select>
      {isGM && <select aria-label="Filter quest visibility" className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-medium text-zinc-200 focus:border-emerald-500/50 focus:outline-none sm:py-3 md:w-auto" value={visibilityFilter} onChange={(event) => setVisibilityFilter(event.target.value)}><option value="All">All visibility</option><option value="public">Player-visible</option><option value="gm-only">GM-only</option></select>}
      {isGM && <button ref={createButtonRef} type="button" className="flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-indigo-500 to-purple-500 px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90 sm:px-6 sm:py-3 md:w-auto" onClick={() => { setCreateDraft(blankQuest(crypto.randomUUID())); setShowCreateModal(true); }}><Plus className="h-5 w-5" />Add new</button>}
    </div>
    {quests.length === 0 ? <p className="rounded-2xl border border-white/10 p-5 text-zinc-300">No quests yet.</p> : filtered.length === 0 ? <p className="rounded-2xl border border-white/10 p-5 text-zinc-300">No quests match these filters.</p> :
      QUEST_STATUSES.map((status) => { const rows = filtered.filter((entry) => entry.status === status); return rows.length ? <section key={status} className="mb-6 space-y-3"><h2 className="text-lg font-semibold text-white">{status}</h2><div className="grid gap-3 lg:grid-cols-2">{rows.map((entry) => <QuestCard key={entry.id} quest={entry} refs={refs} isGM={isGM} />)}</div></section> : null; })}
    {showCreateModal && isGM && createPortal(<div data-testid="quest-modal-backdrop" className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-6 pb-28 backdrop-blur-sm sm:items-center sm:pb-6" onMouseDown={(event) => { if (event.target === event.currentTarget) closeCreate(); }}>
      <div role="dialog" aria-modal="true" aria-label="Create a quest" className="my-auto max-h-[85vh] w-[92vw] max-w-xl overflow-y-auto rounded-xl border border-white/10 bg-zinc-950 p-4 sm:rounded-2xl sm:p-6">
        <h2 className="mb-4 text-lg font-bold text-white sm:text-xl">Create a quest</h2>
        <form onSubmit={create} className="space-y-4"><fieldset disabled={saving} className="space-y-4 disabled:opacity-60">
          <label className="block text-sm text-zinc-400">Quest name<input ref={createNameRef} required className={INPUT} value={createDraft.name} onChange={(event) => setCreateDraft({ ...createDraft, name: event.target.value })} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-zinc-400">Quest type<select className={INPUT} value={createDraft.type} onChange={(event) => setCreateDraft({ ...createDraft, type: event.target.value })}>{QUEST_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}</select></label>
            <label className="block text-sm text-zinc-400">Status<select className={INPUT} value={createDraft.status} onChange={(event) => setCreateDraft({ ...createDraft, status: event.target.value })}>{QUEST_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
            <label className="block text-sm text-zinc-400">Overall visibility<Visibility ariaLabel="Overall visibility" value={createDraft.visibility} onChange={(visibility) => setCreateDraft({ ...createDraft, visibility })} /></label>
            <label className="block text-sm text-zinc-400">Start session<select className={INPUT} value={createDraft.startSessionId} onChange={(event) => setCreateDraft({ ...createDraft, startSessionId: event.target.value })}><option value="">Not set</option>{refs.sessions.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
            {(createDraft.status === "Completed" || createDraft.status === "Abandoned") && <><label className="block text-sm text-zinc-400">End session<select className={INPUT} value={createDraft.endSessionId} onChange={(event) => setCreateDraft({ ...createDraft, endSessionId: event.target.value })}><option value="">Not set</option>{refs.sessions.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><label className="block text-sm text-zinc-400">End date<input type="date" className={INPUT} value={createDraft.endDate} onChange={(event) => setCreateDraft({ ...createDraft, endDate: event.target.value })} /></label></>}
            <label className="block text-sm text-zinc-400">Quest giver<select className={INPUT} value={createDraft.giverId} onChange={(event) => setCreateDraft({ ...createDraft, giverId: event.target.value })}><option value="">Not set</option>{refs.npcs.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
          </div>
          <label className="block text-sm text-zinc-400">Short description<textarea className={INPUT} rows={3} value={createDraft.shortDescription} onChange={(event) => setCreateDraft({ ...createDraft, shortDescription: event.target.value })} /></label>
          {createError && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{createError}</p>}
          <div className="grid grid-cols-1 gap-2 pt-2 sm:flex sm:justify-end sm:gap-3"><button type="button" className={BUTTON} onClick={closeCreate}>Cancel</button><button type="submit" className="rounded-xl bg-linear-to-r from-purple-500 to-indigo-500 px-4 py-2 font-medium text-white disabled:opacity-50">{saving ? "Saving..." : "Save quest"}</button></div>
        </fieldset></form>
      </div>
    </div>, document.body)}
  </main>;

  if (!value) return <main className="app-page-wide text-zinc-300">Quest not found.</main>;
  const visibleLinks = (editing ? draftLinks : links).filter((link) => !managedLabels.has(link.label));
  return <main className="app-page-wide min-w-0 space-y-5">
    <Link className="inline-flex items-center gap-2 text-sm text-violet-200" to="/quests"><ArrowLeft size={16} /> Quests</Link>
    <form onSubmit={save} className="min-w-0 space-y-5"><fieldset disabled={saving} className="min-w-0 space-y-5 disabled:opacity-60">
      <header className={SECTION}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><TypeIcon type={value.type} size={26} />
          {editing ? <label className="min-w-0 text-xs text-zinc-400">Quest name<input className={INPUT} value={value.name} onChange={(event) => update("name", event.target.value)} /></label> : <h1 className="break-words text-2xl font-bold text-white">{value.name}</h1>}</div>
          {!editing && isGM && <button type="button" className={BUTTON} onClick={() => { setDraft(structuredClone(quest)); setDraftLinks(links.filter((link) => !managedLabels.has(link.label))); setEditing(true); }}>Edit</button>}
          {!editing && isGM && <Visibility value={value.visibility} />}</div>
        {editing ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs text-zinc-400">Quest type<select className={INPUT} value={value.type} onChange={(event) => update("type", event.target.value)}>{QUEST_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}</select></label>
          <label className="text-xs text-zinc-400">Status<select className={INPUT} value={value.status} onChange={(event) => update("status", event.target.value)}>{QUEST_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label className="text-xs text-zinc-400">Overall visibility<Visibility ariaLabel="Overall visibility" value={value.visibility} onChange={(next) => update("visibility", next)} /></label>
          <label className="text-xs text-zinc-400">Start session<select className={INPUT} value={value.startSessionId} onChange={(event) => update("startSessionId", event.target.value)}><option value="">Not set</option>{refs.sessions.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
          {ended && <><label className="text-xs text-zinc-400">End session<select className={INPUT} value={value.endSessionId} onChange={(event) => update("endSessionId", event.target.value)}><option value="">Not set</option>{refs.sessions.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><label className="text-xs text-zinc-400">End date<input type="date" className={INPUT} value={value.endDate} onChange={(event) => update("endDate", event.target.value)} /></label></>}
          <label className="text-xs text-zinc-400">Quest giver<select className={INPUT} value={value.giverId} onChange={(event) => update("giverId", event.target.value)}><option value="">Not set</option>{refs.npcs.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
          <label className="text-xs text-zinc-400">Main location<select className={INPUT} value={value.mainLocationId || ""} onChange={(event) => update("mainLocationId", event.target.value)}><option value="">No location</option>{refs.locations.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
        </div> : <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-300">
          {value.startSessionId && <span>Start: <RefLink id={value.startSessionId} rows={refs.sessions} to="/sessions" /></span>}
          {ended && value.endSessionId && <span>End: <RefLink id={value.endSessionId} rows={refs.sessions} to="/sessions" /></span>}
          {ended && value.endDate && <span>Ended: {value.endDate}</span>}
          {value.giverId && <span>Giver: <RefLink id={value.giverId} rows={refs.npcs} to="/npcs" /></span>}
          {value.mainLocationId && <span>Destination: <RefLink id={value.mainLocationId} rows={refs.locations} to="/maps" /></span>}
        </div>}
        <div className="mt-4"><Progress value={value.progress} />{editing && <label className="mt-2 block text-xs text-zinc-400">Set progress<input aria-label="Set progress" type="range" min="0" max="100" value={value.progress} onChange={(event) => update("progress", Number(event.target.value))} className="w-full accent-violet-500" /></label>}</div>
      </header>
      <div className="grid min-w-0 gap-5 lg:grid-cols-2"><div className="min-w-0 space-y-4">{NARRATIVE.map(([field, title]) =>
        editing || value[field] ? <section key={field} className={SECTION}><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold text-white">{title}</h2>{!editing && isGM && field !== "shortDescription" && <Visibility value={value.sectionVisibility[field]} />}</div>
          {editing ? <div className="mt-3 space-y-2">{field !== "shortDescription" && <Visibility ariaLabel={`${title} visibility`} value={value.sectionVisibility[field]} onChange={(next) => update("sectionVisibility", { ...value.sectionVisibility, [field]: next })} />}<textarea aria-label={title} className={INPUT} rows={field === "shortDescription" ? 3 : 6} value={value[field]} onChange={(event) => update(field, event.target.value)} /></div> : <MarkdownContent content={value[field]} />}</section> : null
      )}</div><div className="min-w-0 space-y-4"><ObjectiveList title="Main objective" field="mainObjectives" quest={value} editing={editing} update={update} isGM={isGM} /><ObjectiveList title="Secondary / bonus objectives" field="secondaryObjectives" quest={value} editing={editing} update={update} isGM={isGM} /></div></div>
      {(editing || value.aftermath) && <section className={SECTION}><h2 className="font-semibold text-white">Aftermath</h2>{editing ? <div className="mt-3 space-y-2"><Visibility ariaLabel="Aftermath visibility" value={value.sectionVisibility.aftermath} onChange={(next) => update("sectionVisibility", { ...value.sectionVisibility, aftermath: next })} /><textarea aria-label="Aftermath" className={INPUT} rows={5} value={value.aftermath} onChange={(event) => update("aftermath", event.target.value)} /></div> : <MarkdownContent content={value.aftermath} />}</section>}
      <div className="space-y-4">{RELATED.map((group) => <QuestLinkSection key={group.type} group={group} questId={id} refs={refs} links={visibleLinks} mainLocationId={value.mainLocationId} editing={editing} isGM={isGM} saving={saving} onChange={setDraftLinks} />)}</div>
      {linkError && <p role="alert" className="text-sm text-red-200">{linkError}</p>}
      {editing && <div className="space-y-3">{saveError && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{saveError}</p>}
        <div className="flex flex-wrap gap-2"><button className={BUTTON} type="submit">{saving ? "Saving..." : "Save quest"}</button><button className={BUTTON} type="button" onClick={() => { setDraft(null); setDraftLinks([]); setEditing(false); setSaveError(""); }}>Cancel</button></div></div>}
    </fieldset></form>
  </main>;
}
