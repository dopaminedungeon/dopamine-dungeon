import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Compass, Feather, Flag, PackageSearch, ScrollText, Search, Shield, Swords } from "lucide-react";
import { useCampaign } from "../context/CampaignContext";
import { useMode } from "../context/ModeContext.jsx";
import { MarkdownContent } from "../components/MarkdownContent.jsx";
import { QUEST_SECTIONS, QUEST_STATUSES, QUEST_TYPES } from "../domain/quests/quest.types";
import { questsRepo } from "../data/quests/quests.repo";
import { addLink, getAllLinks, loadLinks, removeLink } from "../data/links/links.repo";
import { createLink } from "../domain/links/link.service";
import { getAllowedLabelsForPair } from "../domain/links/link.rules";

const ICONS = { fetch: PackageSearch, delivery: Flag, combat: Swords, investigation: Search,
  negotiation: Feather, survival: Shield, discovery: Compass };
const INPUT = "w-full min-w-0 rounded-xl border border-white/10 bg-zinc-950/60 px-3 py-2 text-sm text-white focus:border-violet-300 focus:outline-none";
const BUTTON = "rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-50";
const SECTIONS = [["shortDescription", "Short description"], ["hook", "The hook"], ["journey", "The journey"], ["aftermath", "Aftermath"]];
const emptyRefs = { sessions: [], npcs: [], characters: [] };
const RELATED = [{ type: "Session", key: "sessions", path: "/sessions" }, { type: "NPC", key: "npcs", path: "/npcs" },
  { type: "PC", key: "characters", path: "/pcs" }, { type: "Item", key: "items", path: "/items" }, { type: "Map", key: "locations", path: "/maps" }];

function blankQuest(id) {
  return { id, name: "", type: QUEST_TYPES[0].id, status: "Planned", visibility: "gm-only", progress: 0,
    startSessionId: "", endSessionId: "", endDate: "", giverId: "", receiverIds: [],
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
  return onChange ? <select aria-label={ariaLabel} className={INPUT} value={value} onChange={(e) => onChange(e.target.value)}>
    <option value="gm-only">GM-only</option><option value="public">Player-visible</option>
  </select> : <span className={`rounded-full border px-2 py-0.5 text-xs ${value === "public" ? "border-emerald-400/30 text-emerald-200" : "border-rose-400/30 text-rose-200"}`}>
    {value === "public" ? "Player-visible" : "GM-only"}</span>;
}

function RefLink({ id, rows, to, prefix = "" }) {
  const row = rows.find((entry) => entry.id === id);
  return row ? <Link className="break-words text-violet-200 underline-offset-2 hover:underline" to={`${to}/${encodeURIComponent(id)}`}>
    {prefix}{row.name}</Link> : null;
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
      </div><div className="mt-3"><Progress value={quest.progress} /></div>
    </div></div>
  </article>;
}

function ObjectiveList({ title, field, quest, editing, update, isGM }) {
  const entries = quest[field] || [];
  if (!editing && entries.length === 0) return null;
  const setEntry = (index, key, value) => update(field, entries.map((entry, at) => at === index ? { ...entry, [key]: value } : entry));
  const move = (index, direction) => { const next = [...entries]; const other = index + direction;
    if (other < 0 || other >= next.length) return;
    [next[index], next[other]] = [next[other], next[index]]; update(field, next); };
  return <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold text-white">{title}</h2>
      {editing && <button type="button" className={BUTTON} onClick={() => update(field, [...entries, { id: crypto.randomUUID(), type: QUEST_TYPES[0].id,
        description: "", visibility: "gm-only" }])}>Add objective</button>}
    </div>
    {editing && <div className="mt-3"><Visibility value={quest.sectionVisibility[field]} onChange={(value) => update("sectionVisibility", { ...quest.sectionVisibility, [field]: value })} /></div>}
    <div className="mt-3 space-y-3">{entries.map((entry, index) => <div key={entry.id} className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3">
      {editing ? <div className="space-y-2">
        <label className="block text-xs text-zinc-400">Type<select className={INPUT} value={entry.type} onChange={(e) => setEntry(index, "type", e.target.value)}>{QUEST_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}</select></label>
        <label className="block text-xs text-zinc-400">Description<textarea className={INPUT} rows={3} value={entry.description} onChange={(e) => setEntry(index, "description", e.target.value)} /></label>
        <div className="flex flex-wrap items-center gap-2"><Visibility value={entry.visibility} onChange={(value) => setEntry(index, "visibility", value)} />
          <button type="button" className={BUTTON} disabled={index === 0} onClick={() => move(index, -1)}>Move up</button>
          <button type="button" className={BUTTON} disabled={index === entries.length - 1} onClick={() => move(index, 1)}>Move down</button>
          <button type="button" className={BUTTON} onClick={() => update(field, entries.filter((_, at) => at !== index))}>Remove</button></div>
      </div> : <><div className="flex flex-wrap items-center gap-2 text-sm text-zinc-300"><TypeIcon type={entry.type} size={16} /><span>{QUEST_TYPES.find((type) => type.id === entry.type)?.label}</span>{isGM && <Visibility value={entry.visibility} />}</div>
        {entry.description && <MarkdownContent content={entry.description} />}</>}
    </div>)}</div>
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
  const [links, setLinks] = useState([]);
  const [linkType, setLinkType] = useState("Item");
  const [linkId, setLinkId] = useState("");
  const [linkLabel, setLinkLabel] = useState("requires");
  const [linkVisibility, setLinkVisibility] = useState("GM");
  const [linkError, setLinkError] = useState("");
  const [linkSaving, setLinkSaving] = useState(false);
  const linkSavingRef = useRef(false);
  const isNew = id === "new";

  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setEditing(false); setSaveError("");
    if (!selectedCampaignId) { setQuests([]); setQuest(null); setLoading(false); return; }
    const request = id && !isNew ? questsRepo.one(selectedCampaignId, id) : questsRepo.all(selectedCampaignId);
    request.then((result) => {
      if (!active) return;
      setRefs(result.references || emptyRefs);
      if (id && !isNew) setQuest(result.quest);
      else { setQuests(result.quests || []); setQuest(null); }
      if (isNew) { setDraft(blankQuest(crypto.randomUUID())); setEditing(true); }
    }).catch(() => { if (active) setError("Could not load quests. Please try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedCampaignId, id, isNew, isGM]);

  useEffect(() => {
    let active = true;
    setLinks([]); setLinkError("");
    if (id && !isNew && selectedCampaignId) loadLinks(selectedCampaignId).then((rows) => {
      if (active) setLinks(rows.filter((link) => (link.entityA.type === "Quest" && link.entityA.id === id) ||
        (link.entityB.type === "Quest" && link.entityB.id === id)));
    }).catch(() => { if (active) setLinkError("Could not load quest relationships. Please try again."); });
    return () => { active = false; };
  }, [id, isNew, selectedCampaignId, isGM]);

  const filtered = useMemo(() => quests.filter((entry) => {
    const text = [entry.name, entry.shortDescription, entry.type].join(" ").toLowerCase();
    return text.includes(search.trim().toLowerCase()) && (statusFilter === "All" || entry.status === statusFilter) &&
      (typeFilter === "All" || entry.type === typeFilter) && (!isGM || visibilityFilter === "All" || entry.visibility === visibilityFilter);
  }), [quests, search, statusFilter, typeFilter, visibilityFilter, isGM]);
  const value = editing ? draft : quest;
  const update = (field, next) => setDraft((current) => ({ ...current, [field]: next }));
  const ended = value?.status === "Completed" || value?.status === "Abandoned";
  const related = RELATED.find((entry) => entry.type === linkType);
  const availableLabels = getAllowedLabelsForPair("Quest", linkType).filter((label) => !["started", "completed", "failed", "given_by", "assigned_to"].includes(label));

  async function addRelationship() {
    if (!selectedCampaignId || !id || !linkId || linkSavingRef.current) return;
    linkSavingRef.current = true; setLinkSaving(true); setLinkError("");
    try {
      await addLink(createLink({ entityA: { type: "Quest", id }, entityB: { type: linkType, id: linkId },
        label: linkLabel, visibility: linkVisibility }), selectedCampaignId);
      setLinks(getAllLinks().filter((link) => (link.entityA.type === "Quest" && link.entityA.id === id) ||
        (link.entityB.type === "Quest" && link.entityB.id === id)));
      setLinkId("");
    } catch (failure) { setLinkError(failure?.message || "Could not save relationship. Please try again."); }
    finally { linkSavingRef.current = false; setLinkSaving(false); }
  }

  async function deleteRelationship(linkIdToRemove) {
    if (!selectedCampaignId || linkSavingRef.current) return;
    linkSavingRef.current = true; setLinkSaving(true); setLinkError("");
    try { await removeLink(linkIdToRemove, selectedCampaignId); setLinks((current) => current.filter((link) => link.id !== linkIdToRemove)); }
    catch { setLinkError("Could not remove relationship. Please try again."); }
    finally { linkSavingRef.current = false; setLinkSaving(false); }
  }

  async function save(event) {
    event.preventDefault();
    if (!selectedCampaignId || savingRef.current || !draft?.name.trim()) { setSaveError("Quest name is required."); return; }
    savingRef.current = true; setSaving(true); setSaveError("");
    try {
      const result = await questsRepo.save(selectedCampaignId, draft);
      setQuest(result.quest); setDraft(null); setEditing(false);
      if (!isNew && id) void loadLinks(selectedCampaignId).then((rows) => setLinks(rows.filter((link) =>
        (link.entityA.type === "Quest" && link.entityA.id === id) || (link.entityB.type === "Quest" && link.entityB.id === id))))
        .catch(() => setLinkError("Quest saved, but relationships could not refresh. Reload to try again."));
      if (isNew) navigate(`/quests/${encodeURIComponent(result.quest.id)}`, { replace: true });
    } catch (saveFailure) { setSaveError(saveFailure?.message || "Could not save quest. Please try again."); }
    finally { savingRef.current = false; setSaving(false); }
  }

  if (loading) return <main className="p-6 text-zinc-300" role="status">Loading quests...</main>;
  if (error) return <main className="space-y-3 p-6"><p role="alert" className="text-red-200">{error}</p><button className={BUTTON} onClick={() => window.location.reload()}>Retry</button></main>;
  if (!id) return <main className="mx-auto w-full max-w-6xl min-w-0 space-y-6 p-4 sm:p-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-white">Quests</h1><p className="text-sm text-zinc-400">Campaign objectives and narrative threads</p></div>
      {isGM && <Link className={BUTTON} to="/quests/new">Create quest</Link>}</header>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-xs text-zinc-400">Search<input className={INPUT} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search visible quests" /></label>
      <label className="text-xs text-zinc-400">Status<select className={INPUT} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option>All</option>{QUEST_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
      <label className="text-xs text-zinc-400">Type<select className={INPUT} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option>All</option>{QUEST_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}</select></label>
      {isGM && <label className="text-xs text-zinc-400">Visibility<select className={INPUT} value={visibilityFilter} onChange={(e) => setVisibilityFilter(e.target.value)}><option>All</option><option value="public">Player-visible</option><option value="gm-only">GM-only</option></select></label>}</div>
    {quests.length === 0 ? <p className="rounded-2xl border border-white/10 p-5 text-zinc-300">No quests yet.</p> : filtered.length === 0 ? <p className="rounded-2xl border border-white/10 p-5 text-zinc-300">No quests match these filters.</p> :
      QUEST_STATUSES.map((status) => { const rows = filtered.filter((entry) => entry.status === status); return rows.length ? <section key={status} className="space-y-3"><h2 className="text-lg font-semibold text-white">{status}</h2><div className="grid gap-3 lg:grid-cols-2">{rows.map((entry) => <QuestCard key={entry.id} quest={entry} refs={refs} isGM={isGM} />)}</div></section> : null; })}
  </main>;

  if (!value) return <main className="p-6 text-zinc-300">{isNew ? "Preparing quest..." : "Quest not found."}</main>;
  return <main className="mx-auto w-full max-w-6xl min-w-0 space-y-5 p-4 sm:p-6">
    <Link className="inline-flex items-center gap-2 text-sm text-violet-200" to="/quests"><ArrowLeft size={16} /> Quests</Link>
    <form onSubmit={save} className="min-w-0 space-y-5">
      <header className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><TypeIcon type={value.type} size={26} />
          {editing ? <label className="min-w-0 text-xs text-zinc-400">Quest name<input className={INPUT} value={value.name} onChange={(e) => update("name", e.target.value)} /></label> : <h1 className="break-words text-2xl font-bold text-white">{value.name}</h1>}</div>
          {!editing && isGM && <button type="button" className={BUTTON} onClick={() => { setDraft(structuredClone(quest)); setEditing(true); }}>Edit</button>}
          {!editing && isGM && <Visibility value={value.visibility} />}</div>
        {editing ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs text-zinc-400">Quest type<select className={INPUT} value={value.type} onChange={(e) => update("type", e.target.value)}>{QUEST_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}</select></label>
          <label className="text-xs text-zinc-400">Status<select className={INPUT} value={value.status} onChange={(e) => update("status", e.target.value)}>{QUEST_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label className="text-xs text-zinc-400">Overall visibility<Visibility ariaLabel="Overall visibility" value={value.visibility} onChange={(next) => update("visibility", next)} /></label>
          <label className="text-xs text-zinc-400">Start session<select className={INPUT} value={value.startSessionId} onChange={(e) => update("startSessionId", e.target.value)}><option value="">Not set</option>{refs.sessions.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
          {ended && <><label className="text-xs text-zinc-400">End session<select className={INPUT} value={value.endSessionId} onChange={(e) => update("endSessionId", e.target.value)}><option value="">Not set</option>{refs.sessions.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
            <label className="text-xs text-zinc-400">End date<input type="date" className={INPUT} value={value.endDate} onChange={(e) => update("endDate", e.target.value)} /></label></>}
          <label className="text-xs text-zinc-400">Quest giver<select className={INPUT} value={value.giverId} onChange={(e) => update("giverId", e.target.value)}><option value="">Not set</option>{refs.npcs.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
          <label className="text-xs text-zinc-400">Quest receivers<select multiple className={INPUT} value={value.receiverIds} onChange={(e) => update("receiverIds", [...e.target.selectedOptions].map((option) => option.value))}>{refs.characters.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
        </div> : <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-300">
          {value.startSessionId && <span>Start: <RefLink id={value.startSessionId} rows={refs.sessions} to="/sessions" /></span>}
          {ended && value.endSessionId && <span>End: <RefLink id={value.endSessionId} rows={refs.sessions} to="/sessions" /></span>}
          {ended && value.endDate && <span>Ended: {value.endDate}</span>}
          {value.giverId && <span>Giver: <RefLink id={value.giverId} rows={refs.npcs} to="/npcs" /></span>}
          {value.receiverIds?.map((receiverId) => <span key={receiverId}>Receiver: <RefLink id={receiverId} rows={refs.characters} to="/pcs" /></span>)}
        </div>}
        <div className="mt-4"><Progress value={value.progress} />{editing && <label className="mt-2 block text-xs text-zinc-400">Set progress<input aria-label="Set progress" type="range" min="0" max="100" value={value.progress} onChange={(e) => update("progress", Number(e.target.value))} className="w-full accent-violet-500" /></label>}</div>
      </header>
      <div className="grid min-w-0 gap-5 lg:grid-cols-2"><div className="min-w-0 space-y-4">{SECTIONS.filter(([field]) => field !== "aftermath").map(([field, title]) =>
        editing || value[field] ? <section key={field} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold text-white">{title}</h2>{!editing && isGM && <Visibility value={value.sectionVisibility[field]} />}</div>
          {editing ? <div className="mt-3 space-y-2"><Visibility value={value.sectionVisibility[field]} onChange={(next) => update("sectionVisibility", { ...value.sectionVisibility, [field]: next })} /><textarea className={INPUT} rows={field === "shortDescription" ? 3 : 6} value={value[field]} onChange={(e) => update(field, e.target.value)} /></div> : <MarkdownContent content={value[field]} />}</section> : null
      )}</div><div className="min-w-0 space-y-4"><ObjectiveList title="Main objectives" field="mainObjectives" quest={value} editing={editing} update={update} isGM={isGM} /><ObjectiveList title="Secondary / bonus objectives" field="secondaryObjectives" quest={value} editing={editing} update={update} isGM={isGM} /></div></div>
      {(editing || value.aftermath) && <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><h2 className="font-semibold text-white">Aftermath</h2>{editing ? <div className="mt-3 space-y-2"><Visibility value={value.sectionVisibility.aftermath} onChange={(next) => update("sectionVisibility", { ...value.sectionVisibility, aftermath: next })} /><textarea className={INPUT} rows={5} value={value.aftermath} onChange={(e) => update("aftermath", e.target.value)} /></div> : <MarkdownContent content={value.aftermath} />}</section>}
      {!isNew && <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><h2 className="font-semibold text-white">Relationships</h2>
        <div className="mt-3 space-y-2">{links.map((link) => {
          const other = link.entityA.type === "Quest" ? link.entityB : link.entityA;
          const target = RELATED.find((entry) => entry.type === other.type);
          const row = refs[target?.key]?.find((entry) => entry.id === other.id);
          if (!target || !row) return null;
          return <div key={link.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm">
            <span className="min-w-0 break-words text-zinc-300">{link.label.replaceAll("_", " ")} · <RefLink id={other.id} rows={refs[target.key]} to={target.path} />{isGM ? ` · ${link.visibility}` : ""}</span>
            {isGM && !["started", "completed", "failed", "given_by", "assigned_to"].includes(link.label) && <button type="button" className={BUTTON} disabled={linkSaving} onClick={() => void deleteRelationship(link.id)}>Remove link</button>}
          </div>;
        })}{links.length === 0 && <p className="text-sm text-zinc-400">No relationships yet.</p>}</div>
        {isGM && !editing && <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-zinc-400">Entity<select className={INPUT} value={linkType} onChange={(e) => { const nextType = e.target.value; setLinkType(nextType); setLinkId(""); setLinkLabel(getAllowedLabelsForPair("Quest", nextType).filter((label) => !["started", "completed", "failed", "given_by", "assigned_to"].includes(label))[0] || ""); }}>{RELATED.map((entry) => <option key={entry.type} value={entry.type}>{entry.type === "Map" ? "Location" : entry.type}</option>)}</select></label>
          <label className="text-xs text-zinc-400">Target<select className={INPUT} value={linkId} onChange={(e) => setLinkId(e.target.value)}><option value="">Select</option>{refs[related?.key]?.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
          <label className="text-xs text-zinc-400">Relationship<select className={INPUT} value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)}>{availableLabels.map((label) => <option key={label} value={label}>{label.replaceAll("_", " ")}</option>)}</select></label>
          <label className="text-xs text-zinc-400">Visibility<select className={INPUT} value={linkVisibility} onChange={(e) => setLinkVisibility(e.target.value)}><option value="GM">GM-only</option><option value="Player">Player-visible</option></select></label>
          <button type="button" className={BUTTON} disabled={!linkId || linkSaving} onClick={() => void addRelationship()}>{linkSaving ? "Saving link..." : "Add relationship"}</button>
        </div>}
        {linkError && <p role="alert" className="mt-3 text-sm text-red-200">{linkError}</p>}
      </section>}
      {editing && <div className="space-y-3">{saveError && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{saveError}</p>}
        <div className="flex flex-wrap gap-2"><button className={BUTTON} type="submit" disabled={saving}>{saving ? "Saving..." : "Save quest"}</button><button className={BUTTON} type="button" disabled={saving} onClick={() => { if (isNew) navigate("/quests"); else { setDraft(null); setEditing(false); setSaveError(""); } }}>Cancel</button></div></div>}
    </form>
  </main>;
}
