import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { questsRepo } from "../data/quests/quests.repo";
import { createLink } from "../domain/links/link.service";
import { getAllowedLabelsForPair } from "../domain/links/link.rules";
import { editableProfileLinks, isManagedQuestLabel, isManagedQuestLink } from "../domain/links/questManagedLinks";
import { useMode } from "../context/ModeContext.jsx";

const STYLES = {
  Session: { section: "rounded-xl border border-white/10 bg-white/5 p-4 sm:p-5", heading: "text-lg font-semibold text-white" },
  NPC: { section: "rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm", heading: "text-sm font-semibold uppercase tracking-wide text-zinc-300" },
  Item: { section: "rounded-2xl border border-white/10 bg-white/5 p-5", heading: "text-lg font-semibold text-white" },
  Map: { section: "rounded-2xl border border-white/10 bg-white/[0.04] p-5", heading: "text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400" },
};
const labelFor = (label) => ({ started: "start session", given_by: "quest giver", leads_to: "destination" })[label] || label.replaceAll("_", " ");

function questIdFor(link, entityType, entityId) {
  const a = link.entityA, b = link.entityB;
  return a.type === "Quest" && b.type === entityType && String(b.id) === String(entityId) ? String(a.id)
    : b.type === "Quest" && a.type === entityType && String(a.id) === String(entityId) ? String(b.id) : "";
}

export function QuestReciprocalLinks({ campaignId, entityType, entityId, links = [], managedLinks = [], isEditing = false, isSaving = false, onLinksChanged }) {
  const { isGM } = useMode();
  const [loaded, setLoaded] = useState({ scope: "", quests: [] });
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedLabel, setSelectedLabel] = useState("related");
  const [selectedVisibility, setSelectedVisibility] = useState(entityType === "Session" ? "Player" : "GM");
  const scope = `${campaignId}:${entityType}:${entityId}:${isGM}`;
  const quests = loaded.scope === scope ? loaded.quests : [];
  const allowedLabels = getAllowedLabelsForPair(entityType, "Quest").filter((label) => !isManagedQuestLabel(label));
  const editableLinks = editableProfileLinks(links);
  const displayLinks = isEditing
    ? [...editableLinks, ...managedLinks.filter((link) => isManagedQuestLink(link) && !editableLinks.some((draftLink) => draftLink.id === link.id))]
    : links;

  useEffect(() => {
    let active = true;
    if (!campaignId || !entityId) return;
    questsRepo.all(campaignId).then((result) => {
      if (active) setLoaded({ scope, quests: result.quests || [] });
    }).catch(() => { if (active) setLoaded({ scope, quests: [] }); });
    return () => { active = false; };
  }, [campaignId, entityType, entityId, isGM, scope]);

  const visible = new Map(quests.map((quest) => [String(quest.id), quest]));
  const grouped = new Map();
  for (const link of displayLinks) {
    const questId = questIdFor(link, entityType, entityId);
    const quest = visible.get(questId);
    if (!quest || (!isGM && link.visibility !== "Player")) continue;
    const entry = grouped.get(questId) || { quest, links: [] };
    entry.links.push(link);
    grouped.set(questId, entry);
  }
  const rows = [...grouped.values()];
  const candidates = quests.filter((quest) => {
    if (!String(quest.name || "").toLowerCase().includes(query.trim().toLowerCase())) return false;
    return !editableLinks.some((link) => questIdFor(link, entityType, entityId) === String(quest.id) && link.label === selectedLabel);
  }).slice(0, 30);

  function addQuest(quest) {
    if (!isGM || !isEditing || isSaving || !onLinksChanged || !allowedLabels.includes(selectedLabel)) return;
    if (editableLinks.some((link) => questIdFor(link, entityType, entityId) === String(quest.id) && link.label === selectedLabel)) return;
    const link = createLink({ entityA: { type: entityType, id: String(entityId) }, entityB: { type: "Quest", id: String(quest.id) }, label: selectedLabel, visibility: selectedVisibility });
    onLinksChanged([...editableLinks, link]);
    setQuery("");
    setSearchOpen(false);
  }

  function changeLink(link, changes) {
    if (!isGM || !isEditing || isSaving || isManagedQuestLink(link)) return;
    if (changes.label && !allowedLabels.includes(changes.label)) return;
    onLinksChanged(editableLinks.map((candidate) => candidate.id === link.id ? { ...candidate, ...changes } : candidate));
  }

  const style = STYLES[entityType] || STYLES.Map;
  return <section className={`min-w-0 ${style.section}`}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className={style.heading}>Quests</h2>
      {isGM && isEditing && <button type="button" disabled={isSaving} onClick={() => setSearchOpen((open) => !open)} className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-300 disabled:opacity-50">Add Quest</button>}
    </div>
    {isGM && isEditing && searchOpen && <div className="mt-4 rounded-xl border border-white/10 bg-black/15 p-3">
      <div className="flex flex-wrap gap-2">
        <label className="min-w-[10rem] flex-1 text-xs text-zinc-300">Relationship
          <select aria-label="Quest relationship" value={selectedLabel} onChange={(event) => setSelectedLabel(event.target.value)} disabled={isSaving} className="mt-1 w-full rounded-lg border border-white/15 bg-zinc-900 p-2 text-sm text-white">{allowedLabels.map((label) => <option key={label} value={label}>{labelFor(label)}</option>)}</select>
        </label>
        <label className="min-w-[9rem] flex-1 text-xs text-zinc-300">Visibility
          <select aria-label="Quest link visibility" value={selectedVisibility} onChange={(event) => setSelectedVisibility(event.target.value)} disabled={isSaving} className="mt-1 w-full rounded-lg border border-white/15 bg-zinc-900 p-2 text-sm text-white"><option value="GM">GM-only</option><option value="Player">Player-visible</option></select>
        </label>
      </div>
      <input type="search" aria-label="Search quests" placeholder="Search quests..." value={query} onChange={(event) => setQuery(event.target.value)} disabled={isSaving} className="mt-3 w-full rounded-lg border border-white/15 bg-zinc-900 p-2 text-sm text-white" />
      <div className="mt-2 max-h-48 space-y-1 overflow-auto">{candidates.map((quest) => <button key={quest.id} type="button" disabled={isSaving} onClick={() => addQuest(quest)} className="block w-full rounded-lg px-2 py-1.5 text-left text-sm text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-300 disabled:opacity-50">{quest.name}</button>)}{!candidates.length && <p className="text-sm text-zinc-500">No available quests.</p>}</div>
    </div>}
    {rows.length ? <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">{rows.map(({ links: questLinks, quest }) => <div key={quest.id} className="min-w-0 rounded-xl border border-white/10 bg-black/15 p-4">
      <Link className="block max-w-full break-words text-sm font-semibold text-white hover:text-purple-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300" to={`/quests/${encodeURIComponent(quest.id)}`}>{quest.name}</Link>
      <div className="mt-3 flex flex-wrap items-center gap-2">{questLinks.map((link) => <React.Fragment key={link.id}>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-300">{labelFor(link.label)}</span>
        {isGM && <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${link.visibility === "Player" ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300" : "border-red-500/40 bg-red-500/20 text-red-300"}`}>{link.visibility === "Player" ? "Player-visible" : "GM-only"}</span>}
        {isGM && isEditing && !isManagedQuestLink(link) && <div className="flex flex-wrap items-center gap-2">
          <select aria-label={`Relationship for ${quest.name}`} value={link.label} onChange={(event) => changeLink(link, { label: event.target.value })} disabled={isSaving} className="rounded-lg border border-white/15 bg-zinc-900 p-1 text-xs text-white">{allowedLabels.map((label) => <option key={label} value={label}>{labelFor(label)}</option>)}</select>
          <select aria-label={`Visibility for ${quest.name}`} value={link.visibility} onChange={(event) => changeLink(link, { visibility: event.target.value })} disabled={isSaving} className="rounded-lg border border-white/15 bg-zinc-900 p-1 text-xs text-white"><option value="GM">GM-only</option><option value="Player">Player-visible</option></select>
          <button type="button" disabled={isSaving} onClick={() => onLinksChanged(editableLinks.filter((candidate) => candidate.id !== link.id))} className="rounded-lg border border-red-500/25 px-2 py-1 text-xs text-red-200 hover:bg-red-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-300 disabled:opacity-50" aria-label={`Remove ${labelFor(link.label)} Quest link to ${quest.name}`}>Remove</button>
        </div>}
      </React.Fragment>)}</div>
    </div>)}</div> : <p className="mt-3 text-sm text-zinc-500">No linked quests yet.</p>}
  </section>;
}
