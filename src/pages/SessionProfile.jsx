import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Users, Clock, Map, Trash2 } from "lucide-react";
import { useMode } from "../context/ModeContext.jsx";
import { sessionsRepo } from "../data/sessions/sessions.repo";
import { itemsRepo } from "../data/items/items.repo";
import SessionEntityLinkManager from "../components/session/SessionEntityLinkManager.jsx";
import { useCampaign } from "../context/CampaignContext";
export default function SessionProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isGM } = useMode();

  const { selectedCampaignId } = useCampaign();
  const [allSessions, setAllSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allItems, setAllItems] = useState([]);

  useEffect(() => {
    if (!selectedCampaignId) {
      setAllSessions([]);
      setAllItems([]);
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      try {
        const [sessionData, itemData] = await Promise.all([
          sessionsRepo.getAll(selectedCampaignId),
          itemsRepo.getAll(selectedCampaignId),
        ]);
        setAllSessions(Array.isArray(sessionData) ? sessionData : []);
        setAllItems(Array.isArray(itemData) ? itemData : []);
      } catch (error) {
        console.error("[SessionProfile] Failed to load session data", error);
        setAllSessions([]);
        setAllItems([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [selectedCampaignId]);
  const session = useMemo(
    () => allSessions.find((s) => String(s.id) === String(id)),
    [allSessions, id]
  );

  const normalizedSession = useMemo(() => {
    if (!session) return null;
    const summary = session.summary ?? "";
    return {
      ...session,
      summary,
      timeline: session.timeline ?? "",
      moments: session.moments ?? "",
      quotes: session.quotes ?? "",
      gmNotes: session.gmNotes ?? "",
      gmSecrets: session.gmSecrets ?? "",
      gmPrep: Array.isArray(session.gmPrep) ? session.gmPrep : [],
    };
  }, [session]);

  const [editMode, setEditMode] = useState(false);
  const [editableSession, setEditableSession] = useState(() =>
    normalizedSession ? { ...normalizedSession } : null
  );

  useEffect(() => {
    if (normalizedSession) setEditableSession({ ...normalizedSession });
  }, [normalizedSession]);

  const normalizedEditable = useMemo(() => {
    if (!editableSession) return null;
    const summary = editableSession.summary ?? "";
    return {
      ...editableSession,
      summary,
      timeline: editableSession.timeline ?? "",
      moments: editableSession.moments ?? "",
      quotes: editableSession.quotes ?? "",
      gmNotes: editableSession.gmNotes ?? "",
      gmSecrets: editableSession.gmSecrets ?? "",
      gmPrep: Array.isArray(editableSession.gmPrep) ? editableSession.gmPrep : [],
    };
  }, [editableSession]);

  const [gmPrepText, setGmPrepText] = useState("");
  useEffect(() => {
    if (!normalizedSession) return;
    setGmPrepText(normalizedSession.gmPrep.join("\n"));
  }, [normalizedSession]);

  if (loading) {
    return (
      <main className="flex-1 overflow-auto flex items-center justify-center">
        <div className="text-zinc-400">Loading session...</div>
      </main>
    );
  }
  // No such session at all
  if (!normalizedSession) {
    return (
      <main className="flex-1 overflow-auto text-white">
        <h1 className="text-3xl font-bold">Session Not Found</h1>
        <p className="text-zinc-400 mt-2">
          There is no session with this ID.
        </p>
        <button
          onClick={() => navigate("/sessions")}
          className="mt-4 px-4 py-2 bg-white/10 rounded-xl text-zinc-300 hover:bg-white/20"
        >
          Back to Sessions
        </button>
      </main>
    );
  }

  // GM restriction guard: prevent players from viewing GM-only sessions
  if (normalizedSession?.visibility === "gm-only" && !isGM) {
    return (
      <main className="flex-1 overflow-auto">
        <button
          className="flex items-center gap-2 text-zinc-400 hover:text-white mb-4 sm:mb-6"
          onClick={() => navigate("/sessions")}
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Sessions
        </button>
        <div className="max-w-xl mx-auto bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">DM Eyes Only</h1>
          <p className="text-zinc-400 text-sm mb-4">
            This session is marked GM-only. Players don’t get to see it until it’s revealed in play. 💜
          </p>
          <button
            className="mt-2 px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20"
            onClick={() => navigate("/sessions")}
          >
            Back to Sessions
          </button>
        </div>
      </main>
    );
  }

  const viewSession = editMode ? (normalizedEditable ?? normalizedSession) : normalizedSession;
  const isGmOnlyCurrent = viewSession?.visibility === "gm-only";

  const handleFieldChange = (field, value) => {
    setEditableSession((prev) => {
      const base = prev ?? (normalizedSession ? { ...normalizedSession } : {});
      return { ...base, [field]: value };
    });
  };

  const handleVisibilityChange = (visibility) => {
    if (!isGM || !editMode) return;
    setEditableSession((prev) => ({
      ...prev,
      visibility,
    }));
  };
  return (
    <main className="flex-1 overflow-auto">
      <button
        className="flex items-center gap-2 text-zinc-400 hover:text-white mb-4 sm:mb-6"
        onClick={() => navigate("/sessions")}
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Sessions
      </button>

      <div className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-8 backdrop-blur-sm space-y-5 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white flex flex-wrap items-center gap-2">
              {viewSession?.name || "Untitled session"}
              {isGmOnlyCurrent && (
                <span className="px-2 py-1 text-[10px] rounded-full bg-red-500/20 text-red-300 border border-red-500/40">
                  GM ONLY
                </span>
              )}
            </h1>
            <p className="text-zinc-400 text-sm">
              {viewSession?.map || ""}
              {viewSession.sessionNumber && (
                <> • Session #{viewSession.sessionNumber}</>
              )}
              {viewSession.startTime && <> • {viewSession.startTime}</>}
            </p>
          </div>

          {isGM && (
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 self-start">
              <div className="flex flex-wrap items-center gap-1 bg-white/5 border border-white/10 rounded-full p-1">
                <button
                  type="button"
                  disabled={!editMode}
                  onClick={() => handleVisibilityChange("public")}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${viewSession.visibility === "public"
                    ? "bg-emerald-500 text-white"
                    : "text-zinc-300 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-zinc-400"
                    }`}
                >
                  Player-visible
                </button>
                <button
                  type="button"
                  disabled={!editMode}
                  onClick={() => handleVisibilityChange("gm-only")}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${viewSession.visibility === "gm-only"
                    ? "bg-red-500 text-white"
                    : "text-zinc-300 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-zinc-400"
                    }`}
                >
                  GM-only
                </button>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (editMode && normalizedEditable) {
                    const gmPrep = gmPrepText
                      .split("\n")
                      .map((l) => l.trim())
                      .filter(Boolean);

                    const toSave = {
                      ...normalizedEditable,
                      summary: normalizedEditable.summary,
                      timeline: normalizedEditable.timeline ?? "",
                      moments: normalizedEditable.moments ?? "",
                      quotes: normalizedEditable.quotes ?? "",
                      gmPrep,
                    };

                    await sessionsRepo.upsert(selectedCampaignId, toSave);
                    const data = await sessionsRepo.getAll(selectedCampaignId);
                    setAllSessions(data);
                  }

                  setEditMode((prev) => !prev);
                }}
                className="px-3 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-zinc-300 hover:bg-white/10 transition"
              >
                {editMode ? "Done" : "Edit"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const ok = window.confirm("Delete this session? This cannot be undone.");
                  if (!ok) return;

                  await sessionsRepo.remove(selectedCampaignId, String(id));
                  navigate("/sessions");
                }}
                className="px-3 py-1.5 rounded-xl bg-red-500/15 border border-red-500/40 text-xs text-red-200 hover:bg-red-500/25 transition flex items-center gap-2"
                title="Delete session"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          )}
        </div>

        {/* Player & GM layout */}
        <div className={`grid grid-cols-1 ${isGM ? "lg:grid-cols-2" : ""} gap-4 sm:gap-6 pt-2`}>
          {/* LEFT: Player overview */}
          <div className="space-y-4">
            {/* Recap */}
            <div className="bg-white/5 rounded-xl border border-white/10 p-4 sm:p-5">
              <h2 className="text-lg font-semibold text-white mb-2">Session recap</h2>
              {isGM && editMode ? (
                <textarea
                  className="w-full bg-transparent border border-white/15 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-500/60"
                  rows={4}
                  value={editableSession?.summary ?? ""}
                  onChange={(e) => handleFieldChange("summary", e.target.value)}
                />
              ) : (
                <p className="text-zinc-300 text-sm whitespace-pre-line">{viewSession?.summary || ""}</p>
              )}
            </div>

            {/* Linked entities (Session cross-links) */}

            {/* Attendance */}
            <div className="bg-white/5 rounded-xl border border-white/10 p-4 sm:p-5">
              <h2 className="text-lg font-semibold text-white mb-2">Attendance</h2>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-zinc-500" />
                  <div>
                    <p className="text-zinc-400 text-xs uppercase tracking-wide">Players present</p>
                    {isGM && editMode ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          className="w-16 bg-transparent border border-white/15 rounded-lg px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-purple-500/60"
                          value={editableSession.players}
                          onChange={(e) => handleFieldChange("players", Number(e.target.value) || 0)}
                        />
                        <span className="text-zinc-400 text-sm">/</span>
                        <input
                          type="number"
                          min={0}
                          className="w-16 bg-transparent border border-white/15 rounded-lg px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-purple-500/60"
                          value={editableSession.maxPlayers}
                          onChange={(e) => handleFieldChange("maxPlayers", Number(e.target.value) || 0)}
                        />
                      </div>
                    ) : (
                      <p className="text-white font-semibold text-lg">
                        {Number(viewSession?.players) || 0} / {Number(viewSession?.maxPlayers) || 0}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Items discovered, Notable NPCs, timeline, Moments, Quotes, NPC relationships */}
            {/* Items discovered (player-visible) */}
            {/* Items (player-visible) */}
            <SessionEntityLinkManager
              sessionId={String(id)}
              entityType="Item"
              label="introduced"
              sectionTitle="Items discovered"
              isGM={isGM}
              editMode={editMode}
              visibilityMode={isGM ? "GM" : "Player"}
              dataSource={allItems}
              getEntityLabel={(item) => item?.name}
              onAddNew={() => navigate("/items")}
              renderCard={(item, link, helpers) => {
                const { isGM, editMode, navigate, handleRemove } = helpers;

                return (
                  <div
                    key={link.id}
                    className="relative group bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 transition flex flex-col justify-between"
                  >
                    {isGM && editMode && (
                      <button
                        type="button"
                        onClick={() => handleRemove(link.id)}
                        className="absolute top-2 right-2 text-[10px] text-red-400 hover:text-red-200 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Remove
                      </button>
                    )}

                    <div
                      role="button"
                      onClick={() => navigate(`/items/${item.id}`)}
                      className="cursor-pointer"
                    >
                      <p className="text-white font-semibold text-sm">{item?.name || "Untitled item"}</p>
                      {item?.rarity && (
                        <p className="text-zinc-400 text-xs mt-1">{item.rarity}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-end mt-3">
                      {isGM && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full ${link.visibility === "GM"
                            ? "bg-red-500/20 text-red-300 border border-red-500/40"
                            : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            }`}
                        >
                          {link.visibility}
                        </span>
                      )}
                    </div>
                  </div>
                );
              }}
            />

            {/* Session timeline */}
            {(editMode || (viewSession?.timeline && viewSession.timeline.trim().length > 0)) && (
              <div className="bg-white/5 rounded-xl border border-white/10 p-4 sm:p-5">
                <h2 className="text-lg font-semibold text-white mb-2">Session timeline</h2>

                {isGM && editMode ? (
                  <textarea
                    className="w-full bg-transparent border border-white/15 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-500/60"
                    rows={3}
                    value={editableSession?.timeline ?? ""}
                    onChange={(e) => handleFieldChange("timeline", e.target.value)}
                    placeholder="Key beats in order…"
                  />
                ) : (
                  <p className="text-zinc-300 text-sm whitespace-pre-line">
                    {viewSession?.timeline || ""}
                  </p>
                )}
              </div>
            )}

            {/* Moments */}
            {(editMode || (viewSession?.moments && viewSession.moments.trim().length > 0)) && (
              <div className="bg-white/5 rounded-xl border border-white/10 p-4 sm:p-5">
                <h2 className="text-lg font-semibold text-white mb-2">Moments</h2>

                {isGM && editMode ? (
                  <textarea
                    className="w-full bg-transparent border border-white/15 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-500/60"
                    rows={3}
                    value={editableSession?.moments ?? ""}
                    onChange={(e) => handleFieldChange("moments", e.target.value)}
                    placeholder="Cinematic highlights, emotional gut-punches…"
                  />
                ) : (
                  <p className="text-zinc-300 text-sm whitespace-pre-line">
                    {viewSession?.moments || ""}
                  </p>
                )}
              </div>
            )}

            {/* Quotes of the day */}
            {(editMode || (viewSession?.quotes && viewSession.quotes.trim().length > 0)) && (
              <div className="bg-white/5 rounded-xl border border-white/10 p-4 sm:p-5">
                <h2 className="text-lg font-semibold text-white mb-2">Quotes of the day</h2>

                {isGM && editMode ? (
                  <textarea
                    className="w-full bg-transparent border border-white/15 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-500/60"
                    rows={3}
                    value={editableSession?.quotes ?? ""}
                    onChange={(e) => handleFieldChange("quotes", e.target.value)}
                    placeholder="Best one-liners, table memes…"
                  />
                ) : (
                  <p className="text-zinc-300 text-sm whitespace-pre-line">
                    {viewSession?.quotes || ""}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: GM-only zone */}
          {isGM && (
            <div className="space-y-4">
              {/* Off-screen events / GM notes / secrets */}
              <div className="bg-white/5 rounded-xl border border-purple-500/40 p-4 sm:p-5">
                <h2 className="text-lg font-semibold text-purple-200 mb-2">
                  Off-screen events & GM notes
                </h2>
                {isGM && editMode ? (
                  <textarea
                    className="w-full bg-transparent border border-purple-500/40 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-400/80"
                    rows={3}
                    value={editableSession.gmNotes}
                    onChange={(e) => handleFieldChange("gmNotes", e.target.value)}
                  />
                ) : (
                  <p className="text-zinc-300 text-sm mb-3">
                    {viewSession.gmNotes}
                  </p>
                )}
                {isGM && editMode ? (
                  <textarea
                    className="mt-3 w-full bg-transparent border border-purple-500/25 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-400/80"
                    rows={3}
                    value={editableSession.gmSecrets}
                    onChange={(e) => handleFieldChange("gmSecrets", e.target.value)}
                  />
                ) : (
                  <p className="text-zinc-400 text-sm mb-3">
                    <span className="font-semibold text-purple-200">
                      Secrets &amp; twists:
                    </span>{" "}
                    {viewSession.gmSecrets}
                  </p>
                )}
                {isGM && editMode ? (
                  <div className="mt-3">
                    <p className="text-zinc-500 text-xs mb-1 uppercase tracking-wide">
                      Prep notes
                    </p>
                    <textarea
                      className="w-full bg-transparent border border-purple-500/25 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-400/80"
                      rows={3}
                      value={gmPrepText}
                      onChange={(e) => setGmPrepText(e.target.value)}
                    />
                  </div>
                ) : (
                  viewSession.gmPrep &&
                  viewSession.gmPrep.length > 0 && (
                    <div className="mt-3">
                      <p className="text-zinc-500 text-xs mb-1 uppercase tracking-wide">
                        Prep notes
                      </p>
                      <ul className="list-disc list-inside text-zinc-400 text-sm space-y-1">
                        {viewSession.gmPrep.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* Metadata strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 text-sm text-zinc-400 pt-2">
          <div className="flex items-center gap-3">
            <Users className="w-4 h-4 text-zinc-500" />
            <span>{Number(viewSession?.players) || 0} active players in this session.</span>
          </div>
          <div className="flex items-center gap-3">
            <Map className="w-4 h-4 text-zinc-500" />
            <span>Map: {viewSession?.map || ""}</span>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-zinc-500" />
            <span>
              Status: {viewSession?.status || "—"} • Duration: {viewSession?.duration || "—"} •
              Visibility: {isGmOnlyCurrent ? "GM-only" : "Player-visible"}
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}