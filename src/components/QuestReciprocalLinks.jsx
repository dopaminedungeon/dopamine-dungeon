import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { questsRepo } from "../data/quests/quests.repo";
import { loadLinks } from "../data/links/links.repo";
import { useMode } from "../context/ModeContext.jsx";

export function QuestReciprocalLinks({ campaignId, entityType, entityId }) {
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
  return <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
    <h2 className="font-semibold text-white">Related quests</h2>
    <div className="mt-2 space-y-2">{rows.map(({ link, quest }) => <div key={link.id} className="min-w-0 text-sm text-zinc-300">
      <span className="capitalize">{link.label.replaceAll("_", " ")}</span> · <Link className="break-words text-violet-200 hover:underline" to={`/quests/${encodeURIComponent(quest.id)}`}>{quest.name}</Link>
    </div>)}</div>
  </section>;
}
