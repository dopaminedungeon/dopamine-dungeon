import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { questsRepo } from "../data/quests/quests.repo";
import { loadLinks } from "../data/links/links.repo";
import { useMode } from "../context/ModeContext.jsx";

export function QuestReciprocalLinks({ campaignId, entityType, entityId, locationLayout = false }) {
  const { isGM } = useMode();
  const [loaded, setLoaded] = useState({ scope: "", rows: [] });
  const scope = `${campaignId}:${entityType}:${entityId}:${isGM}`;
  const rows = loaded.scope === scope ? loaded.rows : [];
  useEffect(() => {
    let active = true;
    if (!campaignId || !entityId) return;
    Promise.all([questsRepo.all(campaignId), loadLinks(campaignId)]).then(([result, links]) => {
      if (!active) return;
      const visible = new Map(result.quests.map((quest) => [quest.id, quest]));
      setLoaded({ scope, rows: links.flatMap((link) => {
        const a = link.entityA, b = link.entityB;
        const questId = a.type === "Quest" && b.type === entityType && b.id === entityId ? a.id
          : b.type === "Quest" && a.type === entityType && a.id === entityId ? b.id : "";
        const quest = visible.get(questId);
        return quest ? [{ link, quest }] : [];
      }) });
    }).catch(() => { if (active) setLoaded({ scope, rows: [] }); });
    return () => { active = false; };
  }, [campaignId, entityType, entityId, isGM, scope]);
  if (!rows.length) return null;
  if (locationLayout) return <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
    <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Related quests</h2>
    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">{rows.map(({ link, quest }) => <div key={link.id} className="min-w-0 rounded-xl border border-white/10 bg-black/15 p-4">
      <Link className="block max-w-full break-words text-sm font-semibold text-white hover:text-purple-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300" to={`/quests/${encodeURIComponent(quest.id)}`}>{quest.name}</Link>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-300">{link.label.replaceAll("_", " ")}</span>
        {isGM && <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${link.visibility === "Player" ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300" : "border-red-500/40 bg-red-500/20 text-red-300"}`}>{link.visibility === "Player" ? "Player-visible" : "GM-only"}</span>}
      </div>
    </div>)}</div>
  </section>;
  return <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
    <h2 className="font-semibold text-white">Related quests</h2>
    <div className="mt-2 space-y-2">{rows.map(({ link, quest }) => <div key={link.id} className="min-w-0 text-sm text-zinc-300">
      <span className="capitalize">{link.label.replaceAll("_", " ")}</span> · <Link className="break-words text-violet-200 hover:underline" to={`/quests/${encodeURIComponent(quest.id)}`}>{quest.name}</Link>
    </div>)}</div>
  </section>;
}
